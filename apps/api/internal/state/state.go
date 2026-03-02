package state

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"city-map-poster-generator/apps/api/internal/types"
	"github.com/redis/go-redis/v9"
)

type Store struct {
	redis *redis.Client
}

func New(redisURL string) (*Store, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	client := redis.NewClient(opt)
	return &Store{redis: client}, nil
}

func (s *Store) Client() *redis.Client {
	return s.redis
}

func (s *Store) Ping(ctx context.Context) error {
	return s.redis.Ping(ctx).Err()
}

func (s *Store) GetJobState(ctx context.Context, jobID string) (*types.JobState, error) {
	key := fmt.Sprintf("job:%s", jobID)
	raw, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var state types.JobState
	if err := json.Unmarshal([]byte(raw), &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (s *Store) SaveJobState(ctx context.Context, state types.JobState, ttlSeconds int) error {
	key := fmt.Sprintf("job:%s", state.JobID)
	encoded, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return s.redis.SetEx(ctx, key, encoded, time.Duration(ttlSeconds)*time.Second).Err()
}

func (s *Store) UpdateJobState(
	ctx context.Context,
	jobID string,
	ttlSeconds int,
	status *types.JobStatus,
	progress *int,
	step *string,
	artifacts *[]types.Artifact,
	zipKey *string,
	errMsg *string,
) (types.JobState, error) {
	existing, err := s.GetJobState(ctx, jobID)
	if err != nil {
		return types.JobState{}, err
	}
	state := types.NewJobState(jobID)
	if existing != nil {
		state = *existing
	}
	if status != nil {
		state.Status = *status
	}
	if progress != nil {
		state.Progress = *progress
	}
	if step != nil && *step != "" {
		state.Steps = append(state.Steps, *step)
	}
	if artifacts != nil {
		state.Artifacts = *artifacts
	}
	if zipKey != nil {
		state.ZipKey = zipKey
	}
	if errMsg != nil {
		state.Error = errMsg
	}
	state.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := s.SaveJobState(ctx, state, ttlSeconds); err != nil {
		return types.JobState{}, err
	}
	return state, nil
}

func (s *Store) CheckWindowLimit(ctx context.Context, key string, limit int, windowSeconds int) (int, error) {
	count, err := s.redis.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if count == 1 {
		if err := s.redis.Expire(ctx, key, time.Duration(windowSeconds)*time.Second).Err(); err != nil {
			return 0, err
		}
	}
	if count > int64(limit) {
		ttl, err := s.redis.TTL(ctx, key).Result()
		if err != nil {
			return 1, err
		}
		return int(ttl.Seconds()), fmt.Errorf("rate limit exceeded")
	}
	return 0, nil
}

func (s *Store) CheckConcurrencyLimit(ctx context.Context, key string, limit int) error {
	count, err := s.redis.SCard(ctx, key).Result()
	if err != nil {
		return err
	}
	if count >= int64(limit) {
		return fmt.Errorf("too many concurrent jobs")
	}
	return nil
}

func (s *Store) AddActiveJob(ctx context.Context, key string, jobID string) error {
	return s.redis.SAdd(ctx, key, jobID).Err()
}

func (s *Store) RemoveActiveJob(ctx context.Context, key string, jobID string) {
	_ = s.redis.SRem(ctx, key, jobID).Err()
}

func (s *Store) GetPreviewCache(ctx context.Context, key string) (string, error) {
	result, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return result, nil
}

func (s *Store) SetPreviewCache(ctx context.Context, key, objectKey string, ttlSeconds int) error {
	return s.redis.SetEx(ctx, key, objectKey, time.Duration(ttlSeconds)*time.Second).Err()
}

func (s *Store) GetExportState(ctx context.Context, exportID string) (*types.ExportState, error) {
	key := fmt.Sprintf("export:%s", exportID)
	raw, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var state types.ExportState
	if err := json.Unmarshal([]byte(raw), &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (s *Store) SaveExportState(ctx context.Context, state types.ExportState, ttlSeconds int) error {
	key := fmt.Sprintf("export:%s", state.ExportID)
	encoded, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return s.redis.SetEx(ctx, key, encoded, time.Duration(ttlSeconds)*time.Second).Err()
}

func (s *Store) UpdateExportState(
	ctx context.Context,
	exportID string,
	ttlSeconds int,
	status *types.ExportStatus,
	progress *int,
	step *string,
	artifacts *[]types.Artifact,
	downloadKey *string,
	errorMsg *string,
) (types.ExportState, error) {
	existing, err := s.GetExportState(ctx, exportID)
	if err != nil {
		return types.ExportState{}, err
	}
	state := types.NewExportState(exportID)
	if existing != nil {
		state = *existing
	}
	if status != nil {
		state.Status = *status
	}
	if progress != nil {
		state.Progress = *progress
	}
	if step != nil && *step != "" {
		state.Steps = append(state.Steps, *step)
	}
	if artifacts != nil {
		state.Artifacts = *artifacts
	}
	if downloadKey != nil {
		state.DownloadKey = downloadKey
	}
	if errorMsg != nil {
		state.Error = errorMsg
	}
	state.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := s.SaveExportState(ctx, state, ttlSeconds); err != nil {
		return types.ExportState{}, err
	}
	return state, nil
}
