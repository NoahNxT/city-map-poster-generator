package fonts

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"city-map-poster-generator/apps/api-go/internal/config"
	"city-map-poster-generator/apps/api-go/internal/types"
)

type FontPaths struct {
	Light   string
	Regular string
	Bold    string
}

type catalogEntry struct {
	Suggestion types.FontSuggestion
	Files      map[string]string
}

type Service struct {
	cfg         config.Config
	httpClient  *http.Client
	mu          sync.RWMutex
	cached      []types.FontSuggestion
	cachedIndex map[string]catalogEntry
	expiresAt   time.Time
}

var fallbackFonts = []types.FontSuggestion{
	{Family: "Roboto", Category: "sans-serif", Popularity: 1},
	{Family: "Open Sans", Category: "sans-serif", Popularity: 2},
	{Family: "Lato", Category: "sans-serif", Popularity: 3},
	{Family: "Montserrat", Category: "sans-serif", Popularity: 4},
	{Family: "Poppins", Category: "sans-serif", Popularity: 5},
	{Family: "Inter", Category: "sans-serif", Popularity: 6},
	{Family: "Merriweather", Category: "serif", Popularity: 7},
	{Family: "Playfair Display", Category: "serif", Popularity: 8},
	{Family: "Noto Sans", Category: "sans-serif", Popularity: 9},
	{Family: "Noto Serif", Category: "serif", Popularity: 10},
}

func New(cfg config.Config) *Service {
	return &Service{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: time.Duration(cfg.RequestTimeoutSeconds) * time.Second,
		},
		cachedIndex: map[string]catalogEntry{},
	}
}

func (s *Service) defaultFontPaths() FontPaths {
	base := filepath.Join(s.cfg.AssetsDir, "fonts")
	return FontPaths{
		Light:   filepath.Join(base, "Roboto-Light.ttf"),
		Regular: filepath.Join(base, "Roboto-Regular.ttf"),
		Bold:    filepath.Join(base, "Roboto-Bold.ttf"),
	}
}

func (s *Service) ResolveFontPaths(ctx context.Context, family *string) FontPaths {
	if family == nil {
		return s.defaultFontPaths()
	}
	trimmed := strings.TrimSpace(*family)
	if trimmed == "" || strings.EqualFold(trimmed, "Roboto") {
		return s.defaultFontPaths()
	}

	// Try to load and cache catalog index (developer API index includes downloadable files).
	_, _ = s.loadCatalog(ctx)
	indexEntry, ok := s.lookupEntry(trimmed)
	if ok && len(indexEntry.Files) > 0 {
		if resolved, err := s.downloadFromFileMap(ctx, trimmed, indexEntry.Files); err == nil {
			return resolved
		}
	}

	// Fallback: attempt CSS endpoint only when it yields truetype/opentype URLs.
	if urls, err := s.loadTTFURLsFromCSS(ctx, trimmed); err == nil && len(urls) > 0 {
		if resolved, err := s.downloadFromFileMap(ctx, trimmed, urls); err == nil {
			return resolved
		}
	}

	return s.defaultFontPaths()
}

func (s *Service) Search(ctx context.Context, query string, limit int) ([]types.FontSuggestion, error) {
	if limit < 1 {
		limit = 1
	}
	if limit > 25 {
		limit = 25
	}
	catalog, err := s.loadCatalog(ctx)
	if err != nil {
		catalog = fallbackFonts
	}

	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		if len(catalog) > limit {
			return catalog[:limit], nil
		}
		return catalog, nil
	}

	starts := make([]types.FontSuggestion, 0)
	contains := make([]types.FontSuggestion, 0)
	for _, font := range catalog {
		name := strings.ToLower(font.Family)
		if strings.HasPrefix(name, q) {
			starts = append(starts, font)
		} else if strings.Contains(name, q) {
			contains = append(contains, font)
		}
	}
	result := append(starts, contains...)
	if len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func (s *Service) loadCatalog(ctx context.Context) ([]types.FontSuggestion, error) {
	now := time.Now()
	s.mu.RLock()
	if len(s.cached) > 0 && now.Before(s.expiresAt) {
		defer s.mu.RUnlock()
		return append([]types.FontSuggestion(nil), s.cached...), nil
	}
	s.mu.RUnlock()

	catalog, index, err := s.loadFromDeveloperAPI(ctx)
	if err != nil || len(catalog) == 0 {
		catalog, err = s.loadFromMetadata(ctx)
		index = map[string]catalogEntry{}
	}
	if err != nil || len(catalog) == 0 {
		return fallbackFonts, fmt.Errorf("font catalog unavailable")
	}

	s.mu.Lock()
	s.cached = append([]types.FontSuggestion(nil), catalog...)
	s.cachedIndex = index
	s.expiresAt = time.Now().Add(time.Duration(s.cfg.GoogleFontsCacheTTLSeconds) * time.Second)
	s.mu.Unlock()

	return catalog, nil
}

func (s *Service) loadFromDeveloperAPI(ctx context.Context) ([]types.FontSuggestion, map[string]catalogEntry, error) {
	if strings.TrimSpace(s.cfg.GoogleFontsAPIKey) == "" {
		return nil, nil, fmt.Errorf("google fonts api key missing")
	}
	u, err := url.Parse(s.cfg.GoogleFontsAPIURL)
	if err != nil {
		return nil, nil, err
	}
	q := u.Query()
	q.Set("key", s.cfg.GoogleFontsAPIKey)
	q.Set("sort", "popularity")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("User-Agent", s.cfg.NominatimUserAgent)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, nil, fmt.Errorf("developer api returned %d", resp.StatusCode)
	}

	var payload struct {
		Items []struct {
			Family   string            `json:"family"`
			Category string            `json:"category"`
			Files    map[string]string `json:"files"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, nil, err
	}

	catalog := make([]types.FontSuggestion, 0, len(payload.Items))
	index := make(map[string]catalogEntry, len(payload.Items))
	for i, item := range payload.Items {
		family := strings.TrimSpace(item.Family)
		if family == "" {
			continue
		}
		suggestion := types.FontSuggestion{
			Family:     family,
			Category:   strings.TrimSpace(item.Category),
			Popularity: i + 1,
		}
		catalog = append(catalog, suggestion)

		files := make(map[string]string)
		for key, value := range item.Files {
			normalizedKey := strings.ToLower(strings.TrimSpace(key))
			normalizedURL := strings.TrimSpace(value)
			if normalizedKey != "" && normalizedURL != "" {
				files[normalizedKey] = normalizeURL(normalizedURL)
			}
		}
		index[strings.ToLower(family)] = catalogEntry{Suggestion: suggestion, Files: files}
	}
	return catalog, index, nil
}

func (s *Service) loadFromMetadata(ctx context.Context) ([]types.FontSuggestion, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.cfg.GoogleFontsMetadataURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", s.cfg.NominatimUserAgent)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("metadata api returned %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	raw := strings.TrimSpace(string(body))
	if strings.HasPrefix(raw, ")]}'") {
		parts := strings.SplitN(raw, "\n", 2)
		if len(parts) == 2 {
			raw = parts[1]
		}
	}

	var payload struct {
		FamilyMetadataList []struct {
			Family     string `json:"family"`
			Category   string `json:"category"`
			Popularity int    `json:"popularity"`
		} `json:"familyMetadataList"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, err
	}

	out := make([]types.FontSuggestion, 0, len(payload.FamilyMetadataList))
	for i, item := range payload.FamilyMetadataList {
		family := strings.TrimSpace(item.Family)
		if family == "" {
			continue
		}
		pop := item.Popularity
		if pop == 0 {
			pop = i + 1
		}
		out = append(out, types.FontSuggestion{
			Family:     family,
			Category:   strings.TrimSpace(item.Category),
			Popularity: pop,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Popularity == out[j].Popularity {
			return out[i].Family < out[j].Family
		}
		return out[i].Popularity < out[j].Popularity
	})
	return out, nil
}

func (s *Service) lookupEntry(family string) (catalogEntry, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.cachedIndex[strings.ToLower(strings.TrimSpace(family))]
	return entry, ok
}

func (s *Service) downloadFromFileMap(ctx context.Context, family string, files map[string]string) (FontPaths, error) {
	cacheDir := filepath.Join(s.cfg.CacheDir, "fonts")
	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return FontPaths{}, err
	}

	lightURL := pickWeightURL(files, 300)
	regularURL := pickWeightURL(files, 400)
	boldURL := pickWeightURL(files, 700)

	if regularURL == "" {
		return FontPaths{}, fmt.Errorf("missing regular font URL")
	}
	if lightURL == "" {
		lightURL = regularURL
	}
	if boldURL == "" {
		boldURL = regularURL
	}

	lightPath, err := s.downloadFontURL(ctx, cacheDir, family, "light", lightURL)
	if err != nil {
		return FontPaths{}, err
	}
	regularPath, err := s.downloadFontURL(ctx, cacheDir, family, "regular", regularURL)
	if err != nil {
		return FontPaths{}, err
	}
	boldPath, err := s.downloadFontURL(ctx, cacheDir, family, "bold", boldURL)
	if err != nil {
		return FontPaths{}, err
	}

	return FontPaths{Light: lightPath, Regular: regularPath, Bold: boldPath}, nil
}

func (s *Service) downloadFontURL(ctx context.Context, cacheDir, family, weightName, rawURL string) (string, error) {
	fontURL := normalizeURL(rawURL)
	ext := detectFontExt(fontURL)
	base := fmt.Sprintf("%s_%s%s", slug(family), weightName, ext)
	path := filepath.Join(cacheDir, base)
	if _, err := os.Stat(path); err == nil {
		return path, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fontURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", s.cfg.NominatimUserAgent)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("font download returned %d for %s", resp.StatusCode, fontURL)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if len(data) == 0 {
		return "", fmt.Errorf("empty font data for %s", fontURL)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func (s *Service) loadTTFURLsFromCSS(ctx context.Context, family string) (map[string]string, error) {
	apiURL := "https://fonts.googleapis.com/css2?family=" + url.QueryEscape(strings.Join(strings.Fields(family), "+")) + ":wght@300;400;700&display=swap"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	// Ask for legacy css when possible; still may return woff/woff2 only.
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.50 (KHTML, like Gecko) Version/5.1 Safari/534.50")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("css api returned %d", resp.StatusCode)
	}
	cssBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	css := string(cssBytes)

	blockRe := regexp.MustCompile(`(?s)@font-face\s*\{(.*?)\}`)
	weightRe := regexp.MustCompile(`font-weight:\s*([0-9]+)`)
	srcRe := regexp.MustCompile(`src:\s*url\(([^)]+)\)\s*format\('([^']+)'\)`)

	out := map[string]string{}
	for _, block := range blockRe.FindAllStringSubmatch(css, -1) {
		content := block[1]
		weightMatch := weightRe.FindStringSubmatch(content)
		srcMatch := srcRe.FindStringSubmatch(content)
		if len(weightMatch) < 2 || len(srcMatch) < 3 {
			continue
		}
		format := strings.ToLower(strings.TrimSpace(srcMatch[2]))
		rawURL := strings.Trim(srcMatch[1], "\"' ")
		if rawURL == "" {
			continue
		}
		if format != "truetype" && format != "opentype" && !isTTFOrOTF(rawURL) {
			continue
		}
		out[strings.TrimSpace(weightMatch[1])] = normalizeURL(rawURL)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("css did not contain truetype font urls")
	}
	return out, nil
}

func pickWeightURL(files map[string]string, target int) string {
	if len(files) == 0 {
		return ""
	}
	type candidate struct {
		url    string
		weight int
	}
	candidates := make([]candidate, 0, len(files))
	for key, value := range files {
		weight := parseWeightKey(key)
		if weight == 0 {
			continue
		}
		candidates = append(candidates, candidate{url: normalizeURL(value), weight: weight})
	}
	if len(candidates) == 0 {
		return ""
	}
	sort.Slice(candidates, func(i, j int) bool {
		di := absInt(candidates[i].weight - target)
		dj := absInt(candidates[j].weight - target)
		if di == dj {
			return candidates[i].weight < candidates[j].weight
		}
		return di < dj
	})
	return candidates[0].url
}

func parseWeightKey(key string) int {
	normalized := strings.ToLower(strings.TrimSpace(key))
	normalized = strings.TrimSuffix(normalized, "i")
	switch normalized {
	case "regular", "normal":
		return 400
	case "bold":
		return 700
	case "light":
		return 300
	}
	weight, err := strconv.Atoi(normalized)
	if err != nil {
		return 0
	}
	if weight < 100 || weight > 1000 {
		return 0
	}
	return weight
}

func detectFontExt(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err == nil {
		ext := strings.ToLower(path.Ext(u.Path))
		if ext == ".ttf" || ext == ".otf" {
			return ext
		}
	}
	if strings.Contains(strings.ToLower(rawURL), "otf") {
		return ".otf"
	}
	return ".ttf"
}

func isTTFOrOTF(rawURL string) bool {
	ext := strings.ToLower(detectFontExt(rawURL))
	return ext == ".ttf" || ext == ".otf"
}

func normalizeURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if strings.HasPrefix(trimmed, "http://") {
		return "https://" + strings.TrimPrefix(trimmed, "http://")
	}
	return trimmed
}

func slug(input string) string {
	s := strings.ToLower(strings.TrimSpace(input))
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	s = strings.ReplaceAll(s, "\"", "")
	s = strings.ReplaceAll(s, "'", "")
	if s == "" {
		s = "font"
	}
	return s
}

func absInt(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

func EnsureFontFiles(fontPaths FontPaths) error {
	for _, path := range []string{fontPaths.Light, fontPaths.Regular, fontPaths.Bold} {
		if _, err := os.Stat(path); err != nil {
			return fmt.Errorf("missing font file %s: %w", path, err)
		}
	}
	return nil
}
