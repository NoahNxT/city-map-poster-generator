FROM golang:1.24-alpine

RUN apk add --no-cache ca-certificates tzdata git

WORKDIR /app

RUN /usr/local/go/bin/go install github.com/air-verse/air@v1.52.3

ENV PATH="/go/bin:${PATH}"
ENV ASSETS_DIR=/app/assets

CMD ["air", "-c", ".air.api.toml"]
