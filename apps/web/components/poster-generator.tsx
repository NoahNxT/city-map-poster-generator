"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  LoaderCircle,
  MapIcon,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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
import type { LocationSuggestion, PosterRequest } from "@/lib/types";
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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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

const distancePresets = [
  { label: "6km", value: 6000 },
  { label: "12km", value: 12000 },
  { label: "18km", value: 18000 },
];

const defaultValues: FormValues = {
  city: "Paris",
  country: "France",
  latitude: "",
  longitude: "",
  countryLabel: "",
  displayCity: "",
  displayCountry: "",
  fontFamily: "",
  theme: "terracotta",
  allThemes: false,
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
  const [locationQuery, setLocationQuery] = useState(
    `${defaultValues.city}, ${defaultValues.country}`,
  );
  const [debouncedLocationQuery, setDebouncedLocationQuery] =
    useState(locationQuery);
  const [locationAutocompleteOpen, setLocationAutocompleteOpen] =
    useState(false);

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
    }) => fetchPreview(payload, { disableRateLimit }),
    onSuccess: (data) => {
      setPreviewUrl(data.previewUrl);
      setPreviewInfo({ cacheHit: data.cacheHit, expiresAt: data.expiresAt });
      setPreviewError(null);
    },
    onError: (error) => {
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
    form.setValue("city", suggestion.city, { shouldValidate: true });
    form.setValue("country", suggestion.country, { shouldValidate: true });
    form.setValue("latitude", suggestion.latitude, { shouldValidate: true });
    form.setValue("longitude", suggestion.longitude, { shouldValidate: true });

    setPreviewError(null);
    setLastPreviewPlaceId(suggestion.placeId);

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
        distance: values.distance,
        width: values.width,
        height: values.height,
        format: "png",
      },
      disableRateLimit: isDevBuild && disablePreviewRateLimit,
    });
  }

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
                    <Label>Theme</Label>
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
                            <Label htmlFor="displayCity">
                              Display City (i18n label)
                            </Label>
                            <Input
                              id="displayCity"
                              placeholder="東京"
                              {...form.register("displayCity")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="displayCountry">
                              Display Country (i18n label)
                            </Label>
                            <Input
                              id="displayCountry"
                              placeholder="日本"
                              {...form.register("displayCountry")}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="countryLabel">
                            Country Label Override
                          </Label>
                          <Input
                            id="countryLabel"
                            placeholder="FRANCE"
                            {...form.register("countryLabel")}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="fontFamily">Google Font Family</Label>
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
                Preview runs when a location is selected from autocomplete.
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
