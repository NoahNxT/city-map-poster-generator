package types

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type OutputFormat string

const (
	OutputPNG OutputFormat = "png"
	OutputSVG OutputFormat = "svg"
	OutputPDF OutputFormat = "pdf"
)

func (f OutputFormat) IsValid() bool {
	switch f {
	case OutputPNG, OutputSVG, OutputPDF:
		return true
	default:
		return false
	}
}

type GenerateRequest struct {
	City             string      `json:"city"`
	Country          string      `json:"country"`
	Latitude         *string     `json:"latitude,omitempty"`
	Longitude        *string     `json:"longitude,omitempty"`
	FontFamily       *string     `json:"fontFamily,omitempty"`
	Theme            string      `json:"theme"`
	AllThemes        bool        `json:"allThemes"`
	IncludeWater     bool        `json:"includeWater"`
	IncludeParks     bool        `json:"includeParks"`
	CityFontSize     *float64    `json:"cityFontSize,omitempty"`
	CountryFontSize  *float64    `json:"countryFontSize,omitempty"`
	TextColor        *string     `json:"textColor,omitempty"`
	LabelPadding     float64     `json:"labelPaddingScale"`
	TextBlurEnabled  bool        `json:"textBlurEnabled"`
	TextBlurSize     float64     `json:"textBlurSize"`
	TextBlurStrength float64     `json:"textBlurStrength"`
	Distance         int         `json:"distance"`
	Width            float64     `json:"width"`
	Height           float64     `json:"height"`
	Format           OutputFormat `json:"format"`
}

func (r GenerateRequest) CanonicalJSON() ([]byte, error) {
	type canonical struct {
		City             string      `json:"city"`
		Country          string      `json:"country"`
		Latitude         *string     `json:"latitude,omitempty"`
		Longitude        *string     `json:"longitude,omitempty"`
		FontFamily       *string     `json:"fontFamily,omitempty"`
		Theme            string      `json:"theme"`
		AllThemes        bool        `json:"allThemes"`
		IncludeWater     bool        `json:"includeWater"`
		IncludeParks     bool        `json:"includeParks"`
		CityFontSize     *float64    `json:"cityFontSize,omitempty"`
		CountryFontSize  *float64    `json:"countryFontSize,omitempty"`
		TextColor        *string     `json:"textColor,omitempty"`
		LabelPadding     float64     `json:"labelPaddingScale"`
		TextBlurEnabled  bool        `json:"textBlurEnabled"`
		TextBlurSize     float64     `json:"textBlurSize"`
		TextBlurStrength float64     `json:"textBlurStrength"`
		Distance         int         `json:"distance"`
		Width            float64     `json:"width"`
		Height           float64     `json:"height"`
		Format           OutputFormat `json:"format"`
	}
	payload := canonical{
		City:             strings.TrimSpace(r.City),
		Country:          strings.TrimSpace(r.Country),
		Latitude:         r.Latitude,
		Longitude:        r.Longitude,
		FontFamily:       r.FontFamily,
		Theme:            strings.TrimSpace(r.Theme),
		AllThemes:        r.AllThemes,
		IncludeWater:     r.IncludeWater,
		IncludeParks:     r.IncludeParks,
		CityFontSize:     r.CityFontSize,
		CountryFontSize:  r.CountryFontSize,
		TextColor:        r.TextColor,
		LabelPadding:     r.LabelPadding,
		TextBlurEnabled:  r.TextBlurEnabled,
		TextBlurSize:     r.TextBlurSize,
		TextBlurStrength: r.TextBlurStrength,
		Distance:         r.Distance,
		Width:            r.Width,
		Height:           r.Height,
		Format:           r.Format,
	}
	return json.Marshal(payload)
}

type CreateJobRequest struct {
	Payload      GenerateRequest `json:"payload"`
	CaptchaToken *string         `json:"captchaToken,omitempty"`
}

type Theme struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Colors      map[string]string `json:"colors"`
}

type LocationSuggestion struct {
	PlaceID     string  `json:"placeId"`
	DisplayName string  `json:"displayName"`
	City        string  `json:"city"`
	Country     string  `json:"country"`
	Latitude    string  `json:"latitude"`
	Longitude   string  `json:"longitude"`
	CountryCode *string `json:"countryCode,omitempty"`
}

type FontSuggestion struct {
	Family     string `json:"family"`
	Category   string `json:"category,omitempty"`
	Popularity int    `json:"popularity,omitempty"`
}

type Artifact struct {
	Theme    string       `json:"theme"`
	Format   OutputFormat `json:"format"`
	FileName string       `json:"fileName"`
	Key      string       `json:"key"`
}

type JobStatus string

const (
	JobQueued     JobStatus = "queued"
	JobDownloading JobStatus = "downloading"
	JobRendering  JobStatus = "rendering"
	JobPackaging  JobStatus = "packaging"
	JobComplete   JobStatus = "complete"
	JobFailed     JobStatus = "failed"
)

type JobState struct {
	JobID     string     `json:"jobId"`
	Status    JobStatus  `json:"status"`
	Progress  int        `json:"progress"`
	Steps     []string   `json:"steps"`
	Artifacts []Artifact `json:"artifacts"`
	ZipKey    *string    `json:"zipKey,omitempty"`
	Error     *string    `json:"error,omitempty"`
	CreatedAt string     `json:"createdAt"`
	UpdatedAt string     `json:"updatedAt"`
}

func NewJobState(jobID string) JobState {
	now := time.Now().UTC().Format(time.RFC3339)
	return JobState{
		JobID:     jobID,
		Status:    JobQueued,
		Progress:  0,
		Steps:     []string{"Queued"},
		Artifacts: []Artifact{},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func (s *JobState) Update(status JobStatus, progress int, step string) error {
	if progress < 0 || progress > 100 {
		return errors.New("progress must be 0..100")
	}
	s.Status = status
	s.Progress = progress
	if strings.TrimSpace(step) != "" {
		s.Steps = append(s.Steps, step)
	}
	s.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return nil
}
