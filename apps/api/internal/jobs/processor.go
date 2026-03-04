package jobs

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"city-map-poster-generator/apps/api/internal/config"
	"city-map-poster-generator/apps/api/internal/geocode"
	"city-map-poster-generator/apps/api/internal/queue"
	"city-map-poster-generator/apps/api/internal/render"
	"city-map-poster-generator/apps/api/internal/state"
	"city-map-poster-generator/apps/api/internal/storage"
	"city-map-poster-generator/apps/api/internal/types"
	"city-map-poster-generator/apps/api/internal/validation"
)

type Processor struct {
	cfg      config.Config
	store    *state.Store
	queue    *queue.RedisQueue
	storage  *storage.Client
	renderer *render.Renderer
	geocode  *geocode.Client
}

type geocodeCoordinates struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type renderUploadResult struct {
	Artifact types.Artifact
	Bytes    []byte
	Err      error
}

func NewProcessor(cfg config.Config, store *state.Store, queue *queue.RedisQueue, storage *storage.Client, renderer *render.Renderer, geocodeClient *geocode.Client) *Processor {
	return &Processor{cfg: cfg, store: store, queue: queue, storage: storage, renderer: renderer, geocode: geocodeClient}
}

func (p *Processor) ResolveCoordinates(ctx context.Context, req types.GenerateRequest) (float64, float64, error) {
	if req.Latitude != nil && req.Longitude != nil {
		lat, err := strconv.ParseFloat(strings.TrimSpace(*req.Latitude), 64)
		if err != nil {
			return 0, 0, fmt.Errorf("invalid latitude: %w", err)
		}
		lon, err := strconv.ParseFloat(strings.TrimSpace(*req.Longitude), 64)
		if err != nil {
			return 0, 0, fmt.Errorf("invalid longitude: %w", err)
		}
		return lat, lon, nil
	}
	query := fmt.Sprintf("%s, %s", req.City, req.Country)
	cacheKey := fmt.Sprintf("cache:geocode:resolve:%s", normalizeCacheToken(query))
	if cachedRaw, err := p.store.GetCache(ctx, cacheKey); err == nil && strings.TrimSpace(cachedRaw) != "" {
		var cached geocodeCoordinates
		if err := json.Unmarshal([]byte(cachedRaw), &cached); err == nil {
			return cached.Lat, cached.Lon, nil
		}
	}

	suggestions, err := p.geocode.Search(ctx, query, 1)
	if err != nil {
		return 0, 0, err
	}
	if len(suggestions) == 0 {
		return 0, 0, fmt.Errorf("location not found")
	}
	lat, err := strconv.ParseFloat(strings.TrimSpace(suggestions[0].Latitude), 64)
	if err != nil {
		return 0, 0, err
	}
	lon, err := strconv.ParseFloat(strings.TrimSpace(suggestions[0].Longitude), 64)
	if err != nil {
		return 0, 0, err
	}
	if encoded, err := json.Marshal(geocodeCoordinates{Lat: lat, Lon: lon}); err == nil {
		_ = p.store.SetCache(ctx, cacheKey, string(encoded), p.cfg.GeocodeCacheTTLSeconds)
	}
	return lat, lon, nil
}

func (p *Processor) RunWorker(ctx context.Context) error {
	for {
		env, err := p.queue.Dequeue(ctx, time.Duration(p.cfg.WorkerBlock)*time.Second)
		if err != nil {
			return err
		}
		if env == nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			continue
		}
		if err := p.Process(ctx, *env); err != nil {
			// Continue processing next jobs.
			continue
		}
	}
}

func (p *Processor) Process(ctx context.Context, env queue.JobEnvelope) error {
	activeKey := fmt.Sprintf("ratelimit:active:%s", env.ClientIP)
	defer p.store.RemoveActiveJob(ctx, activeKey, env.JobID)

	var payload types.GenerateRequest
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		return p.failJob(ctx, env.JobID, err)
	}
	if err := validation.ValidateGenerateRequest(&payload); err != nil {
		return p.failJob(ctx, env.JobID, err)
	}

	themes := []string{payload.Theme}
	if payload.AllThemes {
		themes = p.renderer.ThemeIDs()
		sort.Strings(themes)
	}

	downloading := types.JobDownloading
	progress := 5
	step := "Downloading map data"
	_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &downloading, &progress, &step, nil, nil, nil)

	lat, lon, err := p.ResolveCoordinates(ctx, payload)
	if err != nil {
		return p.failJob(ctx, env.JobID, err)
	}

	payload.Format = normalizeFormat(payload.Format)
	artifactsByIndex := make([]types.Artifact, len(themes))
	renderedByIndex := make([][]byte, len(themes))

	parallelThemeRendering := payload.AllThemes && len(themes) > 1 && p.cfg.WorkerThemeParallelism > 1
	if parallelThemeRendering {
		type indexedRenderResult struct {
			Index  int
			Result renderUploadResult
		}

		workerCount := p.cfg.WorkerThemeParallelism
		if workerCount < 1 {
			workerCount = 1
		}
		if workerCount > len(themes) {
			workerCount = len(themes)
		}

		rendering := types.JobRendering
		step := fmt.Sprintf("Rendering %d themes in parallel", len(themes))
		_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &rendering, &progress, &step, nil, nil, nil)

		workerCtx, cancel := context.WithCancel(ctx)
		defer cancel()

		jobIndexes := make(chan int)
		results := make(chan indexedRenderResult, len(themes))
		var wg sync.WaitGroup
		for workerIndex := 0; workerIndex < workerCount; workerIndex++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for idx := range jobIndexes {
					result := p.renderAndUploadTheme(workerCtx, env.JobID, payload, themes[idx], lat, lon)
					select {
					case results <- indexedRenderResult{Index: idx, Result: result}:
					case <-workerCtx.Done():
						return
					}
				}
			}()
		}

		go func() {
			defer close(jobIndexes)
			for idx := range themes {
				select {
				case <-workerCtx.Done():
					return
				case jobIndexes <- idx:
				}
			}
		}()
		go func() {
			wg.Wait()
			close(results)
		}()

		completedCount := 0
		for completion := range results {
			if completion.Result.Err != nil {
				cancel()
				return p.failJob(ctx, env.JobID, completion.Result.Err)
			}
			artifactsByIndex[completion.Index] = completion.Result.Artifact
			renderedByIndex[completion.Index] = completion.Result.Bytes
			completedCount++

			progressValue := int(5 + (float64(completedCount)/float64(maxInt(len(themes), 1)))*80)
			rendering := types.JobRendering
			step := fmt.Sprintf("Rendered %s (%d/%d)", completion.Result.Artifact.Theme, completedCount, len(themes))
			_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &rendering, &progressValue, &step, nil, nil, nil)
		}
	} else {
		for idx, themeID := range themes {
			itemProgress := int(5 + (float64(idx)/float64(maxInt(len(themes), 1)))*80)
			rendering := types.JobRendering
			step := fmt.Sprintf("Rendering %s (%d/%d)", themeID, idx+1, len(themes))
			_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &rendering, &itemProgress, &step, nil, nil, nil)

			result := p.renderAndUploadTheme(ctx, env.JobID, payload, themeID, lat, lon)
			if result.Err != nil {
				return p.failJob(ctx, env.JobID, result.Err)
			}
			artifactsByIndex[idx] = result.Artifact
			renderedByIndex[idx] = result.Bytes
		}
	}

	artifacts := make([]types.Artifact, 0, len(themes))
	renderedBytes := make(map[string][]byte, len(themes))
	for idx := range themes {
		item := artifactsByIndex[idx]
		if strings.TrimSpace(item.Key) == "" {
			return p.failJob(ctx, env.JobID, fmt.Errorf("missing artifact for theme index %d", idx))
		}
		artifacts = append(artifacts, item)
		renderedBytes[item.FileName] = renderedByIndex[idx]
	}

	var zipKey *string
	if len(artifacts) > 1 {
		packaging := types.JobPackaging
		progress := 90
		step := "Packaging ZIP archive"
		_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &packaging, &progress, &step, &artifacts, nil, nil)

		archiveName := fmt.Sprintf("%s_%s.zip", slug(payload.City), env.JobID)
		var buf bytes.Buffer
		zipWriter := zip.NewWriter(&buf)
		for _, item := range artifacts {
			fileWriter, err := zipWriter.Create(filepath.Base(item.FileName))
			if err != nil {
				_ = zipWriter.Close()
				return p.failJob(ctx, env.JobID, err)
			}
			content := renderedBytes[item.FileName]
			if len(content) == 0 {
				_ = zipWriter.Close()
				return p.failJob(ctx, env.JobID, fmt.Errorf("missing rendered content for %s", item.FileName))
			}
			if _, err := fileWriter.Write(content); err != nil {
				_ = zipWriter.Close()
				return p.failJob(ctx, env.JobID, err)
			}
		}
		if err := zipWriter.Close(); err != nil {
			return p.failJob(ctx, env.JobID, err)
		}
		archiveKey := fmt.Sprintf("jobs/%s/%s", env.JobID, archiveName)
		if err := p.storage.UploadReader(ctx, p.cfg.S3BucketArtifacts, archiveKey, bytes.NewReader(buf.Bytes()), "application/zip"); err != nil {
			return p.failJob(ctx, env.JobID, err)
		}
		zipKey = &archiveKey
	}

	completed := types.JobComplete
	progress = 100
	step = "Completed"
	_, err = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &completed, &progress, &step, &artifacts, zipKey, nil)
	if err != nil {
		return p.failJob(ctx, env.JobID, err)
	}
	return nil
}

func (p *Processor) renderAndUploadTheme(
	ctx context.Context,
	jobID string,
	payload types.GenerateRequest,
	themeID string,
	lat float64,
	lon float64,
) renderUploadResult {
	forTheme := payload
	forTheme.Theme = themeID
	result, err := p.renderer.Render(ctx, forTheme, lat, lon, render.RenderProfile{RasterDPI: 300})
	if err != nil {
		return renderUploadResult{Err: err}
	}

	fileName := buildFileName(payload.City, themeID, payload.Format)
	key := fmt.Sprintf("jobs/%s/%s", jobID, fileName)
	if err := p.storage.UploadReader(ctx, p.cfg.S3BucketArtifacts, key, bytes.NewReader(result.Bytes), result.ContentType); err != nil {
		return renderUploadResult{Err: err}
	}

	return renderUploadResult{
		Artifact: types.Artifact{
			Theme:    themeID,
			Format:   payload.Format,
			FileName: fileName,
			Key:      key,
		},
		Bytes: result.Bytes,
	}
}

func (p *Processor) failJob(ctx context.Context, jobID string, err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	failed := types.JobFailed
	progress := 100
	step := "Failed"
	_, _ = p.store.UpdateJobState(ctx, jobID, p.cfg.ArtifactTTLSeconds, &failed, &progress, &step, nil, nil, &msg)
	return err
}

func normalizeFormat(format types.OutputFormat) types.OutputFormat {
	if !format.IsValid() {
		return types.OutputPNG
	}
	return format
}

func buildFileName(city, theme string, format types.OutputFormat) string {
	return fmt.Sprintf("%s_%s.%s", slug(city), slug(theme), format)
}

func slug(input string) string {
	s := strings.ToLower(strings.TrimSpace(input))
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	if s == "" {
		s = "poster"
	}
	return s
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func normalizeCacheToken(input string) string {
	trimmed := strings.ToLower(strings.TrimSpace(input))
	if trimmed == "" {
		return ""
	}
	return strings.Join(strings.Fields(trimmed), " ")
}
