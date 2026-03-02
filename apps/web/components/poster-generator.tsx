"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Download,
  Eye,
  LoaderCircle,
  MapIcon,
  Palette,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  createJob,
  fetchDownload,
  fetchFonts,
  fetchJob,
  fetchLocations,
  fetchThemes,
} from "@/lib/api";
import type { LocationSuggestion, PosterRequest, Theme } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Progress } from "./ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";

type AdvancedHelpFieldKey = "fontFamily";

const advancedFieldHelp: Record<
  AdvancedHelpFieldKey,
  {
    title: string;
    description: string;
  }
> = {
  fontFamily: {
    title: "Typography family",
    description:
      "Downloads and applies a Google Font family to city, country, and coordinate labels in the final render.",
  },
};

const schema = z
  .object({
    city: z.string().trim().min(1, "City is required"),
    country: z.string().trim().min(1, "Country is required"),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    fontFamily: z.string().optional(),
    theme: z.string().min(1),
    allThemes: z.boolean(),
    includeWater: z.boolean(),
    includeParks: z.boolean(),
    cityFontSize: z.number().min(8).max(120).optional(),
    countryFontSize: z.number().min(6).max(80).optional(),
    textColor: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      .optional(),
    labelPaddingScale: z.number().min(0.5).max(3),
    distance: z.number().min(1000).max(50000),
    width: z.number().min(1).max(20),
    height: z.number().min(1).max(20),
    format: z.enum(["png", "svg", "pdf"]),
  })
  .superRefine((data, ctx) => {
    const hasLat = Boolean(data.latitude?.trim());
    const hasLon = Boolean(data.longitude?.trim());
    if (hasLat !== hasLon) {
      ctx.addIssue({
        code: "custom",
        message: "Latitude and longitude must be set together",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const PREVIEW_VIEWBOX_WIDTH = 439.2;
const PREVIEW_VIEWBOX_HEIGHT = 583.2;
const DEFAULT_PREVIEW_ZOOM = 2.5;

type PreviewPointer = {
  x: number;
  y: number;
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

function isLikelyLatin(text: string): boolean {
  return /^[A-Za-z0-9\s'".,\-()]+$/.test(text);
}

function formatPreviewCity(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isLikelyLatin(trimmed)) {
    return trimmed.toUpperCase().split("").join("  ");
  }
  return trimmed;
}

function getPreviewTextMetrics(
  displayCity: string,
  widthInches: number,
  heightInches: number,
  cityFontSizeOverride: number | undefined,
  countryFontSizeOverride: number | undefined,
): {
  cityFontSize: number;
  countryFontSize: number;
  coordsFontSize: number;
  attributionFontSize: number;
  dividerWidth: number;
} {
  const width = Math.max(widthInches, 1);
  const height = Math.max(heightInches, 1);
  const scaleFactor = Math.min(height, width) / 12.0;
  const pointsToPreviewUnits = PREVIEW_VIEWBOX_HEIGHT / (height * 72);

  const baseMain = 60;
  const baseSub = 22;
  const baseCoords = 14;
  const cityCharCount = displayCity.trim().length;

  const adjustedMainFontSize =
    typeof cityFontSizeOverride === "number"
      ? cityFontSizeOverride * scaleFactor
      : cityCharCount > 10
        ? Math.max(
            baseMain * scaleFactor * (10 / cityCharCount),
            10 * scaleFactor,
          )
        : baseMain * scaleFactor;
  const adjustedCountryFontSize =
    typeof countryFontSizeOverride === "number"
      ? countryFontSizeOverride * scaleFactor
      : baseSub * scaleFactor;

  return {
    cityFontSize: adjustedMainFontSize * pointsToPreviewUnits,
    countryFontSize: adjustedCountryFontSize * pointsToPreviewUnits,
    coordsFontSize: baseCoords * scaleFactor * pointsToPreviewUnits,
    attributionFontSize: Math.max(4, 5 * scaleFactor) * pointsToPreviewUnits,
    dividerWidth: Math.max(0.4, scaleFactor * pointsToPreviewUnits),
  };
}

function getPreviewLabelLayout(
  metrics: ReturnType<typeof getPreviewTextMetrics>,
  labelPaddingScale: number,
): {
  cityY: number;
  dividerY: number;
  countryY: number;
  coordsY: number;
  attributionY: number;
} {
  const dynamicGapScale = Math.max(
    metrics.cityFontSize / 30,
    metrics.countryFontSize / 11,
    1,
  );
  const minGap = Math.min(
    0.02,
    0.004 * Math.max(labelPaddingScale, 0.5) * dynamicGapScale,
  );
  const cityDesc = (metrics.cityFontSize / PREVIEW_VIEWBOX_HEIGHT) * 0.22;
  const countryAscent =
    (metrics.countryFontSize / PREVIEW_VIEWBOX_HEIGHT) * 0.72;
  const countryDesc = (metrics.countryFontSize / PREVIEW_VIEWBOX_HEIGHT) * 0.22;
  const coordsAscent = (metrics.coordsFontSize / PREVIEW_VIEWBOX_HEIGHT) * 0.72;

  const coordsAxisY = 0.07;
  let countryAxisY = 0.1;
  const coordsTop = coordsAxisY + coordsAscent;
  if (countryAxisY - countryDesc < coordsTop + minGap) {
    countryAxisY = coordsTop + minGap + countryDesc;
  }

  const dividerAxisY = Math.max(0.125, countryAxisY + countryAscent + minGap);
  const cityAxisY = Math.min(
    Math.max(0.14, dividerAxisY + cityDesc + minGap),
    0.32,
  );

  return {
    cityY: PREVIEW_VIEWBOX_HEIGHT * (1 - cityAxisY),
    dividerY: PREVIEW_VIEWBOX_HEIGHT * (1 - dividerAxisY),
    countryY: PREVIEW_VIEWBOX_HEIGHT * (1 - countryAxisY),
    coordsY: PREVIEW_VIEWBOX_HEIGHT * (1 - coordsAxisY),
    attributionY: PREVIEW_VIEWBOX_HEIGHT * (1 - 0.006),
  };
}

function formatPreviewCoords(
  latitude: string | undefined,
  longitude: string | undefined,
): string {
  const lat = Number.parseFloat(latitude?.trim() ?? "");
  const lon = Number.parseFloat(longitude?.trim() ?? "");

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lon) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return "Select a location to show coordinates";
  }

  const latHemisphere = lat >= 0 ? "N" : "S";
  const lonHemisphere = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latHemisphere} / ${Math.abs(lon).toFixed(4)}° ${lonHemisphere}`;
}

function ThemePreviewImage({
  themeId,
  themeName,
  priority = false,
}: {
  themeId: string;
  themeName: string;
  priority?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
      {status !== "loaded" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/80">
          <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">Loading preview</p>
        </div>
      ) : null}
      <Image
        src={`/theme-previews/${themeId}.svg`}
        alt={`${themeName} preview`}
        fill
        priority={priority}
        sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 28vw"
        className={
          status === "loaded"
            ? "object-cover opacity-100 transition-opacity duration-200"
            : "object-cover opacity-0 transition-opacity duration-200"
        }
        unoptimized
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
      {status === "error" ? (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-sm bg-background/85 px-2 py-1 text-center text-[11px] text-muted-foreground">
          Preview unavailable
        </div>
      ) : null}
    </div>
  );
}

type PreviewTextMetrics = ReturnType<typeof getPreviewTextMetrics>;

function PreviewTypographyOverlay({
  className,
  viewBox = `0 0 ${PREVIEW_VIEWBOX_WIDTH} ${PREVIEW_VIEWBOX_HEIGHT}`,
  title,
  previewTextColor,
  previewDisplayCity,
  previewDisplayCountry,
  previewCoords,
  previewTextMetrics,
  previewTypographyFontFamily,
  labelPaddingScale,
}: {
  className: string;
  viewBox?: string;
  title: string;
  previewTextColor: string;
  previewDisplayCity: string;
  previewDisplayCountry: string;
  previewCoords: string;
  previewTextMetrics: PreviewTextMetrics;
  previewTypographyFontFamily: string;
  labelPaddingScale: number;
}) {
  const labelLayout = getPreviewLabelLayout(
    previewTextMetrics,
    labelPaddingScale,
  );

  return (
    <svg
      className={className}
      viewBox={viewBox}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <title>{title}</title>
      <text
        x={PREVIEW_VIEWBOX_WIDTH * 0.5}
        y={labelLayout.cityY}
        textAnchor="middle"
        xmlSpace="preserve"
        fontWeight={700}
        fontSize={previewTextMetrics.cityFontSize}
        fontFamily={previewTypographyFontFamily}
        fill={previewTextColor}
      >
        {previewDisplayCity}
      </text>
      <line
        x1={PREVIEW_VIEWBOX_WIDTH * 0.4}
        x2={PREVIEW_VIEWBOX_WIDTH * 0.6}
        y1={labelLayout.dividerY}
        y2={labelLayout.dividerY}
        stroke={previewTextColor}
        strokeWidth={previewTextMetrics.dividerWidth}
      />
      <text
        x={PREVIEW_VIEWBOX_WIDTH * 0.5}
        y={labelLayout.countryY}
        textAnchor="middle"
        fontWeight={300}
        fontSize={previewTextMetrics.countryFontSize}
        fontFamily={previewTypographyFontFamily}
        fill={previewTextColor}
      >
        {previewDisplayCountry}
      </text>
      <text
        x={PREVIEW_VIEWBOX_WIDTH * 0.5}
        y={labelLayout.coordsY}
        textAnchor="middle"
        fontWeight={400}
        fontSize={previewTextMetrics.coordsFontSize}
        fontFamily={previewTypographyFontFamily}
        fill={previewTextColor}
        opacity={0.7}
      >
        {previewCoords}
      </text>
      <text
        x={PREVIEW_VIEWBOX_WIDTH * 0.995}
        y={labelLayout.attributionY}
        textAnchor="end"
        fontWeight={300}
        fontSize={previewTextMetrics.attributionFontSize}
        fontFamily={previewTypographyFontFamily}
        fill={previewTextColor}
        opacity={0.35}
      >
        © OpenStreetMap contributors
      </text>
    </svg>
  );
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
  labelPaddingScale: 1,
  distance: 12000,
  width: 12,
  height: 16,
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
    textColor: values.textColor?.trim() || undefined,
    labelPaddingScale: values.labelPaddingScale,
    distance: values.distance,
    width: values.width,
    height: values.height,
    format: values.format,
  };
}

export function PosterGenerator() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(
    undefined,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [activePreviewHint, setActivePreviewHint] =
    useState<AdvancedHelpFieldKey | null>(null);
  const [previewZoomEnabled, setPreviewZoomEnabled] = useState(false);
  const [previewZoomLevel, setPreviewZoomLevel] =
    useState(DEFAULT_PREVIEW_ZOOM);
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
  const [fontAutocompleteOpen, setFontAutocompleteOpen] = useState(false);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
  });

  const watchedValues = useWatch({ control: form.control });
  const values = useMemo<FormValues>(
    () => ({
      ...defaultValues,
      ...watchedValues,
    }),
    [watchedValues],
  );

  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: fetchThemes,
  });
  const locationSuggestionsQuery = useQuery({
    queryKey: ["locations", debouncedLocationQuery],
    queryFn: () => fetchLocations(debouncedLocationQuery),
    enabled: locationAutocompleteOpen && debouncedLocationQuery.length >= 3,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const fontSuggestionsQuery = useQuery({
    queryKey: ["fonts", debouncedFontQuery],
    queryFn: () => fetchFonts(debouncedFontQuery),
    enabled: fontAutocompleteOpen,
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  const createJobMutation = useMutation({
    mutationFn: ({
      payload,
      token,
    }: {
      payload: PosterRequest;
      token?: string;
    }) => createJob(payload, token),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setDownloadUrl(null);
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
    const timer = setTimeout(() => {
      setDebouncedLocationQuery(locationQuery.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFontQuery(values.fontFamily?.trim() ?? "");
    }, 250);
    return () => clearTimeout(timer);
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

  const statusTone = useMemo(() => {
    const status = jobQuery.data?.status;
    if (status === "failed") return "destructive" as const;
    if (status === "complete") return "default" as const;
    return "secondary" as const;
  }, [jobQuery.data?.status]);

  function handleGenerate(values: FormValues) {
    createJobMutation.mutate({
      payload: toPayload(values),
      token: captchaToken,
    });
  }

  function handleLocationSelect(suggestion: LocationSuggestion) {
    setLocationQuery(suggestion.displayName);
    setLocationAutocompleteOpen(false);
    form.setValue("city", suggestion.city, { shouldValidate: true });
    form.setValue("country", suggestion.country, { shouldValidate: true });
    form.setValue("latitude", suggestion.latitude, { shouldValidate: true });
    form.setValue("longitude", suggestion.longitude, { shouldValidate: true });
  }

  function handleThemeSelect(theme: Theme) {
    form.setValue("theme", theme.id, { shouldValidate: true });
    setThemeDialogOpen(false);
  }

  function handleFontSelect(family: string) {
    form.setValue("fontFamily", family, { shouldValidate: true });
    setFontAutocompleteOpen(false);
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

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const activeTheme = themesQuery.data?.find(
    (theme) => theme.id === values.theme,
  );
  const themeTextColor = activeTheme?.colors.text ?? "#8C4A18";
  const previewTextColor =
    normalizeHexColor(values.textColor) ?? themeTextColor;
  const previewDisplayCityRaw = values.city || "";
  const previewDisplayCity = formatPreviewCity(previewDisplayCityRaw);
  const previewTextMetrics = getPreviewTextMetrics(
    previewDisplayCityRaw,
    values.width,
    values.height,
    values.cityFontSize,
    values.countryFontSize,
  );
  const previewDisplayCountry = (values.country || "").toUpperCase();
  const previewTypographyFontFamily =
    values.fontFamily?.trim() || "var(--font-heading)";
  const previewCoords = formatPreviewCoords(values.latitude, values.longitude);
  const previewUrl = `/theme-previews/${values.theme}.svg`;
  const previewZoomAnchor = previewPointer ?? { x: 0.5, y: 0.5 };
  const zoomViewWidth = PREVIEW_VIEWBOX_WIDTH / previewZoomLevel;
  const zoomViewHeight = PREVIEW_VIEWBOX_HEIGHT / previewZoomLevel;
  const zoomCenterX = previewZoomAnchor.x * PREVIEW_VIEWBOX_WIDTH;
  const zoomCenterY = previewZoomAnchor.y * PREVIEW_VIEWBOX_HEIGHT;
  const zoomViewX = clamp(
    zoomCenterX - zoomViewWidth / 2,
    0,
    PREVIEW_VIEWBOX_WIDTH - zoomViewWidth,
  );
  const zoomViewY = clamp(
    zoomCenterY - zoomViewHeight / 2,
    0,
    PREVIEW_VIEWBOX_HEIGHT - zoomViewHeight,
  );
  const zoomLensLeft = (zoomViewX / PREVIEW_VIEWBOX_WIDTH) * 100;
  const zoomLensTop = (zoomViewY / PREVIEW_VIEWBOX_HEIGHT) * 100;
  const zoomLensWidth = (zoomViewWidth / PREVIEW_VIEWBOX_WIDTH) * 100;
  const zoomLensHeight = (zoomViewHeight / PREVIEW_VIEWBOX_HEIGHT) * 100;
  const fallbackFontSuggestions = useMemo(() => {
    const query = (values.fontFamily ?? "").trim().toLowerCase();
    if (!query) {
      return fallbackFontFamilies.slice(0, 10);
    }
    return fallbackFontFamilies.filter((font) =>
      font.family.toLowerCase().includes(query),
    );
  }, [values.fontFamily]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <motion.header
        className="mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Badge className="mb-3 bg-amber-700/90 text-amber-50">
          Public Poster Generator
        </Badge>
        <h1 className="font-heading text-4xl tracking-tight text-foreground sm:text-5xl">
          Generate city map posters instantly
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Create high-resolution posters with all built-in maptoposter themes,
          multilingual labels, and export options without signing in.
        </p>
      </motion.header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapIcon className="h-5 w-5 text-amber-700" />
                Map Controls
              </CardTitle>
              <CardDescription>
                All maptoposter options are available here, including advanced
                fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit(handleGenerate)}
              >
                <div className="space-y-2">
                  <Label htmlFor="location-search">Location</Label>
                  <div className="relative">
                    <Input
                      id="location-search"
                      value={locationQuery}
                      placeholder="Search city, district, landmark..."
                      onFocus={() => setLocationAutocompleteOpen(true)}
                      onBlur={() =>
                        setTimeout(
                          () => setLocationAutocompleteOpen(false),
                          120,
                        )
                      }
                      onChange={(event) => {
                        setLocationQuery(event.currentTarget.value);
                      }}
                    />
                    {locationAutocompleteOpen &&
                    debouncedLocationQuery.length >= 3 ? (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                        {locationSuggestionsQuery.isLoading ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            Searching locations...
                          </p>
                        ) : locationSuggestionsQuery.data?.length ? (
                          locationSuggestionsQuery.data.map((suggestion) => (
                            <button
                              key={suggestion.placeId}
                              type="button"
                              className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                handleLocationSelect(suggestion);
                              }}
                            >
                              <p className="truncate font-medium">
                                {suggestion.city}, {suggestion.country}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {suggestion.displayName}
                              </p>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            No results found for this query.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select a suggestion to auto-fill city/country and precise
                    coordinates.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Paris"
                      {...form.register("city")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      placeholder="France"
                      {...form.register("country")}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {distancePresets.map((preset) => (
                      <Button
                        key={preset.value}
                        type="button"
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
                  </div>
                  <div className="space-y-2">
                    <Label>Distance: {values.distance.toLocaleString()}m</Label>
                    <Slider
                      min={1000}
                      max={50000}
                      step={500}
                      value={[values.distance]}
                      onValueChange={(next) =>
                        form.setValue("distance", next[0] ?? values.distance, {
                          shouldValidate: true,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex min-h-8 items-center justify-between gap-3">
                      <Label>Theme</Label>
                      <Dialog
                        open={themeDialogOpen}
                        onOpenChange={setThemeDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Browse themes
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Palette className="h-4 w-4 text-amber-700" />
                              Theme Explorer
                            </DialogTitle>
                            <DialogDescription>
                              Compare all built-in styles and pick the look that
                              fits your poster outcome.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="max-h-[68vh] overflow-y-auto px-5 pb-5">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {themesQuery.data?.map((theme, index) => {
                                const selected = values.theme === theme.id;
                                return (
                                  <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => handleThemeSelect(theme)}
                                    className={[
                                      "overflow-hidden rounded-lg border bg-card text-left transition-all",
                                      selected
                                        ? "border-amber-700 shadow-[0_0_0_1px_hsl(var(--primary))]"
                                        : "border-border hover:border-amber-600/60 hover:shadow-sm",
                                    ].join(" ")}
                                  >
                                    <ThemePreviewImage
                                      themeId={theme.id}
                                      themeName={theme.name}
                                      priority={index < 6}
                                    />
                                    <div className="space-y-2 px-3 py-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-foreground">
                                          {theme.name}
                                        </p>
                                        {selected ? (
                                          <Badge className="bg-amber-700/90 text-amber-50">
                                            Selected
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="min-h-8 text-xs text-muted-foreground">
                                        {theme.description}
                                      </p>
                                      <div className="flex items-center gap-1">
                                        {Object.entries(theme.colors)
                                          .slice(0, 5)
                                          .map(([colorKey, colorValue]) => (
                                            <span
                                              key={colorKey}
                                              title={`${colorKey}: ${colorValue}`}
                                              className="h-4 w-4 rounded-full border border-black/10"
                                              style={{
                                                backgroundColor: colorValue,
                                              }}
                                            />
                                          ))}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Select
                      value={values.theme}
                      onValueChange={(value) =>
                        form.setValue("theme", value, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a theme" />
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
                      <Label>Format</Label>
                    </div>
                    <Select
                      value={values.format}
                      onValueChange={(value) =>
                        form.setValue("format", value as FormValues["format"], {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger>
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
                      Generate all themes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Creates all 17 themes and bundles ZIP download.
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
                  defaultValue="advanced"
                  className="w-full"
                >
                  <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced Options</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="latitude">Latitude</Label>
                            <Input
                              id="latitude"
                              placeholder="48.8566"
                              {...form.register("latitude")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="longitude">Longitude</Label>
                            <Input
                              id="longitude"
                              placeholder="2.3522"
                              {...form.register("longitude")}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="width">
                              Width (inches, max 20)
                            </Label>
                            <Input
                              id="width"
                              type="number"
                              min={1}
                              max={20}
                              step={0.1}
                              value={values.width}
                              onChange={(event) =>
                                form.setValue(
                                  "width",
                                  Number(event.target.value),
                                  { shouldValidate: true },
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="height">
                              Height (inches, max 20)
                            </Label>
                            <Input
                              id="height"
                              type="number"
                              min={1}
                              max={20}
                              step={0.1}
                              value={values.height}
                              onChange={(event) =>
                                form.setValue(
                                  "height",
                                  Number(event.target.value),
                                  { shouldValidate: true },
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-lg border border-dashed px-3 py-3">
                          <p className="text-sm font-medium text-foreground">
                            Map Layers (Export)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Applies to final generation only. Preview remains on
                            fast server defaults.
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  Include water
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Rivers, lakes, canals.
                                </p>
                              </div>
                              <Switch
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
                                <p className="text-sm font-medium text-foreground">
                                  Include parks/greens
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Parks and grass areas.
                                </p>
                              </div>
                              <Switch
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
                            Typography Overrides
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Optional custom city/country sizes and text color
                            for preview and exports.
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="cityFontSize">
                                City font size (pt)
                              </Label>
                              <Input
                                id="cityFontSize"
                                type="number"
                                min={8}
                                max={120}
                                step={1}
                                placeholder="Auto (theme default)"
                                value={
                                  typeof values.cityFontSize === "number"
                                    ? values.cityFontSize
                                    : ""
                                }
                                onChange={(event) => {
                                  const nextRaw = event.currentTarget.value;
                                  form.setValue(
                                    "cityFontSize",
                                    nextRaw ? Number(nextRaw) : undefined,
                                    { shouldValidate: true },
                                  );
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="countryFontSize">
                                Country font size (pt)
                              </Label>
                              <Input
                                id="countryFontSize"
                                type="number"
                                min={6}
                                max={80}
                                step={1}
                                placeholder="Auto (theme default)"
                                value={
                                  typeof values.countryFontSize === "number"
                                    ? values.countryFontSize
                                    : ""
                                }
                                onChange={(event) => {
                                  const nextRaw = event.currentTarget.value;
                                  form.setValue(
                                    "countryFontSize",
                                    nextRaw ? Number(nextRaw) : undefined,
                                    { shouldValidate: true },
                                  );
                                }}
                              />
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <Label htmlFor="labelPaddingScale">
                                Label padding scale
                              </Label>
                              <span className="text-xs text-muted-foreground">
                                {values.labelPaddingScale.toFixed(2)}x
                              </span>
                            </div>
                            <Slider
                              id="labelPaddingScale"
                              min={0.5}
                              max={3}
                              step={0.05}
                              value={[values.labelPaddingScale]}
                              onValueChange={(nextValue) =>
                                form.setValue(
                                  "labelPaddingScale",
                                  nextValue[0] ?? 1,
                                  { shouldValidate: true },
                                )
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Increases spacing between city, divider, country,
                              and coordinates when typography is larger.
                            </p>
                          </div>
                          <div className="mt-3 space-y-2">
                            <Label htmlFor="textColor">
                              Text color override
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="textColor"
                                className="flex-1"
                                placeholder="Auto (theme text color)"
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
                                aria-label="Pick custom text color"
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
                                Reset
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Supports hex colors like <code>#8C4A18</code> or{" "}
                              <code>#abc</code>. Leave empty to use theme text
                              color.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="fontFamily">
                              Google Font Family
                            </Label>
                            <Popover open={activePreviewHint === "fontFamily"}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Explain Google Font Family"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-amber-700 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  {...getHintTriggerHandlers("fontFamily")}
                                >
                                  <CircleHelp className="h-3.5 w-3.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="start"
                                className="w-72"
                                side="top"
                              >
                                <p className="text-xs font-semibold text-foreground">
                                  {advancedFieldHelp.fontFamily.title}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {advancedFieldHelp.fontFamily.description}
                                </p>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="relative">
                            <Input
                              id="fontFamily"
                              value={values.fontFamily ?? ""}
                              placeholder="Search Google Fonts..."
                              onFocus={() => setFontAutocompleteOpen(true)}
                              onBlur={() =>
                                setTimeout(
                                  () => setFontAutocompleteOpen(false),
                                  120,
                                )
                              }
                              onChange={(event) =>
                                form.setValue(
                                  "fontFamily",
                                  event.currentTarget.value,
                                  {
                                    shouldValidate: true,
                                  },
                                )
                              }
                            />
                            {fontAutocompleteOpen ? (
                              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                                {fontSuggestionsQuery.isLoading ? (
                                  <p className="px-3 py-2 text-xs text-muted-foreground">
                                    Searching fonts...
                                  </p>
                                ) : fontSuggestionsQuery.isError ? (
                                  <>
                                    <p className="px-3 py-2 text-xs text-red-700">
                                      Font search unavailable. Showing fallback
                                      suggestions.
                                    </p>
                                    {fallbackFontSuggestions.length ? (
                                      fallbackFontSuggestions.map((font) => (
                                        <button
                                          key={font.family}
                                          type="button"
                                          className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                                          onMouseDown={(event) => {
                                            event.preventDefault();
                                            handleFontSelect(font.family);
                                          }}
                                        >
                                          <p className="truncate font-medium">
                                            {font.family}
                                          </p>
                                          <p className="truncate text-xs text-muted-foreground">
                                            {font.category}
                                          </p>
                                        </button>
                                      ))
                                    ) : (
                                      <p className="px-3 py-2 text-xs text-muted-foreground">
                                        No fallback fonts match this query.
                                      </p>
                                    )}
                                  </>
                                ) : fontSuggestionsQuery.data?.length ? (
                                  fontSuggestionsQuery.data.map((font) => (
                                    <button
                                      key={font.family}
                                      type="button"
                                      className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        handleFontSelect(font.family);
                                      }}
                                    >
                                      <p className="truncate font-medium">
                                        {font.family}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {font.category ?? "Google Font"}
                                      </p>
                                    </button>
                                  ))
                                ) : (
                                  <p className="px-3 py-2 text-xs text-muted-foreground">
                                    No matching fonts found.
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Search and pick from Google Fonts, or type a custom
                            family name.
                          </p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {turnstileSiteKey ? (
                  <Turnstile
                    siteKey={turnstileSiteKey}
                    options={{ theme: "light" }}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(undefined)}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    CAPTCHA site key is not configured. Set{" "}
                    <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>.
                  </p>
                )}

                <div className="hidden lg:block">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      !form.formState.isValid || createJobMutation.isPending
                    }
                  >
                    {createJobMutation.isPending ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Queueing job...
                      </>
                    ) : (
                      <>
                        <WandSparkles className="h-4 w-4" />
                        Generate Poster
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-4 w-4 text-amber-700" />
                Live Preview
              </CardTitle>
              <CardDescription>
                Preview uses pregenerated theme SVG backgrounds and performs no
                API calls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-dashed px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Zoom box
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Inspect smaller text in the preview.
                    </p>
                  </div>
                  <Switch
                    checked={previewZoomEnabled}
                    onCheckedChange={setPreviewZoomEnabled}
                    aria-label="Toggle live preview zoom box"
                  />
                </div>
                {previewZoomEnabled ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Zoom level</span>
                      <span>{previewZoomLevel.toFixed(1)}x</span>
                    </div>
                    <Slider
                      min={1.5}
                      max={6}
                      step={0.5}
                      value={[previewZoomLevel]}
                      onValueChange={(nextValue) =>
                        setPreviewZoomLevel(
                          nextValue[0] ?? DEFAULT_PREVIEW_ZOOM,
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>
              <div
                ref={previewFrameRef}
                className="group relative aspect-[439.2/583.2] touch-none select-none overflow-hidden rounded-lg border bg-gradient-to-b from-amber-50 to-orange-100"
                onPointerMove={(event) => {
                  if (!previewZoomEnabled) return;
                  updatePreviewPointer(event.clientX, event.clientY);
                }}
                onPointerEnter={(event) => {
                  if (!previewZoomEnabled) return;
                  updatePreviewPointer(event.clientX, event.clientY);
                }}
                onPointerDown={(event) => {
                  if (!previewZoomEnabled) return;
                  updatePreviewPointer(event.clientX, event.clientY);
                }}
                onPointerLeave={() => {
                  if (!previewZoomEnabled) return;
                  setPreviewPointer(null);
                }}
              >
                <Image
                  src={previewUrl}
                  alt="Poster preview"
                  fill
                  className="h-full w-full object-cover"
                  unoptimized
                />
                <PreviewTypographyOverlay
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  title="Poster text preview overlay"
                  previewTextColor={previewTextColor}
                  previewDisplayCity={previewDisplayCity}
                  previewDisplayCountry={previewDisplayCountry}
                  previewCoords={previewCoords}
                  previewTextMetrics={previewTextMetrics}
                  previewTypographyFontFamily={previewTypographyFontFamily}
                  labelPaddingScale={values.labelPaddingScale}
                />
                {previewZoomEnabled ? (
                  <>
                    <div
                      className="pointer-events-none absolute z-20 rounded-sm border border-amber-700/80 bg-amber-200/10 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
                      style={{
                        left: `${zoomLensLeft}%`,
                        top: `${zoomLensTop}%`,
                        width: `${zoomLensWidth}%`,
                        height: `${zoomLensHeight}%`,
                      }}
                    />
                    <div className="pointer-events-none absolute right-2 top-2 z-30 w-32 overflow-hidden rounded-md border border-border bg-card/95 shadow-lg sm:w-36">
                      <div className="absolute left-2 top-2 z-20 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                        Zoom {previewZoomLevel.toFixed(1)}x
                      </div>
                      <div className="relative aspect-[439.2/583.2]">
                        <svg
                          className="absolute inset-0 h-full w-full"
                          viewBox={`${zoomViewX} ${zoomViewY} ${zoomViewWidth} ${zoomViewHeight}`}
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <title>Magnified poster preview</title>
                          <image
                            href={previewUrl}
                            x={0}
                            y={0}
                            width={PREVIEW_VIEWBOX_WIDTH}
                            height={PREVIEW_VIEWBOX_HEIGHT}
                            preserveAspectRatio="none"
                          />
                        </svg>
                        <PreviewTypographyOverlay
                          className="absolute inset-0 h-full w-full"
                          viewBox={`${zoomViewX} ${zoomViewY} ${zoomViewWidth} ${zoomViewHeight}`}
                          title="Magnified poster typography overlay"
                          previewTextColor={previewTextColor}
                          previewDisplayCity={previewDisplayCity}
                          previewDisplayCountry={previewDisplayCountry}
                          previewCoords={previewCoords}
                          previewTextMetrics={previewTextMetrics}
                          previewTypographyFontFamily={
                            previewTypographyFontFamily
                          }
                          labelPaddingScale={values.labelPaddingScale}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generation Status</CardTitle>
              <CardDescription>
                Queued jobs update automatically every two seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {jobId ? (
                <>
                  <div className="flex items-center justify-between">
                    <Badge variant={statusTone}>
                      {jobQuery.data?.status ?? "queued"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Job: {jobId.slice(0, 8)}
                    </span>
                  </div>
                  <Progress value={jobQuery.data?.progress ?? 0} />
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {(jobQuery.data?.steps ?? []).slice(-4).map((step) => (
                      <li key={step}>• {step}</li>
                    ))}
                  </ul>
                  {jobQuery.data?.status === "failed" ? (
                    <p className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      {jobQuery.data.error ?? "Generation failed"}
                    </p>
                  ) : null}
                  {jobQuery.data?.status === "complete" ? (
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-xs text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Generation complete
                      </p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {jobQuery.data.artifacts.map((artifact) => (
                          <p key={artifact.key}>{artifact.fileName}</p>
                        ))}
                      </div>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => downloadMutation.mutate(jobId)}
                        disabled={downloadMutation.isPending}
                      >
                        <Download className="h-4 w-4" />
                        {downloadMutation.isPending
                          ? "Preparing download..."
                          : "Download"}
                      </Button>
                      {downloadUrl ? (
                        <p className="break-all text-xs text-muted-foreground">
                          {downloadUrl}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active generation job.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.aside>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-4 backdrop-blur lg:hidden">
        <Button
          className="mx-auto flex w-full max-w-7xl"
          onClick={form.handleSubmit(handleGenerate)}
          disabled={!form.formState.isValid || createJobMutation.isPending}
        >
          {createJobMutation.isPending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Queueing job...
            </>
          ) : (
            <>
              <WandSparkles className="h-4 w-4" />
              Generate Poster
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
