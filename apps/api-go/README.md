# api-go

Go backend for City Map Poster Generator.

## Commands

```bash
bun run --cwd apps/api-go dev
bun run --cwd apps/api-go worker
bun run --cwd apps/api-go test
```

## API

- `GET /health`
- `GET /v2/themes`
- `GET /v2/locations`
- `GET /v2/fonts`
- `POST /v2/preview`
- `POST /v2/jobs`
- `GET /v2/jobs/{jobId}`
- `GET /v2/jobs/{jobId}/download`

## Runtime deps

- Redis (queue, state, rate limits)
- S3-compatible object storage (previews/artifacts)

## Fonts

- Search works with Google Fonts metadata/API.
- Rendering custom Google fonts in PNG/PDF uses downloadable font files from the Google Webfonts Developer API and therefore requires `GOOGLE_FONTS_API_KEY`.
