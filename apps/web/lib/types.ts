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
  textBlurSize: number;
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
