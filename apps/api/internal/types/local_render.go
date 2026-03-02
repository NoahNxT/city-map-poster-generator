package types

import "time"

const SnapshotSchemaVersion = "v1"

type RenderSnapshotRequest struct {
	City         string  `json:"city"`
	Country      string  `json:"country"`
	Latitude     *string `json:"latitude,omitempty"`
	Longitude    *string `json:"longitude,omitempty"`
	Distance     int     `json:"distance"`
	Width        float64 `json:"width"`
	Height       float64 `json:"height"`
	IncludeWater bool    `json:"includeWater"`
	IncludeParks bool    `json:"includeParks"`
}

type SnapshotNode struct {
	ID  int64   `json:"id"`
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type SnapshotWay struct {
	ID    int64             `json:"id"`
	Nodes []int64           `json:"nodes"`
	Tags  map[string]string `json:"tags"`
}

type RenderSnapshotPayload struct {
	SchemaVersion  string         `json:"schemaVersion"`
	SnapshotID     string         `json:"snapshotId"`
	CreatedAt      string         `json:"createdAt"`
	ResolvedLat    float64        `json:"resolvedLat"`
	ResolvedLon    float64        `json:"resolvedLon"`
	Center         [2]float64     `json:"center"`
	Distance       int            `json:"distance"`
	TargetAspect   float64        `json:"targetAspect"`
	IncludeWater   bool           `json:"includeWater"`
	IncludeParks   bool           `json:"includeParks"`
	CoordPrecision int            `json:"coordPrecision"`
	Nodes          []SnapshotNode `json:"nodes"`
	Roads          []SnapshotWay  `json:"roads"`
	Water          []SnapshotWay  `json:"water"`
	Parks          []SnapshotWay  `json:"parks"`
}

type ExportArtifactPlan struct {
	Theme       string       `json:"theme"`
	Format      OutputFormat `json:"format"`
	FileName    string       `json:"fileName"`
	ContentType string       `json:"contentType"`
}

type ExportInitRequest struct {
	Payload          GenerateRequest      `json:"payload"`
	AllThemes        bool                 `json:"allThemes"`
	ArtifactsPlanned []ExportArtifactPlan `json:"artifactsPlanned"`
	CaptchaToken     *string              `json:"captchaToken,omitempty"`
	RendererVersion  string               `json:"rendererVersion"`
	SnapshotID       string               `json:"snapshotId"`
}

type ExportUploadTarget struct {
	FileName    string `json:"fileName"`
	Key         string `json:"key"`
	ContentType string `json:"contentType"`
	UploadURL   string `json:"uploadUrl"`
}

type ExportInitResponse struct {
	ExportID  string               `json:"exportId"`
	Status    ExportStatus         `json:"status"`
	Uploads   []ExportUploadTarget `json:"uploads"`
	MaxSizeMB int                  `json:"maxSizeMb"`
	ExpiresAt string               `json:"expiresAt"`
}

type ExportCompleteUpload struct {
	Key    string `json:"key"`
	Sha256 string `json:"sha256"`
	Size   int64  `json:"size"`
}

type ExportCompleteRequest struct {
	Uploads     []ExportCompleteUpload `json:"uploads"`
	DownloadKey string                 `json:"downloadKey"`
}

type ExportStatus string

const (
	ExportQueued    ExportStatus = "queued"
	ExportUploading ExportStatus = "uploading"
	ExportComplete  ExportStatus = "complete"
	ExportFailed    ExportStatus = "failed"
)

type ExportState struct {
	ExportID        string       `json:"exportId"`
	Status          ExportStatus `json:"status"`
	Progress        int          `json:"progress"`
	Steps           []string     `json:"steps"`
	Artifacts       []Artifact   `json:"artifacts"`
	ExpectedUploads []string     `json:"expectedUploads"`
	DownloadKey     *string      `json:"downloadKey,omitempty"`
	Error           *string      `json:"error,omitempty"`
	CreatedAt       string       `json:"createdAt"`
	UpdatedAt       string       `json:"updatedAt"`
}

func NewExportState(exportID string) ExportState {
	now := time.Now().UTC().Format(time.RFC3339)
	return ExportState{
		ExportID:        exportID,
		Status:          ExportQueued,
		Progress:        0,
		Steps:           []string{"Queued"},
		Artifacts:       []Artifact{},
		ExpectedUploads: []string{},
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}
