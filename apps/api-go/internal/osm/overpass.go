package osm

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"city-map-poster-generator/apps/api-go/internal/config"
)

type Node struct {
	ID  int64
	Lat float64
	Lon float64
}

type Way struct {
	ID    int64
	Nodes []int64
	Tags  map[string]string
}

type FeatureSet struct {
	Nodes  map[int64]Node
	Roads  []Way
	Water  []Way
	Parks  []Way
	Center [2]float64
}

type Client struct {
	cfg  config.Config
	http *http.Client
}

func New(cfg config.Config) *Client {
	return &Client{
		cfg: cfg,
		http: &http.Client{Timeout: time.Duration(cfg.RequestTimeoutSeconds) * time.Second},
	}
}

func (c *Client) cachePath(query string) string {
	h := sha256.Sum256([]byte(query))
	name := hex.EncodeToString(h[:]) + ".json"
	return filepath.Join(c.cfg.CacheDir, name)
}

func (c *Client) Fetch(ctx context.Context, lat, lon float64, dist int, includeWater bool, includeParks bool, networkType string) (*FeatureSet, error) {
	if networkType == "" {
		networkType = "all"
	}
	query := buildQuery(lat, lon, dist, includeWater, includeParks, networkType)

	if err := os.MkdirAll(c.cfg.CacheDir, 0o755); err != nil {
		return nil, err
	}
	cachePath := c.cachePath(query)
	var body []byte
	if cached, err := os.ReadFile(cachePath); err == nil && len(cached) > 0 {
		body = cached
	} else {
		u, err := url.Parse(c.cfg.OverpassURL)
		if err != nil {
			return nil, err
		}
		form := url.Values{}
		form.Set("data", query)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(form.Encode()))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("User-Agent", c.cfg.NominatimUserAgent)

		resp, err := c.http.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
			return nil, fmt.Errorf("overpass returned %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
		}
		body, err = io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		_ = os.WriteFile(cachePath, body, 0o644)
	}

	return parseFeatureSet(body, lat, lon), nil
}

func buildQuery(lat, lon float64, dist int, includeWater, includeParks bool, networkType string) string {
	highwayFilter := "[highway]"
	switch strings.ToLower(networkType) {
	case "drive":
		highwayFilter = "[highway][highway!~\"footway|path|cycleway|steps|pedestrian|bridleway|track\"]"
	case "walk":
		highwayFilter = "[highway][highway!~\"motorway|trunk\"]"
	}

	parts := []string{
		fmt.Sprintf("way(around:%d,%f,%f)%s;", dist, lat, lon, highwayFilter),
	}
	if includeWater {
		parts = append(parts,
			fmt.Sprintf("way(around:%d,%f,%f)[natural=water];", dist, lat, lon),
			fmt.Sprintf("way(around:%d,%f,%f)[waterway=riverbank];", dist, lat, lon),
		)
	}
	if includeParks {
		parts = append(parts,
			fmt.Sprintf("way(around:%d,%f,%f)[leisure=park];", dist, lat, lon),
			fmt.Sprintf("way(around:%d,%f,%f)[landuse=grass];", dist, lat, lon),
		)
	}

	return fmt.Sprintf(`[out:json][timeout:45];(%s);(._;>;);out body;`, strings.Join(parts, ""))
}

func parseFeatureSet(body []byte, lat, lon float64) *FeatureSet {
	var payload struct {
		Elements []struct {
			Type  string            `json:"type"`
			ID    int64             `json:"id"`
			Lat   float64           `json:"lat"`
			Lon   float64           `json:"lon"`
			Nodes []int64           `json:"nodes"`
			Tags  map[string]string `json:"tags"`
		} `json:"elements"`
	}
	_ = json.Unmarshal(body, &payload)

	set := &FeatureSet{
		Nodes:  make(map[int64]Node),
		Roads:  []Way{},
		Water:  []Way{},
		Parks:  []Way{},
		Center: [2]float64{lat, lon},
	}

	for _, el := range payload.Elements {
		if el.Type == "node" {
			set.Nodes[el.ID] = Node{ID: el.ID, Lat: el.Lat, Lon: el.Lon}
		}
	}
	for _, el := range payload.Elements {
		if el.Type != "way" || len(el.Nodes) < 2 {
			continue
		}
		way := Way{ID: el.ID, Nodes: el.Nodes, Tags: el.Tags}
		if _, ok := el.Tags["highway"]; ok {
			set.Roads = append(set.Roads, way)
		}
		if el.Tags["natural"] == "water" || el.Tags["waterway"] == "riverbank" {
			set.Water = append(set.Water, way)
		}
		if el.Tags["leisure"] == "park" || el.Tags["landuse"] == "grass" {
			set.Parks = append(set.Parks, way)
		}
	}
	return set
}
