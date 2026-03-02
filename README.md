# City Map Poster Generator

Public, no-auth city poster generator built with a **Bun + Turborepo** monorepo:

- `apps/web`: Next.js (App Router) + Tailwind + `shadcn/ui`-style components + TanStack Query
- `apps/api`: FastAPI + Redis queue (RQ) + vendored `maptoposter` renderer
- `docker-compose.yml`: web, api, worker, redis, minio

## Stack

- Frontend: Next.js 16, React 19, Tailwind, `react-hook-form`, `zod`, `framer-motion`
- Backend: FastAPI, Redis, RQ worker, MinIO/S3, Cloudflare Turnstile verification
- Tooling: Bun workspaces, Turborepo, Biome, TypeScript, Pyright, Ruff, Pytest

## Node Runtime (nvm + latest LTS)

This repo is pinned to Node LTS with `.nvmrc`.

```bash
nvm install --lts
nvm use --lts
node -v
```

Expected version: `v24.14.0`.

## Quick Start

1. Install JS deps:

```bash
bun install
```

2. Copy environment template:

```bash
cp .env.example .env
```

3. Start full stack (recommended):

```bash
docker compose up --build
```

4. Open:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- MinIO Console: `http://localhost:9001`

## Local Dev (Frontend HMR, No Web Image Rebuilds)

Use Docker only for backend services and run the frontend dev server on host.
This gives you instant HMR via `next dev --turbopack`.

1. Start backend stack:

```bash
bun run dev:backend
```

2. Run frontend dev server (HMR enabled):

```bash
bun run dev:web
```

3. Open:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`

One-command variant:

```bash
bun run dev:local
```

Useful backend commands:

```bash
bun run dev:backend:logs
bun run dev:backend:down
```

## Local Dev Without Docker

Run services in separate terminals:

```bash
# terminal 1: web
bun run dev:web

# terminal 2: api
bun run dev:api

# terminal 3: worker
bun run dev:worker
```

You also need a local Redis + S3-compatible storage (or MinIO).

## Scripts

```bash
bun run dev           # turbo: web + api
bun run dev:web
bun run dev:api
bun run dev:worker

bun run lint          # biome (web) + ruff (api)
bun run check-types   # tsc/next + pyright
bun run format        # biome format
```

## API Endpoints

- `GET /health`
- `GET /v1/themes`
- `POST /v1/preview`
- `POST /v1/jobs`
- `GET /v1/jobs/{jobId}`
- `GET /v1/jobs/{jobId}/download`

## Feature Coverage (maptoposter parity)

- Required: city, country
- Optional: latitude/longitude overrides, distance, dimensions (`max=20`), labels, font family
- Themes: all bundled built-in themes
- Export formats: `png`, `svg`, `pdf`
- `allThemes`: generate every theme + ZIP output
- Preview caching + artifact storage with presigned downloads

## Theme Gallery Previews

The web app includes a static gallery preview for all built-in themes at:

- `apps/web/public/theme-previews/<theme-id>.svg`

Regenerate all theme previews:

```bash
bun run generate:theme-previews
```

Generator source:

- `scripts/generate_theme_previews.py`

## CAPTCHA and Rate Limiting

- Turnstile verification for generation endpoint (`/v1/jobs`) when `CAPTCHA_REQUIRED=true`
- IP rate limits:
  - Preview: `20 / 10 min`
  - Jobs: `5 / 10 min`
  - Concurrent jobs: `2`

Configure values in `.env`.

## Notes

- Current geocoder is public Nominatim (as requested). For higher production load, use a paid provider or self-hosted geocoder.
- Generated artifacts are intended to be short-lived (24h retention target).
