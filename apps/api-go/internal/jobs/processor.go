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
	"time"

	"city-map-poster-generator/apps/api-go/internal/config"
	"city-map-poster-generator/apps/api-go/internal/geocode"
	"city-map-poster-generator/apps/api-go/internal/queue"
	"city-map-poster-generator/apps/api-go/internal/render"
	"city-map-poster-generator/apps/api-go/internal/state"
	"city-map-poster-generator/apps/api-go/internal/storage"
	"city-map-poster-generator/apps/api-go/internal/types"
	"city-map-poster-generator/apps/api-go/internal/validation"
)

type Processor struct {
	cfg      config.Config
	store    *state.Store
	queue    *queue.RedisQueue
	storage  *storage.Client
	renderer *render.Renderer
	geocode  *geocode.Client
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
	suggestions, err := p.geocode.Search(ctx, fmt.Sprintf("%s, %s", req.City, req.Country), 1)
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
		msg := err.Error()
		failed := types.JobFailed
		progress := 100
		step := "Failed"
		_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &failed, &progress, &step, nil, nil, &msg)
		return err
	}
	if err := validation.ValidateGenerateRequest(&payload); err != nil {
		msg := err.Error()
		failed := types.JobFailed
		progress := 100
		step := "Failed"
		_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &failed, &progress, &step, nil, nil, &msg)
		return err
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
		msg := err.Error()
		failed := types.JobFailed
		progress := 100
		step := "Failed"
		_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &failed, &progress, &step, nil, nil, &msg)
		return err
	}

	artifacts := make([]types.Artifact, 0, len(themes))
	renderedBytes := make(map[string][]byte, len(themes))
	payload.Format = normalizeFormat(payload.Format)
	for idx, themeID := range themes {
		itemProgress := int(5 + (float64(idx)/float64(maxInt(len(themes), 1)))*80)
		rendering := types.JobRendering
		step := fmt.Sprintf("Rendering %s (%d/%d)", themeID, idx+1, len(themes))
		_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &rendering, &itemProgress, &step, nil, nil, nil)

		forTheme := payload
		forTheme.Theme = themeID
		result, err := p.renderer.Render(ctx, forTheme, lat, lon, render.RenderProfile{RasterDPI: 300})
		if err != nil {
			msg := err.Error()
			failed := types.JobFailed
			progress := 100
			step := "Failed"
			_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &failed, &progress, &step, nil, nil, &msg)
			return err
		}

		fileName := buildFileName(payload.City, themeID, payload.Format)
		key := fmt.Sprintf("jobs/%s/%s", env.JobID, fileName)
		if err := p.storage.UploadReader(ctx, p.cfg.S3BucketArtifacts, key, bytes.NewReader(result.Bytes), result.ContentType); err != nil {
			msg := err.Error()
			failed := types.JobFailed
			progress := 100
			step := "Failed"
			_, _ = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &failed, &progress, &step, nil, nil, &msg)
			return err
		}
		artifacts = append(artifacts, types.Artifact{Theme: themeID, Format: payload.Format, FileName: fileName, Key: key})
		renderedBytes[fileName] = result.Bytes
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
				return err
			}
			content := renderedBytes[item.FileName]
			if len(content) == 0 {
				_ = zipWriter.Close()
				return fmt.Errorf("missing rendered content for %s", item.FileName)
			}
			if _, err := fileWriter.Write(content); err != nil {
				_ = zipWriter.Close()
				return err
			}
		}
		if err := zipWriter.Close(); err != nil {
			return err
		}
		archiveKey := fmt.Sprintf("jobs/%s/%s", env.JobID, archiveName)
		if err := p.storage.UploadReader(ctx, p.cfg.S3BucketArtifacts, archiveKey, bytes.NewReader(buf.Bytes()), "application/zip"); err != nil {
			return err
		}
		zipKey = &archiveKey
	}

	completed := types.JobComplete
	progress = 100
	step = "Completed"
	_, err = p.store.UpdateJobState(ctx, env.JobID, p.cfg.ArtifactTTLSeconds, &completed, &progress, &step, &artifacts, zipKey, nil)
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
