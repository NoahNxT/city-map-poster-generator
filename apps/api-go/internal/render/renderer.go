package render

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image/png"
	"math"
	"path/filepath"
	"sort"
	"strings"

	"city-map-poster-generator/apps/api-go/internal/fonts"
	"city-map-poster-generator/apps/api-go/internal/osm"
	"city-map-poster-generator/apps/api-go/internal/types"
	"github.com/fogleman/gg"
	"github.com/jung-kurt/gofpdf"
)

type CoordinateResolver interface {
	Resolve(ctx context.Context, city string, country string) (float64, float64, error)
}

type Renderer struct {
	osmClient   *osm.Client
	fontService *fonts.Service
	themes      map[string]types.Theme
}

type RenderProfile struct {
	RasterDPI int
}

type RenderResult struct {
	Bytes       []byte
	ContentType string
}

func New(osmClient *osm.Client, fontService *fonts.Service, themeList []types.Theme) *Renderer {
	themeMap := make(map[string]types.Theme, len(themeList))
	for _, theme := range themeList {
		themeMap[theme.ID] = theme
	}
	return &Renderer{
		osmClient:   osmClient,
		fontService: fontService,
		themes:      themeMap,
	}
}

func (r *Renderer) ThemeExists(themeID string) bool {
	_, ok := r.themes[themeID]
	return ok
}

func (r *Renderer) ThemeIDs() []string {
	out := make([]string, 0, len(r.themes))
	for k := range r.themes {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func (r *Renderer) Render(ctx context.Context, req types.GenerateRequest, lat, lon float64, profile RenderProfile) (RenderResult, error) {
	theme, ok := r.themes[req.Theme]
	if !ok {
		return RenderResult{}, fmt.Errorf("unknown theme: %s", req.Theme)
	}
	if profile.RasterDPI <= 0 {
		profile.RasterDPI = 300
	}

	features, err := r.osmClient.Fetch(ctx, lat, lon, req.Distance, req.IncludeWater, req.IncludeParks, "all")
	if err != nil {
		return RenderResult{}, err
	}
	widthPx := maxInt(64, int(math.Round(req.Width*float64(profile.RasterDPI))))
	heightPx := maxInt(64, int(math.Round(req.Height*float64(profile.RasterDPI))))

	dc := gg.NewContext(widthPx, heightPx)
	palette := newPalette(theme)
	drawPoster(dc, req, palette, features, lat, lon, widthPx, heightPx, profile.RasterDPI, r.fontService)

	pngBytes, err := encodePNG(dc)
	if err != nil {
		return RenderResult{}, err
	}

	switch req.Format {
	case types.OutputPNG:
		return RenderResult{Bytes: pngBytes, ContentType: "image/png"}, nil
	case types.OutputSVG:
		svg := wrapPNGAsSVG(pngBytes, widthPx, heightPx)
		return RenderResult{Bytes: svg, ContentType: "image/svg+xml"}, nil
	case types.OutputPDF:
		pdfBytes, err := pngToPDF(pngBytes, req.Width, req.Height)
		if err != nil {
			return RenderResult{}, err
		}
		return RenderResult{Bytes: pdfBytes, ContentType: "application/pdf"}, nil
	default:
		return RenderResult{}, fmt.Errorf("unsupported format")
	}
}

type palette struct {
	BG            string
	Text          string
	GradientColor string
	Water         string
	Parks         string
	RoadMotorway  string
	RoadPrimary   string
	RoadSecondary string
	RoadTertiary  string
	RoadResidential string
	RoadDefault   string
}

func newPalette(theme types.Theme) palette {
	color := func(key, fallback string) string {
		if value, ok := theme.Colors[key]; ok && strings.TrimSpace(value) != "" {
			return value
		}
		return fallback
	}
	return palette{
		BG:             color("bg", "#F5EDE4"),
		Text:           color("text", "#8B4513"),
		GradientColor:  color("gradient_color", color("bg", "#F5EDE4")),
		Water:          color("water", "#A8C4C4"),
		Parks:          color("parks", "#E8E0D0"),
		RoadMotorway:   color("road_motorway", "#A0522D"),
		RoadPrimary:    color("road_primary", "#B8653A"),
		RoadSecondary:  color("road_secondary", "#C9846A"),
		RoadTertiary:   color("road_tertiary", "#D9A08A"),
		RoadResidential: color("road_residential", "#E5C4B0"),
		RoadDefault:    color("road_default", "#D9A08A"),
	}
}

type projectedNode struct {
	x float64
	y float64
}

func drawPoster(
	dc *gg.Context,
	req types.GenerateRequest,
	palette palette,
	features *osm.FeatureSet,
	lat float64,
	lon float64,
	widthPx int,
	heightPx int,
	dpi int,
	fontSvc *fonts.Service,
) {
	dc.SetHexColor(palette.BG)
	dc.Clear()

	projected, minX, minY, spanX, spanY := projectNodes(features, float64(widthPx)/float64(heightPx), lat)

	if req.IncludeWater {
		dc.SetHexColor(palette.Water)
		for _, way := range features.Water {
			drawWayPolygon(dc, way, projected)
		}
	}
	if req.IncludeParks {
		dc.SetHexColor(palette.Parks)
		for _, way := range features.Parks {
			drawWayPolygon(dc, way, projected)
		}
	}

	scaleFactor := math.Min(req.Width, req.Height) / 12.0
	for _, way := range features.Roads {
		if len(way.Nodes) < 2 {
			continue
		}
		color := roadColor(palette, way.Tags["highway"])
		width := roadWidth(way.Tags["highway"], scaleFactor, float64(dpi)/160)
		dc.SetHexColor(color)
		dc.SetLineWidth(width)
		drawWayLine(dc, way, projected)
	}

	drawGradient(dc, palette.GradientColor, widthPx, heightPx)

	fontPaths := fontSvc.ResolveFontPaths(context.Background(), req.FontFamily)
	_ = fonts.EnsureFontFiles(fontPaths)
	drawLabels(dc, req, fontPaths, palette, lat, lon, widthPx, heightPx, dpi)

	_ = minX
	_ = minY
	_ = spanX
	_ = spanY
}

func projectNodes(features *osm.FeatureSet, targetAspect float64, centerLat float64) (map[int64]projectedNode, float64, float64, float64, float64) {
	out := make(map[int64]projectedNode, len(features.Nodes))
	if len(features.Nodes) == 0 {
		return out, 0, 0, 1, 1
	}
	latScale := math.Cos(centerLat * math.Pi / 180)
	if latScale < 0.0001 {
		latScale = 0.0001
	}
	first := true
	var minX, maxX, minY, maxY float64
	for id, node := range features.Nodes {
		x := node.Lon * latScale
		y := node.Lat
		out[id] = projectedNode{x: x, y: y}
		if first {
			minX, maxX, minY, maxY = x, x, y, y
			first = false
		} else {
			if x < minX {
				minX = x
			}
			if x > maxX {
				maxX = x
			}
			if y < minY {
				minY = y
			}
			if y > maxY {
				maxY = y
			}
		}
	}
	spanX := maxX - minX
	spanY := maxY - minY
	if spanX <= 0 {
		spanX = 1e-6
	}
	if spanY <= 0 {
		spanY = 1e-6
	}
	dataAspect := spanX / spanY
	if dataAspect > targetAspect {
		desiredY := spanX / targetAspect
		delta := (desiredY - spanY) / 2
		minY -= delta
		maxY += delta
	} else {
		desiredX := spanY * targetAspect
		delta := (desiredX - spanX) / 2
		minX -= delta
		maxX += delta
	}
	spanX = maxX - minX
	spanY = maxY - minY
	for id, node := range out {
		nx := (node.x - minX) / spanX
		ny := (node.y - minY) / spanY
		out[id] = projectedNode{x: nx, y: 1 - ny}
	}
	return out, minX, minY, spanX, spanY
}

func drawWayPolygon(dc *gg.Context, way osm.Way, nodes map[int64]projectedNode) {
	if len(way.Nodes) < 3 || way.Nodes[0] != way.Nodes[len(way.Nodes)-1] {
		return
	}
	started := false
	for _, nodeID := range way.Nodes {
		point, ok := nodes[nodeID]
		if !ok {
			continue
		}
		x := point.x * float64(dc.Width())
		y := point.y * float64(dc.Height())
		if !started {
			dc.MoveTo(x, y)
			started = true
		} else {
			dc.LineTo(x, y)
		}
	}
	if started {
		dc.ClosePath()
		dc.Fill()
	}
}

func drawWayLine(dc *gg.Context, way osm.Way, nodes map[int64]projectedNode) {
	started := false
	for _, nodeID := range way.Nodes {
		point, ok := nodes[nodeID]
		if !ok {
			continue
		}
		x := point.x * float64(dc.Width())
		y := point.y * float64(dc.Height())
		if !started {
			dc.MoveTo(x, y)
			started = true
		} else {
			dc.LineTo(x, y)
		}
	}
	if started {
		dc.Stroke()
	}
}

func roadColor(p palette, highway string) string {
	switch highway {
	case "motorway", "motorway_link":
		return p.RoadMotorway
	case "trunk", "trunk_link", "primary", "primary_link":
		return p.RoadPrimary
	case "secondary", "secondary_link":
		return p.RoadSecondary
	case "tertiary", "tertiary_link", "unclassified":
		return p.RoadTertiary
	case "residential", "living_street", "service":
		return p.RoadResidential
	default:
		return p.RoadDefault
	}
}

func roadWidth(highway string, scaleFactor float64, dpiScale float64) float64 {
	base := 0.9
	switch highway {
	case "motorway", "motorway_link":
		base = 2.3
	case "trunk", "trunk_link", "primary", "primary_link":
		base = 1.8
	case "secondary", "secondary_link":
		base = 1.4
	case "tertiary", "tertiary_link", "unclassified":
		base = 1.1
	case "residential", "living_street", "service":
		base = 0.8
	}
	return math.Max(0.2, base*scaleFactor*dpiScale)
}

func drawGradient(dc *gg.Context, color string, widthPx, heightPx int) {
	dc.SetHexColor(color)
	steps := 40
	for i := 0; i < steps; i++ {
		t := float64(i) / float64(steps)
		a := 0.7 * (1 - t)
		dc.SetRGBA255(255, 255, 255, 0)
		_ = a
	}
	for i := 0; i < steps; i++ {
		t := float64(i) / float64(steps)
		alpha := (1 - t) * 0.35
		dc.SetHexColor(color)
		dc.SetRGBA(1, 1, 1, 0)
		_ = alpha
	}
	// Lightweight gradient approximation by stacked translucent bars.
	for i := 0; i < 70; i++ {
		t := float64(i) / 70
		alpha := (1 - t) * 0.08
		dc.SetHexColor(color)
		dc.SetRGBA(0, 0, 0, 0)
		_ = alpha
	}
	for i := 0; i < 90; i++ {
		t := float64(i) / 90
		alpha := (1 - t) * 0.30
		dc.SetHexColor(color)
		dc.SetRGBA(0.96, 0.93, 0.88, alpha)
		dc.DrawRectangle(0, float64(heightPx)-float64(i+1), float64(widthPx), 1)
		dc.Fill()
		dc.DrawRectangle(0, float64(i), float64(widthPx), 1)
		dc.Fill()
	}
}

func drawLabels(dc *gg.Context, req types.GenerateRequest, fontPaths fonts.FontPaths, palette palette, lat, lon float64, widthPx, heightPx int, dpi int) {
	labelColor := palette.Text
	if req.TextColor != nil && strings.TrimSpace(*req.TextColor) != "" {
		labelColor = strings.TrimSpace(*req.TextColor)
	}
	scaleFactor := math.Min(req.Width, req.Height) / 12.0
	baseMain := 60.0
	baseSub := 22.0
	baseCoords := 14.0

	displayCity := req.City
	if isLikelyLatin(displayCity) {
		displayCity = strings.ToUpper(displayCity)
		displayCity = strings.Join(strings.Split(displayCity, ""), "  ")
	}
	cityRaw := strings.TrimSpace(req.City)
	adjustedMain := baseMain * scaleFactor
	if req.CityFontSize != nil {
		adjustedMain = *req.CityFontSize * scaleFactor
	} else if len(cityRaw) > 10 {
		lengthFactor := 10.0 / float64(len(cityRaw))
		adjustedMain = math.Max(adjustedMain*lengthFactor, 10.0*scaleFactor)
	}
	subFont := baseSub * scaleFactor
	if req.CountryFontSize != nil {
		subFont = *req.CountryFontSize * scaleFactor
	}
	coordsFont := baseCoords * scaleFactor
	attrFont := math.Max(4, 5*scaleFactor)

	dynamicGapScale := math.Max(math.Max(adjustedMain/math.Max(baseMain*scaleFactor, 1e-6), subFont/math.Max(baseSub*scaleFactor, 1e-6)), 1.0)
	minGap := 0.004 * req.LabelPadding * dynamicGapScale
	pointToAxis := 1.0 / (req.Height * 72.0)
	cityDesc := adjustedMain * 0.22 * pointToAxis
	countryAscent := subFont * 0.72 * pointToAxis
	countryDesc := subFont * 0.22 * pointToAxis
	coordsAscent := coordsFont * 0.72 * pointToAxis

	coordsY := 0.07
	countryY := 0.10
	coordsTop := coordsY + coordsAscent
	if countryY-countryDesc < coordsTop+minGap {
		countryY = coordsTop + minGap + countryDesc
	}
	dividerY := math.Max(0.125, countryY+countryAscent+minGap)
	cityY := math.Min(math.Max(0.14, dividerY+cityDesc+minGap), 0.32)

	if req.TextBlurEnabled {
		blurSize := req.TextBlurSize
		blurStrength := req.TextBlurStrength
		panelWidth := clamp(0.52*blurSize, 0.34, 0.9)
		panelHeight := clamp(0.14*blurSize, 0.08, 0.34)
		panelCenterY := (cityY + coordsY) / 2.0
		panelX := 0.5 - panelWidth/2
		panelY := clamp(panelCenterY-panelHeight/2, 0, 1-panelHeight)
		blurScale := clamp(blurStrength/30.0, 0, 1)
		layers := maxInt(2, int(math.Round(4+blurScale*10)))
		coreAlpha := 0.10 + 0.22*blurScale
		edgeAlpha := 0.04 + 0.14*blurScale
		cornerRadius := 0.02 * blurSize

		for layer := layers; layer > 0; layer-- {
			t := float64(layer) / float64(layers)
			spread := (1 - t) * (0.06 * blurSize)
			alpha := (edgeAlpha * (t * t)) / float64(layers)
			dc.SetHexColor(palette.BG)
			dc.SetRGBA(0.96, 0.93, 0.88, alpha)
			x := (panelX - spread) * float64(widthPx)
			y := (1 - (panelY+panelHeight+spread)) * float64(heightPx)
			w := (panelWidth + (spread * 2)) * float64(widthPx)
			h := (panelHeight + (spread * 2)) * float64(heightPx)
			r := (cornerRadius + spread) * math.Min(float64(widthPx), float64(heightPx))
			dc.DrawRoundedRectangle(x, y, w, h, r)
			dc.Fill()
		}
		dc.SetHexColor(palette.BG)
		dc.SetRGBA(0.96, 0.93, 0.88, coreAlpha)
		x := panelX * float64(widthPx)
		y := (1 - (panelY + panelHeight)) * float64(heightPx)
		w := panelWidth * float64(widthPx)
		h := panelHeight * float64(heightPx)
		r := cornerRadius * math.Min(float64(widthPx), float64(heightPx))
		dc.DrawRoundedRectangle(x, y, w, h, r)
		dc.Fill()
	}

	ptToPx := float64(dpi) / 72.0
	citySizePx := adjustedMain * ptToPx
	subSizePx := subFont * ptToPx
	coordsSizePx := coordsFont * ptToPx
	attrSizePx := attrFont * ptToPx

	dc.SetHexColor(labelColor)
	if err := dc.LoadFontFace(filepath.Clean(fontPaths.Bold), citySizePx); err == nil {
		dc.DrawStringAnchored(displayCity, float64(widthPx)*0.5, (1-cityY)*float64(heightPx), 0.5, 0.5)
	}
	if err := dc.LoadFontFace(filepath.Clean(fontPaths.Light), subSizePx); err == nil {
		dc.DrawStringAnchored(strings.ToUpper(req.Country), float64(widthPx)*0.5, (1-countryY)*float64(heightPx), 0.5, 0.5)
	}
	if err := dc.LoadFontFace(filepath.Clean(fontPaths.Regular), coordsSizePx); err == nil {
		dc.SetHexColor(labelColor)
		dc.SetRGBA(0.2, 0.2, 0.2, 0.7)
		dc.DrawStringAnchored(formatCoords(lat, lon), float64(widthPx)*0.5, (1-coordsY)*float64(heightPx), 0.5, 0.5)
	}

	dc.SetHexColor(labelColor)
	dc.SetLineWidth(math.Max(1, scaleFactor*ptToPx))
	dc.DrawLine(float64(widthPx)*0.4, (1-dividerY)*float64(heightPx), float64(widthPx)*0.6, (1-dividerY)*float64(heightPx))
	dc.Stroke()

	if err := dc.LoadFontFace(filepath.Clean(fontPaths.Light), attrSizePx); err == nil {
		dc.SetHexColor(labelColor)
		dc.SetRGBA(0.2, 0.2, 0.2, 0.35)
		dc.DrawStringAnchored("© OpenStreetMap contributors", float64(widthPx)*0.995, (1-0.006)*float64(heightPx), 1, 1)
	}
}

func formatCoords(lat, lon float64) string {
	latHem := "N"
	if lat < 0 {
		latHem = "S"
	}
	lonHem := "E"
	if lon < 0 {
		lonHem = "W"
	}
	return fmt.Sprintf("%.4f° %s / %.4f° %s", math.Abs(lat), latHem, math.Abs(lon), lonHem)
}

func isLikelyLatin(input string) bool {
	for _, r := range input {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || strings.ContainsRune(" '\".,-()", r) {
			continue
		}
		return false
	}
	return true
}

func encodePNG(dc *gg.Context) ([]byte, error) {
	var out bytes.Buffer
	if err := png.Encode(&out, dc.Image()); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func wrapPNGAsSVG(pngBytes []byte, widthPx, heightPx int) []byte {
	b64 := base64.StdEncoding.EncodeToString(pngBytes)
	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d"><image href="data:image/png;base64,%s" x="0" y="0" width="%d" height="%d" /></svg>`, widthPx, heightPx, widthPx, heightPx, b64, widthPx, heightPx)
	return []byte(svg)
}

func pngToPDF(pngBytes []byte, widthIn, heightIn float64) ([]byte, error) {
	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr:        "pt",
		Size:           gofpdf.SizeType{Wd: widthIn * 72, Ht: heightIn * 72},
		OrientationStr: "P",
	})
	pdf.AddPage()
	opt := gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}
	name := "poster"
	pdf.RegisterImageOptionsReader(name, opt, bytes.NewReader(pngBytes))
	pdf.ImageOptions(name, 0, 0, widthIn*72, heightIn*72, false, opt, 0, "")
	var out bytes.Buffer
	if err := pdf.Output(&out); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
