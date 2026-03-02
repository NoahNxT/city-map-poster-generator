FROM oven/bun:1.2.17 AS base
WORKDIR /app

COPY package.json turbo.json biome.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/typescript-config ./packages/typescript-config

RUN bun install

COPY apps/web ./apps/web

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["bun", "run", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
