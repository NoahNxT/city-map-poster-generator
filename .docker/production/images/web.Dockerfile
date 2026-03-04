FROM oven/bun:1.2.17

WORKDIR /app

COPY package.json bun.lock turbo.json biome.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/typescript-config ./packages/typescript-config

RUN bun install --frozen-lockfile

COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_PREVIEW_ENGINE=snapshot

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_PREVIEW_ENGINE=${NEXT_PUBLIC_PREVIEW_ENGINE}
ENV NODE_ENV=production

WORKDIR /app/apps/web
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start", "--hostname", "0.0.0.0", "--port", "3000"]
