package render

import (
	"bytes"
	"math"
	"strings"
	"testing"

	"city-map-poster-generator/apps/api/internal/fonts"
	"city-map-poster-generator/apps/api/internal/osm"
	"city-map-poster-generator/apps/api/internal/types"
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
		TextBlurSizeX:    1.2,
		TextBlurSizeY:    1.2,
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

func TestComputeLabelSpecMaintainsVerticalOrder(t *testing.T) {
	req := sampleRequest(types.OutputPNG)
	req.Width = 12
	req.Height = 16
	req.LabelPadding = 1.55
	req.TextBlurEnabled = false

	labels := computeLabelSpec(req, samplePalette(), 51.22, 4.39)

	if !(labels.CityY > labels.DividerY && labels.DividerY > labels.CountryY && labels.CountryY > labels.CoordsY) {
		t.Fatalf(
			"invalid label stack order city=%.4f divider=%.4f country=%.4f coords=%.4f",
			labels.CityY,
			labels.DividerY,
			labels.CountryY,
			labels.CoordsY,
		)
	}
}

func TestComputeLabelSpecPaddingExpandsGaps(t *testing.T) {
	baseReq := sampleRequest(types.OutputPNG)
	baseReq.Width = 12
	baseReq.Height = 16
	baseReq.TextBlurEnabled = false
	baseReq.LabelPadding = 1

	spaciousReq := baseReq
	spaciousReq.LabelPadding = 2.5

	base := computeLabelSpec(baseReq, samplePalette(), 51.22, 4.39)
	spacious := computeLabelSpec(spaciousReq, samplePalette(), 51.22, 4.39)

	baseCityGap := base.CityY - base.DividerY
	spaciousCityGap := spacious.CityY - spacious.DividerY
	if spaciousCityGap <= baseCityGap {
		t.Fatalf("expected larger city/divider gap when padding increases: base=%.5f spacious=%.5f", baseCityGap, spaciousCityGap)
	}

	baseCountryGap := base.CountryY - base.CoordsY
	spaciousCountryGap := spacious.CountryY - spacious.CoordsY
	if spaciousCountryGap <= baseCountryGap {
		t.Fatalf("expected larger country/coords gap when padding increases: base=%.5f spacious=%.5f", baseCountryGap, spaciousCountryGap)
	}
}

func TestComputeLabelSpecDividerPaddingIsSymmetric(t *testing.T) {
	req := sampleRequest(types.OutputPNG)
	req.Width = 12
	req.Height = 16
	req.LabelPadding = 1.55
	req.TextBlurEnabled = false

	labels := computeLabelSpec(req, samplePalette(), 51.22, 4.39)

	pointToAxis := 1.0 / (req.Height * 72.0)
	cityDescRatio := 0.26
	if isLikelyLatin(req.City) {
		cityDescRatio = 0.08
	}
	cityDesc := labels.CitySizePt * cityDescRatio * pointToAxis
	countryAscent := labels.CountrySizePt * 0.72 * pointToAxis

	gapAboveDivider := (labels.CityY - cityDesc) - labels.DividerY
	gapBelowDivider := labels.DividerY - (labels.CountryY + countryAscent)

	if math.Abs(gapAboveDivider-gapBelowDivider) > 1e-6 {
		t.Fatalf(
			"expected symmetric divider padding, got above=%.8f below=%.8f",
			gapAboveDivider,
			gapBelowDivider,
		)
	}
}

func TestComputeLabelSpecBlurStrengthAffectsBackdrop(t *testing.T) {
	weakReq := sampleRequest(types.OutputPNG)
	weakReq.TextBlurEnabled = true
	weakReq.TextBlurStrength = 2

	strongReq := weakReq
	strongReq.TextBlurStrength = 26

	weak := computeLabelSpec(weakReq, samplePalette(), 51.22, 4.39)
	strong := computeLabelSpec(strongReq, samplePalette(), 51.22, 4.39)

	if weak.Blur == nil || strong.Blur == nil {
		t.Fatalf("expected blur spec to be present")
	}
	if strong.Blur.CoreAlpha <= weak.Blur.CoreAlpha {
		t.Fatalf("expected stronger blur core alpha to increase: weak=%.4f strong=%.4f", weak.Blur.CoreAlpha, strong.Blur.CoreAlpha)
	}
	if strong.Blur.EdgeAlpha <= weak.Blur.EdgeAlpha {
		t.Fatalf("expected stronger blur edge alpha to increase: weak=%.4f strong=%.4f", weak.Blur.EdgeAlpha, strong.Blur.EdgeAlpha)
	}
	if strong.Blur.Layers <= weak.Blur.Layers {
		t.Fatalf("expected stronger blur to use more layers: weak=%d strong=%d", weak.Blur.Layers, strong.Blur.Layers)
	}
}
