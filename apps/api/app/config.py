from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "City Map Poster API"
    app_env: str = "development"
    app_base_url: str = "http://localhost:8000"

    redis_url: str = "redis://localhost:6379/0"
    rq_queue_name: str = "map_jobs"

    s3_endpoint_url: str = "http://localhost:9000"
    s3_public_endpoint_url: str = "http://localhost:9000"
    s3_region_name: str = "us-east-1"
    s3_access_key_id: str = "minioadmin"
    s3_secret_access_key: str = "minioadmin"
    s3_bucket_previews: str = "map-previews"
    s3_bucket_artifacts: str = "map-artifacts"
    s3_secure: bool = False

    preview_ttl_seconds: int = 60 * 60 * 12
    preview_raster_dpi: int = 120
    preview_network_type: str = "drive"
    preview_include_water: bool = False
    preview_include_parks: bool = False
    artifact_ttl_seconds: int = 60 * 60 * 24
    presigned_url_ttl_seconds: int = 60 * 60

    turnstile_secret_key: str = ""
    turnstile_verify_url: str = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    captcha_required: bool = False

    rate_limit_preview_count: int = 20
    rate_limit_preview_window_seconds: int = 600
    rate_limit_locations_count: int = 60
    rate_limit_locations_window_seconds: int = 600
    rate_limit_jobs_count: int = 5
    rate_limit_jobs_window_seconds: int = 600
    rate_limit_max_concurrent_jobs_per_ip: int = 2

    request_timeout_seconds: int = 60
    nominatim_search_url: str = "https://nominatim.openstreetmap.org/search"
    nominatim_user_agent: str = "city-map-poster-generator/1.0"
    google_fonts_metadata_url: str = "https://fonts.google.com/metadata/fonts"
    google_fonts_cache_ttl_seconds: int = 60 * 60 * 24
    rate_limit_fonts_count: int = 120
    rate_limit_fonts_window_seconds: int = 600

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
