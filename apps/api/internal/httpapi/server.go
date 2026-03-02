package httpapi

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"city-map-poster-generator/apps/api/internal/captcha"
	"city-map-poster-generator/apps/api/internal/config"
	"city-map-poster-generator/apps/api/internal/fonts"
	"city-map-poster-generator/apps/api/internal/jobs"
	"city-map-poster-generator/apps/api/internal/osm"
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

const (
	maxPreviewLongEdgePx = 2048
	minPreviewRasterDPI  = 24
	maxPreviewPixelCount = 4_000_000
)

type Server struct {
	cfg      config.Config
	store    *state.Store
	storage  *storage.Client
	renderer *render.Renderer
	geocoder interface {
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
	r.Get("/v2/fonts/{family}/bundle", s.handleFontBundle)
	r.Post("/v2/preview", s.handlePreview)
	r.Get("/v2/previews/{previewId}", s.handlePreviewAsset)
	r.Post("/v2/render/snapshot", s.handleRenderSnapshot)
	r.Post("/v2/jobs", s.handleCreateJob)
	r.Get("/v2/jobs/{jobId}", s.handleJobStatus)
	r.Get("/v2/jobs/{jobId}/download", s.handleDownload)
	r.Post("/v2/exports/init", s.handleExportInit)
	r.Post("/v2/exports/{exportId}/complete", s.handleExportComplete)
	r.Get("/v2/exports/{exportId}", s.handleExportStatus)
	r.Get("/v2/exports/{exportId}/download", s.handleExportDownload)
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

func (s *Server) handleFontBundle(w http.ResponseWriter, r *http.Request) {
	familyRaw := strings.TrimSpace(chi.URLParam(r, "family"))
	if familyRaw == "" {
		writeError(w, http.StatusBadRequest, "font family is required")
		return
	}
	family, err := url.PathUnescape(familyRaw)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid font family")
		return
	}
	weights := parseFontWeights(r.URL.Query().Get("weights"))
	responseEncoding := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("encoding")))

	family = strings.TrimSpace(family)
	fontPaths := s.fontsSvc.ResolveFontPaths(r.Context(), &family)
	if err := fonts.EnsureFontFiles(fontPaths); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	filesByWeight := map[string]string{
		"300": fontPaths.Light,
		"400": fontPaths.Regular,
		"700": fontPaths.Bold,
	}

	if responseEncoding == "json" {
		files := map[string]string{}
		for _, weight := range weights {
			path, ok := filesByWeight[weight]
			if !ok {
				continue
			}
			content, err := os.ReadFile(filepath.Clean(path))
			if err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			files[weight] = base64.StdEncoding.EncodeToString(content)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"family":  family,
			"weights": weights,
			"files":   files,
		})
		return
	}

	manifest := map[string]any{
		"family":  family,
		"weights": weights,
		"files":   map[string]string{},
	}

	var out bytes.Buffer
	zipWriter := zip.NewWriter(&out)
	for _, weight := range weights {
		path, ok := filesByWeight[weight]
		if !ok {
			continue
		}
		content, err := os.ReadFile(filepath.Clean(path))
		if err != nil {
			_ = zipWriter.Close()
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		entryName := fmt.Sprintf("%s-%s.ttf", slugForKey(family), weight)
		fileWriter, err := zipWriter.Create(entryName)
		if err != nil {
			_ = zipWriter.Close()
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if _, err := fileWriter.Write(content); err != nil {
			_ = zipWriter.Close()
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		manifestFiles, _ := manifest["files"].(map[string]string)
		manifestFiles[weight] = entryName
	}

	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		_ = zipWriter.Close()
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	manifestEntry, err := zipWriter.Create("manifest.json")
	if err != nil {
		_ = zipWriter.Close()
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if _, err := manifestEntry.Write(manifestBytes); err != nil {
		_ = zipWriter.Close()
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := zipWriter.Close(); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sum := sha256.Sum256(out.Bytes())
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("X-Font-Bundle-Sha256", hex.EncodeToString(sum[:]))
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s-font-bundle.zip"`, slugForKey(family)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(out.Bytes())
}

func (s *Server) handleRenderSnapshot(w http.ResponseWriter, r *http.Request) {
	responseEncoding := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("encoding")))
	wantJSON := responseEncoding == "json"

	var payload types.RenderSnapshotRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := validation.ValidateRenderSnapshotRequest(&payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !s.shouldBypassRateLimit(r) {
		if err := s.enforceWindowLimit(r.Context(), fmt.Sprintf("ratelimit:snapshot:%s", clientIP(r)), s.cfg.RateLimitPreviewCount, s.cfg.RateLimitPreviewWindowSec); err != nil {
			writeError(w, http.StatusTooManyRequests, err.Error())
			return
		}
	}

	lat, lon, err := s.processor.ResolveCoordinates(r.Context(), types.GenerateRequest{
		City:      payload.City,
		Country:   payload.Country,
		Latitude:  payload.Latitude,
		Longitude: payload.Longitude,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	cacheKey, err := util.SnapshotCacheKey(payload, lat, lon)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	snapshotID := strings.TrimPrefix(cacheKey, "snapshot:")
	objectKey := fmt.Sprintf("snapshot/%s.bin", snapshotID)

	cachedObjectKey, err := s.store.GetPreviewCache(r.Context(), cacheKey)
	if err == nil && cachedObjectKey != "" && s.storage.ObjectExists(r.Context(), s.cfg.S3BucketPreviews, cachedObjectKey) {
		content, err := s.storage.GetObjectBytes(r.Context(), s.cfg.S3BucketPreviews, cachedObjectKey)
		if err == nil {
			if wantJSON {
				rawJSON, err := ungzipBytes(content)
				if err == nil {
					writeSnapshotJSON(w, snapshotID, lat, lon, rawJSON)
					return
				}
			}
			writeSnapshotBinary(w, snapshotID, lat, lon, content)
			return
		}
	}

	features, err := s.renderer.FetchFeaturesForSnapshot(r.Context(), payload, lat, lon)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	snapshot := buildSnapshotPayload(snapshotID, payload, lat, lon, features)
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	compressed, err := gzipBytes(encoded)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := s.storage.UploadBytes(r.Context(), s.cfg.S3BucketPreviews, objectKey, compressed, "application/x-render-snapshot+gzip"); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	_ = s.store.SetPreviewCache(r.Context(), cacheKey, objectKey, s.cfg.PreviewTTLSeconds)

	if wantJSON {
		writeSnapshotJSON(w, snapshotID, lat, lon, encoded)
		return
	}
	writeSnapshotBinary(w, snapshotID, lat, lon, compressed)
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
		writeJSON(w, http.StatusOK, map[string]any{
			"previewUrl": s.previewProxyURL(r, cachedObjectKey),
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
	previewDPI := cappedPreviewRasterDPI(payload, s.cfg.PreviewRasterDPI)
	result, err := s.renderer.Render(r.Context(), payload, lat, lon, render.RenderProfile{RasterDPI: previewDPI})
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
	writeJSON(w, http.StatusOK, map[string]any{
		"previewUrl": s.previewProxyURL(r, objectKey),
		"cacheHit":   false,
		"expiresAt":  time.Now().UTC().Add(time.Duration(s.cfg.PreviewTTLSeconds) * time.Second).Format(time.RFC3339),
	})
}

func (s *Server) handlePreviewAsset(w http.ResponseWriter, r *http.Request) {
	previewID := strings.TrimSpace(chi.URLParam(r, "previewId"))
	if previewID == "" || strings.Contains(previewID, "/") || strings.Contains(previewID, "..") {
		writeError(w, http.StatusBadRequest, "invalid preview id")
		return
	}
	objectKey := fmt.Sprintf("preview/%s", previewID)
	content, err := s.storage.GetObjectBytes(r.Context(), s.cfg.S3BucketPreviews, objectKey)
	if err != nil {
		writeError(w, http.StatusNotFound, "preview not found")
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
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

func (s *Server) handleExportInit(w http.ResponseWriter, r *http.Request) {
	var body types.ExportInitRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := validation.ValidateExportInitRequest(&body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !body.AllThemes {
		if _, ok := s.themeSet[body.Payload.Theme]; !ok {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Unknown theme: %s", body.Payload.Theme))
			return
		}
	}

	ip := clientIP(r)
	if !s.shouldBypassRateLimit(r) {
		if err := s.enforceWindowLimit(r.Context(), fmt.Sprintf("ratelimit:exports:%s", ip), s.cfg.RateLimitJobsCount, s.cfg.RateLimitJobsWindowSec); err != nil {
			writeError(w, http.StatusTooManyRequests, err.Error())
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

	exportID := uuid.NewString()
	uploads := make([]types.ExportUploadTarget, 0, len(body.ArtifactsPlanned))
	artifacts := make([]types.Artifact, 0, len(body.ArtifactsPlanned))
	expectedUploads := make([]string, 0, len(body.ArtifactsPlanned))

	for _, planned := range body.ArtifactsPlanned {
		fileName := filepath.Base(strings.TrimSpace(planned.FileName))
		if fileName == "" {
			writeError(w, http.StatusBadRequest, "artifactsPlanned contains empty fileName")
			return
		}
		objectKey := fmt.Sprintf("exports/%s/%s", exportID, fileName)
		uploadURL, err := s.storage.SignedPutURL(
			r.Context(),
			s.cfg.S3BucketArtifacts,
			objectKey,
			planned.ContentType,
			s.cfg.PresignedURLTTLSeconds,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		uploads = append(uploads, types.ExportUploadTarget{
			FileName:    fileName,
			Key:         objectKey,
			ContentType: planned.ContentType,
			UploadURL:   uploadURL,
		})
		expectedUploads = append(expectedUploads, objectKey)
		artifacts = append(artifacts, types.Artifact{
			Theme:    planned.Theme,
			Format:   planned.Format,
			FileName: fileName,
			Key:      objectKey,
		})
	}

	stateValue := types.NewExportState(exportID)
	stateValue.Status = types.ExportUploading
	stateValue.Progress = 10
	stateValue.Steps = append(stateValue.Steps, "Upload session created")
	stateValue.ExpectedUploads = expectedUploads
	stateValue.Artifacts = artifacts
	if err := s.store.SaveExportState(r.Context(), stateValue, s.cfg.ArtifactTTLSeconds); err != nil {
		writeError(w, http.StatusServiceUnavailable, "Export state unavailable")
		return
	}

	writeJSON(w, http.StatusOK, types.ExportInitResponse{
		ExportID:  exportID,
		Status:    stateValue.Status,
		Uploads:   uploads,
		MaxSizeMB: 100,
		ExpiresAt: time.Now().UTC().Add(time.Duration(s.cfg.PresignedURLTTLSeconds) * time.Second).Format(time.RFC3339),
	})
}

func (s *Server) handleExportComplete(w http.ResponseWriter, r *http.Request) {
	exportID := strings.TrimSpace(chi.URLParam(r, "exportId"))
	if exportID == "" {
		writeError(w, http.StatusBadRequest, "exportId is required")
		return
	}
	existing, err := s.store.GetExportState(r.Context(), exportID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if existing == nil {
		writeError(w, http.StatusNotFound, "Export not found")
		return
	}

	var body types.ExportCompleteRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(body.Uploads) == 0 {
		writeError(w, http.StatusBadRequest, "uploads must not be empty")
		return
	}

	expected := make(map[string]struct{}, len(existing.ExpectedUploads))
	for _, key := range existing.ExpectedUploads {
		expected[key] = struct{}{}
	}
	for _, item := range body.Uploads {
		key := strings.TrimSpace(item.Key)
		if key == "" {
			writeError(w, http.StatusBadRequest, "upload key is required")
			return
		}
		if _, ok := expected[key]; !ok {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("unexpected upload key: %s", key))
			return
		}
		meta, err := s.storage.HeadObject(r.Context(), s.cfg.S3BucketArtifacts, key)
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("missing uploaded object: %s", key))
			return
		}
		if item.Size > 0 && meta.Size != item.Size {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("size mismatch for %s", key))
			return
		}
		if strings.TrimSpace(item.Sha256) != "" {
			content, err := s.storage.GetObjectBytes(r.Context(), s.cfg.S3BucketArtifacts, key)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			sum := sha256.Sum256(content)
			if !strings.EqualFold(strings.TrimSpace(item.Sha256), hex.EncodeToString(sum[:])) {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("sha256 mismatch for %s", key))
				return
			}
		}
	}

	downloadKey := strings.TrimSpace(body.DownloadKey)
	if downloadKey == "" {
		if len(existing.Artifacts) == 1 {
			downloadKey = existing.Artifacts[0].Key
		}
	}
	if downloadKey != "" {
		if _, ok := expected[downloadKey]; !ok {
			writeError(w, http.StatusBadRequest, "downloadKey must match an uploaded artifact key")
			return
		}
	}

	status := types.ExportComplete
	progress := 100
	step := "Completed"
	var downloadKeyPtr *string
	if downloadKey != "" {
		downloadKeyPtr = &downloadKey
	}
	stateValue, err := s.store.UpdateExportState(
		r.Context(),
		exportID,
		s.cfg.ArtifactTTLSeconds,
		&status,
		&progress,
		&step,
		&existing.Artifacts,
		downloadKeyPtr,
		nil,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stateValue)
}

func (s *Server) handleExportStatus(w http.ResponseWriter, r *http.Request) {
	exportID := strings.TrimSpace(chi.URLParam(r, "exportId"))
	stateValue, err := s.store.GetExportState(r.Context(), exportID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stateValue == nil {
		writeError(w, http.StatusNotFound, "Export not found")
		return
	}
	writeJSON(w, http.StatusOK, stateValue)
}

func (s *Server) handleExportDownload(w http.ResponseWriter, r *http.Request) {
	exportID := strings.TrimSpace(chi.URLParam(r, "exportId"))
	stateValue, err := s.store.GetExportState(r.Context(), exportID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if stateValue == nil {
		writeError(w, http.StatusNotFound, "Export not found")
		return
	}
	if stateValue.Status != types.ExportComplete {
		writeError(w, http.StatusConflict, "Export is not complete")
		return
	}
	var key string
	if stateValue.DownloadKey != nil {
		key = strings.TrimSpace(*stateValue.DownloadKey)
	}
	if key == "" && len(stateValue.Artifacts) == 1 {
		key = stateValue.Artifacts[0].Key
	}
	if key == "" {
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

func (s *Server) previewProxyURL(r *http.Request, objectKey string) string {
	previewID := strings.TrimSpace(filepath.Base(strings.TrimSpace(objectKey)))
	if previewID == "" || previewID == "." || previewID == "/" {
		return ""
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if forwarded := strings.TrimSpace(r.Header.Get("x-forwarded-proto")); forwarded != "" {
		scheme = forwarded
	}
	host := strings.TrimSpace(r.Host)
	if host == "" {
		return fmt.Sprintf("/v2/previews/%s", previewID)
	}
	return fmt.Sprintf("%s://%s/v2/previews/%s", scheme, host, previewID)
}

func cappedPreviewRasterDPI(payload types.GenerateRequest, requested int) int {
	dpi := requested
	if dpi <= 0 {
		dpi = 120
	}

	longEdgeInches := math.Max(payload.Width, payload.Height)
	if longEdgeInches > 0 {
		edgeLimited := int(math.Floor(float64(maxPreviewLongEdgePx) / longEdgeInches))
		if edgeLimited > 0 && edgeLimited < dpi {
			dpi = edgeLimited
		}
	}
	if dpi < minPreviewRasterDPI {
		dpi = minPreviewRasterDPI
	}

	widthPx := math.Max(64, math.Round(payload.Width*float64(dpi)))
	heightPx := math.Max(64, math.Round(payload.Height*float64(dpi)))
	for dpi > minPreviewRasterDPI && widthPx*heightPx > maxPreviewPixelCount {
		dpi -= 1
		widthPx = math.Max(64, math.Round(payload.Width*float64(dpi)))
		heightPx = math.Max(64, math.Round(payload.Height*float64(dpi)))
	}

	return dpi
}

func parseFontWeights(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{"300", "400", "700"}
	}
	set := map[string]struct{}{}
	for _, part := range strings.Split(trimmed, ",") {
		weight := strings.TrimSpace(part)
		if weight == "" {
			continue
		}
		if weight != "300" && weight != "400" && weight != "700" {
			continue
		}
		set[weight] = struct{}{}
	}
	if len(set) == 0 {
		return []string{"300", "400", "700"}
	}
	weights := make([]string, 0, len(set))
	for _, ordered := range []string{"300", "400", "700"} {
		if _, ok := set[ordered]; ok {
			weights = append(weights, ordered)
		}
	}
	return weights
}

func slugForKey(input string) string {
	s := strings.ToLower(strings.TrimSpace(input))
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	s = strings.ReplaceAll(s, "\"", "")
	s = strings.ReplaceAll(s, "'", "")
	if s == "" {
		return "value"
	}
	return s
}

func writeSnapshotBinary(w http.ResponseWriter, snapshotID string, lat float64, lon float64, payload []byte) {
	w.Header().Set("Content-Type", "application/x-render-snapshot+gzip")
	w.Header().Set("X-Snapshot-Id", snapshotID)
	w.Header().Set("X-Resolved-Lat", fmt.Sprintf("%.7f", lat))
	w.Header().Set("X-Resolved-Lon", fmt.Sprintf("%.7f", lon))
	w.Header().Set("ETag", fmt.Sprintf(`"%s"`, snapshotID))
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

func writeSnapshotJSON(w http.ResponseWriter, snapshotID string, lat float64, lon float64, payload []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Snapshot-Id", snapshotID)
	w.Header().Set("X-Resolved-Lat", fmt.Sprintf("%.7f", lat))
	w.Header().Set("X-Resolved-Lon", fmt.Sprintf("%.7f", lon))
	w.Header().Set("ETag", fmt.Sprintf(`"%s"`, snapshotID))
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

func buildSnapshotPayload(
	snapshotID string,
	req types.RenderSnapshotRequest,
	resolvedLat float64,
	resolvedLon float64,
	features *osm.FeatureSet,
) types.RenderSnapshotPayload {
	nodes := make([]types.SnapshotNode, 0, len(features.Nodes))
	nodeIDs := make([]int64, 0, len(features.Nodes))
	for id := range features.Nodes {
		nodeIDs = append(nodeIDs, id)
	}
	sort.Slice(nodeIDs, func(i, j int) bool { return nodeIDs[i] < nodeIDs[j] })
	for _, id := range nodeIDs {
		node := features.Nodes[id]
		nodes = append(nodes, types.SnapshotNode{
			ID:  node.ID,
			Lat: roundCoord(node.Lat),
			Lon: roundCoord(node.Lon),
		})
	}

	targetAspect := req.Width / req.Height
	if targetAspect <= 0 {
		targetAspect = 1
	}

	return types.RenderSnapshotPayload{
		SchemaVersion:  types.SnapshotSchemaVersion,
		SnapshotID:     snapshotID,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		ResolvedLat:    roundCoord(resolvedLat),
		ResolvedLon:    roundCoord(resolvedLon),
		Center:         [2]float64{roundCoord(features.Center[0]), roundCoord(features.Center[1])},
		Distance:       req.Distance,
		TargetAspect:   targetAspect,
		IncludeWater:   req.IncludeWater,
		IncludeParks:   req.IncludeParks,
		CoordPrecision: 7,
		Nodes:          nodes,
		Roads:          snapshotWays(features.Roads),
		Water:          snapshotWays(features.Water),
		Parks:          snapshotWays(features.Parks),
	}
}

func snapshotWays(items []osm.Way) []types.SnapshotWay {
	ways := make([]types.SnapshotWay, 0, len(items))
	for _, way := range items {
		wayNodes := make([]int64, 0, len(way.Nodes))
		wayNodes = append(wayNodes, way.Nodes...)
		tags := make(map[string]string, len(way.Tags))
		for k, v := range way.Tags {
			tags[k] = v
		}
		ways = append(ways, types.SnapshotWay{
			ID:    way.ID,
			Nodes: wayNodes,
			Tags:  tags,
		})
	}
	sort.Slice(ways, func(i, j int) bool { return ways[i].ID < ways[j].ID })
	return ways
}

func roundCoord(value float64) float64 {
	formatted := fmt.Sprintf("%.7f", value)
	parsed, err := strconv.ParseFloat(formatted, 64)
	if err != nil {
		return value
	}
	return parsed
}

func gzipBytes(raw []byte) ([]byte, error) {
	var out bytes.Buffer
	zw := gzip.NewWriter(&out)
	if _, err := zw.Write(raw); err != nil {
		_ = zw.Close()
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func ungzipBytes(raw []byte) ([]byte, error) {
	zr, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	defer zr.Close()
	return io.ReadAll(zr)
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
