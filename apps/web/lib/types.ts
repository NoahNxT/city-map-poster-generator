export type OutputFormat = "png" | "svg" | "pdf";

export type PosterRequest = {
  city: string;
  country: string;
  latitude?: string;
  longitude?: string;
  fontFamily?: string;
  theme: string;
  allThemes: boolean;
  includeWater: boolean;
  includeParks: boolean;
  cityFontSize?: number;
  countryFontSize?: number;
  textColor?: string;
  labelPaddingScale: number;
  textBlurEnabled: boolean;
  textBlurSizeX: number;
  textBlurSizeY: number;
  textBlurStrength: number;
  distance: number;
  width: number;
  height: number;
  format: OutputFormat;
};

export type Theme = {
  id: string;
  name: string;
  description: string;
  colors: Record<string, string>;
};

export type LocationSuggestion = {
  placeId: string;
  displayName: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  countryCode?: string | null;
};

export type FontSuggestion = {
  family: string;
  category?: string | null;
  popularity?: number | null;
};

export type JobArtifact = {
  theme: string;
  format: OutputFormat;
  fileName: string;
  key: string;
};

export type JobState = {
  jobId: string;
  status:
    | "queued"
    | "downloading"
    | "rendering"
    | "packaging"
    | "complete"
    | "failed";
  progress: number;
  steps: string[];
  artifacts: JobArtifact[];
  zipKey?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RenderSnapshotRequest = {
  city: string;
  country: string;
  latitude?: string;
  longitude?: string;
  distance: number;
  width: number;
  height: number;
  includeWater: boolean;
  includeParks: boolean;
};

export type SnapshotNode = {
  id: number;
  lat: number;
  lon: number;
};

export type SnapshotWay = {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
};

export type RenderSnapshotPayload = {
  schemaVersion: string;
  snapshotId: string;
  createdAt: string;
  resolvedLat: number;
  resolvedLon: number;
  center: [number, number];
  distance: number;
  targetAspect: number;
  includeWater: boolean;
  includeParks: boolean;
  coordPrecision: number;
  nodes: SnapshotNode[];
  roads: SnapshotWay[];
  water: SnapshotWay[];
  parks: SnapshotWay[];
};

export type ExportArtifactPlan = {
  theme: string;
  format: OutputFormat;
  fileName: string;
  contentType: string;
};

export type ExportInitRequest = {
  payload: PosterRequest;
  allThemes: boolean;
  artifactsPlanned: ExportArtifactPlan[];
  rendererVersion: string;
  snapshotId: string;
  captchaToken?: string;
};

export type ExportUploadTarget = {
  fileName: string;
  key: string;
  contentType: string;
  uploadUrl: string;
};

export type ExportInitResponse = {
  exportId: string;
  status: "queued" | "uploading" | "complete" | "failed";
  uploads: ExportUploadTarget[];
  maxSizeMb: number;
  expiresAt: string;
};

export type ExportCompleteUpload = {
  key: string;
  sha256: string;
  size: number;
};

export type ExportState = {
  exportId: string;
  status: "queued" | "uploading" | "complete" | "failed";
  progress: number;
  steps: string[];
  artifacts: JobArtifact[];
  expectedUploads: string[];
  downloadKey?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};
