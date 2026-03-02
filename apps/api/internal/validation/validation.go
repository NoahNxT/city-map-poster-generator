package validation

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"city-map-poster-generator/apps/api/internal/types"
)

var hexColor = regexp.MustCompile(`^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)

const (
	minPosterSizeInches = 1.0
	maxPosterSizeInches = 80.0
	minDistanceMeters   = 1000
	maxDistanceMeters   = 18000
)

func ValidateGenerateRequest(req *types.GenerateRequest) error {
	req.City = strings.TrimSpace(req.City)
	req.Country = strings.TrimSpace(req.Country)
	req.Theme = strings.TrimSpace(req.Theme)
	if req.City == "" || len(req.City) > 100 {
		return fmt.Errorf("city must be between 1 and 100 chars")
	}
	if req.Country == "" || len(req.Country) > 100 {
		return fmt.Errorf("country must be between 1 and 100 chars")
	}
	if req.Theme == "" || len(req.Theme) > 60 {
		return fmt.Errorf("theme must be between 1 and 60 chars")
	}

	hasLat := req.Latitude != nil && strings.TrimSpace(*req.Latitude) != ""
	hasLon := req.Longitude != nil && strings.TrimSpace(*req.Longitude) != ""
	if hasLat != hasLon {
		return fmt.Errorf("latitude and longitude must be provided together")
	}
	if hasLat {
		lat, err := strconv.ParseFloat(strings.TrimSpace(*req.Latitude), 64)
		if err != nil || lat < -90 || lat > 90 {
			return fmt.Errorf("latitude must be a number between -90 and 90")
		}
		lon, err := strconv.ParseFloat(strings.TrimSpace(*req.Longitude), 64)
		if err != nil || lon < -180 || lon > 180 {
			return fmt.Errorf("longitude must be a number between -180 and 180")
		}
	}

	if req.FontFamily != nil {
		trimmed := strings.TrimSpace(*req.FontFamily)
		if trimmed == "" {
			req.FontFamily = nil
		} else if len(trimmed) > 80 {
			return fmt.Errorf("fontFamily max length is 80")
		} else {
			req.FontFamily = &trimmed
		}
	}

	if req.CityFontSize != nil && (*req.CityFontSize < 8 || *req.CityFontSize > 120) {
		return fmt.Errorf("cityFontSize must be between 8 and 120")
	}
	if req.CountryFontSize != nil && (*req.CountryFontSize < 6 || *req.CountryFontSize > 80) {
		return fmt.Errorf("countryFontSize must be between 6 and 80")
	}
	if req.TextColor != nil {
		trimmed := strings.TrimSpace(*req.TextColor)
		if trimmed == "" {
			req.TextColor = nil
		} else if !hexColor.MatchString(trimmed) {
			return fmt.Errorf("textColor must be a hex color")
		} else {
			req.TextColor = &trimmed
		}
	}
	if req.LabelPadding < 0.5 || req.LabelPadding > 3 {
		return fmt.Errorf("labelPaddingScale must be between 0.5 and 3")
	}
	if req.TextBlurSize < 0.6 || req.TextBlurSize > 2.5 {
		return fmt.Errorf("textBlurSize must be between 0.6 and 2.5")
	}
	if req.TextBlurStrength < 0 || req.TextBlurStrength > 30 {
		return fmt.Errorf("textBlurStrength must be between 0 and 30")
	}
	if req.Distance < minDistanceMeters || req.Distance > maxDistanceMeters {
		return fmt.Errorf("distance must be between %d and %d", minDistanceMeters, maxDistanceMeters)
	}
	if req.Width < minPosterSizeInches || req.Width > maxPosterSizeInches {
		return fmt.Errorf("width must be between %.0f and %.0f", minPosterSizeInches, maxPosterSizeInches)
	}
	if req.Height < minPosterSizeInches || req.Height > maxPosterSizeInches {
		return fmt.Errorf("height must be between %.0f and %.0f", minPosterSizeInches, maxPosterSizeInches)
	}
	if !req.Format.IsValid() {
		return fmt.Errorf("format must be one of png, svg, pdf")
	}
	return nil
}

func ValidateRenderSnapshotRequest(req *types.RenderSnapshotRequest) error {
	req.City = strings.TrimSpace(req.City)
	req.Country = strings.TrimSpace(req.Country)
	if req.City == "" || len(req.City) > 100 {
		return fmt.Errorf("city must be between 1 and 100 chars")
	}
	if req.Country == "" || len(req.Country) > 100 {
		return fmt.Errorf("country must be between 1 and 100 chars")
	}

	hasLat := req.Latitude != nil && strings.TrimSpace(*req.Latitude) != ""
	hasLon := req.Longitude != nil && strings.TrimSpace(*req.Longitude) != ""
	if hasLat != hasLon {
		return fmt.Errorf("latitude and longitude must be provided together")
	}
	if hasLat {
		lat, err := strconv.ParseFloat(strings.TrimSpace(*req.Latitude), 64)
		if err != nil || lat < -90 || lat > 90 {
			return fmt.Errorf("latitude must be a number between -90 and 90")
		}
		lon, err := strconv.ParseFloat(strings.TrimSpace(*req.Longitude), 64)
		if err != nil || lon < -180 || lon > 180 {
			return fmt.Errorf("longitude must be a number between -180 and 180")
		}
	}

	if req.Distance < minDistanceMeters || req.Distance > maxDistanceMeters {
		return fmt.Errorf("distance must be between %d and %d", minDistanceMeters, maxDistanceMeters)
	}
	if req.Width < minPosterSizeInches || req.Width > maxPosterSizeInches {
		return fmt.Errorf("width must be between %.0f and %.0f", minPosterSizeInches, maxPosterSizeInches)
	}
	if req.Height < minPosterSizeInches || req.Height > maxPosterSizeInches {
		return fmt.Errorf("height must be between %.0f and %.0f", minPosterSizeInches, maxPosterSizeInches)
	}
	return nil
}

func ValidateExportInitRequest(req *types.ExportInitRequest) error {
	if err := ValidateGenerateRequest(&req.Payload); err != nil {
		return err
	}
	req.RendererVersion = strings.TrimSpace(req.RendererVersion)
	req.SnapshotID = strings.TrimSpace(req.SnapshotID)
	if req.RendererVersion == "" || len(req.RendererVersion) > 80 {
		return fmt.Errorf("rendererVersion must be between 1 and 80 chars")
	}
	if req.SnapshotID == "" || len(req.SnapshotID) > 200 {
		return fmt.Errorf("snapshotId must be between 1 and 200 chars")
	}
	if len(req.ArtifactsPlanned) < 1 || len(req.ArtifactsPlanned) > 50 {
		return fmt.Errorf("artifactsPlanned must contain between 1 and 50 items")
	}
	for i := range req.ArtifactsPlanned {
		item := &req.ArtifactsPlanned[i]
		item.Theme = strings.TrimSpace(item.Theme)
		item.FileName = strings.TrimSpace(item.FileName)
		item.ContentType = strings.TrimSpace(item.ContentType)
		if item.Theme == "" || len(item.Theme) > 80 {
			return fmt.Errorf("artifactsPlanned[%d].theme is invalid", i)
		}
		if item.FileName == "" || len(item.FileName) > 200 {
			return fmt.Errorf("artifactsPlanned[%d].fileName is invalid", i)
		}
		if item.ContentType == "" || len(item.ContentType) > 120 {
			return fmt.Errorf("artifactsPlanned[%d].contentType is invalid", i)
		}
		if !item.Format.IsValid() {
			return fmt.Errorf("artifactsPlanned[%d].format is invalid", i)
		}
	}
	return nil
}
