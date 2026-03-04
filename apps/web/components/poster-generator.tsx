"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  CircleHelp,
  Eye,
  LoaderCircle,
  MapIcon,
  WandSparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  createJob,
  fetchDownload,
  fetchFontBundleData,
  fetchFonts,
  fetchJob,
  fetchLocations,
  fetchPreview,
  fetchRenderSnapshot,
  fetchThemes,
} from "@/lib/api";
import {
  LOCALE_COOKIE_NAME,
  type Locale,
  localeLabels,
  locales,
} from "@/lib/i18n/config";
import type { HomeDictionary } from "@/lib/i18n/dictionaries";
import type {
  LocationSuggestion,
  PosterRequest,
  RenderSnapshotPayload,
  RenderSnapshotRequest,
  Theme,
} from "@/lib/types";
import { LocationSearchField } from "./poster-generator/location-search-field";
import { PreviewPanel } from "./poster-generator/preview-panel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";

type AdvancedHelpFieldKey =
  | "fontFamily"
  | "sizeUnit"
  | "width"
  | "height"
  | "cityFontSize"
  | "countryFontSize";
type SizeUnit = "cm" | "in";
type DimensionField = "width" | "height";

const CM_PER_INCH = 2.54;
const MIN_POSTER_INCHES_INCH_MODE = 5;
const MAX_POSTER_INCHES = 80;
const MIN_POSTER_CENTIMETERS = 10;
const MAX_POSTER_CENTIMETERS = 200;
const MIN_POSTER_INCHES = MIN_POSTER_CENTIMETERS / CM_PER_INCH;
const MIN_DISTANCE_METERS = 1000;
const MAX_DISTANCE_METERS = 18000;
const MIN_TEXT_BLUR_SIZE = 0.6;
const MAX_TEXT_BLUR_SIZE = 2.5;
const MIN_TEXT_BLUR_STRENGTH = 0;
const MAX_TEXT_BLUR_STRENGTH = 30;
const MIN_PERCENT = 1;
const MAX_PERCENT = 100;
const MID_PERCENT = 50;
const DEFAULT_TEXT_BLUR_SIZE_X_PERCENT = 50;
const DEFAULT_TEXT_BLUR_SIZE_Y_PERCENT = 50;
const DEFAULT_TEXT_BLUR_STRENGTH_PERCENT = 100;
const TUNED_TEXT_BLUR_SIZE_X_PERCENT = 65;
const TUNED_TEXT_BLUR_SIZE_Y_PERCENT = 60;
const TUNED_TEXT_BLUR_SIZE_X_VALUE =
  MIN_TEXT_BLUR_SIZE +
  ((TUNED_TEXT_BLUR_SIZE_X_PERCENT - MIN_PERCENT) /
    Math.max(MAX_PERCENT - MIN_PERCENT, 1e-6)) *
    (MAX_TEXT_BLUR_SIZE - MIN_TEXT_BLUR_SIZE);
const TUNED_TEXT_BLUR_SIZE_Y_VALUE =
  MIN_TEXT_BLUR_SIZE +
  ((TUNED_TEXT_BLUR_SIZE_Y_PERCENT - MIN_PERCENT) /
    Math.max(MAX_PERCENT - MIN_PERCENT, 1e-6)) *
    (MAX_TEXT_BLUR_SIZE - MIN_TEXT_BLUR_SIZE);
const MAX_LOCAL_PREVIEW_LONG_EDGE_PX = 2048;
const PREVIEW_FRAME_MAX_WIDTH_PX = 420;
const PREVIEW_FRAME_MAX_HEIGHT_PX = 560;
const DEFAULT_CITY_FONT_SIZE = 60;
const DEFAULT_COUNTRY_FONT_SIZE = 22;

type FormValues = {
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
  format: "png" | "svg" | "pdf";
};

const DEFAULT_PREVIEW_ZOOM = 2.5;

type PreviewPointer = {
  x: number;
  y: number;
};

type RendererMode = "local-wasm" | "server-fallback";
type PreviewEngine = "hybrid" | "snapshot";

type WorkerRenderResponse =
  | {
      type: "rendered";
      id: string;
      dataUrl: string;
    }
  | {
      type: "error";
      id: string;
      message: string;
    };

type WorkerRenderRequest = {
  type: "render";
  id: string;
  payload: PosterRequest;
  snapshot: RenderSnapshotPayload;
  theme: Theme;
  pixelWidth: number;
  pixelHeight: number;
  fontBundle?: {
    family: string;
    files: Record<string, string>;
  } | null;
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PREVIEW_RENDER_DPI = 120;
const SNAPSHOT_FETCH_TIMEOUT_MS = 60_000;
const WORKER_RENDER_TIMEOUT_MS = 8_000;
const WORKER_RENDER_DEBOUNCE_MS = 120;
const TurnstileWidget = dynamic(
  () => import("@marsidev/react-turnstile").then((module) => module.Turnstile),
  { ssr: false },
);
const ThemeExplorerDialog = dynamic(
  () =>
    import("./poster-generator/theme-explorer-dialog").then(
      (module) => module.ThemeExplorerDialog,
    ),
  { loading: () => null },
);
const FontFamilyPicker = dynamic(
  () =>
    import("./poster-generator/font-family-picker").then(
      (module) => module.FontFamilyPicker,
    ),
  { ssr: false, loading: () => null },
);

function supportsLocalRenderer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function valueToPercent(value: number, min: number, max: number): number {
  const clamped = clamp(value, min, max);
  const ratio = (clamped - min) / Math.max(max - min, 1e-6);
  return Math.round(MIN_PERCENT + ratio * (MAX_PERCENT - MIN_PERCENT));
}

function percentToValue(percent: number, min: number, max: number): number {
  const clamped = clamp(percent, MIN_PERCENT, MAX_PERCENT);
  const ratio =
    (clamped - MIN_PERCENT) / Math.max(MAX_PERCENT - MIN_PERCENT, 1e-6);
  return min + ratio * (max - min);
}

function valueToPercentWithMid(
  value: number,
  min: number,
  midValue: number,
  max: number,
): number {
  const clamped = clamp(value, min, max);
  if (clamped <= midValue) {
    const ratio = (clamped - min) / Math.max(midValue - min, 1e-6);
    return Math.round(MIN_PERCENT + ratio * (MID_PERCENT - MIN_PERCENT));
  }
  const ratio = (clamped - midValue) / Math.max(max - midValue, 1e-6);
  return Math.round(MID_PERCENT + ratio * (MAX_PERCENT - MID_PERCENT));
}

function percentToValueWithMid(
  percent: number,
  min: number,
  midValue: number,
  max: number,
): number {
  const clamped = clamp(percent, MIN_PERCENT, MAX_PERCENT);
  if (clamped <= MID_PERCENT) {
    const ratio =
      (clamped - MIN_PERCENT) / Math.max(MID_PERCENT - MIN_PERCENT, 1e-6);
    return min + ratio * (midValue - min);
  }
  const ratio =
    (clamped - MID_PERCENT) / Math.max(MAX_PERCENT - MID_PERCENT, 1e-6);
  return midValue + ratio * (max - midValue);
}

function blurSizeXToPercent(value: number): number {
  return valueToPercentWithMid(
    value,
    MIN_TEXT_BLUR_SIZE,
    TUNED_TEXT_BLUR_SIZE_X_VALUE,
    MAX_TEXT_BLUR_SIZE,
  );
}

function blurSizeXFromPercent(percent: number): number {
  return percentToValueWithMid(
    percent,
    MIN_TEXT_BLUR_SIZE,
    TUNED_TEXT_BLUR_SIZE_X_VALUE,
    MAX_TEXT_BLUR_SIZE,
  );
}

function blurSizeYToPercent(value: number): number {
  return valueToPercentWithMid(
    value,
    MIN_TEXT_BLUR_SIZE,
    TUNED_TEXT_BLUR_SIZE_Y_VALUE,
    MAX_TEXT_BLUR_SIZE,
  );
}

function blurSizeYFromPercent(percent: number): number {
  return percentToValueWithMid(
    percent,
    MIN_TEXT_BLUR_SIZE,
    TUNED_TEXT_BLUR_SIZE_Y_VALUE,
    MAX_TEXT_BLUR_SIZE,
  );
}

function blurStrengthToPercent(value: number): number {
  return valueToPercent(value, MIN_TEXT_BLUR_STRENGTH, MAX_TEXT_BLUR_STRENGTH);
}

function blurStrengthFromPercent(percent: number): number {
  return percentToValue(
    percent,
    MIN_TEXT_BLUR_STRENGTH,
    MAX_TEXT_BLUR_STRENGTH,
  );
}

function inchesToCentimeters(inches: number): number {
  return inches * CM_PER_INCH;
}

function centimetersToInches(centimeters: number): number {
  return centimeters / CM_PER_INCH;
}

function maxDimensionInInchesForUnit(unit: SizeUnit): number {
  return unit === "cm"
    ? centimetersToInches(MAX_POSTER_CENTIMETERS)
    : MAX_POSTER_INCHES;
}

function minDimensionInInchesForUnit(unit: SizeUnit): number {
  return unit === "cm"
    ? centimetersToInches(MIN_POSTER_CENTIMETERS)
    : MIN_POSTER_INCHES_INCH_MODE;
}

function parseDecimalInput(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  if (!/^[+-]?(\d+([.]\d*)?|[.]\d+)$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDimensionValue(
  inches: number,
  unit: SizeUnit,
  locale: string,
): string {
  const safeInches = Number.isFinite(inches) ? inches : MIN_POSTER_INCHES;
  const displayValue =
    unit === "cm" ? inchesToCentimeters(safeInches) : safeInches;
  const rounded = Number(displayValue.toFixed(2));
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

function computeAutoCityFontSize(city: string): number {
  const cityLength = city.trim().length;
  if (cityLength <= 10) {
    return DEFAULT_CITY_FONT_SIZE;
  }
  const scaledSize = Math.max(DEFAULT_CITY_FONT_SIZE * (10 / cityLength), 10);
  return Math.round(scaledSize);
}

function normalizeHexColor(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !HEX_COLOR_PATTERN.test(raw)) {
    return null;
  }
  if (raw.length === 7) {
    return raw;
  }
  const [r, g, b] = raw.slice(1).split("");
  return `#${r}${r}${g}${g}${b}${b}`;
}

function sanitizeFontFamily(value: string | undefined): string {
  return (value ?? "").trim().replace(/["']/g, "");
}

function buildGoogleFontsStylesheetUrl(
  value: string | undefined,
): string | null {
  const family = sanitizeFontFamily(value);
  if (!family) return null;

  const familyToken = family.split(/\s+/).join("+");
  const encodedFamily = encodeURIComponent(familyToken).replace(/%2B/g, "+");
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@300;400;700&display=swap`;
}

const distancePresets = [
  { label: "6km", value: 6000 },
  { label: "12km", value: 12000 },
  { label: "18km", value: 18000 },
];

const fallbackFontFamilies = [
  { family: "Roboto", category: "sans-serif" },
  { family: "Open Sans", category: "sans-serif" },
  { family: "Inter", category: "sans-serif" },
  { family: "Montserrat", category: "sans-serif" },
  { family: "Lato", category: "sans-serif" },
  { family: "Poppins", category: "sans-serif" },
  { family: "Noto Sans", category: "sans-serif" },
  { family: "Noto Serif", category: "serif" },
  { family: "Merriweather", category: "serif" },
  { family: "Playfair Display", category: "serif" },
];

const defaultValues: FormValues = {
  city: "Antwerp",
  country: "Belgium",
  latitude: "51.2211097",
  longitude: "4.3997081",
  fontFamily: "",
  theme: "terracotta",
  allThemes: false,
  includeWater: true,
  includeParks: true,
  cityFontSize: undefined,
  countryFontSize: undefined,
  textColor: undefined,
  labelPaddingScale: 1.2,
  textBlurEnabled: false,
  textBlurSizeX: blurSizeXFromPercent(DEFAULT_TEXT_BLUR_SIZE_X_PERCENT),
  textBlurSizeY: blurSizeYFromPercent(DEFAULT_TEXT_BLUR_SIZE_Y_PERCENT),
  textBlurStrength: blurStrengthFromPercent(DEFAULT_TEXT_BLUR_STRENGTH_PERCENT),
  distance: 12000,
  width: centimetersToInches(30),
  height: centimetersToInches(40),
  format: "png",
};

function toPayload(values: FormValues): PosterRequest {
  return {
    city: values.city,
    country: values.country,
    latitude: values.latitude?.trim() || undefined,
    longitude: values.longitude?.trim() || undefined,
    fontFamily: values.fontFamily?.trim() || undefined,
    theme: values.theme,
    allThemes: values.allThemes,
    includeWater: values.includeWater,
    includeParks: values.includeParks,
    cityFontSize: values.cityFontSize,
    countryFontSize: values.countryFontSize,
    textColor: normalizeHexColor(values.textColor) ?? undefined,
    labelPaddingScale: values.labelPaddingScale,
    textBlurEnabled: values.textBlurEnabled,
    textBlurSizeX: values.textBlurSizeX,
    textBlurSizeY: values.textBlurSizeY,
    textBlurStrength: values.textBlurStrength,
    distance: values.distance,
    width: values.width,
    height: values.height,
    format: values.format,
  };
}

function toSnapshotRequest(values: FormValues): RenderSnapshotRequest {
  return {
    city: values.city.trim(),
    country: values.country.trim(),
    latitude: values.latitude?.trim() || undefined,
    longitude: values.longitude?.trim() || undefined,
    distance: values.distance,
    width: values.width,
    height: values.height,
    includeWater: values.includeWater,
    includeParks: values.includeParks,
  };
}

export function PosterGenerator({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: HomeDictionary;
}) {
  const showDevRateLimitToggle = process.env.NODE_ENV !== "production";
  const configuredPreviewEngine =
    process.env.NEXT_PUBLIC_PREVIEW_ENGINE?.trim().toLowerCase();
  const previewEngine: PreviewEngine =
    configuredPreviewEngine === "hybrid" ||
    configuredPreviewEngine === "snapshot"
      ? configuredPreviewEngine
      : process.env.NODE_ENV === "production"
        ? "snapshot"
        : "hybrid";
  const locationInputId = "location-search";
  const locationHintId = "location-search-help";
  const locationStatusId = "location-search-status";
  const locationListboxId = "location-search-listbox";
  const fontDescriptionId = "font-family-help";
  const generationStatusLiveId = "generation-status-live";
  const generationStatusTitleId = "generation-status-title";
  const distanceSliderId = "distance-slider";
  const themeSelectId = "theme-select";
  const formatSelectId = "format-select";
  const sizeUnitSelectId = "size-unit-select";
  const includeWaterId = "include-water-switch";
  const includeParksId = "include-parks-switch";
  const blurEnabledId = "text-blur-switch";
  const devSettingsToggleId = "dev-settings-switch";
  const rateLimitToggleId = "dev-rate-limit-switch";
  const captchaToggleId = "dev-captcha-switch";
  const zoomToggleId = "preview-zoom-switch";
  const zoomSliderId = "preview-zoom-slider";
  const pageDescriptionId = "generator-page-description";
  const previewKeyboardHintId = "preview-keyboard-hint";
  const previewFrameId = "live-preview-frame";
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [jobId, setJobId] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(
    undefined,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>(
    previewEngine === "snapshot" ? "server-fallback" : "local-wasm",
  );
  const [rendererReason, setRendererReason] = useState(
    previewEngine === "snapshot" ? "snapshot-engine" : "initializing",
  );
  const [latestPreviewUrl, setLatestPreviewUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localRenderPending, setLocalRenderPending] = useState(true);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [themeDialogMounted, setThemeDialogMounted] = useState(false);
  const [advancedAccordionValue, setAdvancedAccordionValue] =
    useState<string>("");
  const [activePreviewHint, setActivePreviewHint] =
    useState<AdvancedHelpFieldKey | null>(null);
  const [previewZoomEnabled, setPreviewZoomEnabled] = useState(false);
  const [showDevSettingsCard, setShowDevSettingsCard] = useState(false);
  const [disableRateLimit, setDisableRateLimit] = useState(false);
  const [disableCaptchaCheck, setDisableCaptchaCheck] = useState(false);
  const [turnstileRenderKey, setTurnstileRenderKey] = useState(0);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("cm");
  const [activeDimensionField, setActiveDimensionField] =
    useState<DimensionField | null>(null);
  const [widthInputValue, setWidthInputValue] = useState(() =>
    formatDimensionValue(defaultValues.width, "cm", locale),
  );
  const [heightInputValue, setHeightInputValue] = useState(() =>
    formatDimensionValue(defaultValues.height, "cm", locale),
  );
  const [previewZoomLevel, setPreviewZoomLevel] =
    useState(DEFAULT_PREVIEW_ZOOM);
  const [distanceSliderValue, setDistanceSliderValue] = useState(
    defaultValues.distance,
  );
  const [labelPaddingSliderValue, setLabelPaddingSliderValue] = useState(
    defaultValues.labelPaddingScale,
  );
  const [blurSizeXSliderValue, setBlurSizeXSliderValue] = useState(() =>
    blurSizeXToPercent(defaultValues.textBlurSizeX),
  );
  const [blurSizeYSliderValue, setBlurSizeYSliderValue] = useState(() =>
    blurSizeYToPercent(defaultValues.textBlurSizeY),
  );
  const [blurStrengthSliderValue, setBlurStrengthSliderValue] = useState(() =>
    blurStrengthToPercent(defaultValues.textBlurStrength),
  );
  const [previewZoomSliderValue, setPreviewZoomSliderValue] =
    useState(DEFAULT_PREVIEW_ZOOM);
  const [debouncedSnapshotRequest, setDebouncedSnapshotRequest] =
    useState<RenderSnapshotRequest>(() => toSnapshotRequest(defaultValues));
  const [debouncedPreviewPayload, setDebouncedPreviewPayload] =
    useState<PosterRequest>(() => toPayload(defaultValues));
  const [previewPointer, setPreviewPointer] = useState<PreviewPointer | null>(
    null,
  );
  const [locationQuery, setLocationQuery] = useState(
    `${defaultValues.city}, ${defaultValues.country}`,
  );
  const [debouncedLocationQuery, setDebouncedLocationQuery] =
    useState(locationQuery);
  const [debouncedFontQuery, setDebouncedFontQuery] = useState<string>(
    defaultValues.fontFamily ?? "",
  );
  const [locationAutocompleteOpen, setLocationAutocompleteOpen] =
    useState(false);
  const [fontComboboxOpen, setFontComboboxOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState<string>(
    defaultValues.fontFamily ?? "",
  );
  const [activeLocationIndex, setActiveLocationIndex] = useState<number>(-1);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const latestWorkerRenderIdRef = useRef<string>("");
  const workerRenderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const workerRenderScheduleRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pathname = usePathname();
  const router = useRouter();

  const form = useForm<FormValues>({
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const watchedValues = useWatch({ control: form.control });
  const values = useMemo<FormValues>(
    () => ({
      ...defaultValues,
      ...watchedValues,
    }),
    [watchedValues],
  );
  const advancedOptionsOpen = advancedAccordionValue === "advanced";
  const selectedFontFamily = values.fontFamily?.trim() ?? "";
  const previewPayload = useMemo(() => toPayload(values), [values]);
  const {
    city: snapshotCity,
    country: snapshotCountry,
    latitude: snapshotLatitude,
    longitude: snapshotLongitude,
    distance: snapshotDistance,
    width: snapshotWidth,
    height: snapshotHeight,
    includeWater: snapshotIncludeWater,
    includeParks: snapshotIncludeParks,
  } = values;
  const snapshotRequest = useMemo(
    (): RenderSnapshotRequest => ({
      city: snapshotCity.trim(),
      country: snapshotCountry.trim(),
      latitude: snapshotLatitude?.trim() || undefined,
      longitude: snapshotLongitude?.trim() || undefined,
      distance: snapshotDistance,
      width: snapshotWidth,
      height: snapshotHeight,
      includeWater: snapshotIncludeWater,
      includeParks: snapshotIncludeParks,
    }),
    [
      snapshotCity,
      snapshotCountry,
      snapshotLatitude,
      snapshotLongitude,
      snapshotDistance,
      snapshotWidth,
      snapshotHeight,
      snapshotIncludeWater,
      snapshotIncludeParks,
    ],
  );
  const d = dictionary;

  const clearWorkerRenderTimeout = useCallback(() => {
    if (workerRenderTimeoutRef.current !== null) {
      clearTimeout(workerRenderTimeoutRef.current);
      workerRenderTimeoutRef.current = null;
    }
  }, []);

  const clearWorkerRenderSchedule = useCallback(() => {
    if (workerRenderScheduleRef.current !== null) {
      clearTimeout(workerRenderScheduleRef.current);
      workerRenderScheduleRef.current = null;
    }
  }, []);

  const fallbackToServer = useCallback(
    (reason: string) => {
      clearWorkerRenderSchedule();
      clearWorkerRenderTimeout();
      const worker = workerRef.current;
      if (worker) {
        worker.terminate();
        workerRef.current = null;
      }
      setRendererMode("server-fallback");
      setRendererReason(reason);
      setLocalRenderPending(false);
      setLocalPreviewUrl(null);
    },
    [clearWorkerRenderSchedule, clearWorkerRenderTimeout],
  );

  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: fetchThemes,
    staleTime: 12 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
  const locationSuggestionsQuery = useQuery({
    queryKey: ["locations", debouncedLocationQuery, disableRateLimit],
    queryFn: ({ signal }) =>
      fetchLocations(debouncedLocationQuery, {
        disableRateLimit,
        signal,
      }),
    enabled: locationAutocompleteOpen && debouncedLocationQuery.length >= 3,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const fontSuggestionsQuery = useQuery({
    queryKey: ["fonts", debouncedFontQuery, disableRateLimit],
    queryFn: ({ signal }) =>
      fetchFonts(debouncedFontQuery, {
        disableRateLimit,
        signal,
      }),
    enabled: fontComboboxOpen,
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
  const fontBundleQuery = useQuery({
    queryKey: ["font-bundle", selectedFontFamily],
    queryFn: () => fetchFontBundleData(selectedFontFamily),
    enabled: rendererMode === "local-wasm" && selectedFontFamily.length > 0,
    staleTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const snapshotQuery = useQuery({
    queryKey: ["render-snapshot", debouncedSnapshotRequest, disableRateLimit],
    queryFn: ({ signal }) =>
      withTimeout(
        fetchRenderSnapshot(debouncedSnapshotRequest, {
          disableRateLimit,
          signal,
        }),
        SNAPSHOT_FETCH_TIMEOUT_MS,
        "snapshot-timeout",
      ),
    enabled:
      rendererMode === "local-wasm" &&
      debouncedSnapshotRequest.city.trim().length > 0 &&
      debouncedSnapshotRequest.country.trim().length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
  const previewQuery = useQuery({
    queryKey: ["preview", debouncedPreviewPayload, disableRateLimit],
    queryFn: ({ signal }) =>
      fetchPreview(debouncedPreviewPayload, {
        disableRateLimit,
        signal,
      }),
    enabled:
      (rendererMode === "server-fallback" || previewEngine === "hybrid") &&
      debouncedPreviewPayload.city.trim().length > 0 &&
      debouncedPreviewPayload.country.trim().length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const createJobMutation = useMutation({
    mutationFn: ({
      payload,
      token,
      disableRateLimit,
      disableCaptchaCheck,
    }: {
      payload: PosterRequest;
      token?: string;
      disableRateLimit: boolean;
      disableCaptchaCheck: boolean;
    }) =>
      createJob(payload, token, {
        disableRateLimit,
        disableCaptchaCheck,
      }),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setDownloadUrl(null);
    },
    onSettled: () => {
      if (!turnstileSiteKey || disableCaptchaCheck) {
        return;
      }
      setCaptchaToken(undefined);
      setTurnstileRenderKey((currentKey) => currentKey + 1);
    },
  });

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 2000;
      return status === "complete" || status === "failed" ? false : 2000;
    },
  });

  const downloadMutation = useMutation({
    mutationFn: fetchDownload,
    onSuccess: (data) => {
      setDownloadUrl(data.url);
      window.open(data.url, "_blank", "noopener,noreferrer");
    },
  });

  useEffect(() => {
    if (previewEngine === "snapshot") {
      setRendererMode("server-fallback");
      setRendererReason("snapshot-engine");
      setLocalRenderPending(false);
      setLocalPreviewUrl(null);
      return;
    }

    if (!supportsLocalRenderer()) {
      setRendererMode("server-fallback");
      setRendererReason("unsupported-browser");
      setLocalRenderPending(false);
      return;
    }

    let disposed = false;
    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL("../lib/renderer/renderer-worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;
      setRendererMode("local-wasm");
      setRendererReason("ok");
      worker.onmessage = (event: MessageEvent<WorkerRenderResponse>) => {
        if (disposed) {
          return;
        }
        const message = event.data;
        if (!message || message.id !== latestWorkerRenderIdRef.current) {
          return;
        }
        clearWorkerRenderSchedule();
        clearWorkerRenderTimeout();
        if (message.type === "rendered") {
          setLocalPreviewUrl(message.dataUrl || null);
          setLocalRenderPending(false);
          return;
        }
        fallbackToServer("worker-render-error");
      };
      worker.onerror = () => {
        if (disposed) {
          return;
        }
        clearWorkerRenderSchedule();
        clearWorkerRenderTimeout();
        fallbackToServer("worker-runtime-error");
      };
    } catch {
      setRendererMode("server-fallback");
      setRendererReason("worker-init-failed");
      setLocalRenderPending(false);
    }

    return () => {
      disposed = true;
      clearWorkerRenderSchedule();
      clearWorkerRenderTimeout();
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [
    clearWorkerRenderSchedule,
    clearWorkerRenderTimeout,
    fallbackToServer,
    previewEngine,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocationQuery(locationQuery.trim());
      setActiveLocationIndex(-1);
    }, 450);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFontQuery(fontSearchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [fontSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSnapshotRequest(snapshotRequest);
    }, 350);
    return () => clearTimeout(timer);
  }, [snapshotRequest]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPreviewPayload(previewPayload);
    }, 450);
    return () => clearTimeout(timer);
  }, [previewPayload]);

  useEffect(() => {
    const nextUrl = previewQuery.data?.previewUrl;
    if (nextUrl) {
      setLatestPreviewUrl(nextUrl);
    }
  }, [previewQuery.data?.previewUrl]);

  useEffect(() => {
    if (rendererMode === "local-wasm" && snapshotQuery.isError) {
      const detail =
        snapshotQuery.error instanceof Error
          ? snapshotQuery.error.message
          : "unknown";
      fallbackToServer(`snapshot-fetch-failed:${detail}`);
    }
  }, [
    rendererMode,
    snapshotQuery.error,
    snapshotQuery.isError,
    fallbackToServer,
  ]);

  useEffect(() => {
    if (rendererMode === "local-wasm" && themesQuery.isError) {
      fallbackToServer("themes-fetch-failed");
    }
  }, [rendererMode, themesQuery.isError, fallbackToServer]);

  useEffect(() => {
    if (!fontComboboxOpen) {
      return;
    }
    setFontSearchQuery(values.fontFamily?.trim() ?? "");
  }, [fontComboboxOpen, values.fontFamily]);

  useEffect(() => {
    const href = buildGoogleFontsStylesheetUrl(values.fontFamily);
    if (!href) {
      return;
    }

    const linkId = "preview-google-font-family";
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.append(link);
    }

    if (link.getAttribute("href") !== href) {
      link.setAttribute("href", href);
    }
  }, [values.fontFamily]);

  useEffect(() => {
    const firstTheme = themesQuery.data?.[0];
    if (
      firstTheme &&
      !themesQuery.data?.some((theme) => theme.id === values.theme)
    ) {
      form.setValue("theme", firstTheme.id, { shouldValidate: true });
    }
  }, [form, themesQuery.data, values.theme]);

  useEffect(() => {
    if (!previewZoomEnabled) {
      setPreviewPointer(null);
    }
  }, [previewZoomEnabled]);

  useEffect(() => {
    if (activeDimensionField !== "width") {
      setWidthInputValue(formatDimensionValue(values.width, sizeUnit, locale));
    }
    if (activeDimensionField !== "height") {
      setHeightInputValue(
        formatDimensionValue(values.height, sizeUnit, locale),
      );
    }
  }, [activeDimensionField, locale, sizeUnit, values.height, values.width]);

  useEffect(() => {
    setDistanceSliderValue(values.distance);
  }, [values.distance]);

  useEffect(() => {
    setLabelPaddingSliderValue(values.labelPaddingScale);
  }, [values.labelPaddingScale]);

  useEffect(() => {
    setBlurSizeXSliderValue(blurSizeXToPercent(values.textBlurSizeX));
  }, [values.textBlurSizeX]);

  useEffect(() => {
    setBlurSizeYSliderValue(blurSizeYToPercent(values.textBlurSizeY));
  }, [values.textBlurSizeY]);

  useEffect(() => {
    setBlurStrengthSliderValue(blurStrengthToPercent(values.textBlurStrength));
  }, [values.textBlurStrength]);

  useEffect(() => {
    setPreviewZoomSliderValue(previewZoomLevel);
  }, [previewZoomLevel]);

  useEffect(() => {
    const minInches = minDimensionInInchesForUnit(sizeUnit);
    const maxInches = maxDimensionInInchesForUnit(sizeUnit);
    const currentWidth = form.getValues("width");
    const currentHeight = form.getValues("height");
    const normalizedWidth = Number.isFinite(currentWidth)
      ? currentWidth
      : defaultValues.width;
    const normalizedHeight = Number.isFinite(currentHeight)
      ? currentHeight
      : defaultValues.height;
    const nextWidth = clamp(normalizedWidth, minInches, maxInches);
    const nextHeight = clamp(normalizedHeight, minInches, maxInches);
    if (Math.abs(nextWidth - normalizedWidth) > 0.0001) {
      form.setValue("width", nextWidth, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    if (Math.abs(nextHeight - normalizedHeight) > 0.0001) {
      form.setValue("height", nextHeight, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [form, sizeUnit]);

  useEffect(() => {
    if (!showDevRateLimitToggle) {
      return;
    }
    const rawValue =
      window.localStorage.getItem("disableRateLimit") ??
      window.localStorage.getItem("disablePreviewRateLimit");
    if (rawValue === "1") {
      setDisableRateLimit(true);
    }
    const rawCaptchaBypassValue = window.localStorage.getItem(
      "disableCaptchaCheck",
    );
    if (rawCaptchaBypassValue === "1") {
      setDisableCaptchaCheck(true);
    }
    const rawShowDevSettingsValue = window.localStorage.getItem(
      "showDevSettingsCard",
    );
    if (rawShowDevSettingsValue === "1") {
      setShowDevSettingsCard(true);
    }
  }, [showDevRateLimitToggle]);

  useEffect(() => {
    if (!showDevRateLimitToggle) {
      return;
    }
    window.localStorage.setItem(
      "disableRateLimit",
      disableRateLimit ? "1" : "0",
    );
  }, [disableRateLimit, showDevRateLimitToggle]);

  useEffect(() => {
    if (!showDevRateLimitToggle) {
      return;
    }
    window.localStorage.setItem(
      "disableCaptchaCheck",
      disableCaptchaCheck ? "1" : "0",
    );
  }, [disableCaptchaCheck, showDevRateLimitToggle]);

  useEffect(() => {
    if (!showDevRateLimitToggle) {
      return;
    }
    window.localStorage.setItem(
      "showDevSettingsCard",
      showDevSettingsCard ? "1" : "0",
    );
  }, [showDevRateLimitToggle, showDevSettingsCard]);

  useEffect(() => {
    if (!turnstileSiteKey) {
      return;
    }
    setCaptchaToken(undefined);
    if (!disableCaptchaCheck) {
      setTurnstileRenderKey((currentKey) => currentKey + 1);
    }
  }, [disableCaptchaCheck, turnstileSiteKey]);

  const statusTone = useMemo(() => {
    const status = jobQuery.data?.status;
    if (status === "failed") return "destructive" as const;
    if (status === "complete") return "default" as const;
    return "secondary" as const;
  }, [jobQuery.data?.status]);

  function handleGenerate(values: FormValues) {
    createJobMutation.mutate({
      payload: toPayload(values),
      token: disableCaptchaCheck ? undefined : captchaToken,
      disableRateLimit,
      disableCaptchaCheck,
    });
  }

  function handleLocationSelect(suggestion: LocationSuggestion) {
    setLocationQuery(suggestion.displayName);
    setLocationAutocompleteOpen(false);
    setActiveLocationIndex(-1);
    form.setValue("city", suggestion.city, { shouldValidate: true });
    form.setValue("country", suggestion.country, { shouldValidate: true });
    form.setValue("latitude", suggestion.latitude, { shouldValidate: true });
    form.setValue("longitude", suggestion.longitude, { shouldValidate: true });
  }

  function handleThemeSelect(theme: Theme) {
    form.setValue("theme", theme.id, { shouldValidate: true });
    setThemeDialogOpen(false);
  }

  function prepareThemeExplorerDialog() {
    setThemeDialogMounted(true);
  }

  function openThemeExplorerDialog() {
    setThemeDialogMounted(true);
    setThemeDialogOpen(true);
  }

  function handleFontSelect(family: string) {
    form.setValue("fontFamily", family, { shouldValidate: true });
    setFontSearchQuery(family);
    setFontComboboxOpen(false);
  }

  function clearFontSelection() {
    form.setValue("fontFamily", undefined, { shouldValidate: true });
    setFontSearchQuery("");
    setFontComboboxOpen(false);
  }

  function handleLocaleChange(nextLocale: string): void {
    if (!locales.includes(nextLocale as Locale) || nextLocale === locale) {
      return;
    }

    const pathSegments = pathname.split("/").filter(Boolean);
    const nextPathSegments = [...pathSegments];
    if (nextPathSegments.length === 0) {
      nextPathSegments.push(nextLocale);
    } else if (locales.includes(nextPathSegments[0] as Locale)) {
      nextPathSegments[0] = nextLocale;
    } else {
      nextPathSegments.unshift(nextLocale);
    }

    const maxAge = 60 * 60 * 24 * 365;
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not consistently available across all target browsers.
    document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(nextLocale)}; path=/; max-age=${maxAge}; samesite=lax`;
    router.push(`/${nextPathSegments.join("/")}`);
  }

  function getHintTriggerHandlers(field: AdvancedHelpFieldKey): {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  } {
    return {
      onMouseEnter: () => setActivePreviewHint(field),
      onMouseLeave: () => setActivePreviewHint(null),
      onFocus: () => setActivePreviewHint(field),
      onBlur: () => setActivePreviewHint(null),
    };
  }

  function renderFieldHelp(
    field: AdvancedHelpFieldKey,
    ariaLabel: string,
    helpText: string,
  ) {
    return (
      <Popover open={activePreviewHint === field}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-amber-700 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...getHintTriggerHandlers(field)}
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72" side="top">
          <p className="text-xs text-muted-foreground">{helpText}</p>
        </PopoverContent>
      </Popover>
    );
  }

  function toInchesFromDisplayValue(displayValue: number): number {
    return sizeUnit === "cm" ? centimetersToInches(displayValue) : displayValue;
  }

  function getDimensionFormValue(field: DimensionField): number {
    return form.getValues(field);
  }

  function setDimensionInputText(field: DimensionField, value: string): void {
    if (field === "width") {
      setWidthInputValue(value);
      return;
    }
    setHeightInputValue(value);
  }

  function syncDimensionInputWithFormValue(field: DimensionField): void {
    const fallback =
      field === "width" ? defaultValues.width : defaultValues.height;
    const current = getDimensionFormValue(field);
    const minInches = minDimensionInInchesForUnit(sizeUnit);
    const maxInches = maxDimensionInInchesForUnit(sizeUnit);
    const clamped = Number.isFinite(current)
      ? clamp(current, minInches, maxInches)
      : fallback;
    form.setValue(field, clamped, { shouldValidate: true, shouldDirty: true });
    setDimensionInputText(
      field,
      formatDimensionValue(clamped, sizeUnit, locale),
    );
  }

  function handleDimensionInputChange(
    field: DimensionField,
    rawValue: string,
  ): void {
    setDimensionInputText(field, rawValue);
    const parsedDisplay = parseDecimalInput(rawValue);
    if (parsedDisplay === null) {
      return;
    }
    const minInches = minDimensionInInchesForUnit(sizeUnit);
    const maxInches = maxDimensionInInchesForUnit(sizeUnit);
    form.setValue(
      field,
      clamp(toInchesFromDisplayValue(parsedDisplay), minInches, maxInches),
      {
        shouldValidate: true,
        shouldDirty: true,
      },
    );
  }

  function handleDimensionInputBlur(
    field: DimensionField,
    rawValue: string,
  ): void {
    setActiveDimensionField((currentField) =>
      currentField === field ? null : currentField,
    );
    const parsedDisplay = parseDecimalInput(rawValue);
    if (parsedDisplay === null) {
      syncDimensionInputWithFormValue(field);
      return;
    }
    const minInches = minDimensionInInchesForUnit(sizeUnit);
    const maxInches = maxDimensionInInchesForUnit(sizeUnit);
    const clampedInches = clamp(
      toInchesFromDisplayValue(parsedDisplay),
      minInches,
      maxInches,
    );
    form.setValue(field, clampedInches, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    setDimensionInputText(
      field,
      formatDimensionValue(clampedInches, sizeUnit, locale),
    );
  }

  function updatePreviewPointer(clientX: number, clientY: number): void {
    const frame = previewFrameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    setPreviewPointer({
      x: clamp((clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((clientY - bounds.top) / bounds.height, 0, 1),
    });
  }

  function handlePreviewFrameKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
  ): void {
    if (!previewZoomEnabled) {
      return;
    }

    const step = event.shiftKey ? 0.08 : 0.03;
    const current = previewPointer ?? { x: 0.5, y: 0.5 };

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPreviewPointer({ x: clamp(current.x - step, 0, 1), y: current.y });
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPreviewPointer({ x: clamp(current.x + step, 0, 1), y: current.y });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setPreviewPointer({ x: current.x, y: clamp(current.y - step, 0, 1) });
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setPreviewPointer({ x: current.x, y: clamp(current.y + step, 0, 1) });
      return;
    }

    if (event.key.toLowerCase() === "home") {
      event.preventDefault();
      setPreviewPointer({ x: 0.5, y: 0.5 });
    }
  }

  const activeTheme = themesQuery.data?.find(
    (theme) => theme.id === values.theme,
  );
  const themeTextColor = activeTheme?.colors.text ?? "#8C4A18";
  const localFontBundlePending =
    rendererMode === "local-wasm" &&
    selectedFontFamily.length > 0 &&
    fontBundleQuery.isFetching &&
    !fontBundleQuery.data;
  const requiresCaptchaToken =
    Boolean(turnstileSiteKey) && !disableCaptchaCheck;
  const isGenerateDisabled =
    !form.formState.isValid ||
    createJobMutation.isPending ||
    (requiresCaptchaToken && !captchaToken);
  const dimensionUnitLabel = sizeUnit === "cm" ? "cm" : "in";
  const dimensionMinInches = minDimensionInInchesForUnit(sizeUnit);
  const dimensionMaxInches = maxDimensionInInchesForUnit(sizeUnit);
  const dimensionDisplayMin = formatDimensionValue(
    dimensionMinInches,
    sizeUnit,
    locale,
  );
  const dimensionDisplayMax = formatDimensionValue(
    dimensionMaxInches,
    sizeUnit,
    locale,
  );
  const dimensionRangePlaceholder = `${dimensionDisplayMin} - ${dimensionDisplayMax}`;
  const dimensionHelpTemplate =
    sizeUnit === "cm"
      ? d.controls.dimensionHelpCentimeters
      : d.controls.dimensionHelpInches;
  const dimensionHelpText = dimensionHelpTemplate
    .replace("{min}", dimensionDisplayMin)
    .replace("{max}", dimensionDisplayMax);
  const autoCityFontSize = computeAutoCityFontSize(values.city);
  const autoCountryFontSize = DEFAULT_COUNTRY_FONT_SIZE;
  const cityFontSizeInputValue =
    typeof values.cityFontSize === "number"
      ? values.cityFontSize
      : autoCityFontSize;
  const countryFontSizeInputValue =
    typeof values.countryFontSize === "number"
      ? values.countryFontSize
      : autoCountryFontSize;
  const previewWidthInches =
    Number.isFinite(values.width) && values.width > 0
      ? values.width
      : defaultValues.width;
  const previewHeightInches =
    Number.isFinite(values.height) && values.height > 0
      ? values.height
      : defaultValues.height;
  const rawPreviewPixelWidth = Math.max(
    320,
    Math.round(previewWidthInches * PREVIEW_RENDER_DPI),
  );
  const rawPreviewPixelHeight = Math.max(
    320,
    Math.round(previewHeightInches * PREVIEW_RENDER_DPI),
  );
  const previewScale = Math.min(
    1,
    MAX_LOCAL_PREVIEW_LONG_EDGE_PX /
      Math.max(rawPreviewPixelWidth, rawPreviewPixelHeight),
  );
  const previewPixelWidth = Math.max(
    320,
    Math.round(rawPreviewPixelWidth * previewScale),
  );
  const previewPixelHeight = Math.max(
    320,
    Math.round(rawPreviewPixelHeight * previewScale),
  );
  const previewUrl =
    rendererMode === "local-wasm"
      ? previewEngine === "hybrid"
        ? (localPreviewUrl ?? latestPreviewUrl)
        : localPreviewUrl
      : latestPreviewUrl;
  const hasPreview = Boolean(previewUrl);
  const localLaneLoading =
    rendererMode === "local-wasm" &&
    (snapshotQuery.isFetching || localRenderPending || localFontBundlePending);
  const isPreviewLoading =
    rendererMode === "local-wasm"
      ? previewEngine === "hybrid"
        ? !hasPreview && (localLaneLoading || previewQuery.isFetching)
        : localLaneLoading || !hasPreview
      : previewQuery.isFetching || !hasPreview;
  const previewAspect = previewWidthInches / previewHeightInches;
  const previewFrameMaxWidth = Math.min(
    PREVIEW_FRAME_MAX_WIDTH_PX,
    PREVIEW_FRAME_MAX_HEIGHT_PX * previewAspect,
  );
  const previewViewboxWidth = previewWidthInches * 100;
  const previewViewboxHeight = previewHeightInches * 100;
  const previewZoomAnchor = previewPointer ?? { x: 0.5, y: 0.5 };
  const zoomViewWidth = previewViewboxWidth / previewZoomLevel;
  const zoomViewHeight = previewViewboxHeight / previewZoomLevel;
  const zoomCenterX = previewZoomAnchor.x * previewViewboxWidth;
  const zoomCenterY = previewZoomAnchor.y * previewViewboxHeight;
  const zoomViewX = clamp(
    zoomCenterX - zoomViewWidth / 2,
    0,
    previewViewboxWidth - zoomViewWidth,
  );
  const zoomViewY = clamp(
    zoomCenterY - zoomViewHeight / 2,
    0,
    previewViewboxHeight - zoomViewHeight,
  );
  const zoomLensLeft = (zoomViewX / previewViewboxWidth) * 100;
  const zoomLensTop = (zoomViewY / previewViewboxHeight) * 100;
  const zoomLensWidth = (zoomViewWidth / previewViewboxWidth) * 100;
  const zoomLensHeight = (zoomViewHeight / previewViewboxHeight) * 100;

  useEffect(() => {
    if (rendererMode !== "local-wasm") {
      return;
    }
    const worker = workerRef.current;
    if (
      !worker ||
      !snapshotQuery.data ||
      !activeTheme ||
      localFontBundlePending
    ) {
      return;
    }

    clearWorkerRenderSchedule();
    clearWorkerRenderTimeout();
    const renderId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    latestWorkerRenderIdRef.current = renderId;
    const message: WorkerRenderRequest = {
      type: "render",
      id: renderId,
      payload: previewPayload,
      snapshot: snapshotQuery.data,
      theme: activeTheme,
      pixelWidth: previewPixelWidth,
      pixelHeight: previewPixelHeight,
      fontBundle:
        selectedFontFamily.length > 0 && fontBundleQuery.data
          ? {
              family: fontBundleQuery.data.family,
              files: fontBundleQuery.data.files,
            }
          : null,
    };
    workerRenderScheduleRef.current = setTimeout(() => {
      if (latestWorkerRenderIdRef.current !== renderId) {
        return;
      }
      setLocalRenderPending(true);
      workerRenderTimeoutRef.current = setTimeout(() => {
        if (latestWorkerRenderIdRef.current === renderId) {
          fallbackToServer("worker-render-timeout");
        }
      }, WORKER_RENDER_TIMEOUT_MS);
      worker.postMessage(message);
    }, WORKER_RENDER_DEBOUNCE_MS);
  }, [
    rendererMode,
    snapshotQuery.data,
    activeTheme,
    localFontBundlePending,
    selectedFontFamily,
    fontBundleQuery.data,
    previewPayload,
    previewPixelWidth,
    previewPixelHeight,
    clearWorkerRenderSchedule,
    clearWorkerRenderTimeout,
    fallbackToServer,
  ]);

  const fallbackFontSuggestions = useMemo(() => {
    const query = fontSearchQuery.trim().toLowerCase();
    if (!query) {
      return fallbackFontFamilies.slice(0, 10);
    }
    return fallbackFontFamilies.filter((font) =>
      font.family.toLowerCase().includes(query),
    );
  }, [fontSearchQuery]);
  const fontCommandItemClassName =
    "data-[selected=true]:bg-muted data-[selected=true]:text-foreground";
  const locationSuggestions = locationSuggestionsQuery.data ?? [];
  const activeLocationSuggestion =
    activeLocationIndex >= 0 && activeLocationIndex < locationSuggestions.length
      ? locationSuggestions[activeLocationIndex]
      : null;
  const statusAnnouncement = createJobMutation.isPending
    ? d.controls.queueingButton
    : createJobMutation.error
      ? createJobMutation.error.message
      : jobQuery.data?.status === "failed"
        ? (jobQuery.data.error ?? d.status.generationFailed)
        : jobQuery.data?.status === "complete"
          ? d.status.generationComplete
          : "";

  function handleLocationInputKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ): void {
    if (!locationSuggestions.length) {
      if (event.key === "Escape") {
        setLocationAutocompleteOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setLocationAutocompleteOpen(true);
      setActiveLocationIndex((current) => {
        if (current < 0) return 0;
        return Math.min(current + 1, locationSuggestions.length - 1);
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setLocationAutocompleteOpen(true);
      setActiveLocationIndex((current) => {
        if (current < 0) return locationSuggestions.length - 1;
        return Math.max(current - 1, 0);
      });
      return;
    }

    if (event.key === "Enter" && activeLocationSuggestion) {
      event.preventDefault();
      handleLocationSelect(activeLocationSuggestion);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setLocationAutocompleteOpen(false);
      setActiveLocationIndex(-1);
    }
  }

  const locationStatusMessage = locationSuggestionsQuery.isLoading
    ? d.controls.searchingLocations
    : locationAutocompleteOpen && debouncedLocationQuery.length >= 3
      ? locationSuggestions.length
        ? d.controls.locationSuggestionsCountLabel.replace(
            "{count}",
            String(locationSuggestions.length),
          )
        : d.controls.noLocationResults
      : "";

  return (
    <main
      id="main-content"
      className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8"
      aria-describedby={pageDescriptionId}
    >
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Badge className="bg-amber-700/90 text-amber-50">
            {d.header.badge}
          </Badge>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex min-w-[180px] items-center gap-2">
              <Label
                htmlFor="language-select"
                className="text-xs text-muted-foreground"
              >
                {d.languageLabel}
              </Label>
              <Select value={locale} onValueChange={handleLocaleChange}>
                <SelectTrigger id="language-select" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {localeLabels[entry]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showDevRateLimitToggle ? (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={devSettingsToggleId}
                  className="text-xs text-muted-foreground"
                >
                  {d.preview.devSettingsToggleLabel}
                </Label>
                <Switch
                  id={devSettingsToggleId}
                  checked={showDevSettingsCard}
                  onCheckedChange={setShowDevSettingsCard}
                  aria-label={d.preview.devSettingsToggleLabel}
                />
              </div>
            ) : null}
          </div>
        </div>
        <h1 className="font-heading text-4xl tracking-tight text-foreground sm:text-5xl">
          {d.header.title}
        </h1>
        <p
          id={pageDescriptionId}
          className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base"
        >
          {d.header.subtitle}
        </p>
      </header>

      {showDevRateLimitToggle && showDevSettingsCard ? (
        <section aria-label={d.preview.devSettingsTitle} className="mb-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold tracking-tight text-sm uppercase text-muted-foreground">
                {d.preview.devSettingsTitle}
              </h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-dashed px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label
                      htmlFor={rateLimitToggleId}
                      className="text-sm font-medium text-foreground"
                    >
                      {d.preview.disableRateLimitTitle}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {d.preview.disableRateLimitDescription}
                    </p>
                  </div>
                  <Switch
                    id={rateLimitToggleId}
                    checked={disableRateLimit}
                    onCheckedChange={setDisableRateLimit}
                    aria-label={d.preview.disableRateLimitTitle}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-dashed px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label
                      htmlFor={captchaToggleId}
                      className="text-sm font-medium text-foreground"
                    >
                      {d.preview.disableCaptchaTitle}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {d.preview.disableCaptchaDescription}
                    </p>
                  </div>
                  <Switch
                    id={captchaToggleId}
                    checked={disableCaptchaCheck}
                    onCheckedChange={setDisableCaptchaCheck}
                    aria-label={d.preview.disableCaptchaTitle}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <section aria-labelledby="map-controls-title">
            <Card>
              <CardHeader>
                <h2
                  id="map-controls-title"
                  className="font-semibold tracking-tight flex items-center gap-2 text-xl"
                >
                  <MapIcon className="h-5 w-5 text-amber-700" />
                  {d.controls.title}
                </h2>
                <CardDescription>{d.controls.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-6"
                  onSubmit={form.handleSubmit(handleGenerate)}
                  aria-busy={createJobMutation.isPending}
                  noValidate
                >
                  <LocationSearchField
                    inputId={locationInputId}
                    hintId={locationHintId}
                    statusId={locationStatusId}
                    listboxId={locationListboxId}
                    label={d.controls.location}
                    placeholder={d.controls.locationPlaceholder}
                    helpText={d.controls.locationHelp}
                    searchingText={d.controls.searchingLocations}
                    noResultsText={d.controls.noLocationResults}
                    locationQuery={locationQuery}
                    setLocationQuery={setLocationQuery}
                    locationAutocompleteOpen={locationAutocompleteOpen}
                    setLocationAutocompleteOpen={setLocationAutocompleteOpen}
                    debouncedLocationQuery={debouncedLocationQuery}
                    locationSuggestions={locationSuggestions}
                    activeLocationIndex={activeLocationIndex}
                    setActiveLocationIndex={setActiveLocationIndex}
                    activeLocationSuggestion={activeLocationSuggestion ?? null}
                    onLocationSelect={handleLocationSelect}
                    onLocationInputKeyDown={handleLocationInputKeyDown}
                    isLoading={locationSuggestionsQuery.isLoading}
                    locationStatusMessage={locationStatusMessage}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="city">{d.controls.city}</Label>
                      <Input
                        id="city"
                        placeholder={d.controls.cityPlaceholder}
                        aria-invalid={Boolean(form.formState.errors.city)}
                        aria-describedby={
                          form.formState.errors.city ? "city-error" : undefined
                        }
                        {...form.register("city", {
                          required: d.controls.cityRequired,
                        })}
                      />
                      {form.formState.errors.city ? (
                        <p id="city-error" className="text-xs text-destructive">
                          {d.controls.cityRequired}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">{d.controls.country}</Label>
                      <Input
                        id="country"
                        placeholder={d.controls.countryPlaceholder}
                        aria-invalid={Boolean(form.formState.errors.country)}
                        aria-describedby={
                          form.formState.errors.country
                            ? "country-error"
                            : undefined
                        }
                        {...form.register("country", {
                          required: d.controls.countryRequired,
                        })}
                      />
                      {form.formState.errors.country ? (
                        <p
                          id="country-error"
                          className="text-xs text-destructive"
                        >
                          {d.controls.countryRequired}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <fieldset className="flex flex-wrap gap-2">
                      <legend className="sr-only">{d.controls.distance}</legend>
                      {distancePresets.map((preset) => (
                        <Button
                          key={preset.value}
                          type="button"
                          aria-pressed={values.distance === preset.value}
                          variant={
                            values.distance === preset.value
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() =>
                            form.setValue("distance", preset.value, {
                              shouldValidate: true,
                            })
                          }
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </fieldset>
                    <div className="space-y-2">
                      <Label htmlFor={distanceSliderId}>
                        {d.controls.distance}:{" "}
                        {distanceSliderValue.toLocaleString()}m
                      </Label>
                      <Slider
                        id={distanceSliderId}
                        aria-label={d.controls.distance}
                        min={MIN_DISTANCE_METERS}
                        max={MAX_DISTANCE_METERS}
                        step={500}
                        value={[distanceSliderValue]}
                        onValueChange={(next) =>
                          setDistanceSliderValue(next[0] ?? distanceSliderValue)
                        }
                        onValueCommit={(next) =>
                          form.setValue(
                            "distance",
                            next[0] ?? distanceSliderValue,
                            {
                              shouldValidate: true,
                            },
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex min-h-8 items-center justify-between gap-3">
                        <Label htmlFor={themeSelectId}>
                          {d.controls.theme}
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onMouseEnter={prepareThemeExplorerDialog}
                          onFocus={prepareThemeExplorerDialog}
                          onClick={openThemeExplorerDialog}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {d.controls.browseThemes}
                        </Button>
                        {themeDialogMounted ? (
                          <ThemeExplorerDialog
                            open={themeDialogOpen}
                            onOpenChange={setThemeDialogOpen}
                            closeLabel={d.accessibility.closeDialog}
                            browseThemesLabel={d.controls.browseThemes}
                            title={d.themeExplorer.title}
                            description={d.themeExplorer.description}
                            loadingPreviewLabel={d.themeExplorer.loadingPreview}
                            previewUnavailableLabel={
                              d.themeExplorer.previewUnavailable
                            }
                            selectedLabel={d.themeExplorer.selected}
                            themes={themesQuery.data}
                            selectedThemeId={values.theme}
                            onThemeSelect={handleThemeSelect}
                            showTrigger={false}
                          />
                        ) : null}
                      </div>
                      <Select
                        value={values.theme}
                        onValueChange={(value) =>
                          form.setValue("theme", value, {
                            shouldValidate: true,
                          })
                        }
                      >
                        <SelectTrigger
                          id={themeSelectId}
                          aria-label={d.controls.theme}
                        >
                          <SelectValue placeholder={d.controls.theme} />
                        </SelectTrigger>
                        <SelectContent>
                          {themesQuery.data?.map((theme) => (
                            <SelectItem key={theme.id} value={theme.id}>
                              {theme.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex min-h-8 items-center">
                        <Label htmlFor={formatSelectId}>
                          {d.controls.format}
                        </Label>
                      </div>
                      <Select
                        value={values.format}
                        onValueChange={(value) =>
                          form.setValue(
                            "format",
                            value as FormValues["format"],
                            {
                              shouldValidate: true,
                            },
                          )
                        }
                      >
                        <SelectTrigger
                          id={formatSelectId}
                          aria-label={d.controls.format}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="png">PNG</SelectItem>
                          <SelectItem value="svg">SVG</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-3">
                    <div>
                      <Label htmlFor="allThemes" className="block">
                        {d.controls.generateAllThemesTitle}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {d.controls.generateAllThemesDescription}
                      </p>
                    </div>
                    <Switch
                      id="allThemes"
                      checked={values.allThemes}
                      onCheckedChange={(checked) =>
                        form.setValue("allThemes", checked, {
                          shouldValidate: true,
                        })
                      }
                    />
                  </div>

                  <Accordion
                    type="single"
                    collapsible
                    value={advancedAccordionValue}
                    onValueChange={setAdvancedAccordionValue}
                    className="w-full"
                  >
                    <AccordionItem value="advanced">
                      <AccordionTrigger>
                        {d.controls.advancedOptions}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="latitude">
                                {d.controls.latitude}
                              </Label>
                              <Input
                                id="latitude"
                                placeholder="48.8566"
                                {...form.register("latitude")}
                              />
                              <p className="text-xs text-muted-foreground">
                                {d.controls.latitudeHelp}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="longitude">
                                {d.controls.longitude}
                              </Label>
                              <Input
                                id="longitude"
                                placeholder="2.3522"
                                {...form.register("longitude")}
                              />
                              <p className="text-xs text-muted-foreground">
                                {d.controls.longitudeHelp}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={sizeUnitSelectId}>
                                {d.controls.sizeUnit}
                              </Label>
                              {renderFieldHelp(
                                "sizeUnit",
                                d.controls.explainSizeUnit,
                                d.controls.sizeUnitHelp,
                              )}
                            </div>
                            <Select
                              value={sizeUnit}
                              onValueChange={(value) =>
                                setSizeUnit(value as SizeUnit)
                              }
                            >
                              <SelectTrigger
                                id={sizeUnitSelectId}
                                aria-label={d.controls.sizeUnit}
                                className="w-full sm:w-56"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cm">
                                  {d.controls.centimeters}
                                </SelectItem>
                                <SelectItem value="in">
                                  {d.controls.inches}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {d.controls.sizeUnitHelp}
                            </p>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor="width">
                                  {d.controls.width} ({dimensionUnitLabel})
                                </Label>
                                {renderFieldHelp(
                                  "width",
                                  d.controls.explainDimensions,
                                  dimensionHelpText,
                                )}
                              </div>
                              <Input
                                id="width"
                                type="text"
                                inputMode="decimal"
                                placeholder={dimensionRangePlaceholder}
                                value={widthInputValue}
                                onFocus={() => setActiveDimensionField("width")}
                                onChange={(event) =>
                                  handleDimensionInputChange(
                                    "width",
                                    event.currentTarget.value,
                                  )
                                }
                                onBlur={(event) =>
                                  handleDimensionInputBlur(
                                    "width",
                                    event.currentTarget.value,
                                  )
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                {dimensionHelpText}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor="height">
                                  {d.controls.height} ({dimensionUnitLabel})
                                </Label>
                                {renderFieldHelp(
                                  "height",
                                  d.controls.explainDimensions,
                                  dimensionHelpText,
                                )}
                              </div>
                              <Input
                                id="height"
                                type="text"
                                inputMode="decimal"
                                placeholder={dimensionRangePlaceholder}
                                value={heightInputValue}
                                onFocus={() =>
                                  setActiveDimensionField("height")
                                }
                                onChange={(event) =>
                                  handleDimensionInputChange(
                                    "height",
                                    event.currentTarget.value,
                                  )
                                }
                                onBlur={(event) =>
                                  handleDimensionInputBlur(
                                    "height",
                                    event.currentTarget.value,
                                  )
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                {dimensionHelpText}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-dashed px-3 py-3">
                            <p className="text-sm font-medium text-foreground">
                              {d.controls.mapLayersTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {d.controls.mapLayersDescription}
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                                <div>
                                  <Label
                                    htmlFor={includeWaterId}
                                    className="text-sm font-medium text-foreground"
                                  >
                                    {d.controls.includeWater}
                                  </Label>
                                  <p
                                    id={`${includeWaterId}-description`}
                                    className="text-xs text-muted-foreground"
                                  >
                                    {d.controls.includeWaterDescription}
                                  </p>
                                </div>
                                <Switch
                                  id={includeWaterId}
                                  aria-describedby={`${includeWaterId}-description`}
                                  checked={values.includeWater}
                                  onCheckedChange={(checked) =>
                                    form.setValue("includeWater", checked, {
                                      shouldValidate: true,
                                    })
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                                <div>
                                  <Label
                                    htmlFor={includeParksId}
                                    className="text-sm font-medium text-foreground"
                                  >
                                    {d.controls.includeParks}
                                  </Label>
                                  <p
                                    id={`${includeParksId}-description`}
                                    className="text-xs text-muted-foreground"
                                  >
                                    {d.controls.includeParksDescription}
                                  </p>
                                </div>
                                <Switch
                                  id={includeParksId}
                                  aria-describedby={`${includeParksId}-description`}
                                  checked={values.includeParks}
                                  onCheckedChange={(checked) =>
                                    form.setValue("includeParks", checked, {
                                      shouldValidate: true,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-dashed px-3 py-3">
                            <p className="text-sm font-medium text-foreground">
                              {d.controls.typographyTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {d.controls.typographyDescription}
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="cityFontSize">
                                    {d.controls.cityFontSize}
                                  </Label>
                                  {renderFieldHelp(
                                    "cityFontSize",
                                    d.controls.explainCityFontSize,
                                    d.controls.cityFontSizeHelp,
                                  )}
                                </div>
                                <Input
                                  id="cityFontSize"
                                  type="number"
                                  min={8}
                                  max={120}
                                  step={1}
                                  placeholder={d.controls.autoThemeDefault}
                                  value={cityFontSizeInputValue}
                                  onChange={(event) => {
                                    const nextRaw = event.currentTarget.value;
                                    form.setValue(
                                      "cityFontSize",
                                      nextRaw ? Number(nextRaw) : undefined,
                                      { shouldValidate: true },
                                    );
                                  }}
                                />
                                <p className="text-xs text-muted-foreground">
                                  {d.controls.cityFontSizeHelp}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="countryFontSize">
                                    {d.controls.countryFontSize}
                                  </Label>
                                  {renderFieldHelp(
                                    "countryFontSize",
                                    d.controls.explainCountryFontSize,
                                    d.controls.countryFontSizeHelp,
                                  )}
                                </div>
                                <Input
                                  id="countryFontSize"
                                  type="number"
                                  min={6}
                                  max={80}
                                  step={1}
                                  placeholder={d.controls.autoThemeDefault}
                                  value={countryFontSizeInputValue}
                                  onChange={(event) => {
                                    const nextRaw = event.currentTarget.value;
                                    form.setValue(
                                      "countryFontSize",
                                      nextRaw ? Number(nextRaw) : undefined,
                                      { shouldValidate: true },
                                    );
                                  }}
                                />
                                <p className="text-xs text-muted-foreground">
                                  {d.controls.countryFontSizeHelp}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <Label htmlFor="labelPaddingScale">
                                  {d.controls.labelPaddingScale}
                                </Label>
                                <span className="text-xs text-muted-foreground">
                                  {labelPaddingSliderValue.toFixed(2)}x
                                </span>
                              </div>
                              <Slider
                                id="labelPaddingScale"
                                aria-label={d.controls.labelPaddingScale}
                                min={0.5}
                                max={3}
                                step={0.05}
                                value={[labelPaddingSliderValue]}
                                onValueChange={(nextValue) =>
                                  setLabelPaddingSliderValue(
                                    nextValue[0] ?? labelPaddingSliderValue,
                                  )
                                }
                                onValueCommit={(nextValue) =>
                                  form.setValue(
                                    "labelPaddingScale",
                                    nextValue[0] ?? labelPaddingSliderValue,
                                    { shouldValidate: true },
                                  )
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                {d.controls.labelPaddingHelp}
                              </p>
                            </div>
                            <div className="mt-3 rounded-md border border-border bg-card px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <Label
                                    htmlFor={blurEnabledId}
                                    className="text-sm font-medium text-foreground"
                                  >
                                    {d.controls.blurTitle}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {d.controls.blurDescription}
                                  </p>
                                </div>
                                <Switch
                                  id={blurEnabledId}
                                  checked={values.textBlurEnabled}
                                  onCheckedChange={(checked) => {
                                    form.setValue("textBlurEnabled", checked, {
                                      shouldValidate: true,
                                    });
                                    if (checked) {
                                      form.setValue(
                                        "textBlurSizeX",
                                        blurSizeXFromPercent(
                                          DEFAULT_TEXT_BLUR_SIZE_X_PERCENT,
                                        ),
                                        { shouldValidate: true },
                                      );
                                      form.setValue(
                                        "textBlurSizeY",
                                        blurSizeYFromPercent(
                                          DEFAULT_TEXT_BLUR_SIZE_Y_PERCENT,
                                        ),
                                        { shouldValidate: true },
                                      );
                                      form.setValue(
                                        "textBlurStrength",
                                        blurStrengthFromPercent(
                                          DEFAULT_TEXT_BLUR_STRENGTH_PERCENT,
                                        ),
                                        { shouldValidate: true },
                                      );
                                      setBlurSizeXSliderValue(
                                        DEFAULT_TEXT_BLUR_SIZE_X_PERCENT,
                                      );
                                      setBlurSizeYSliderValue(
                                        DEFAULT_TEXT_BLUR_SIZE_Y_PERCENT,
                                      );
                                      setBlurStrengthSliderValue(
                                        DEFAULT_TEXT_BLUR_STRENGTH_PERCENT,
                                      );
                                    }
                                  }}
                                />
                              </div>
                              {values.textBlurEnabled ? (
                                <div className="mt-3 space-y-3">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{d.controls.blurSizeX}</span>
                                      <span>
                                        {Math.round(blurSizeXSliderValue)}%
                                      </span>
                                    </div>
                                    <Slider
                                      aria-label={d.controls.blurSizeX}
                                      min={MIN_PERCENT}
                                      max={MAX_PERCENT}
                                      step={1}
                                      value={[blurSizeXSliderValue]}
                                      onValueChange={(nextValue) =>
                                        setBlurSizeXSliderValue(
                                          nextValue[0] ?? blurSizeXSliderValue,
                                        )
                                      }
                                      onValueCommit={(nextValue) => {
                                        const committedPercent =
                                          nextValue[0] ?? blurSizeXSliderValue;
                                        form.setValue(
                                          "textBlurSizeX",
                                          blurSizeXFromPercent(
                                            committedPercent,
                                          ),
                                          { shouldValidate: true },
                                        );
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{d.controls.blurSizeY}</span>
                                      <span>
                                        {Math.round(blurSizeYSliderValue)}%
                                      </span>
                                    </div>
                                    <Slider
                                      aria-label={d.controls.blurSizeY}
                                      min={MIN_PERCENT}
                                      max={MAX_PERCENT}
                                      step={1}
                                      value={[blurSizeYSliderValue]}
                                      onValueChange={(nextValue) =>
                                        setBlurSizeYSliderValue(
                                          nextValue[0] ?? blurSizeYSliderValue,
                                        )
                                      }
                                      onValueCommit={(nextValue) => {
                                        const committedPercent =
                                          nextValue[0] ?? blurSizeYSliderValue;
                                        form.setValue(
                                          "textBlurSizeY",
                                          blurSizeYFromPercent(
                                            committedPercent,
                                          ),
                                          { shouldValidate: true },
                                        );
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{d.controls.blurStrength}</span>
                                      <span>
                                        {Math.round(blurStrengthSliderValue)}%
                                      </span>
                                    </div>
                                    <Slider
                                      aria-label={d.controls.blurStrength}
                                      min={MIN_PERCENT}
                                      max={MAX_PERCENT}
                                      step={1}
                                      value={[blurStrengthSliderValue]}
                                      onValueChange={(nextValue) =>
                                        setBlurStrengthSliderValue(
                                          nextValue[0] ??
                                            blurStrengthSliderValue,
                                        )
                                      }
                                      onValueCommit={(nextValue) => {
                                        const committedPercent =
                                          nextValue[0] ??
                                          blurStrengthSliderValue;
                                        form.setValue(
                                          "textBlurStrength",
                                          blurStrengthFromPercent(
                                            committedPercent,
                                          ),
                                          { shouldValidate: true },
                                        );
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-3 space-y-2">
                              <Label htmlFor="textColor">
                                {d.controls.textColor}
                              </Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  id="textColor"
                                  className="flex-1"
                                  placeholder={d.controls.autoThemeTextColor}
                                  value={values.textColor ?? ""}
                                  onChange={(event) => {
                                    const nextRaw =
                                      event.currentTarget.value.trim();
                                    form.setValue(
                                      "textColor",
                                      nextRaw || undefined,
                                      { shouldValidate: true },
                                    );
                                  }}
                                />
                                <Input
                                  type="color"
                                  className="h-11 w-14 p-1"
                                  aria-label={d.controls.pickCustomTextColor}
                                  value={
                                    normalizeHexColor(values.textColor) ??
                                    normalizeHexColor(themeTextColor) ??
                                    "#8c4a18"
                                  }
                                  onChange={(event) =>
                                    form.setValue(
                                      "textColor",
                                      event.currentTarget.value,
                                      { shouldValidate: true },
                                    )
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    form.setValue("textColor", undefined, {
                                      shouldValidate: true,
                                    })
                                  }
                                >
                                  {d.controls.reset}
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {d.controls.textColorHelp}
                              </p>
                            </div>
                          </div>

                          {advancedOptionsOpen ? (
                            <FontFamilyPicker
                              controls={d.controls}
                              activePreviewHintField={activePreviewHint}
                              getHintTriggerHandlers={getHintTriggerHandlers}
                              fontComboboxOpen={fontComboboxOpen}
                              setFontComboboxOpen={setFontComboboxOpen}
                              selectedFontFamily={selectedFontFamily}
                              fontDescriptionId={fontDescriptionId}
                              fontSearchQuery={fontSearchQuery}
                              setFontSearchQuery={setFontSearchQuery}
                              fontSuggestionsLoading={
                                fontSuggestionsQuery.isLoading
                              }
                              fontSuggestionsError={
                                fontSuggestionsQuery.isError
                              }
                              fontSuggestions={fontSuggestionsQuery.data}
                              fallbackFontSuggestions={fallbackFontSuggestions}
                              clearFontSelection={clearFontSelection}
                              handleFontSelect={handleFontSelect}
                              fontCommandItemClassName={
                                fontCommandItemClassName
                              }
                            />
                          ) : null}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {turnstileSiteKey && !disableCaptchaCheck ? (
                    <TurnstileWidget
                      key={turnstileRenderKey}
                      siteKey={turnstileSiteKey}
                      options={{ theme: "light" }}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(undefined)}
                    />
                  ) : showDevRateLimitToggle && disableCaptchaCheck ? (
                    <p className="text-xs text-muted-foreground">
                      {d.preview.disableCaptchaDescription}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {d.controls.captchaMissing}
                    </p>
                  )}

                  <div className="hidden lg:block">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isGenerateDisabled}
                    >
                      {createJobMutation.isPending ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          {d.controls.queueingButton}
                        </>
                      ) : (
                        <>
                          <WandSparkles className="h-4 w-4" />
                          {d.controls.generatedButton}
                        </>
                      )}
                    </Button>
                  </div>
                  {createJobMutation.error ? (
                    <p
                      role="alert"
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                    >
                      {createJobMutation.error.message}
                    </p>
                  ) : null}
                </form>
              </CardContent>
            </Card>
          </section>
        </div>

        <PreviewPanel
          dictionary={d}
          showDevRateLimitToggle={showDevRateLimitToggle}
          rendererMode={rendererMode}
          rendererReason={rendererReason}
          zoomToggleId={zoomToggleId}
          previewZoomEnabled={previewZoomEnabled}
          setPreviewZoomEnabled={setPreviewZoomEnabled}
          previewFrameId={previewFrameId}
          zoomSliderId={zoomSliderId}
          previewZoomSliderValue={previewZoomSliderValue}
          setPreviewZoomSliderValue={setPreviewZoomSliderValue}
          setPreviewZoomLevel={setPreviewZoomLevel}
          previewWidthInches={previewWidthInches}
          previewHeightInches={previewHeightInches}
          previewFrameMaxWidth={previewFrameMaxWidth}
          city={values.city}
          country={values.country}
          previewKeyboardHintId={previewKeyboardHintId}
          previewFrameRef={previewFrameRef}
          updatePreviewPointer={updatePreviewPointer}
          setPreviewPointer={setPreviewPointer}
          handlePreviewFrameKeyDown={handlePreviewFrameKeyDown}
          previewUrl={previewUrl}
          isPreviewLoading={isPreviewLoading}
          previewQueryIsError={previewQuery.isError}
          localPreviewUrl={localPreviewUrl}
          hasPreview={hasPreview}
          zoomLensLeft={zoomLensLeft}
          zoomLensTop={zoomLensTop}
          zoomLensWidth={zoomLensWidth}
          zoomLensHeight={zoomLensHeight}
          previewZoomLevel={previewZoomLevel}
          zoomViewX={zoomViewX}
          zoomViewY={zoomViewY}
          zoomViewWidth={zoomViewWidth}
          zoomViewHeight={zoomViewHeight}
          previewViewboxWidth={previewViewboxWidth}
          previewViewboxHeight={previewViewboxHeight}
          generationStatusTitleId={generationStatusTitleId}
          generationStatusLiveId={generationStatusLiveId}
          jobId={jobId}
          jobData={jobQuery.data}
          jobIsFetching={jobQuery.isFetching}
          statusTone={statusTone}
          onDownload={() => {
            if (!jobId) return;
            downloadMutation.mutate(jobId);
          }}
          downloadPending={downloadMutation.isPending}
          downloadUrl={downloadUrl}
          statusAnnouncement={statusAnnouncement}
        />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-4 backdrop-blur lg:hidden">
        <Button
          className="mx-auto flex w-full max-w-7xl"
          onClick={form.handleSubmit(handleGenerate)}
          disabled={isGenerateDisabled}
        >
          {createJobMutation.isPending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {d.controls.queueingButton}
            </>
          ) : (
            <>
              <WandSparkles className="h-4 w-4" />
              {d.controls.generatedButton}
            </>
          )}
        </Button>
      </div>
    </main>
  );
}
