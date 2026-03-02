package validation

import (
	"testing"

	"city-map-poster-generator/apps/api/internal/types"
)

func baseRequest() types.GenerateRequest {
	return types.GenerateRequest{
		City:             "Antwerp",
		Country:          "Belgium",
		Theme:            "terracotta",
		AllThemes:        false,
		IncludeWater:     true,
		IncludeParks:     true,
		LabelPadding:     1,
		TextBlurEnabled:  false,
		TextBlurSizeX:    1,
		TextBlurSizeY:    1,
		TextBlurStrength: 8,
		Distance:         12000,
		Width:            12,
		Height:           16,
		Format:           types.OutputPNG,
	}
}

func TestValidateGenerateRequest_AcceptsValidPayload(t *testing.T) {
	req := baseRequest()
	if err := ValidateGenerateRequest(&req); err != nil {
		t.Fatalf("expected valid payload, got error: %v", err)
	}
}

func TestValidateGenerateRequest_RejectsInvalidTextColor(t *testing.T) {
	req := baseRequest()
	invalid := "orange"
	req.TextColor = &invalid
	if err := ValidateGenerateRequest(&req); err == nil {
		t.Fatalf("expected validation error for textColor")
	}
}

func TestValidateGenerateRequest_RejectsHalfCoordinatePair(t *testing.T) {
	req := baseRequest()
	lat := "51.2"
	req.Latitude = &lat
	if err := ValidateGenerateRequest(&req); err == nil {
		t.Fatalf("expected validation error for incomplete lat/lon pair")
	}
}
