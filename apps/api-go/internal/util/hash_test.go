package util

import (
	"testing"

	"city-map-poster-generator/apps/api-go/internal/types"
)

func TestPreviewCacheKeyStable(t *testing.T) {
	req := types.GenerateRequest{
		City:             "Antwerp",
		Country:          "Belgium",
		Theme:            "terracotta",
		IncludeWater:     true,
		IncludeParks:     true,
		LabelPadding:     1,
		TextBlurEnabled:  false,
		TextBlurSize:     1,
		TextBlurStrength: 8,
		Distance:         12000,
		Width:            12,
		Height:           16,
		Format:           types.OutputPDF,
	}
	keyA, err := PreviewCacheKey(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	keyB, err := PreviewCacheKey(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if keyA != keyB {
		t.Fatalf("expected stable key, got %s and %s", keyA, keyB)
	}
}
