package util

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"city-map-poster-generator/apps/api-go/internal/types"
)

const PreviewCacheVersion = "v1"

func PreviewCacheKey(req types.GenerateRequest) (string, error) {
	payload := req
	payload.Format = types.OutputPNG
	payload.AllThemes = false

	canonical, err := payload.CanonicalJSON()
	if err != nil {
		return "", err
	}
	wrapper, err := json.Marshal(map[string]any{
		"payload":   json.RawMessage(canonical),
		"_version":  PreviewCacheVersion,
	})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(wrapper)
	return "preview:" + hex.EncodeToString(sum[:]), nil
}
