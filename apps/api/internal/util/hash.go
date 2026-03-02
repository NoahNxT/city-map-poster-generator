package util

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"city-map-poster-generator/apps/api/internal/types"
)

const PreviewCacheVersion = "v5"
const SnapshotCacheVersion = "v1"

func PreviewCacheKey(req types.GenerateRequest) (string, error) {
	payload := req
	payload.Format = types.OutputPNG
	payload.AllThemes = false

	canonical, err := payload.CanonicalJSON()
	if err != nil {
		return "", err
	}
	wrapper, err := json.Marshal(map[string]any{
		"payload":  json.RawMessage(canonical),
		"_version": PreviewCacheVersion,
	})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(wrapper)
	return "preview:" + hex.EncodeToString(sum[:]), nil
}

func SnapshotCacheKey(req types.RenderSnapshotRequest, resolvedLat float64, resolvedLon float64) (string, error) {
	payload := map[string]any{
		"city":         strings.TrimSpace(req.City),
		"country":      strings.TrimSpace(req.Country),
		"latitude":     req.Latitude,
		"longitude":    req.Longitude,
		"distance":     req.Distance,
		"width":        req.Width,
		"height":       req.Height,
		"includeWater": req.IncludeWater,
		"includeParks": req.IncludeParks,
		"resolvedLat":  fmt.Sprintf("%.7f", resolvedLat),
		"resolvedLon":  fmt.Sprintf("%.7f", resolvedLon),
		"_version":     SnapshotCacheVersion,
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(encoded)
	return "snapshot:" + hex.EncodeToString(sum[:]), nil
}
