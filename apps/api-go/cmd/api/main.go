package main

import (
	"context"
	"log"
	"net/http"

	"city-map-poster-generator/apps/api-go/internal/captcha"
	"city-map-poster-generator/apps/api-go/internal/config"
	"city-map-poster-generator/apps/api-go/internal/fonts"
	"city-map-poster-generator/apps/api-go/internal/geocode"
	"city-map-poster-generator/apps/api-go/internal/httpapi"
	"city-map-poster-generator/apps/api-go/internal/jobs"
	"city-map-poster-generator/apps/api-go/internal/osm"
	"city-map-poster-generator/apps/api-go/internal/queue"
	"city-map-poster-generator/apps/api-go/internal/render"
	"city-map-poster-generator/apps/api-go/internal/state"
	"city-map-poster-generator/apps/api-go/internal/storage"
	"city-map-poster-generator/apps/api-go/internal/themes"
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
	captchaVerifier := captcha.New(cfg)

	server, err := httpapi.New(cfg, store, s3Client, renderer, geocodeClient, fontSvc, captchaVerifier, jobQueue, processor)
	if err != nil {
		log.Fatalf("server init: %v", err)
	}

	addr := ":" + cfg.Port
	log.Printf("api-go listening on %s", addr)
	if err := http.ListenAndServe(addr, server.Router()); err != nil {
		log.Fatalf("api server: %v", err)
	}
}
