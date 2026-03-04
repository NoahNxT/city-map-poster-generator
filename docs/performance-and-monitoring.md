# Performance Budgets, Lighthouse, and API Monitoring

## CI Performance Gates

This repository now enforces frontend transfer budgets and Lighthouse assertions in CI.

- Workflow: `.github/workflows/performance-seo-ci.yml`
- Budget script: `apps/web/scripts/check-performance-budgets.mjs`
- Lighthouse config: `apps/web/lighthouserc.json`

### Budget checks

The budget script reads built artifacts from `apps/web/.next` and validates:

- Home HTML gzip size (`/en`)
- Script tag count in prerendered home HTML
- Initial JS gzip size derived from script tags
- Largest client chunk gzip size

Override thresholds with environment variables:

- `PERF_BUDGET_HOME_HTML_GZIP_BYTES`
- `PERF_BUDGET_HOME_SCRIPT_COUNT`
- `PERF_BUDGET_LOCALE_INITIAL_JS_GZIP_BYTES`
- `PERF_BUDGET_LARGEST_CHUNK_GZIP_BYTES`
- `PERF_BUDGET_LOCALE` (default: `en`)

Run manually:

```bash
NEXT_PUBLIC_SITE_URL=https://example.com bun run --cwd apps/web build
bun run --cwd apps/web perf:budget
```

### Lighthouse CI

Lighthouse runs against `/en` and asserts:

- SEO >= 0.98
- Performance >= 0.85
- CLS and key UX metric thresholds

Run manually:

```bash
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 bun run --cwd apps/web build
bunx --package @lhci/cli lhci autorun --config=apps/web/lighthouserc.json
```

## API Metrics and Dashboards

The API exposes Prometheus metrics at `/metrics`.

Tracked latency routes:

- `/v2/locations`
- `/v2/preview`
- `/v2/render/snapshot`

Tracked cache hit/miss counters:

- `geocode`
- `preview`
- `snapshot`

### Local monitoring stack

Monitoring assets:

- Prometheus config: `ops/monitoring/prometheus/prometheus.yml`

The local Docker compose now includes:

- Prometheus at `http://localhost:9090`

## k6 Latency Tests

Load scripts are provided for key endpoints:

- `apps/api/perf/k6/locations.js`
- `apps/api/perf/k6/snapshot.js`

Run examples:

```bash
API_BASE_URL=http://localhost:8000 bun run perf:k6:locations
API_BASE_URL=http://localhost:8000 bun run perf:k6:snapshot
```
