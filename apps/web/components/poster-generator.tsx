"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronsUpDown,
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
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  createJob,
  fetchDownload,
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
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type {
  LocationSuggestion,
  PosterRequest,
  RenderSnapshotPayload,
  RenderSnapshotRequest,
  Theme,
} from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "./ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
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
    textBlurEnabled: z.boolean(),
    textBlurSize: z.number().min(0.6).max(2.5),
    textBlurStrength: z.number().min(0).max(30),
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

const DEFAULT_PREVIEW_ZOOM = 2.5;

type PreviewPointer = {
  x: number;
  y: number;
};

type RendererMode = "local-wasm" | "server-fallback";

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
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PREVIEW_RENDER_DPI = 120;

function supportsLocalRenderer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  );
}

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

function ThemePreviewImage({
  themeId,
  themeName,
  loadingLabel,
  unavailableLabel,
  priority = false,
}: {
  themeId: string;
  themeName: string;
  loadingLabel: string;
  unavailableLabel: string;
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
          <p className="text-[11px] text-muted-foreground">{loadingLabel}</p>
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
          {unavailableLabel}
        </div>
      ) : null}
    </div>
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
  textBlurEnabled: false,
  textBlurSize: 1,
  textBlurStrength: 8,
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
    textBlurEnabled: values.textBlurEnabled,
    textBlurSize: values.textBlurSize,
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
  dictionary: Dictionary;
}) {
  const showDevRateLimitToggle = process.env.NODE_ENV !== "production";
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
  const includeWaterId = "include-water-switch";
  const includeParksId = "include-parks-switch";
  const blurEnabledId = "text-blur-switch";
  const rateLimitToggleId = "dev-rate-limit-switch";
  const zoomToggleId = "preview-zoom-switch";
  const zoomSliderId = "preview-zoom-slider";
  const pageDescriptionId = "generator-page-description";
  const previewKeyboardHintId = "preview-keyboard-hint";
  const previewFrameId = "live-preview-frame";
  const shouldReduceMotion = useReducedMotion();
  const [jobId, setJobId] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(
    undefined,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>("local-wasm");
  const [rendererReason, setRendererReason] = useState("initializing");
  const [latestPreviewUrl, setLatestPreviewUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localRenderPending, setLocalRenderPending] = useState(true);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [activePreviewHint, setActivePreviewHint] =
    useState<AdvancedHelpFieldKey | null>(null);
  const [previewZoomEnabled, setPreviewZoomEnabled] = useState(false);
  const [disableRateLimit, setDisableRateLimit] = useState(false);
  const [previewZoomLevel, setPreviewZoomLevel] =
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
  const pathname = usePathname();
  const router = useRouter();

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

  const fallbackToServer = useCallback((reason: string) => {
    const worker = workerRef.current;
    if (worker) {
      worker.terminate();
      workerRef.current = null;
    }
    setRendererMode("server-fallback");
    setRendererReason(reason);
    setLocalRenderPending(false);
    setLocalPreviewUrl(null);
  }, []);

  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: fetchThemes,
  });
  const locationSuggestionsQuery = useQuery({
    queryKey: ["locations", debouncedLocationQuery, disableRateLimit],
    queryFn: () =>
      fetchLocations(debouncedLocationQuery, {
        disableRateLimit,
      }),
    enabled: locationAutocompleteOpen && debouncedLocationQuery.length >= 3,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const fontSuggestionsQuery = useQuery({
    queryKey: ["fonts", debouncedFontQuery, disableRateLimit],
    queryFn: () =>
      fetchFonts(debouncedFontQuery, {
        disableRateLimit,
      }),
    enabled: fontComboboxOpen,
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
  const snapshotQuery = useQuery({
    queryKey: ["render-snapshot", debouncedSnapshotRequest, disableRateLimit],
    queryFn: () =>
      fetchRenderSnapshot(debouncedSnapshotRequest, {
        disableRateLimit,
      }),
    enabled:
      rendererMode === "local-wasm" &&
      debouncedSnapshotRequest.city.trim().length > 0 &&
      debouncedSnapshotRequest.country.trim().length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const previewQuery = useQuery({
    queryKey: ["preview", debouncedPreviewPayload, disableRateLimit],
    queryFn: () =>
      fetchPreview(debouncedPreviewPayload, {
        disableRateLimit,
      }),
    enabled:
      rendererMode === "server-fallback" &&
      debouncedPreviewPayload.city.trim().length > 0 &&
      debouncedPreviewPayload.country.trim().length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const createJobMutation = useMutation({
    mutationFn: ({
      payload,
      token,
      disableRateLimit,
    }: {
      payload: PosterRequest;
      token?: string;
      disableRateLimit: boolean;
    }) => createJob(payload, token, { disableRateLimit }),
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
        fallbackToServer("worker-runtime-error");
      };
    } catch {
      setRendererMode("server-fallback");
      setRendererReason("worker-init-failed");
      setLocalRenderPending(false);
    }

    return () => {
      disposed = true;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [fallbackToServer]);

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
      fallbackToServer("snapshot-fetch-failed");
    }
  }, [rendererMode, snapshotQuery.isError, fallbackToServer]);

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
    if (!showDevRateLimitToggle) {
      return;
    }
    const rawValue =
      window.localStorage.getItem("disableRateLimit") ??
      window.localStorage.getItem("disablePreviewRateLimit");
    if (rawValue === "1") {
      setDisableRateLimit(true);
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
      disableRateLimit,
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

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const activeTheme = themesQuery.data?.find(
    (theme) => theme.id === values.theme,
  );
  const themeTextColor = activeTheme?.colors.text ?? "#8C4A18";
  const selectedFontFamily = values.fontFamily?.trim() ?? "";
  const previewWidthInches =
    Number.isFinite(values.width) && values.width > 0
      ? values.width
      : defaultValues.width;
  const previewHeightInches =
    Number.isFinite(values.height) && values.height > 0
      ? values.height
      : defaultValues.height;
  const previewPixelWidth = Math.max(
    320,
    Math.round(previewWidthInches * PREVIEW_RENDER_DPI),
  );
  const previewPixelHeight = Math.max(
    320,
    Math.round(previewHeightInches * PREVIEW_RENDER_DPI),
  );
  const previewUrl =
    rendererMode === "local-wasm" ? localPreviewUrl : latestPreviewUrl;
  const hasPreview = Boolean(previewUrl);
  const isPreviewLoading =
    rendererMode === "local-wasm"
      ? snapshotQuery.isFetching || localRenderPending || !hasPreview
      : previewQuery.isFetching;
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
    if (!worker || !snapshotQuery.data || !activeTheme) {
      return;
    }

    const renderId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    latestWorkerRenderIdRef.current = renderId;
    setLocalRenderPending(true);
    const message: WorkerRenderRequest = {
      type: "render",
      id: renderId,
      payload: previewPayload,
      snapshot: snapshotQuery.data,
      theme: activeTheme,
      pixelWidth: previewPixelWidth,
      pixelHeight: previewPixelHeight,
    };
    worker.postMessage(message);
  }, [
    rendererMode,
    snapshotQuery.data,
    activeTheme,
    previewPayload,
    previewPixelWidth,
    previewPixelHeight,
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
      <motion.header
        className="mb-8"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.35 }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Badge className="bg-amber-700/90 text-amber-50">
            {d.header.badge}
          </Badge>
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
      </motion.header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.35,
            delay: shouldReduceMotion ? 0 : 0.05,
          }}
        >
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
                >
                  <div className="space-y-2">
                    <Label htmlFor={locationInputId}>
                      {d.controls.location}
                    </Label>
                    <div className="relative">
                      <Input
                        id={locationInputId}
                        value={locationQuery}
                        placeholder={d.controls.locationPlaceholder}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={
                          locationAutocompleteOpen &&
                          debouncedLocationQuery.length >= 3
                        }
                        aria-controls={
                          locationAutocompleteOpen &&
                          debouncedLocationQuery.length >= 3
                            ? locationListboxId
                            : undefined
                        }
                        aria-activedescendant={
                          activeLocationSuggestion
                            ? `location-option-${activeLocationSuggestion.placeId}`
                            : undefined
                        }
                        aria-describedby={`${locationHintId} ${locationStatusId}`}
                        onFocus={() => {
                          setLocationAutocompleteOpen(true);
                        }}
                        onBlur={() =>
                          setTimeout(() => {
                            setLocationAutocompleteOpen(false);
                            setActiveLocationIndex(-1);
                          }, 120)
                        }
                        onKeyDown={handleLocationInputKeyDown}
                        onChange={(event) => {
                          setLocationQuery(event.currentTarget.value);
                          setLocationAutocompleteOpen(true);
                          setActiveLocationIndex(-1);
                        }}
                      />
                      {locationAutocompleteOpen &&
                      debouncedLocationQuery.length >= 3 ? (
                        <div
                          id={locationListboxId}
                          role="listbox"
                          aria-label={d.controls.location}
                          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
                        >
                          {locationSuggestionsQuery.isLoading ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground">
                              {d.controls.searchingLocations}
                            </p>
                          ) : locationSuggestions.length ? (
                            locationSuggestions.map((suggestion, index) => (
                              <button
                                key={suggestion.placeId}
                                type="button"
                                id={`location-option-${suggestion.placeId}`}
                                role="option"
                                aria-selected={index === activeLocationIndex}
                                tabIndex={-1}
                                className={`w-full rounded-sm px-3 py-2 text-left text-sm ${
                                  index === activeLocationIndex
                                    ? "bg-muted text-foreground"
                                    : "hover:bg-muted"
                                }`}
                                onMouseEnter={() =>
                                  setActiveLocationIndex(index)
                                }
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
                              {d.controls.noLocationResults}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <p
                      id={locationHintId}
                      className="text-xs text-muted-foreground"
                    >
                      {d.controls.locationHelp}
                    </p>
                    <p
                      id={locationStatusId}
                      className="sr-only"
                      aria-live="polite"
                    >
                      {locationStatusMessage}
                    </p>
                  </div>

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
                        {...form.register("city")}
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
                        {...form.register("country")}
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
                        {values.distance.toLocaleString()}m
                      </Label>
                      <Slider
                        id={distanceSliderId}
                        aria-label={d.controls.distance}
                        min={1000}
                        max={50000}
                        step={500}
                        value={[values.distance]}
                        onValueChange={(next) =>
                          form.setValue(
                            "distance",
                            next[0] ?? values.distance,
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
                              {d.controls.browseThemes}
                            </Button>
                          </DialogTrigger>
                          <DialogContent
                            closeLabel={d.accessibility.closeDialog}
                          >
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Palette className="h-4 w-4 text-amber-700" />
                                {d.themeExplorer.title}
                              </DialogTitle>
                              <DialogDescription>
                                {d.themeExplorer.description}
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
                                        loadingLabel={
                                          d.themeExplorer.loadingPreview
                                        }
                                        unavailableLabel={
                                          d.themeExplorer.previewUnavailable
                                        }
                                        priority={index < 6}
                                      />
                                      <div className="space-y-2 px-3 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-sm font-semibold text-foreground">
                                            {theme.name}
                                          </p>
                                          {selected ? (
                                            <Badge className="bg-amber-700/90 text-amber-50">
                                              {d.themeExplorer.selected}
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
                    defaultValue="advanced"
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
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="width">{d.controls.width}</Label>
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
                                {d.controls.height}
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
                                <Label htmlFor="cityFontSize">
                                  {d.controls.cityFontSize}
                                </Label>
                                <Input
                                  id="cityFontSize"
                                  type="number"
                                  min={8}
                                  max={120}
                                  step={1}
                                  placeholder={d.controls.autoThemeDefault}
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
                                  {d.controls.countryFontSize}
                                </Label>
                                <Input
                                  id="countryFontSize"
                                  type="number"
                                  min={6}
                                  max={80}
                                  step={1}
                                  placeholder={d.controls.autoThemeDefault}
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
                                  {d.controls.labelPaddingScale}
                                </Label>
                                <span className="text-xs text-muted-foreground">
                                  {values.labelPaddingScale.toFixed(2)}x
                                </span>
                              </div>
                              <Slider
                                id="labelPaddingScale"
                                aria-label={d.controls.labelPaddingScale}
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
                                  onCheckedChange={(checked) =>
                                    form.setValue("textBlurEnabled", checked, {
                                      shouldValidate: true,
                                    })
                                  }
                                />
                              </div>
                              {values.textBlurEnabled ? (
                                <div className="mt-3 space-y-3">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{d.controls.blurSize}</span>
                                      <span>
                                        {values.textBlurSize.toFixed(2)}x
                                      </span>
                                    </div>
                                    <Slider
                                      aria-label={d.controls.blurSize}
                                      min={0.6}
                                      max={2.5}
                                      step={0.05}
                                      value={[values.textBlurSize]}
                                      onValueChange={(nextValue) =>
                                        form.setValue(
                                          "textBlurSize",
                                          nextValue[0] ?? 1,
                                          { shouldValidate: true },
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{d.controls.blurStrength}</span>
                                      <span>
                                        {values.textBlurStrength.toFixed(1)}px
                                      </span>
                                    </div>
                                    <Slider
                                      aria-label={d.controls.blurStrength}
                                      min={0}
                                      max={30}
                                      step={0.5}
                                      value={[values.textBlurStrength]}
                                      onValueChange={(nextValue) =>
                                        form.setValue(
                                          "textBlurStrength",
                                          nextValue[0] ?? 8,
                                          { shouldValidate: true },
                                        )
                                      }
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

                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="fontFamily">
                                {d.controls.googleFontFamily}
                              </Label>
                              <Popover
                                open={activePreviewHint === "fontFamily"}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={
                                      d.controls.explainGoogleFontFamily
                                    }
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
                                    {d.controls.googleFontHelpTitle}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {d.controls.googleFontHelpDescription}
                                  </p>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <Popover
                              open={fontComboboxOpen}
                              onOpenChange={(open) => {
                                setFontComboboxOpen(open);
                                if (open) {
                                  setFontSearchQuery(selectedFontFamily);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  id="fontFamily"
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={fontComboboxOpen}
                                  aria-describedby={fontDescriptionId}
                                  className="w-full justify-between font-normal hover:bg-muted hover:text-foreground"
                                >
                                  <span
                                    className={
                                      selectedFontFamily
                                        ? "truncate text-left"
                                        : "truncate text-left text-muted-foreground"
                                    }
                                  >
                                    {selectedFontFamily ||
                                      d.controls.selectGoogleFont}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="start"
                                className="w-[var(--radix-popover-trigger-width)] p-0"
                              >
                                <Command shouldFilter={false}>
                                  <CommandInput
                                    value={fontSearchQuery}
                                    placeholder={d.controls.searchGoogleFonts}
                                    aria-label={
                                      d.controls.searchGoogleFontsAria
                                    }
                                    onValueChange={setFontSearchQuery}
                                  />
                                  <CommandList>
                                    {fontSuggestionsQuery.isLoading ? (
                                      <p className="px-3 py-3 text-xs text-muted-foreground">
                                        {d.controls.searchingFonts}
                                      </p>
                                    ) : (
                                      <>
                                        <CommandGroup
                                          heading={d.controls.selection}
                                        >
                                          <CommandItem
                                            className={fontCommandItemClassName}
                                            value="theme-default-font"
                                            onSelect={clearFontSelection}
                                          >
                                            <Check
                                              className={`mr-2 h-4 w-4 ${
                                                selectedFontFamily
                                                  ? "opacity-0"
                                                  : "opacity-100"
                                              }`}
                                            />
                                            {d.controls.themeDefaultFont}
                                          </CommandItem>
                                        </CommandGroup>
                                        <CommandSeparator />
                                        {fontSuggestionsQuery.isError ? (
                                          <>
                                            <p className="px-3 py-2 text-xs text-red-700">
                                              {d.controls.fontSearchUnavailable}
                                            </p>
                                            <CommandGroup
                                              heading={d.controls.fallbackFonts}
                                            >
                                              {fallbackFontSuggestions.length ? (
                                                fallbackFontSuggestions.map(
                                                  (font) => {
                                                    const isSelected =
                                                      selectedFontFamily.toLowerCase() ===
                                                      font.family.toLowerCase();
                                                    return (
                                                      <CommandItem
                                                        className={
                                                          fontCommandItemClassName
                                                        }
                                                        key={font.family}
                                                        value={`fallback-${font.family.toLowerCase()}`}
                                                        onSelect={() =>
                                                          handleFontSelect(
                                                            font.family,
                                                          )
                                                        }
                                                      >
                                                        <Check
                                                          className={`mr-2 h-4 w-4 ${
                                                            isSelected
                                                              ? "opacity-100"
                                                              : "opacity-0"
                                                          }`}
                                                        />
                                                        <div className="min-w-0">
                                                          <p className="truncate font-medium">
                                                            {font.family}
                                                          </p>
                                                          <p className="truncate text-xs text-muted-foreground">
                                                            {font.category}
                                                          </p>
                                                        </div>
                                                      </CommandItem>
                                                    );
                                                  },
                                                )
                                              ) : (
                                                <CommandEmpty>
                                                  {d.controls.noFallbackFonts}
                                                </CommandEmpty>
                                              )}
                                            </CommandGroup>
                                          </>
                                        ) : fontSuggestionsQuery.data
                                            ?.length ? (
                                          <CommandGroup
                                            heading={d.controls.googleFonts}
                                          >
                                            {fontSuggestionsQuery.data.map(
                                              (font) => {
                                                const isSelected =
                                                  selectedFontFamily.toLowerCase() ===
                                                  font.family.toLowerCase();
                                                return (
                                                  <CommandItem
                                                    className={
                                                      fontCommandItemClassName
                                                    }
                                                    key={font.family}
                                                    value={`google-${font.family.toLowerCase()}`}
                                                    onSelect={() =>
                                                      handleFontSelect(
                                                        font.family,
                                                      )
                                                    }
                                                  >
                                                    <Check
                                                      className={`mr-2 h-4 w-4 ${
                                                        isSelected
                                                          ? "opacity-100"
                                                          : "opacity-0"
                                                      }`}
                                                    />
                                                    <div className="min-w-0">
                                                      <p className="truncate font-medium">
                                                        {font.family}
                                                      </p>
                                                      <p className="truncate text-xs text-muted-foreground">
                                                        {font.category ??
                                                          d.controls
                                                            .googleFonts}
                                                      </p>
                                                    </div>
                                                  </CommandItem>
                                                );
                                              },
                                            )}
                                          </CommandGroup>
                                        ) : (
                                          <CommandEmpty>
                                            {d.controls.noFontsFound}
                                          </CommandEmpty>
                                        )}
                                      </>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <p
                              id={fontDescriptionId}
                              className="text-xs text-muted-foreground"
                            >
                              {d.controls.searchGoogleFontsHelp}
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
                      {d.controls.captchaMissing}
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
        </motion.div>

        <motion.aside
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.35,
            delay: shouldReduceMotion ? 0 : 0.1,
          }}
          className="space-y-6 lg:sticky lg:top-6 lg:self-start"
        >
          <section aria-labelledby="live-preview-title">
            <Card>
              <CardHeader>
                <h2
                  id="live-preview-title"
                  className="font-semibold tracking-tight flex items-center gap-2 text-lg"
                >
                  <Sparkles className="h-4 w-4 text-amber-700" />
                  {d.preview.title}
                </h2>
                <CardDescription>{d.preview.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {showDevRateLimitToggle ? (
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
                ) : null}
                <div className="rounded-lg border border-dashed px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label
                        htmlFor={zoomToggleId}
                        className="text-sm font-medium text-foreground"
                      >
                        {d.preview.zoomTitle}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {d.preview.zoomDescription}
                      </p>
                    </div>
                    <Switch
                      id={zoomToggleId}
                      checked={previewZoomEnabled}
                      onCheckedChange={setPreviewZoomEnabled}
                      aria-label={d.preview.zoomTitle}
                      aria-controls={previewFrameId}
                    />
                  </div>
                  {previewZoomEnabled ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{d.preview.zoomLevel}</span>
                        <span>
                          {d.preview.zoomLevelValue.replace(
                            "{value}",
                            previewZoomLevel.toFixed(1),
                          )}
                        </span>
                      </div>
                      <Slider
                        id={zoomSliderId}
                        aria-label={d.preview.zoomLevel}
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
                {showDevRateLimitToggle ? (
                  <p className="text-[11px] text-muted-foreground">
                    Renderer mode:{" "}
                    <span className="font-medium text-foreground">
                      {rendererMode}
                    </span>
                    {rendererReason !== "ok" ? ` (${rendererReason})` : ""}
                  </p>
                ) : null}
                <figure
                  id={previewFrameId}
                  ref={previewFrameRef}
                  className="group relative touch-none select-none overflow-hidden rounded-lg border bg-gradient-to-b from-amber-50 to-orange-100"
                  style={{
                    aspectRatio: `${previewWidthInches} / ${previewHeightInches}`,
                  }}
                  tabIndex={previewZoomEnabled ? 0 : -1}
                  aria-label={`${d.preview.title}: ${values.city}, ${values.country}`}
                  aria-describedby={previewKeyboardHintId}
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
                  onKeyDown={handlePreviewFrameKeyDown}
                >
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt={d.preview.posterAlt}
                      fill
                      priority
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/65">
                      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <LoaderCircle
                          className={
                            isPreviewLoading
                              ? "h-4 w-4 animate-spin"
                              : "h-4 w-4"
                          }
                        />
                        <span>
                          {rendererMode === "server-fallback" &&
                          previewQuery.isError
                            ? d.themeExplorer.previewUnavailable
                            : d.themeExplorer.loadingPreview}
                        </span>
                      </div>
                    </div>
                  )}
                  {previewZoomEnabled && hasPreview ? (
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
                          {d.preview.zoomValue.replace(
                            "{value}",
                            previewZoomLevel.toFixed(1),
                          )}
                        </div>
                        <div
                          className="relative"
                          style={{
                            aspectRatio: `${previewWidthInches} / ${previewHeightInches}`,
                          }}
                        >
                          <svg
                            className="absolute inset-0 h-full w-full"
                            viewBox={`${zoomViewX} ${zoomViewY} ${zoomViewWidth} ${zoomViewHeight}`}
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            <title>{d.preview.magnifiedTitle}</title>
                            <image
                              href={previewUrl ?? ""}
                              x={0}
                              y={0}
                              width={previewViewboxWidth}
                              height={previewViewboxHeight}
                              preserveAspectRatio="none"
                            />
                          </svg>
                        </div>
                      </div>
                    </>
                  ) : null}
                </figure>
                <p id={previewKeyboardHintId} className="sr-only">
                  {d.accessibility.previewKeyboardHint}
                </p>
                {isPreviewLoading ? (
                  <p className="text-xs text-muted-foreground">
                    {d.themeExplorer.loadingPreview}
                  </p>
                ) : null}
                {rendererMode === "server-fallback" && previewQuery.isError ? (
                  <p className="text-xs text-destructive">
                    {d.themeExplorer.previewUnavailable}
                  </p>
                ) : null}

                <section
                  className="rounded-lg border border-dashed px-3 py-3"
                  aria-labelledby={generationStatusTitleId}
                  aria-live="polite"
                  aria-atomic="true"
                  id={generationStatusLiveId}
                  aria-busy={Boolean(jobId) && jobQuery.isFetching}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p
                      id={generationStatusTitleId}
                      className="text-sm font-semibold text-foreground"
                    >
                      {d.status.title}
                    </p>
                    {jobId ? (
                      <Badge variant={statusTone}>
                        {jobQuery.data?.status ?? d.status.queuedBadge}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{d.status.idleBadge}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.status.description}
                  </p>
                  <div className="mt-3 space-y-3">
                    {jobId ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {d.status.jobLabel}: {jobId.slice(0, 8)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {jobQuery.data?.progress ?? 0}%
                          </span>
                        </div>
                        <Progress value={jobQuery.data?.progress ?? 0} />
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {(jobQuery.data?.steps ?? [])
                            .slice(-4)
                            .map((step) => (
                              <li key={step}>• {step}</li>
                            ))}
                        </ul>
                        {jobQuery.data?.status === "failed" ? (
                          <p className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertCircle className="h-4 w-4" />
                            {jobQuery.data.error ?? d.status.generationFailed}
                          </p>
                        ) : null}
                        {jobQuery.data?.status === "complete" ? (
                          <div className="space-y-2">
                            <p className="flex items-center gap-2 text-xs text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                              {d.status.generationComplete}
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
                                ? d.status.preparingDownload
                                : d.status.download}
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
                        {d.status.idle}
                      </p>
                    )}
                  </div>
                </section>
                <output className="sr-only" aria-live="assertive">
                  {statusAnnouncement}
                </output>
              </CardContent>
            </Card>
          </section>
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
