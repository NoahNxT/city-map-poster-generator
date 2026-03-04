"use client";

import { LoaderCircle, Palette } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Theme } from "@/lib/types";

type ThemeExplorerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closeLabel: string;
  browseThemesLabel: string;
  title: string;
  description: string;
  loadingPreviewLabel: string;
  previewUnavailableLabel: string;
  selectedLabel: string;
  themes?: Theme[];
  selectedThemeId: string;
  onThemeSelect: (theme: Theme) => void;
  triggerIcon?: ReactNode;
  showTrigger?: boolean;
};

const loadedPreviewSources = new Set<string>();
const previewWarmPromises = new Map<string, Promise<string>>();

function toThemePreviewThumbSrc(themeId: string): string {
  return `/theme-previews/thumbs/${themeId}.jpg`;
}

function toThemePreviewSvgSrc(themeId: string): string {
  return `/theme-previews/${themeId}.svg`;
}

async function warmImageSource(src: string): Promise<string> {
  if (loadedPreviewSources.has(src)) {
    return src;
  }
  const pendingWarm = previewWarmPromises.get(src);
  if (pendingWarm) {
    return pendingWarm;
  }
  const warmPromise = new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.loading = "eager";
    image.onload = () => {
      loadedPreviewSources.add(src);
      resolve(src);
    };
    image.onerror = () => {
      reject(new Error(`Failed to preload ${src}`));
    };
    image.src = src;
  }).finally(() => {
    previewWarmPromises.delete(src);
  });
  previewWarmPromises.set(src, warmPromise);
  return warmPromise;
}

async function warmThemePreview(themeId: string): Promise<string> {
  const thumbSrc = toThemePreviewThumbSrc(themeId);
  const svgSrc = toThemePreviewSvgSrc(themeId);
  try {
    return await warmImageSource(thumbSrc);
  } catch {
    return warmImageSource(svgSrc);
  }
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
  const thumbSrc = useMemo(() => toThemePreviewThumbSrc(themeId), [themeId]);
  const svgSrc = useMemo(() => toThemePreviewSvgSrc(themeId), [themeId]);
  const [src, setSrc] = useState(() => {
    if (loadedPreviewSources.has(thumbSrc)) {
      return thumbSrc;
    }
    if (loadedPreviewSources.has(svgSrc)) {
      return svgSrc;
    }
    return thumbSrc;
  });
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(() =>
    loadedPreviewSources.has(src) ? "loaded" : "loading",
  );

  useEffect(() => {
    let cancelled = false;
    if (loadedPreviewSources.has(src)) {
      setStatus("loaded");
      return () => {
        cancelled = true;
      };
    }
    setStatus("loading");
    void warmThemePreview(themeId)
      .then((nextSrc) => {
        if (cancelled) {
          return;
        }
        setSrc(nextSrc);
        setStatus("loaded");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [src, themeId]);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
      {status !== "loaded" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/80">
          <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">{loadingLabel}</p>
        </div>
      ) : null}
      <Image
        src={src}
        alt={`${themeName} preview`}
        fill
        priority={priority}
        sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 28vw"
        unoptimized
        className={
          status === "loaded"
            ? "object-cover opacity-100 transition-opacity duration-200"
            : "object-cover opacity-0 transition-opacity duration-200"
        }
        onLoad={() => {
          loadedPreviewSources.add(src);
          setStatus("loaded");
        }}
        onError={() => {
          if (src !== svgSrc) {
            setSrc(svgSrc);
            if (loadedPreviewSources.has(svgSrc)) {
              setStatus("loaded");
              return;
            }
            setStatus("loading");
            void warmImageSource(svgSrc)
              .then(() => {
                setStatus("loaded");
              })
              .catch(() => {
                setStatus("error");
              });
            return;
          }
          setStatus("error");
        }}
      />
      {status === "error" ? (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-sm bg-background/85 px-2 py-1 text-center text-[11px] text-muted-foreground">
          {unavailableLabel}
        </div>
      ) : null}
    </div>
  );
}

export function ThemeExplorerDialog({
  open,
  onOpenChange,
  closeLabel,
  browseThemesLabel,
  title,
  description,
  loadingPreviewLabel,
  previewUnavailableLabel,
  selectedLabel,
  themes,
  selectedThemeId,
  onThemeSelect,
  triggerIcon,
  showTrigger = true,
}: ThemeExplorerDialogProps) {
  const themeIds = useMemo(
    () => themes?.map((theme) => theme.id) ?? [],
    [themes],
  );

  useEffect(() => {
    if (themeIds.length === 0) {
      return;
    }
    let cancelled = false;
    const warm = () => {
      const firstBatch = themeIds.slice(0, 9);
      void Promise.all(
        firstBatch.map((themeId) => warmThemePreview(themeId)),
      ).catch(() => undefined);
      for (const themeId of themeIds.slice(9)) {
        if (cancelled) {
          return;
        }
        void warmThemePreview(themeId).catch(() => undefined);
      }
    };
    const requestIdle = window.requestIdleCallback?.bind(window);
    if (requestIdle) {
      const idleId = requestIdle(warm, { timeout: 1_200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }
    const timeoutId = setTimeout(warm, 240);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [themeIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
          >
            {triggerIcon}
            {browseThemesLabel}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent closeLabel={closeLabel}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-amber-700" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[68vh] overflow-y-auto px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes?.map((theme, index) => {
              const selected = selectedThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onThemeSelect(theme)}
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
                    loadingLabel={loadingPreviewLabel}
                    unavailableLabel={previewUnavailableLabel}
                    priority={index < 6}
                  />
                  <div className="space-y-2 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {theme.name}
                      </p>
                      {selected ? (
                        <Badge className="bg-amber-700/90 text-amber-50">
                          {selectedLabel}
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
  );
}
