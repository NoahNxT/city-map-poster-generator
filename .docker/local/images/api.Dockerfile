FROM golang:1.24-alpine AS builder

WORKDIR /src

COPY apps/api/go.mod ./go.mod
COPY apps/api/go.sum ./go.sum
RUN /usr/local/go/bin/go mod download

COPY apps/api .
RUN /usr/local/go/bin/go build -o /out/api ./cmd/api && /usr/local/go/bin/go build -o /out/worker ./cmd/worker

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=builder /out/api /app/api
COPY --from=builder /out/worker /app/worker
COPY --from=builder /src/assets /app/assets

ENV ASSETS_DIR=/app/assets
EXPOSE 8000

CMD ["/app/api"]
