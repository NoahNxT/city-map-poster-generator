package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"city-map-poster-generator/apps/api/internal/captcha"
	"city-map-poster-generator/apps/api/internal/config"
	"city-map-poster-generator/apps/api/internal/fonts"
	"city-map-poster-generator/apps/api/internal/jobs"
	"city-map-poster-generator/apps/api/internal/queue"
	"city-map-poster-generator/apps/api/internal/render"
	"city-map-poster-generator/apps/api/internal/state"
	"city-map-poster-generator/apps/api/internal/storage"
	"city-map-poster-generator/apps/api/internal/themes"
	"city-map-poster-generator/apps/api/internal/types"
	"city-map-poster-generator/apps/api/internal/util"
	"city-map-poster-generator/apps/api/internal/validation"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Server struct {
	cfg       config.Config
	store     *state.Store
	storage   *storage.Client
	renderer  *render.Renderer
	geocoder  interface {
		Search(ctx context.Context, query string, limit int) ([]types.LocationSuggestion, error)
	}
	fontsSvc  *fonts.Service
	captcha   *captcha.Verifier
	queue     *queue.RedisQueue
	processor *jobs.Processor
	themes    []types.Theme
	themeSet  map[string]struct{}
}

func New(cfg config.Config, store *state.Store, storageClient *storage.Client, renderer *render.Renderer, geocoder interface {
	Search(ctx context.Context, query string, limit int) ([]types.LocationSuggestion, error)
}, fontsSvc *fonts.Service, captchaVerifier *captcha.Verifier, queue *queue.RedisQueue, processor *jobs.Processor) (*Server, error) {
	themeList, err := themes.LoadThemes(cfg.AssetsDir)
	if err != nil {
		return nil, err
	}
	return &Server{
		cfg:       cfg,
		store:     store,
		storage:   storageClient,
		renderer:  renderer,
		geocoder:  geocoder,
		fontsSvc:  fontsSvc,
		captcha:   captchaVerifier,
		queue:     queue,
		processor: processor,
		themes:    themeList,
		themeSet:  themes.ThemeIDSet(themeList),
	}, nil
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(corsMiddleware)
	r.Get("/health", s.handleHealth)
	r.Get("/v2/themes", s.handleThemes)
	r.Get("/v2/locations", s.handleLocations)
	r.Get("/v2/fonts", s.handleFonts)
	r.Post("/v2/preview", s.handlePreview)
	r.Post("/v2/jobs", s.handleCreateJob)
	r.Get("/v2/jobs/{jobId}", s.handleJobStatus)
	r.Get("/v2/jobs/{jobId}/download", s.handleDownload)
	return r
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "api",
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleThemes(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"themes": s.themes})
}

func (s *Server) handleLocations(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	limit := parseQueryInt(r, "limit", 8)
	if len(query) < 2 {
		writeJSON(w, http.StatusOK, map[string]any{"suggestions": []types.LocationSuggestion{}})
		return
	}
	if !s.shouldBypassRateLimit(r) {
		if err := s.enforceWindowLimit(r.Context(), fmt.Sprintf("ratelimit:locations:%s", clientIP(r)), s.cfg.RateLimitLocationsCount, s.cfg.RateLimitLocationsWindowSec); err != nil {
			writeError(w, http.StatusTooManyRequests, err.Error())
			return
		}
	}
	suggestions, err := s.geocoder.Search(r.Context(), query, limit)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"suggestions": suggestions})
}

func (s *Server) handleFonts(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	limit := parseQueryInt(r, "limit", 12)
	if !s.shouldBypassRateLimit(r) {
		if err := s.enforceWindowLimit(r.Context(), fmt.Sprintf("ratelimit:fonts:%s", clientIP(r)), s.cfg.RateLimitFontsCount, s.cfg.RateLimitFontsWindowSec); err != nil {
			writeError(w, http.StatusTooManyRequests, err.Error())
			return
		}
	}
	suggestions, err := s.fontsSvc.Search(r.Context(), query, limit)
	if err != nil {
		log.Printf("font search fallback: %v", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"suggestions": suggestions})
}

func (s *Server) handlePreview(w http.ResponseWriter, r *http.Request) {
	var payload types.GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	payload.Format = types.OutputPNG
	payload.AllThemes = false
	if err := validation.ValidateGenerateRequest(&payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if _, ok := s.themeSet[payload.Theme]; !ok {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Unknown theme: %s", payload.Theme))
		return
	}

	if !s.shouldBypassRateLimit(r) {
		if err := s.enforceWindowLimit(r.Context(), fmt.Sprintf("ratelimit:preview:%s", clientIP(r)), s.cfg.RateLimitPreviewCount, s.cfg.RateLimitPreviewWindowSec); err != nil {
			writeError(w, http.StatusTooManyRequests, err.Error())
			return
		}
	}

	cacheKey, err := util.PreviewCacheKey(payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	cachedObjectKey, err := s.store.GetPreviewCache(r.Context(), cacheKey)
	if err == nil && cachedObjectKey != "" && s.storage.ObjectExists(r.Context(), s.cfg.S3BucketPreviews, cachedObjectKey) {
		url, err := s.storage.SignedURL(r.Context(), s.cfg.S3BucketPreviews, cachedObjectKey, s.cfg.PresignedURLTTLSeconds)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"previewUrl": url,
			"cacheHit":   true,
			"expiresAt":  time.Now().UTC().Add(time.Duration(s.cfg.PreviewTTLSeconds) * time.Second).Format(time.RFC3339),
		})
		return
	}

	lat, lon, err := s.processor.ResolveCoordinates(r.Context(), payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	result, err := s.renderer.Render(r.Context(), payload, lat, lon, render.RenderProfile{RasterDPI: s.cfg.PreviewRasterDPI})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	objectKey := fmt.Sprintf("preview/%s.png", strings.TrimPrefix(cacheKey, "preview:"))
	if err := s.storage.UploadReader(r.Context(), s.cfg.S3BucketPreviews, objectKey, bytesReader(result.Bytes), "image/png"); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.store.SetPreviewCache(r.Context(), cacheKey, objectKey, s.cfg.PreviewTTLSeconds)
	url, err := s.storage.SignedURL(r.Context(), s.cfg.S3BucketPreviews, objectKey, s.cfg.PresignedURLTTLSeconds)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"previewUrl": url,
		"cacheHit":   false,
		"expiresAt":  time.Now().UTC().Add(time.Duration(s.cfg.PreviewTTLSeconds) * time.Second).Format(time.RFC3339),
	})
}

func (s *Server) handleCreateJob(w http.ResponseWriter, r *http.Request) {
	var body types.CreateJobRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := validation.ValidateGenerateRequest(&body.Payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !body.Payload.AllThemes {
		if _, ok := s.themeSet[body.Payload.Theme]; !ok {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Unknown theme: %s", body.Payload.Theme))
			return
		}
	}

	ip := clientIP(r)
	if !s.shouldBypassRateLimit(r) {
		if err := s.enforceWindowLimit(r.Context(), fmt.Sprintf("ratelimit:jobs:%s", ip), s.cfg.RateLimitJobsCount, s.cfg.RateLimitJobsWindowSec); err != nil {
			writeError(w, http.StatusTooManyRequests, err.Error())
			return
		}
		if err := s.store.CheckConcurrencyLimit(r.Context(), fmt.Sprintf("ratelimit:active:%s", ip), s.cfg.RateLimitConcurrentPerIP); err != nil {
			writeError(w, http.StatusTooManyRequests, "Too many concurrent jobs from this IP. Try again after current jobs finish.")
			return
		}
	}
	if err := s.captcha.Verify(r.Context(), body.CaptchaToken, ip); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "missing") {
			status = http.StatusInternalServerError
		}
		writeError(w, status, err.Error())
		return
	}

	jobID := uuid.NewString()
	statePayload := types.NewJobState(jobID)
	if err := s.store.SaveJobState(r.Context(), statePayload, s.cfg.ArtifactTTLSeconds); err != nil {
		writeError(w, http.StatusServiceUnavailable, "Job queue unavailable. Start backend dependencies (redis/minio/worker) before generating.")
		return
	}
	activeKey := fmt.Sprintf("ratelimit:active:%s", ip)
	if err := s.store.AddActiveJob(r.Context(), activeKey, jobID); err != nil {
		writeError(w, http.StatusServiceUnavailable, "Job queue unavailable. Start backend dependencies (redis/minio/worker) before generating.")
		return
	}
	encoded, err := json.Marshal(body.Payload)
	if err != nil {
		s.store.RemoveActiveJob(r.Context(), activeKey, jobID)
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.queue.Enqueue(r.Context(), queue.JobEnvelope{JobID: jobID, ClientIP: ip, Payload: encoded}); err != nil {
		s.store.RemoveActiveJob(r.Context(), activeKey, jobID)
		writeError(w, http.StatusServiceUnavailable, "Job queue unavailable. Start backend dependencies (redis/minio/worker) before generating.")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"jobId":     jobID,
		"status":    types.JobQueued,
		"createdAt": statePayload.CreatedAt,
	})
}

func (s *Server) handleJobStatus(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobId")
	stateValue, err := s.store.GetJobState(r.Context(), jobID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stateValue == nil {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	writeJSON(w, http.StatusOK, stateValue)
}

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobId")
	stateValue, err := s.store.GetJobState(r.Context(), jobID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stateValue == nil {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	if stateValue.Status != types.JobComplete {
		writeError(w, http.StatusConflict, "Job is not complete")
		return
	}
	var key string
	if stateValue.ZipKey != nil {
		key = *stateValue.ZipKey
	} else if len(stateValue.Artifacts) == 1 {
		key = stateValue.Artifacts[0].Key
	} else {
		writeError(w, http.StatusConflict, "No downloadable artifact available")
		return
	}
	url, err := s.storage.SignedURL(r.Context(), s.cfg.S3BucketArtifacts, key, s.cfg.PresignedURLTTLSeconds)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"url":       url,
		"expiresAt": time.Now().UTC().Add(time.Duration(s.cfg.PresignedURLTTLSeconds) * time.Second).Format(time.RFC3339),
	})
}

func (s *Server) enforceWindowLimit(ctx context.Context, key string, limit int, windowSec int) error {
	retryAfter, err := s.store.CheckWindowLimit(ctx, key, limit, windowSec)
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) {
		return err
	}
	if retryAfter <= 0 {
		retryAfter = 1
	}
	return fmt.Errorf("Rate limit exceeded. Retry in %d seconds.", retryAfter)
}

func (s *Server) shouldBypassRateLimit(r *http.Request) bool {
	if strings.EqualFold(s.cfg.AppEnv, "production") {
		return false
	}
	for _, key := range []string{"x-dev-no-rate-limit", "x-dev-preview-no-rate-limit", "x-dev-generate-no-rate-limit"} {
		value := strings.ToLower(strings.TrimSpace(r.Header.Get(key)))
		if value == "1" || value == "true" || value == "yes" || value == "on" {
			return true
		}
	}
	return false
}

func clientIP(r *http.Request) string {
	if fwd := strings.TrimSpace(r.Header.Get("x-forwarded-for")); fwd != "" {
		parts := strings.Split(fwd, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	if strings.TrimSpace(r.RemoteAddr) == "" {
		return "unknown"
	}
	return r.RemoteAddr
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, detail string) {
	writeJSON(w, status, map[string]string{"detail": detail})
}

func parseQueryInt(r *http.Request, key string, fallback int) int {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return fallback
	}
	var value int
	if _, err := fmt.Sscanf(raw, "%d", &value); err != nil {
		return fallback
	}
	return value
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func bytesReader(data []byte) *bytes.Reader {
	return bytes.NewReader(data)
}
