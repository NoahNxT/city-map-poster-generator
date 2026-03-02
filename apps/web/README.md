# web

Next.js frontend for City Map Poster Generator.

## Commands

```bash
bun run --cwd apps/web dev
bun run --cwd apps/web build
bun run --cwd apps/web start
bun run --cwd apps/web check-types
```

## UI Notes

- Live preview attempts `local-wasm` rendering first and falls back to server preview when needed.
- In development builds (`NODE_ENV != production`), a `Dev settings` toggle appears next to the language selector.
- When enabled, it reveals a full-width development settings card above the map controls and live preview columns.
- Development toggles can disable API rate limits and CAPTCHA checks for local testing.
