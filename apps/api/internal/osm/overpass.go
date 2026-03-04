package osm

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"city-map-poster-generator/apps/api/internal/config"
	"github.com/redis/go-redis/v9"
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
	cfg       config.Config
	http      *http.Client
	redis     *redis.Client
	inflight  map[string]*fetchCall
	inflightM sync.Mutex
}

type fetchCall struct {
	done chan struct{}
	body []byte
	err  error
}

func New(cfg config.Config) *Client {
	var redisClient *redis.Client
	if opts, err := redis.ParseURL(cfg.RedisURL); err == nil {
		redisClient = redis.NewClient(opts)
	}
	return &Client{
		cfg:      cfg,
		http:     &http.Client{Timeout: time.Duration(cfg.RequestTimeoutSeconds) * time.Second},
		redis:    redisClient,
		inflight: map[string]*fetchCall{},
	}
}

func (c *Client) cachePath(query string) string {
	h := sha256.Sum256([]byte(query))
	name := hex.EncodeToString(h[:]) + ".json"
	return filepath.Join(c.cfg.CacheDir, name)
}

func (c *Client) sharedCacheKey(query string) string {
	h := sha256.Sum256([]byte(query))
	return fmt.Sprintf("cache:overpass:%s", hex.EncodeToString(h[:]))
}

func (c *Client) Fetch(ctx context.Context, lat, lon float64, dist int, targetAspect float64, includeWater bool, includeParks bool, networkType string) (*FeatureSet, error) {
	if networkType == "" {
		networkType = "all"
	}
	query := buildQuery(lat, lon, dist, targetAspect, includeWater, includeParks, networkType)
	sharedKey := c.sharedCacheKey(query)

	if err := os.MkdirAll(c.cfg.CacheDir, 0o755); err != nil {
		return nil, err
	}
	cachePath := c.cachePath(query)

	if sharedCached, err := c.readSharedCache(ctx, sharedKey); err == nil && len(sharedCached) > 0 {
		_ = os.WriteFile(cachePath, sharedCached, 0o644)
		return parseFeatureSet(sharedCached, lat, lon), nil
	}

	if diskCached, err := os.ReadFile(cachePath); err == nil && len(diskCached) > 0 {
		_ = c.writeSharedCache(ctx, sharedKey, diskCached)
		return parseFeatureSet(diskCached, lat, lon), nil
	}

	body, err := c.fetchWithSingleflight(ctx, sharedKey, query)
	if err != nil {
		return nil, err
	}
	_ = os.WriteFile(cachePath, body, 0o644)
	_ = c.writeSharedCache(ctx, sharedKey, body)

	return parseFeatureSet(body, lat, lon), nil
}

func (c *Client) fetchWithSingleflight(ctx context.Context, key string, query string) ([]byte, error) {
	c.inflightM.Lock()
	if existing, ok := c.inflight[key]; ok {
		c.inflightM.Unlock()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-existing.done:
			return existing.body, existing.err
		}
	}
	call := &fetchCall{done: make(chan struct{})}
	c.inflight[key] = call
	c.inflightM.Unlock()

	body, err := c.fetchNetwork(ctx, query)

	c.inflightM.Lock()
	call.body = body
	call.err = err
	close(call.done)
	delete(c.inflight, key)
	c.inflightM.Unlock()
	return body, err
}

func (c *Client) fetchNetwork(ctx context.Context, query string) ([]byte, error) {
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
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func (c *Client) readSharedCache(ctx context.Context, key string) ([]byte, error) {
	if c.redis == nil {
		return nil, nil
	}
	body, err := c.redis.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return body, nil
}

func (c *Client) writeSharedCache(ctx context.Context, key string, body []byte) error {
	if c.redis == nil || len(body) == 0 {
		return nil
	}
	ttlSeconds := c.cfg.OverpassCacheTTLSeconds
	if ttlSeconds <= 0 {
		ttlSeconds = 3600
	}
	return c.redis.SetEx(ctx, key, body, time.Duration(ttlSeconds)*time.Second).Err()
}

func buildQuery(lat, lon float64, dist int, targetAspect float64, includeWater, includeParks bool, networkType string) string {
	highwayFilter := "[highway]"
	switch strings.ToLower(networkType) {
	case "drive":
		highwayFilter = "[highway][highway!~\"footway|path|cycleway|steps|pedestrian|bridleway|track\"]"
	case "walk":
		highwayFilter = "[highway][highway!~\"motorway|trunk\"]"
	}

	south, west, north, east := viewportBBox(lat, lon, dist, targetAspect, 1.10)

	parts := []string{
		fmt.Sprintf("way(%f,%f,%f,%f)%s;", south, west, north, east, highwayFilter),
	}
	if includeWater {
		parts = append(parts,
			fmt.Sprintf("way(%f,%f,%f,%f)[natural=water];", south, west, north, east),
			fmt.Sprintf("way(%f,%f,%f,%f)[waterway=riverbank];", south, west, north, east),
		)
	}
	if includeParks {
		parts = append(parts,
			fmt.Sprintf("way(%f,%f,%f,%f)[leisure=park];", south, west, north, east),
			fmt.Sprintf("way(%f,%f,%f,%f)[landuse=grass];", south, west, north, east),
		)
	}

	return fmt.Sprintf(`[out:json][timeout:45];(%s);(._;>;);out body;`, strings.Join(parts, ""))
}

func viewportBBox(centerLat, centerLon float64, dist int, targetAspect float64, overscan float64) (south, west, north, east float64) {
	const metersPerDegreeLat = 111_320.0

	if targetAspect <= 0 {
		targetAspect = 1
	}
	if dist <= 0 {
		dist = 1000
	}
	if overscan <= 0 {
		overscan = 1
	}

	halfHeightMeters := float64(dist)
	halfWidthMeters := float64(dist)
	if targetAspect >= 1 {
		halfHeightMeters = halfHeightMeters / targetAspect
	} else {
		halfWidthMeters = halfWidthMeters * targetAspect
	}
	halfHeightMeters *= overscan
	halfWidthMeters *= overscan

	latScale := math.Cos(centerLat * math.Pi / 180)
	if math.Abs(latScale) < 0.0001 {
		latScale = 0.0001
	}
	halfLat := halfHeightMeters / metersPerDegreeLat
	halfLon := halfWidthMeters / (metersPerDegreeLat * latScale)

	return centerLat - halfLat, centerLon - halfLon, centerLat + halfLat, centerLon + halfLon
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
