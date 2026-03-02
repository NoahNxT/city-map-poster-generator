package geocode

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"city-map-poster-generator/apps/api/internal/config"
	"city-map-poster-generator/apps/api/internal/types"
)

type Client struct {
	cfg    config.Config
	http   *http.Client
}

func New(cfg config.Config) *Client {
	return &Client{
		cfg: cfg,
		http: &http.Client{Timeout: time.Duration(cfg.RequestTimeoutSeconds) * time.Second},
	}
}

func extractCity(address map[string]any) string {
	keys := []string{"city", "town", "village", "municipality", "hamlet", "suburb", "county", "state_district", "state"}
	for _, key := range keys {
		if value, ok := address[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (c *Client) Search(ctx context.Context, query string, limit int) ([]types.LocationSuggestion, error) {
	trimmed := strings.TrimSpace(query)
	if len(trimmed) < 2 {
		return []types.LocationSuggestion{}, nil
	}
	if limit < 1 {
		limit = 1
	}
	if limit > 10 {
		limit = 10
	}

	u, err := url.Parse(c.cfg.NominatimSearchURL)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("q", trimmed)
	q.Set("format", "jsonv2")
	q.Set("addressdetails", "1")
	q.Set("limit", fmt.Sprintf("%d", limit))
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.cfg.NominatimUserAgent)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("nominatim returned %d", resp.StatusCode)
	}

	var payload []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	out := make([]types.LocationSuggestion, 0, len(payload))
	for _, item := range payload {
		address, ok := item["address"].(map[string]any)
		if !ok {
			address = map[string]any{}
		}
		country, _ := address["country"].(string)
		lat, _ := item["lat"].(string)
		lon, _ := item["lon"].(string)
		if strings.TrimSpace(country) == "" || strings.TrimSpace(lat) == "" || strings.TrimSpace(lon) == "" {
			continue
		}
		placeID := fmt.Sprintf("%v", item["place_id"])
		if placeID == "" {
			continue
		}
		city := extractCity(address)
		if city == "" {
			if name, ok := item["name"].(string); ok && strings.TrimSpace(name) != "" {
				city = strings.TrimSpace(name)
			} else {
				city = strings.TrimSpace(country)
			}
		}
		displayName, _ := item["display_name"].(string)
		if strings.TrimSpace(displayName) == "" {
			displayName = fmt.Sprintf("%s, %s", city, country)
		}
		countryCode, _ := address["country_code"].(string)
		if strings.TrimSpace(countryCode) != "" {
			countryCode = strings.ToUpper(strings.TrimSpace(countryCode))
		}
		var codePtr *string
		if countryCode != "" {
			codePtr = &countryCode
		}
		out = append(out, types.LocationSuggestion{
			PlaceID:     placeID,
			DisplayName: strings.TrimSpace(displayName),
			City:        city,
			Country:     strings.TrimSpace(country),
			Latitude:    strings.TrimSpace(lat),
			Longitude:   strings.TrimSpace(lon),
			CountryCode: codePtr,
		})
	}
	return out, nil
}
