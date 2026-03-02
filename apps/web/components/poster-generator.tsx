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
  fetchJob,
  fetchLocations,
  fetchPreview,
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

type AdvancedHelpFieldKey =
  | "displayCity"
  | "displayCountry"
  | "countryLabel"
  | "fontFamily";

const advancedFieldHelp: Record<
  AdvancedHelpFieldKey,
  {
    title: string;
    description: string;
    previewLabel: string;
  }
> = {
  displayCity: {
    title: "Display city text",
    description:
      "Overrides the large city title at the bottom of the poster. Useful for i18n labels like native scripts.",
    previewLabel: "City title",
  },
  displayCountry: {
    title: "Display country text",
    description:
      "Overrides the country line under the city title. This has higher priority than Country Label Override.",
    previewLabel: "Country line",
  },
  countryLabel: {
    title: "Fallback country text",
    description:
      "Used when Display Country is empty. It updates the same country line under the main city title.",
    previewLabel: "Country fallback",
  },
  fontFamily: {
    title: "Typography family",
    description:
      "Downloads and applies a Google Font family to city, country, and coordinate labels in the final render.",
    previewLabel: "Typography block",
  },
};

const previewHintBoxes: Record<
  AdvancedHelpFieldKey,
  {
    className: string;
  }
> = {
  displayCity: {
    className:
      "left-[15%] top-[72%] h-[11%] w-[70%] border-amber-700/90 bg-amber-100/25",
  },
  displayCountry: {
    className:
      "left-[29%] top-[82%] h-[5%] w-[42%] border-sky-700/90 bg-sky-100/30",
  },
  countryLabel: {
    className:
      "left-[29%] top-[82%] h-[5%] w-[42%] border-emerald-700/90 bg-emerald-100/30",
  },
  fontFamily: {
    className:
      "left-[14%] top-[70%] h-[22%] w-[72%] border-cyan-700/90 bg-cyan-100/25",
  },
};

const schema = z
  .object({
    city: z.string().trim().min(1, "City is required"),
    country: z.string().trim().min(1, "Country is required"),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    countryLabel: z.string().optional(),
    displayCity: z.string().optional(),
    displayCountry: z.string().optional(),
    fontFamily: z.string().optional(),
    theme: z.string().min(1),
    allThemes: z.boolean(),
    includeWater: z.boolean(),
    includeParks: z.boolean(),
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
type PreviewResult = {
  previewUrl: string;
  cacheHit: boolean;
  expiresAt: string;
};

function isLikelyLatin(text: string): boolean {
  return /^[A-Za-z0-9\s'".,\-()]+$/.test(text);
}

function formatPreviewCity(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!isLikelyLatin(trimmed)) {
    return trimmed;
  }
  return trimmed.toUpperCase().split("").join(" ");
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

const distancePresets = [
  { label: "6km", value: 6000 },
  { label: "12km", value: 12000 },
  { label: "18km", value: 18000 },
];

const defaultValues: FormValues = {
  city: "Antwerp",
  country: "Belgium",
  latitude: "",
  longitude: "",
  countryLabel: "",
  displayCity: "",
  displayCountry: "",
  fontFamily: "",
  theme: "terracotta",
  allThemes: false,
  includeWater: true,
  includeParks: true,
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
    countryLabel: values.countryLabel?.trim() || undefined,
    displayCity: values.displayCity?.trim() || undefined,
    displayCountry: values.displayCountry?.trim() || undefined,
    fontFamily: values.fontFamily?.trim() || undefined,
    theme: values.theme,
    allThemes: values.allThemes,
    includeWater: values.includeWater,
    includeParks: values.includeParks,
    distance: values.distance,
    width: values.width,
    height: values.height,
    format: values.format,
  };
}

function extractErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Request failed.";
  }

  try {
    const parsed = JSON.parse(error.message) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
  } catch {
    // Keep original message when it is not JSON.
  }

  return error.message || "Request failed.";
}

export function PosterGenerator() {
  const isDevBuild = process.env.NODE_ENV !== "production";
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{
    cacheHit: boolean;
    expiresAt: string;
  } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(
    undefined,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [disablePreviewRateLimit, setDisablePreviewRateLimit] = useState(false);
  const [lastPreviewPlaceId, setLastPreviewPlaceId] = useState<string | null>(
    null,
  );
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSuggestion | null>(null);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [activePreviewHint, setActivePreviewHint] =
    useState<AdvancedHelpFieldKey | null>(null);
  const [locationQuery, setLocationQuery] = useState(
    `${defaultValues.city}, ${defaultValues.country}`,
  );
  const [debouncedLocationQuery, setDebouncedLocationQuery] =
    useState(locationQuery);
  const [locationAutocompleteOpen, setLocationAutocompleteOpen] =
    useState(false);
  const previewCacheRef = useRef<Record<string, PreviewResult>>({});
  const activePreviewRequestKeyRef = useRef<string | null>(null);

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

  const previewMutation = useMutation({
    mutationFn: ({
      payload,
      disableRateLimit,
    }: {
      payload: PosterRequest;
      disableRateLimit: boolean;
      requestKey: string;
    }) => fetchPreview(payload, { disableRateLimit }),
    onSuccess: (data, variables) => {
      if (activePreviewRequestKeyRef.current !== variables.requestKey) {
        return;
      }
      previewCacheRef.current[variables.requestKey] = data;
      setPreviewUrl(data.previewUrl);
      setPreviewInfo({ cacheHit: data.cacheHit, expiresAt: data.expiresAt });
      setPreviewError(null);
    },
    onError: (error, variables) => {
      if (activePreviewRequestKeyRef.current !== variables.requestKey) {
        return;
      }
      setPreviewError(extractErrorMessage(error));
    },
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
    const firstTheme = themesQuery.data?.[0];
    if (
      firstTheme &&
      !themesQuery.data?.some((theme) => theme.id === values.theme)
    ) {
      form.setValue("theme", firstTheme.id, { shouldValidate: true });
    }
  }, [form, themesQuery.data, values.theme]);

  useEffect(() => {
    if (!isDevBuild) {
      return;
    }
    const stored = window.localStorage.getItem("dev:disablePreviewRateLimit");
    setDisablePreviewRateLimit(stored === "1");
  }, [isDevBuild]);

  useEffect(() => {
    if (!isDevBuild) {
      return;
    }
    window.localStorage.setItem(
      "dev:disablePreviewRateLimit",
      disablePreviewRateLimit ? "1" : "0",
    );
  }, [disablePreviewRateLimit, isDevBuild]);

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
    if (
      previewMutation.isPending ||
      lastPreviewPlaceId === suggestion.placeId
    ) {
      return;
    }

    setLocationQuery(suggestion.displayName);
    setLocationAutocompleteOpen(false);
    setSelectedLocation(suggestion);
    form.setValue("city", suggestion.city, { shouldValidate: true });
    form.setValue("country", suggestion.country, { shouldValidate: true });
    form.setValue("latitude", suggestion.latitude, { shouldValidate: true });
    form.setValue("longitude", suggestion.longitude, { shouldValidate: true });

    setPreviewError(null);
    setLastPreviewPlaceId(suggestion.placeId);

    const requestKey = [
      suggestion.placeId,
      values.theme,
      values.distance,
      values.width,
      values.height,
    ].join("|");
    activePreviewRequestKeyRef.current = requestKey;

    const cached = previewCacheRef.current[requestKey];
    if (cached) {
      setPreviewUrl(cached.previewUrl);
      setPreviewInfo({
        cacheHit: cached.cacheHit,
        expiresAt: cached.expiresAt,
      });
      return;
    }

    previewMutation.mutate({
      payload: {
        city: suggestion.city,
        country: suggestion.country,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        countryLabel: values.countryLabel?.trim() || undefined,
        displayCity: values.displayCity?.trim() || undefined,
        displayCountry: values.displayCountry?.trim() || undefined,
        fontFamily: values.fontFamily?.trim() || undefined,
        theme: values.theme,
        allThemes: false,
        includeWater: true,
        includeParks: true,
        distance: values.distance,
        width: values.width,
        height: values.height,
        format: "png",
      },
      disableRateLimit: isDevBuild && disablePreviewRateLimit,
      requestKey,
    });
  }

  function handleThemeSelect(theme: Theme) {
    form.setValue("theme", theme.id, { shouldValidate: true });
    setThemeDialogOpen(false);
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

  useEffect(() => {
    if (!selectedLocation || !lastPreviewPlaceId) {
      return;
    }

    const requestKey = [
      selectedLocation.placeId,
      values.theme,
      values.distance,
      values.width,
      values.height,
    ].join("|");
    activePreviewRequestKeyRef.current = requestKey;

    const cached = previewCacheRef.current[requestKey];
    if (cached) {
      setPreviewUrl(cached.previewUrl);
      setPreviewInfo({
        cacheHit: cached.cacheHit,
        expiresAt: cached.expiresAt,
      });
      setPreviewError(null);
      return;
    }

    if (
      previewMutation.isPending &&
      activePreviewRequestKeyRef.current === requestKey
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      previewMutation.mutate({
        payload: {
          city: selectedLocation.city,
          country: selectedLocation.country,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          theme: values.theme,
          allThemes: false,
          includeWater: true,
          includeParks: true,
          distance: values.distance,
          width: values.width,
          height: values.height,
          format: "png",
        },
        disableRateLimit: isDevBuild && disablePreviewRateLimit,
        requestKey,
      });
    }, 320);

    return () => window.clearTimeout(timer);
  }, [
    disablePreviewRateLimit,
    isDevBuild,
    lastPreviewPlaceId,
    previewMutation.isPending,
    selectedLocation,
    values.distance,
    values.height,
    values.theme,
    values.width,
    previewMutation.mutate,
  ]);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const activeTheme = themesQuery.data?.find(
    (theme) => theme.id === values.theme,
  );
  const previewTextColor = activeTheme?.colors.text ?? "#8C4A18";
  const previewDisplayCity = formatPreviewCity(
    values.displayCity?.trim() || values.city || "",
  );
  const previewDisplayCountry = (
    values.displayCountry?.trim() ||
    values.countryLabel?.trim() ||
    values.country ||
    ""
  ).toUpperCase();
  const previewCoords = formatPreviewCoords(values.latitude, values.longitude);

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
                        setLastPreviewPlaceId(null);
                        setSelectedLocation(null);
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
                    <div className="flex items-center justify-between gap-3">
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
                              {themesQuery.data?.map((theme) => {
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
                                    <div className="relative aspect-[3/4] w-full bg-muted">
                                      <Image
                                        src={`/theme-previews/${theme.id}.svg`}
                                        alt={`${theme.name} preview`}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                      />
                                    </div>
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
                    <Label>Format</Label>
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

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="displayCity">
                                Display City (i18n label)
                              </Label>
                              <Popover
                                open={activePreviewHint === "displayCity"}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="Explain Display City"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-amber-700 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    {...getHintTriggerHandlers("displayCity")}
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
                                    {advancedFieldHelp.displayCity.title}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {advancedFieldHelp.displayCity.description}
                                  </p>
                                  <p className="mt-2 text-[11px] text-amber-700">
                                    Highlighting:{" "}
                                    {advancedFieldHelp.displayCity.previewLabel}
                                  </p>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <Input
                              id="displayCity"
                              placeholder="東京"
                              {...form.register("displayCity")}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="displayCountry">
                                Display Country (i18n label)
                              </Label>
                              <Popover
                                open={activePreviewHint === "displayCountry"}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="Explain Display Country"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-amber-700 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    {...getHintTriggerHandlers(
                                      "displayCountry",
                                    )}
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
                                    {advancedFieldHelp.displayCountry.title}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {
                                      advancedFieldHelp.displayCountry
                                        .description
                                    }
                                  </p>
                                  <p className="mt-2 text-[11px] text-amber-700">
                                    Highlighting:{" "}
                                    {
                                      advancedFieldHelp.displayCountry
                                        .previewLabel
                                    }
                                  </p>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <Input
                              id="displayCountry"
                              placeholder="日本"
                              {...form.register("displayCountry")}
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

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="countryLabel">
                              Country Label Override
                            </Label>
                            <Popover
                              open={activePreviewHint === "countryLabel"}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Explain Country Label Override"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-amber-700 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  {...getHintTriggerHandlers("countryLabel")}
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
                                  {advancedFieldHelp.countryLabel.title}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {advancedFieldHelp.countryLabel.description}
                                </p>
                                <p className="mt-2 text-[11px] text-amber-700">
                                  Highlighting:{" "}
                                  {advancedFieldHelp.countryLabel.previewLabel}
                                </p>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Input
                            id="countryLabel"
                            placeholder="FRANCE"
                            {...form.register("countryLabel")}
                          />
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
                                <p className="mt-2 text-[11px] text-amber-700">
                                  Highlighting:{" "}
                                  {advancedFieldHelp.fontFamily.previewLabel}
                                </p>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Input
                            id="fontFamily"
                            placeholder="Noto Sans JP"
                            {...form.register("fontFamily")}
                          />
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
                Map updates on location/theme, while text labels update
                instantly without new API renders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isDevBuild ? (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Disable preview rate limit
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Development only.
                    </p>
                  </div>
                  <Switch
                    checked={disablePreviewRateLimit}
                    onCheckedChange={(checked) => {
                      setDisablePreviewRateLimit(checked);
                      setPreviewError(null);
                    }}
                    aria-label="Disable preview rate limit for development"
                  />
                </div>
              ) : null}
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-gradient-to-b from-amber-50 to-orange-100">
                {previewMutation.isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/75">
                    <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Poster preview"
                    fill
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Select a location from autocomplete to render preview.
                  </div>
                )}
                {previewUrl ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0">
                    <div className="bg-gradient-to-t from-background/70 via-background/40 to-transparent px-4 pb-3 pt-16">
                      <div className="relative mx-auto w-[72%] text-center">
                        <p
                          className="font-heading text-[clamp(24px,6vw,58px)] font-bold leading-none tracking-[0.28em]"
                          style={{ color: previewTextColor }}
                        >
                          {previewDisplayCity}
                        </p>
                        <p
                          className="mt-1 text-[clamp(11px,2vw,25px)] leading-tight"
                          style={{ color: previewTextColor }}
                        >
                          {previewDisplayCountry}
                        </p>
                        <p
                          className="mt-1 text-[clamp(9px,1.5vw,15px)] opacity-80"
                          style={{ color: previewTextColor }}
                        >
                          {previewCoords}
                        </p>
                        <div
                          className="mx-auto mt-1 h-px w-24 opacity-70"
                          style={{ backgroundColor: previewTextColor }}
                        />
                      </div>
                    </div>
                    <p className="absolute bottom-1 right-2 text-[9px] text-muted-foreground/80">
                      © OpenStreetMap contributors
                    </p>
                  </div>
                ) : null}
                {activePreviewHint ? (
                  <div className="pointer-events-none absolute inset-0">
                    <div
                      className={[
                        "absolute rounded-md border-2 transition-all duration-150 ease-out",
                        previewHintBoxes[activePreviewHint].className,
                      ].join(" ")}
                    />
                    <span className="absolute right-2 top-2 rounded-md bg-background/85 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm">
                      {advancedFieldHelp[activePreviewHint].previewLabel}
                    </span>
                  </div>
                ) : null}
              </div>
              {previewInfo ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {previewInfo.cacheHit ? "Cached preview" : "Fresh render"} ·
                  expires {new Date(previewInfo.expiresAt).toLocaleString()}
                </p>
              ) : null}
              {previewError ? (
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {previewError}
                </p>
              ) : null}
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
