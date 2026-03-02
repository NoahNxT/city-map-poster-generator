package render

import (
	"bytes"
	"strings"
	"testing"

	"city-map-poster-generator/apps/api-go/internal/fonts"
	"city-map-poster-generator/apps/api-go/internal/osm"
	"city-map-poster-generator/apps/api-go/internal/types"
)

func sampleFeatures() *osm.FeatureSet {
	return &osm.FeatureSet{
		Nodes: map[int64]osm.Node{
			1: {ID: 1, Lat: 51.22, Lon: 4.39},
			2: {ID: 2, Lat: 51.23, Lon: 4.39},
			3: {ID: 3, Lat: 51.23, Lon: 4.40},
			4: {ID: 4, Lat: 51.22, Lon: 4.40},
		},
		Roads:  []osm.Way{{ID: 10, Nodes: []int64{1, 2, 3, 4}, Tags: map[string]string{"highway": "primary"}}},
		Water:  []osm.Way{{ID: 20, Nodes: []int64{1, 2, 3, 4, 1}, Tags: map[string]string{"natural": "water"}}},
		Parks:  []osm.Way{{ID: 30, Nodes: []int64{1, 2, 3, 4, 1}, Tags: map[string]string{"leisure": "park"}}},
		Center: [2]float64{51.22, 4.39},
	}
}

func sampleRequest(format types.OutputFormat) types.GenerateRequest {
	return types.GenerateRequest{
		City:             "Antwerp",
		Country:          "Belgium",
		Theme:            "terracotta",
		IncludeWater:     true,
		IncludeParks:     true,
		LabelPadding:     1,
		TextBlurEnabled:  true,
		TextBlurSize:     1.2,
		TextBlurStrength: 10,
		Distance:         12000,
		Width:            6,
		Height:           8,
		Format:           format,
	}
}

func samplePalette() palette {
	return newPalette(types.Theme{Colors: map[string]string{
		"bg":               "#F5EDE4",
		"text":             "#8B4513",
		"gradient_color":   "#F5EDE4",
		"water":            "#A8C4C4",
		"parks":            "#E8E0D0",
		"road_motorway":    "#A0522D",
		"road_primary":     "#B8653A",
		"road_secondary":   "#C9846A",
		"road_tertiary":    "#D9A08A",
		"road_residential": "#E5C4B0",
		"road_default":     "#D9A08A",
	}})
}

func TestRenderSVGIsNativeVector(t *testing.T) {
	req := sampleRequest(types.OutputSVG)
	svg, err := renderSVG(req, samplePalette(), sampleFeatures(), 51.22, 4.39, fonts.FontPaths{})
	if err != nil {
		t.Fatalf("render svg failed: %v", err)
	}
	content := string(svg)
	if !strings.Contains(content, "<svg") {
		t.Fatalf("expected svg element")
	}
	if strings.Contains(content, "data:image/png") {
		t.Fatalf("expected native svg primitives, got embedded PNG data URI")
	}
	if !strings.Contains(content, "<polyline") {
		t.Fatalf("expected road polyline in svg output")
	}
}

func TestRenderPDFIsNativePDF(t *testing.T) {
	req := sampleRequest(types.OutputPDF)
	pdf, err := renderPDF(req, samplePalette(), sampleFeatures(), 51.22, 4.39, fonts.FontPaths{})
	if err != nil {
		t.Fatalf("render pdf failed: %v", err)
	}
	if len(pdf) < 4 || !bytes.Equal(pdf[:4], []byte("%PDF")) {
		t.Fatalf("expected PDF header")
	}
}
