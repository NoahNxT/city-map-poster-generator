package render

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"html"
	"image/png"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"city-map-poster-generator/apps/api/internal/fonts"
	"city-map-poster-generator/apps/api/internal/osm"
	"city-map-poster-generator/apps/api/internal/types"
	"github.com/fogleman/gg"
	"github.com/jung-kurt/gofpdf"
)

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

type palette struct {
	BG              string
	Text            string
	GradientColor   string
	Water           string
	Parks           string
	RoadMotorway    string
	RoadPrimary     string
	RoadSecondary   string
	RoadTertiary    string
	RoadResidential string
	RoadDefault     string
}

type projectedNode struct {
	x float64
	y float64
}

type blurSpec struct {
	PanelX       float64
	PanelY       float64
	PanelW       float64
	PanelH       float64
	CornerRadius float64
	Layers       int
	EdgeAlpha    float64
	CoreAlpha    float64
	BlurSize     float64
}

type labelSpec struct {
	Color          string
	DisplayCity    string
	DisplayCountry string
	Coords         string
	CityY          float64
	CountryY       float64
	CoordsY        float64
	DividerY       float64
	CitySizePt     float64
	CountrySizePt  float64
	CoordsSizePt   float64
	AttrSizePt     float64
	DividerWidthPt float64
	Blur           *blurSpec
}

type rgb struct {
	R int
	G int
	B int
}

func New(osmClient *osm.Client, fontService *fonts.Service, themeList []types.Theme) *Renderer {
	themeMap := make(map[string]types.Theme, len(themeList))
	for _, theme := range themeList {
		themeMap[theme.ID] = theme
	}
	return &Renderer{osmClient: osmClient, fontService: fontService, themes: themeMap}
}

func (r *Renderer) ThemeExists(themeID string) bool {
	_, ok := r.themes[themeID]
	return ok
}

func (r *Renderer) ThemeIDs() []string {
	out := make([]string, 0, len(r.themes))
	for id := range r.themes {
		out = append(out, id)
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
	pal := newPalette(theme)
	fontPaths := r.fontService.ResolveFontPaths(ctx, req.FontFamily)
	_ = fonts.EnsureFontFiles(fontPaths)

	switch req.Format {
	case types.OutputPNG:
		data, err := renderPNG(req, pal, features, lat, lon, profile.RasterDPI, fontPaths)
		if err != nil {
			return RenderResult{}, err
		}
		return RenderResult{Bytes: data, ContentType: "image/png"}, nil
	case types.OutputSVG:
		data, err := renderSVG(req, pal, features, lat, lon, fontPaths)
		if err != nil {
			return RenderResult{}, err
		}
		return RenderResult{Bytes: data, ContentType: "image/svg+xml"}, nil
	case types.OutputPDF:
		data, err := renderPDF(req, pal, features, lat, lon, fontPaths)
		if err != nil {
			return RenderResult{}, err
		}
		return RenderResult{Bytes: data, ContentType: "application/pdf"}, nil
	default:
		return RenderResult{}, fmt.Errorf("unsupported format")
	}
}

func renderPNG(req types.GenerateRequest, pal palette, features *osm.FeatureSet, lat, lon float64, dpi int, fontPaths fonts.FontPaths) ([]byte, error) {
	widthPx := maxInt(64, int(math.Round(req.Width*float64(dpi))))
	heightPx := maxInt(64, int(math.Round(req.Height*float64(dpi))))
	dc := gg.NewContext(widthPx, heightPx)
	dc.SetHexColor(pal.BG)
	dc.Clear()

	projected, _, _, _, _ := projectNodes(features, float64(widthPx)/float64(heightPx), lat)
	drawMapPolygonsRaster(dc, req, pal, features, projected)
	drawRoadsRaster(dc, req, pal, features, projected, dpi)
	drawGradientRaster(dc, pal.GradientColor, float64(widthPx), float64(heightPx))

	labels := computeLabelSpec(req, pal, lat, lon)
	drawLabelsRaster(dc, req, labels, pal, fontPaths, float64(widthPx), float64(heightPx), dpi)

	var out bytes.Buffer
	if err := png.Encode(&out, dc.Image()); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func renderSVG(req types.GenerateRequest, pal palette, features *osm.FeatureSet, lat, lon float64, fontPaths fonts.FontPaths) ([]byte, error) {
	width := req.Width * 72
	height := req.Height * 72
	projected, _, _, _, _ := projectNodes(features, width/height, lat)
	labels := computeLabelSpec(req, pal, lat, lon)

	fontDefs := buildSVGFontDefs(fontPaths)
	familyLight := "PosterLight"
	familyRegular := "PosterRegular"
	familyBold := "PosterBold"
	if fontDefs == "" {
		familyLight = "serif"
		familyRegular = "serif"
		familyBold = "serif"
	}

	var b strings.Builder
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" width="%.2fin" height="%.2fin" viewBox="0 0 %.2f %.2f">`, req.Width, req.Height, width, height)
	if fontDefs != "" {
		b.WriteString("<defs><style>")
		b.WriteString(fontDefs)
		b.WriteString("</style></defs>")
	}
	fmt.Fprintf(&b, `<rect x="0" y="0" width="%.2f" height="%.2f" fill="%s"/>`, width, height, pal.BG)

	if req.IncludeWater {
		for _, way := range features.Water {
			points := wayPointsNormalized(way, projected, width, height)
			if len(points) < 3 || way.Nodes[0] != way.Nodes[len(way.Nodes)-1] {
				continue
			}
			fmt.Fprintf(&b, `<polygon points="%s" fill="%s"/>`, pointsToSVG(points), pal.Water)
		}
	}
	if req.IncludeParks {
		for _, way := range features.Parks {
			points := wayPointsNormalized(way, projected, width, height)
			if len(points) < 3 || way.Nodes[0] != way.Nodes[len(way.Nodes)-1] {
				continue
			}
			fmt.Fprintf(&b, `<polygon points="%s" fill="%s"/>`, pointsToSVG(points), pal.Parks)
		}
	}

	scaleFactor := math.Min(req.Width, req.Height) / 12.0
	for _, way := range features.Roads {
		points := wayPointsNormalized(way, projected, width, height)
		if len(points) < 2 {
			continue
		}
		lineWidth := roadWidth(way.Tags["highway"], scaleFactor, 1)
		fmt.Fprintf(&b, `<polyline points="%s" fill="none" stroke="%s" stroke-width="%.3f" stroke-linecap="round" stroke-linejoin="round"/>`, pointsToSVG(points), roadColor(pal, way.Tags["highway"]), lineWidth)
	}

	drawGradientSVG(&b, pal.GradientColor, width, height)
	drawLabelsSVG(&b, labels, pal, width, height, familyLight, familyRegular, familyBold)

	b.WriteString("</svg>")
	return []byte(b.String()), nil
}

func renderPDF(req types.GenerateRequest, pal palette, features *osm.FeatureSet, lat, lon float64, fontPaths fonts.FontPaths) ([]byte, error) {
	width := req.Width * 72
	height := req.Height * 72
	projected, _, _, _, _ := projectNodes(features, width/height, lat)
	labels := computeLabelSpec(req, pal, lat, lon)

	pdf := gofpdf.NewCustom(&gofpdf.InitType{
		UnitStr:        "pt",
		Size:           gofpdf.SizeType{Wd: width, Ht: height},
		OrientationStr: "P",
	})
	pdf.AddPage()
	fontLight := "PosterLight"
	fontRegular := "PosterRegular"
	fontBold := "PosterBold"

	pdf.AddUTF8Font("PosterLight", "", filepath.Clean(fontPaths.Light))
	pdf.AddUTF8Font("PosterRegular", "", filepath.Clean(fontPaths.Regular))
	pdf.AddUTF8Font("PosterBold", "", filepath.Clean(fontPaths.Bold))
	if pdf.Error() != nil {
		pdf = gofpdf.NewCustom(&gofpdf.InitType{
			UnitStr:        "pt",
			Size:           gofpdf.SizeType{Wd: width, Ht: height},
			OrientationStr: "P",
		})
		pdf.AddPage()
		fontLight = "Helvetica"
		fontRegular = "Helvetica"
		fontBold = "Helvetica"
	}

	bg := parseHexColor(pal.BG)
	pdf.SetFillColor(bg.R, bg.G, bg.B)
	pdf.Rect(0, 0, width, height, "F")

	if req.IncludeWater {
		waterColor := parseHexColor(pal.Water)
		pdf.SetFillColor(waterColor.R, waterColor.G, waterColor.B)
		for _, way := range features.Water {
			points := wayPointsPDF(way, projected, width, height)
			if len(points) < 3 || way.Nodes[0] != way.Nodes[len(way.Nodes)-1] {
				continue
			}
			pdf.Polygon(points, "F")
		}
	}
	if req.IncludeParks {
		parksColor := parseHexColor(pal.Parks)
		pdf.SetFillColor(parksColor.R, parksColor.G, parksColor.B)
		for _, way := range features.Parks {
			points := wayPointsPDF(way, projected, width, height)
			if len(points) < 3 || way.Nodes[0] != way.Nodes[len(way.Nodes)-1] {
				continue
			}
			pdf.Polygon(points, "F")
		}
	}

	scaleFactor := math.Min(req.Width, req.Height) / 12.0
	for _, way := range features.Roads {
		points := wayPointsPDF(way, projected, width, height)
		if len(points) < 2 {
			continue
		}
		lineColor := parseHexColor(roadColor(pal, way.Tags["highway"]))
		pdf.SetDrawColor(lineColor.R, lineColor.G, lineColor.B)
		pdf.SetLineWidth(roadWidth(way.Tags["highway"], scaleFactor, 1))
		for i := 1; i < len(points); i++ {
			pdf.Line(points[i-1].X, points[i-1].Y, points[i].X, points[i].Y)
		}
	}

	drawGradientPDF(pdf, pal.GradientColor, width, height)
	drawLabelsPDF(pdf, labels, pal, width, height, fontLight, fontRegular, fontBold)

	var out bytes.Buffer
	if err := pdf.Output(&out); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func drawMapPolygonsRaster(dc *gg.Context, req types.GenerateRequest, pal palette, features *osm.FeatureSet, projected map[int64]projectedNode) {
	if req.IncludeWater {
		dc.SetHexColor(pal.Water)
		for _, way := range features.Water {
			drawWayPolygon(dc, way, projected)
		}
	}
	if req.IncludeParks {
		dc.SetHexColor(pal.Parks)
		for _, way := range features.Parks {
			drawWayPolygon(dc, way, projected)
		}
	}
}

func drawRoadsRaster(dc *gg.Context, req types.GenerateRequest, pal palette, features *osm.FeatureSet, projected map[int64]projectedNode, dpi int) {
	scaleFactor := math.Min(req.Width, req.Height) / 12.0
	for _, way := range features.Roads {
		if len(way.Nodes) < 2 {
			continue
		}
		dc.SetHexColor(roadColor(pal, way.Tags["highway"]))
		dc.SetLineWidth(roadWidth(way.Tags["highway"], scaleFactor, float64(dpi)/160.0))
		drawWayLine(dc, way, projected)
	}
}

func drawGradientRaster(dc *gg.Context, color string, width, height float64) {
	for i := 0; i < 90; i++ {
		t := float64(i) / 90
		alpha := (1 - t) * 0.30
		dc.SetHexColor(color)
		dc.SetRGBA(0.96, 0.93, 0.88, alpha)
		dc.DrawRectangle(0, height-float64(i+1), width, 1)
		dc.Fill()
		dc.DrawRectangle(0, float64(i), width, 1)
		dc.Fill()
	}
}

func drawLabelsRaster(dc *gg.Context, req types.GenerateRequest, labels labelSpec, pal palette, fontPaths fonts.FontPaths, width, height float64, dpi int) {
	if labels.Blur != nil {
		drawBlurRaster(dc, labels.Blur, pal.BG, width, height)
	}

	ptToPx := float64(dpi) / 72.0
	citySize := labels.CitySizePt * ptToPx
	countrySize := labels.CountrySizePt * ptToPx
	coordsSize := labels.CoordsSizePt * ptToPx
	attrSize := labels.AttrSizePt * ptToPx
	dividerWidth := labels.DividerWidthPt * ptToPx

	if err := dc.LoadFontFace(filepath.Clean(fontPaths.Bold), citySize); err == nil {
		dc.SetHexColor(labels.Color)
		dc.DrawStringAnchored(labels.DisplayCity, width*0.5, axisToCanvasY(labels.CityY, height), 0.5, 0.5)
	}
	if err := dc.LoadFontFace(filepath.Clean(fontPaths.Light), countrySize); err == nil {
		dc.SetHexColor(labels.Color)
		dc.DrawStringAnchored(labels.DisplayCountry, width*0.5, axisToCanvasY(labels.CountryY, height), 0.5, 0.5)
	}
	if err := dc.LoadFontFace(filepath.Clean(fontPaths.Regular), coordsSize); err == nil {
		dc.SetHexColor(labels.Color)
		dc.SetRGBA(0.2, 0.2, 0.2, 0.7)
		dc.DrawStringAnchored(labels.Coords, width*0.5, axisToCanvasY(labels.CoordsY, height), 0.5, 0.5)
	}

	dc.SetHexColor(labels.Color)
	dc.SetLineWidth(math.Max(0.5, dividerWidth))
	y := axisToCanvasY(labels.DividerY, height)
	dc.DrawLine(width*0.4, y, width*0.6, y)
	dc.Stroke()

	if err := dc.LoadFontFace(filepath.Clean(fontPaths.Light), attrSize); err == nil {
		dc.SetHexColor(labels.Color)
		dc.SetRGBA(0.2, 0.2, 0.2, 0.35)
		dc.DrawStringAnchored("© OpenStreetMap contributors", width*0.995, axisToCanvasY(0.006, height), 1, 1)
	}

	_ = req
}

func drawBlurRaster(dc *gg.Context, blur *blurSpec, bgColor string, width, height float64) {
	for layer := blur.Layers; layer > 0; layer-- {
		t := float64(layer) / float64(blur.Layers)
		spread := (1 - t) * (0.06 * blur.BlurSize)
		alpha := (blur.EdgeAlpha * (t * t)) / float64(blur.Layers)
		dc.SetHexColor(bgColor)
		dc.SetRGBA(0.96, 0.93, 0.88, alpha)
		x := (blur.PanelX - spread) * width
		y := axisToCanvasY(blur.PanelY+blur.PanelH+spread, height)
		w := (blur.PanelW + (spread * 2)) * width
		h := (blur.PanelH + (spread * 2)) * height
		r := (blur.CornerRadius + spread) * math.Min(width, height)
		dc.DrawRoundedRectangle(x, y, w, h, r)
		dc.Fill()
	}
	dc.SetHexColor(bgColor)
	dc.SetRGBA(0.96, 0.93, 0.88, blur.CoreAlpha)
	x := blur.PanelX * width
	y := axisToCanvasY(blur.PanelY+blur.PanelH, height)
	w := blur.PanelW * width
	h := blur.PanelH * height
	r := blur.CornerRadius * math.Min(width, height)
	dc.DrawRoundedRectangle(x, y, w, h, r)
	dc.Fill()
}

func drawGradientSVG(b *strings.Builder, color string, width, height float64) {
	step := height / 90.0
	for i := 0; i < 90; i++ {
		t := float64(i) / 90
		alpha := (1 - t) * 0.30
		yBottom := height - step*float64(i+1)
		yTop := step * float64(i)
		fmt.Fprintf(b, `<rect x="0" y="%.3f" width="%.3f" height="%.3f" fill="%s" fill-opacity="%.4f"/>`, yBottom, width, step+0.1, color, alpha)
		fmt.Fprintf(b, `<rect x="0" y="%.3f" width="%.3f" height="%.3f" fill="%s" fill-opacity="%.4f"/>`, yTop, width, step+0.1, color, alpha)
	}
}

func drawLabelsSVG(b *strings.Builder, labels labelSpec, pal palette, width, height float64, familyLight, familyRegular, familyBold string) {
	if labels.Blur != nil {
		for layer := labels.Blur.Layers; layer > 0; layer-- {
			t := float64(layer) / float64(labels.Blur.Layers)
			spread := (1 - t) * (0.06 * labels.Blur.BlurSize)
			alpha := (labels.Blur.EdgeAlpha * (t * t)) / float64(labels.Blur.Layers)
			x := (labels.Blur.PanelX - spread) * width
			y := axisToCanvasY(labels.Blur.PanelY+labels.Blur.PanelH+spread, height)
			w := (labels.Blur.PanelW + spread*2) * width
			h := (labels.Blur.PanelH + spread*2) * height
			r := (labels.Blur.CornerRadius + spread) * math.Min(width, height)
			fmt.Fprintf(b, `<rect x="%.3f" y="%.3f" width="%.3f" height="%.3f" rx="%.3f" ry="%.3f" fill="%s" fill-opacity="%.4f"/>`, x, y, w, h, r, r, pal.BG, alpha)
		}
		x := labels.Blur.PanelX * width
		y := axisToCanvasY(labels.Blur.PanelY+labels.Blur.PanelH, height)
		w := labels.Blur.PanelW * width
		h := labels.Blur.PanelH * height
		r := labels.Blur.CornerRadius * math.Min(width, height)
		fmt.Fprintf(b, `<rect x="%.3f" y="%.3f" width="%.3f" height="%.3f" rx="%.3f" ry="%.3f" fill="%s" fill-opacity="%.4f"/>`, x, y, w, h, r, r, pal.BG, labels.Blur.CoreAlpha)
	}

	fmt.Fprintf(b, `<text x="%.3f" y="%.3f" text-anchor="middle" dominant-baseline="middle" font-family="%s" font-size="%.3f" fill="%s">%s</text>`, width*0.5, axisToCanvasY(labels.CityY, height), familyBold, labels.CitySizePt, labels.Color, html.EscapeString(labels.DisplayCity))
	fmt.Fprintf(b, `<text x="%.3f" y="%.3f" text-anchor="middle" dominant-baseline="middle" font-family="%s" font-size="%.3f" fill="%s">%s</text>`, width*0.5, axisToCanvasY(labels.CountryY, height), familyLight, labels.CountrySizePt, labels.Color, html.EscapeString(labels.DisplayCountry))
	fmt.Fprintf(b, `<text x="%.3f" y="%.3f" text-anchor="middle" dominant-baseline="middle" font-family="%s" font-size="%.3f" fill="%s" fill-opacity="0.7">%s</text>`, width*0.5, axisToCanvasY(labels.CoordsY, height), familyRegular, labels.CoordsSizePt, labels.Color, html.EscapeString(labels.Coords))

	dividerY := axisToCanvasY(labels.DividerY, height)
	fmt.Fprintf(b, `<line x1="%.3f" y1="%.3f" x2="%.3f" y2="%.3f" stroke="%s" stroke-width="%.3f"/>`, width*0.4, dividerY, width*0.6, dividerY, labels.Color, labels.DividerWidthPt)
	fmt.Fprintf(b, `<text x="%.3f" y="%.3f" text-anchor="end" dominant-baseline="ideographic" font-family="%s" font-size="%.3f" fill="%s" fill-opacity="0.35">© OpenStreetMap contributors</text>`, width*0.995, axisToCanvasY(0.006, height), familyLight, labels.AttrSizePt, labels.Color)
}

func drawGradientPDF(pdf *gofpdf.Fpdf, color string, width, height float64) {
	rgbColor := parseHexColor(color)
	step := height / 90
	for i := 0; i < 90; i++ {
		t := float64(i) / 90
		alpha := (1 - t) * 0.30
		yBottom := height - step*float64(i+1)
		yTop := step * float64(i)
		pdf.SetAlpha(alpha, "Normal")
		pdf.SetFillColor(rgbColor.R, rgbColor.G, rgbColor.B)
		pdf.Rect(0, yBottom, width, step+0.2, "F")
		pdf.Rect(0, yTop, width, step+0.2, "F")
	}
	pdf.SetAlpha(1, "Normal")
}

func drawLabelsPDF(pdf *gofpdf.Fpdf, labels labelSpec, pal palette, width, height float64, fontLight, fontRegular, fontBold string) {
	if labels.Blur != nil {
		bg := parseHexColor(pal.BG)
		for layer := labels.Blur.Layers; layer > 0; layer-- {
			t := float64(layer) / float64(labels.Blur.Layers)
			spread := (1 - t) * (0.06 * labels.Blur.BlurSize)
			alpha := (labels.Blur.EdgeAlpha * (t * t)) / float64(labels.Blur.Layers)
			x := (labels.Blur.PanelX - spread) * width
			y := axisToCanvasY(labels.Blur.PanelY+labels.Blur.PanelH+spread, height)
			w := (labels.Blur.PanelW + spread*2) * width
			h := (labels.Blur.PanelH + spread*2) * height
			r := (labels.Blur.CornerRadius + spread) * math.Min(width, height)
			pdf.SetAlpha(alpha, "Normal")
			pdf.SetFillColor(bg.R, bg.G, bg.B)
			pdf.RoundedRect(x, y, w, h, r, "1234", "F")
		}
		x := labels.Blur.PanelX * width
		y := axisToCanvasY(labels.Blur.PanelY+labels.Blur.PanelH, height)
		w := labels.Blur.PanelW * width
		h := labels.Blur.PanelH * height
		r := labels.Blur.CornerRadius * math.Min(width, height)
		pdf.SetAlpha(labels.Blur.CoreAlpha, "Normal")
		pdf.SetFillColor(bg.R, bg.G, bg.B)
		pdf.RoundedRect(x, y, w, h, r, "1234", "F")
		pdf.SetAlpha(1, "Normal")
	}

	color := parseHexColor(labels.Color)
	setPDFFont(pdf, fontBold, labels.CitySizePt)
	drawPDFTextCentered(pdf, labels.DisplayCity, width*0.5, axisToCanvasY(labels.CityY, height), color, 1)
	setPDFFont(pdf, fontLight, labels.CountrySizePt)
	drawPDFTextCentered(pdf, labels.DisplayCountry, width*0.5, axisToCanvasY(labels.CountryY, height), color, 1)
	setPDFFont(pdf, fontRegular, labels.CoordsSizePt)
	drawPDFTextCentered(pdf, labels.Coords, width*0.5, axisToCanvasY(labels.CoordsY, height), color, 0.7)

	pdf.SetDrawColor(color.R, color.G, color.B)
	pdf.SetLineWidth(labels.DividerWidthPt)
	y := axisToCanvasY(labels.DividerY, height)
	pdf.Line(width*0.4, y, width*0.6, y)

	setPDFFont(pdf, fontLight, labels.AttrSizePt)
	drawPDFTextRight(pdf, "© OpenStreetMap contributors", width*0.995, axisToCanvasY(0.006, height), color, 0.35)
}

func setPDFFont(pdf *gofpdf.Fpdf, family string, size float64) {
	pdf.SetFont(family, "", size)
}

func drawPDFTextCentered(pdf *gofpdf.Fpdf, text string, xCenter, yCenter float64, color rgb, alpha float64) {
	pdf.SetAlpha(alpha, "Normal")
	pdf.SetTextColor(color.R, color.G, color.B)
	width := pdf.GetStringWidth(text)
	fontSize := currentPDFFontSize(pdf)
	pdf.Text(xCenter-width/2, yCenter+(fontSize*0.35), text)
	pdf.SetAlpha(1, "Normal")
}

func drawPDFTextRight(pdf *gofpdf.Fpdf, text string, xRight, yBase float64, color rgb, alpha float64) {
	pdf.SetAlpha(alpha, "Normal")
	pdf.SetTextColor(color.R, color.G, color.B)
	width := pdf.GetStringWidth(text)
	fontSize := currentPDFFontSize(pdf)
	pdf.Text(xRight-width, yBase+(fontSize*0.35), text)
	pdf.SetAlpha(1, "Normal")
}

func currentPDFFontSize(pdf *gofpdf.Fpdf) float64 {
	_, size := pdf.GetFontSize()
	return size
}

func computeLabelSpec(req types.GenerateRequest, pal palette, lat, lon float64) labelSpec {
	labelColor := pal.Text
	if req.TextColor != nil && strings.TrimSpace(*req.TextColor) != "" {
		labelColor = strings.TrimSpace(*req.TextColor)
	}

	scaleFactor := math.Min(req.Width, req.Height) / 12.0
	baseMain := 60.0
	baseSub := 22.0
	baseCoords := 14.0

	displayCity := strings.TrimSpace(req.City)
	if isLikelyLatin(displayCity) {
		displayCity = strings.ToUpper(displayCity)
		displayCity = strings.Join(strings.Split(displayCity, ""), "  ")
	}
	cityRaw := strings.TrimSpace(req.City)
	mainSize := baseMain * scaleFactor
	if req.CityFontSize != nil {
		mainSize = *req.CityFontSize * scaleFactor
	} else if len(cityRaw) > 10 {
		mainSize = math.Max(mainSize*(10.0/float64(len(cityRaw))), 10.0*scaleFactor)
	}
	countrySize := baseSub * scaleFactor
	if req.CountryFontSize != nil {
		countrySize = *req.CountryFontSize * scaleFactor
	}
	coordsSize := baseCoords * scaleFactor
	attrSize := math.Max(4, 5*scaleFactor)

	dynamicGapScale := math.Max(math.Max(mainSize/math.Max(baseMain*scaleFactor, 1e-6), countrySize/math.Max(baseSub*scaleFactor, 1e-6)), 1.0)
	minGap := 0.004 * req.LabelPadding * dynamicGapScale
	pointToAxis := 1.0 / (req.Height * 72.0)
	cityDesc := mainSize * 0.22 * pointToAxis
	countryAscent := countrySize * 0.72 * pointToAxis
	countryDesc := countrySize * 0.22 * pointToAxis
	coordsAscent := coordsSize * 0.72 * pointToAxis

	coordsY := 0.07
	countryY := 0.10
	coordsTop := coordsY + coordsAscent
	if countryY-countryDesc < coordsTop+minGap {
		countryY = coordsTop + minGap + countryDesc
	}
	dividerY := math.Max(0.125, countryY+countryAscent+minGap)
	cityY := math.Min(math.Max(0.14, dividerY+cityDesc+minGap), 0.32)

	label := labelSpec{
		Color:          labelColor,
		DisplayCity:    displayCity,
		DisplayCountry: strings.ToUpper(strings.TrimSpace(req.Country)),
		Coords:         formatCoords(lat, lon),
		CityY:          cityY,
		CountryY:       countryY,
		CoordsY:        coordsY,
		DividerY:       dividerY,
		CitySizePt:     mainSize,
		CountrySizePt:  countrySize,
		CoordsSizePt:   coordsSize,
		AttrSizePt:     attrSize,
		DividerWidthPt: math.Max(0.5, 1*scaleFactor),
	}

	if req.TextBlurEnabled {
		blurSize := req.TextBlurSize
		blurStrength := req.TextBlurStrength
		panelW := clamp(0.52*blurSize, 0.34, 0.9)
		panelH := clamp(0.14*blurSize, 0.08, 0.34)
		centerY := (cityY + coordsY) / 2.0
		panelX := 0.5 - panelW/2
		panelY := clamp(centerY-panelH/2, 0, 1-panelH)
		blurScale := clamp(blurStrength/30.0, 0, 1)
		label.Blur = &blurSpec{
			PanelX:       panelX,
			PanelY:       panelY,
			PanelW:       panelW,
			PanelH:       panelH,
			CornerRadius: 0.02 * blurSize,
			Layers:       maxInt(2, int(math.Round(4+blurScale*10))),
			EdgeAlpha:    0.04 + 0.14*blurScale,
			CoreAlpha:    0.10 + 0.22*blurScale,
			BlurSize:     blurSize,
		}
	}

	return label
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

func wayPointsNormalized(way osm.Way, nodes map[int64]projectedNode, width, height float64) [][2]float64 {
	points := make([][2]float64, 0, len(way.Nodes))
	for _, nodeID := range way.Nodes {
		node, ok := nodes[nodeID]
		if !ok {
			continue
		}
		points = append(points, [2]float64{node.x * width, node.y * height})
	}
	return points
}

func wayPointsPDF(way osm.Way, nodes map[int64]projectedNode, width, height float64) []gofpdf.PointType {
	points := make([]gofpdf.PointType, 0, len(way.Nodes))
	for _, nodeID := range way.Nodes {
		node, ok := nodes[nodeID]
		if !ok {
			continue
		}
		points = append(points, gofpdf.PointType{X: node.x * width, Y: node.y * height})
	}
	return points
}

func pointsToSVG(points [][2]float64) string {
	parts := make([]string, 0, len(points))
	for _, point := range points {
		parts = append(parts, fmt.Sprintf("%.3f,%.3f", point[0], point[1]))
	}
	return strings.Join(parts, " ")
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

func roadWidth(highway string, scaleFactor float64, scale float64) float64 {
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
	return math.Max(0.2, base*scaleFactor*scale)
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

func axisToCanvasY(axisY float64, canvasHeight float64) float64 {
	return (1 - axisY) * canvasHeight
}

func parseHexColor(hex string) rgb {
	trimmed := strings.TrimSpace(strings.TrimPrefix(hex, "#"))
	if len(trimmed) == 3 {
		trimmed = strings.Repeat(string(trimmed[0]), 2) + strings.Repeat(string(trimmed[1]), 2) + strings.Repeat(string(trimmed[2]), 2)
	}
	if len(trimmed) != 6 {
		return rgb{R: 0, G: 0, B: 0}
	}
	var r, g, b int
	_, err := fmt.Sscanf(trimmed, "%02x%02x%02x", &r, &g, &b)
	if err != nil {
		return rgb{R: 0, G: 0, B: 0}
	}
	return rgb{R: r, G: g, B: b}
}

func buildSVGFontDefs(paths fonts.FontPaths) string {
	encode := func(fontFamily, path string) string {
		data, err := os.ReadFile(filepath.Clean(path))
		if err != nil || len(data) == 0 {
			return ""
		}
		return fmt.Sprintf(`@font-face{font-family:'%s';src:url(data:font/ttf;base64,%s) format('truetype');}`, fontFamily, base64.StdEncoding.EncodeToString(data))
	}
	light := encode("PosterLight", paths.Light)
	regular := encode("PosterRegular", paths.Regular)
	bold := encode("PosterBold", paths.Bold)
	defs := light + regular + bold
	return defs
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

func newPalette(theme types.Theme) palette {
	get := func(key, fallback string) string {
		if value, ok := theme.Colors[key]; ok && strings.TrimSpace(value) != "" {
			return value
		}
		return fallback
	}
	return palette{
		BG:              get("bg", "#F5EDE4"),
		Text:            get("text", "#8B4513"),
		GradientColor:   get("gradient_color", get("bg", "#F5EDE4")),
		Water:           get("water", "#A8C4C4"),
		Parks:           get("parks", "#E8E0D0"),
		RoadMotorway:    get("road_motorway", "#A0522D"),
		RoadPrimary:     get("road_primary", "#B8653A"),
		RoadSecondary:   get("road_secondary", "#C9846A"),
		RoadTertiary:    get("road_tertiary", "#D9A08A"),
		RoadResidential: get("road_residential", "#E5C4B0"),
		RoadDefault:     get("road_default", "#D9A08A"),
	}
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
