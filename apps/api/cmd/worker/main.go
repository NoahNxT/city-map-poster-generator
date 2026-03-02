package main

import (
	"context"
	"log"

	"city-map-poster-generator/apps/api/internal/config"
	"city-map-poster-generator/apps/api/internal/fonts"
	"city-map-poster-generator/apps/api/internal/geocode"
	"city-map-poster-generator/apps/api/internal/jobs"
	"city-map-poster-generator/apps/api/internal/osm"
	"city-map-poster-generator/apps/api/internal/queue"
	"city-map-poster-generator/apps/api/internal/render"
	"city-map-poster-generator/apps/api/internal/state"
	"city-map-poster-generator/apps/api/internal/storage"
	"city-map-poster-generator/apps/api/internal/themes"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	ctx := context.Background()

	store, err := state.New(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis state: %v", err)
	}
	s3Client, err := storage.New(ctx, cfg)
	if err != nil {
		log.Fatalf("s3 client: %v", err)
	}
	if err := s3Client.EnsureBuckets(ctx); err != nil {
		log.Printf("bucket bootstrap warning: %v", err)
	}
	fontSvc := fonts.New(cfg)
	geocodeClient := geocode.New(cfg)
	osmClient := osm.New(cfg)
	themeList, err := themes.LoadThemes(cfg.AssetsDir)
	if err != nil {
		log.Fatalf("load themes: %v", err)
	}
	renderer := render.New(osmClient, fontSvc, themeList)
	jobQueue := queue.New(store.Client(), cfg.QueueName)
	processor := jobs.NewProcessor(cfg, store, jobQueue, s3Client, renderer, geocodeClient)

	log.Printf("worker-go started for queue %s", cfg.QueueName)
	if err := processor.RunWorker(ctx); err != nil {
		log.Fatalf("worker loop failed: %v", err)
	}
}
