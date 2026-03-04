package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppName string
	AppEnv  string

	Port string

	RedisURL    string
	QueueName   string
	WorkerBlock int

	S3EndpointURL       string
	S3PublicEndpointURL string
	S3Region            string
	S3AccessKeyID       string
	S3SecretAccessKey   string
	S3BucketPreviews    string
	S3BucketArtifacts   string
	S3Secure            bool

	PreviewTTLSeconds      int
	PreviewRasterDPI       int
	ArtifactTTLSeconds     int
	PresignedURLTTLSeconds int

	CaptchaRequired    bool
	TurnstileSecret    string
	TurnstileVerifyURL string

	RateLimitPreviewCount       int
	RateLimitPreviewWindowSec   int
	RateLimitLocationsCount     int
	RateLimitLocationsWindowSec int
	RateLimitFontsCount         int
	RateLimitFontsWindowSec     int
	RateLimitJobsCount          int
	RateLimitJobsWindowSec      int
	RateLimitConcurrentPerIP    int

	RequestTimeoutSeconds int
	NominatimSearchURL    string
	NominatimUserAgent    string
	OverpassURL           string

	GoogleFontsAPIURL          string
	GoogleFontsAPIKey          string
	GoogleFontsMetadataURL     string
	GoogleFontsCacheTTLSeconds int

	ThemesCacheTTLSeconds    int
	FontsCacheTTLSeconds     int
	LocationsCacheTTLSeconds int
	GeocodeCacheTTLSeconds   int
	OverpassCacheTTLSeconds  int
	WorkerThemeParallelism   int

	CacheDir  string
	AssetsDir string
}

func Load() (Config, error) {
	cfg := Config{
		AppName: getEnv("APP_NAME", "City Map Poster API (Go)"),
		AppEnv:  getEnv("APP_ENV", "development"),
		Port:    getEnv("PORT", "8000"),

		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379/0"),
		QueueName:   getEnv("RQ_QUEUE_NAME", "map_jobs"),
		WorkerBlock: getEnvInt("WORKER_BLOCK_SECONDS", 5),

		S3EndpointURL:       getEnv("S3_ENDPOINT_URL", "http://localhost:9000"),
		S3PublicEndpointURL: getEnv("S3_PUBLIC_ENDPOINT_URL", "http://localhost:9000"),
		S3Region:            getEnv("S3_REGION_NAME", "us-east-1"),
		S3AccessKeyID:       getEnv("S3_ACCESS_KEY_ID", "minioadmin"),
		S3SecretAccessKey:   getEnv("S3_SECRET_ACCESS_KEY", "minioadmin"),
		S3BucketPreviews:    getEnv("S3_BUCKET_PREVIEWS", "map-previews"),
		S3BucketArtifacts:   getEnv("S3_BUCKET_ARTIFACTS", "map-artifacts"),
		S3Secure:            getEnvBool("S3_SECURE", false),

		PreviewTTLSeconds:      getEnvInt("PREVIEW_TTL_SECONDS", 60*60*12),
		PreviewRasterDPI:       getEnvInt("PREVIEW_RASTER_DPI", 120),
		ArtifactTTLSeconds:     getEnvInt("ARTIFACT_TTL_SECONDS", 60*60*24),
		PresignedURLTTLSeconds: getEnvInt("PRESIGNED_URL_TTL_SECONDS", 60*60),

		CaptchaRequired:    getEnvBool("CAPTCHA_REQUIRED", false),
		TurnstileSecret:    getEnv("TURNSTILE_SECRET_KEY", ""),
		TurnstileVerifyURL: getEnv("TURNSTILE_VERIFY_URL", "https://challenges.cloudflare.com/turnstile/v0/siteverify"),

		RateLimitPreviewCount:       getEnvInt("RATE_LIMIT_PREVIEW_COUNT", 20),
		RateLimitPreviewWindowSec:   getEnvInt("RATE_LIMIT_PREVIEW_WINDOW_SECONDS", 600),
		RateLimitLocationsCount:     getEnvInt("RATE_LIMIT_LOCATIONS_COUNT", 60),
		RateLimitLocationsWindowSec: getEnvInt("RATE_LIMIT_LOCATIONS_WINDOW_SECONDS", 600),
		RateLimitFontsCount:         getEnvInt("RATE_LIMIT_FONTS_COUNT", 120),
		RateLimitFontsWindowSec:     getEnvInt("RATE_LIMIT_FONTS_WINDOW_SECONDS", 600),
		RateLimitJobsCount:          getEnvInt("RATE_LIMIT_JOBS_COUNT", 3),
		RateLimitJobsWindowSec:      getEnvInt("RATE_LIMIT_JOBS_WINDOW_SECONDS", 600),
		RateLimitConcurrentPerIP:    getEnvInt("RATE_LIMIT_MAX_CONCURRENT_JOBS_PER_IP", 2),

		RequestTimeoutSeconds: getEnvInt("REQUEST_TIMEOUT_SECONDS", 60),
		NominatimSearchURL:    getEnv("NOMINATIM_SEARCH_URL", "https://nominatim.openstreetmap.org/search"),
		NominatimUserAgent:    getEnv("NOMINATIM_USER_AGENT", "city-map-poster-generator/2.0"),
		OverpassURL:           getEnv("OVERPASS_URL", "https://overpass-api.de/api/interpreter"),

		GoogleFontsAPIURL:          getEnv("GOOGLE_FONTS_API_URL", "https://www.googleapis.com/webfonts/v1/webfonts"),
		GoogleFontsAPIKey:          getEnv("GOOGLE_FONTS_API_KEY", ""),
		GoogleFontsMetadataURL:     getEnv("GOOGLE_FONTS_METADATA_URL", "https://fonts.google.com/metadata/fonts"),
		GoogleFontsCacheTTLSeconds: getEnvInt("GOOGLE_FONTS_CACHE_TTL_SECONDS", 60*60*24),

		ThemesCacheTTLSeconds:    getEnvInt("THEMES_CACHE_TTL_SECONDS", 60*60),
		FontsCacheTTLSeconds:     getEnvInt("FONTS_CACHE_TTL_SECONDS", 15*60),
		LocationsCacheTTLSeconds: getEnvInt("LOCATIONS_CACHE_TTL_SECONDS", 5*60),
		GeocodeCacheTTLSeconds:   getEnvInt("GEOCODE_CACHE_TTL_SECONDS", 30*60),
		OverpassCacheTTLSeconds:  getEnvInt("OVERPASS_CACHE_TTL_SECONDS", 60*60),
		WorkerThemeParallelism:   getEnvInt("WORKER_THEME_PARALLELISM", 2),

		CacheDir:  getEnv("CACHE_DIR", "/tmp/map-cache"),
		AssetsDir: getEnv("ASSETS_DIR", "/app/assets"),
	}

	if strings.TrimSpace(cfg.RedisURL) == "" {
		return Config{}, fmt.Errorf("REDIS_URL must be set")
	}
	if strings.TrimSpace(cfg.S3EndpointURL) == "" {
		return Config{}, fmt.Errorf("S3_ENDPOINT_URL must be set")
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func getEnvInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return fallback
	}
	switch v {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}
