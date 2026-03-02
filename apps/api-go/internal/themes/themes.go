package themes

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"city-map-poster-generator/apps/api-go/internal/types"
)

func LoadThemes(assetsDir string) ([]types.Theme, error) {
	themeDir := filepath.Join(assetsDir, "themes")
	entries, err := os.ReadDir(themeDir)
	if err != nil {
		return nil, fmt.Errorf("read themes dir: %w", err)
	}
	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		paths = append(paths, filepath.Join(themeDir, entry.Name()))
	}
	sort.Strings(paths)

	result := make([]types.Theme, 0, len(paths))
	for _, p := range paths {
		raw, err := os.ReadFile(p)
		if err != nil {
			return nil, fmt.Errorf("read theme %s: %w", p, err)
		}
		var data map[string]any
		if err := json.Unmarshal(raw, &data); err != nil {
			return nil, fmt.Errorf("parse theme %s: %w", p, err)
		}
		colors := make(map[string]string)
		for key, value := range data {
			if key == "name" || key == "description" {
				continue
			}
			asString, ok := value.(string)
			if ok {
				colors[key] = asString
			}
		}
		id := strings.TrimSuffix(filepath.Base(p), ".json")
		name, _ := data["name"].(string)
		description, _ := data["description"].(string)
		result = append(result, types.Theme{
			ID:          id,
			Name:        name,
			Description: description,
			Colors:      colors,
		})
	}
	return result, nil
}

func ThemeIDSet(themes []types.Theme) map[string]struct{} {
	result := make(map[string]struct{}, len(themes))
	for _, t := range themes {
		result[t.ID] = struct{}{}
	}
	return result
}
