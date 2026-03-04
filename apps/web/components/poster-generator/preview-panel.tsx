"use client";

import {
  AlertCircle,
  CheckCircle2,
  Download,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { HomeDictionary } from "@/lib/i18n/dictionaries";
import type { JobState } from "@/lib/types";

type StatusTone = "default" | "secondary" | "destructive";

type PreviewPanelProps = {
  dictionary: HomeDictionary;
  showDevRateLimitToggle: boolean;
  rendererMode: string;
  rendererReason: string;
  zoomToggleId: string;
  previewZoomEnabled: boolean;
  setPreviewZoomEnabled: (checked: boolean) => void;
  previewFrameId: string;
  zoomSliderId: string;
  previewZoomSliderValue: number;
  setPreviewZoomSliderValue: (value: number) => void;
  setPreviewZoomLevel: (value: number) => void;
  previewWidthInches: number;
  previewHeightInches: number;
  previewFrameMaxWidth: number;
  city: string;
  country: string;
  previewKeyboardHintId: string;
  previewFrameRef: RefObject<HTMLDivElement | null>;
  updatePreviewPointer: (clientX: number, clientY: number) => void;
  setPreviewPointer: (value: { x: number; y: number } | null) => void;
  handlePreviewFrameKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => void;
  previewUrl: string | null;
  isPreviewLoading: boolean;
  previewQueryIsError: boolean;
  localPreviewUrl: string | null;
  hasPreview: boolean;
  zoomLensLeft: number;
  zoomLensTop: number;
  zoomLensWidth: number;
  zoomLensHeight: number;
  previewZoomLevel: number;
  zoomViewX: number;
  zoomViewY: number;
  zoomViewWidth: number;
  zoomViewHeight: number;
  previewViewboxWidth: number;
  previewViewboxHeight: number;
  generationStatusTitleId: string;
  generationStatusLiveId: string;
  jobId: string | null;
  jobData?: JobState;
  jobIsFetching: boolean;
  statusTone: StatusTone;
  onDownload: () => void;
  downloadPending: boolean;
  downloadUrl: string | null;
  statusAnnouncement: string;
};

export function PreviewPanel({
  dictionary,
  showDevRateLimitToggle,
  rendererMode,
  rendererReason,
  zoomToggleId,
  previewZoomEnabled,
  setPreviewZoomEnabled,
  previewFrameId,
  zoomSliderId,
  previewZoomSliderValue,
  setPreviewZoomSliderValue,
  setPreviewZoomLevel,
  previewWidthInches,
  previewHeightInches,
  previewFrameMaxWidth,
  city,
  country,
  previewKeyboardHintId,
  previewFrameRef,
  updatePreviewPointer,
  setPreviewPointer,
  handlePreviewFrameKeyDown,
  previewUrl,
  isPreviewLoading,
  previewQueryIsError,
  localPreviewUrl,
  hasPreview,
  zoomLensLeft,
  zoomLensTop,
  zoomLensWidth,
  zoomLensHeight,
  previewZoomLevel,
  zoomViewX,
  zoomViewY,
  zoomViewWidth,
  zoomViewHeight,
  previewViewboxWidth,
  previewViewboxHeight,
  generationStatusTitleId,
  generationStatusLiveId,
  jobId,
  jobData,
  jobIsFetching,
  statusTone,
  onDownload,
  downloadPending,
  downloadUrl,
  statusAnnouncement,
}: PreviewPanelProps) {
  const d = dictionary;
  const showInFrameRefreshLoader = Boolean(previewUrl) && isPreviewLoading;

  return (
    <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
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
                        previewZoomSliderValue.toFixed(1),
                      )}
                    </span>
                  </div>
                  <Slider
                    id={zoomSliderId}
                    aria-label={d.preview.zoomLevel}
                    min={1.5}
                    max={6}
                    step={0.5}
                    value={[previewZoomSliderValue]}
                    onValueChange={(nextValue) =>
                      setPreviewZoomSliderValue(
                        nextValue[0] ?? previewZoomSliderValue,
                      )
                    }
                    onValueCommit={(nextValue) =>
                      setPreviewZoomLevel(
                        nextValue[0] ?? previewZoomSliderValue,
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
              className="group relative mx-auto w-full touch-none select-none overflow-hidden rounded-lg border bg-gradient-to-b from-amber-50 to-orange-100"
              style={{
                aspectRatio: `${previewWidthInches} / ${previewHeightInches}`,
                maxWidth: `${previewFrameMaxWidth}px`,
              }}
              tabIndex={previewZoomEnabled ? 0 : -1}
              aria-label={`${d.preview.title}: ${city}, ${country}`}
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
                        isPreviewLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"
                      }
                    />
                    <span>
                      {previewQueryIsError && !localPreviewUrl
                        ? d.themeExplorer.previewUnavailable
                        : d.themeExplorer.loadingPreview}
                    </span>
                  </div>
                </div>
              )}
              {showInFrameRefreshLoader ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between bg-background/30 backdrop-blur-[1px]">
                  <div className="flex h-full items-center justify-center">
                    <div className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/85 px-2.5 py-1.5 text-xs text-foreground shadow-sm">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      <span>{d.themeExplorer.loadingPreview}</span>
                    </div>
                  </div>
                  <div className="h-1 w-full bg-border/45">
                    <div className="h-full w-1/3 animate-pulse bg-amber-600/70" />
                  </div>
                </div>
              ) : null}
              {previewZoomEnabled && hasPreview ? (
                <div
                  className="pointer-events-none absolute z-20 rounded-sm border border-amber-700/80 bg-amber-200/10 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
                  style={{
                    left: `${zoomLensLeft}%`,
                    top: `${zoomLensTop}%`,
                    width: `${zoomLensWidth}%`,
                    height: `${zoomLensHeight}%`,
                  }}
                />
              ) : null}
              {previewZoomEnabled && hasPreview ? (
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
            {!hasPreview && previewQueryIsError ? (
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
              aria-busy={Boolean(jobId) && jobIsFetching}
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
                    {jobData?.status ?? d.status.queuedBadge}
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
                        {jobData?.progress ?? 0}%
                      </span>
                    </div>
                    <Progress value={jobData?.progress ?? 0} />
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {(jobData?.steps ?? []).slice(-4).map((step) => (
                        <li key={step}>• {step}</li>
                      ))}
                    </ul>
                    {jobData?.status === "failed" ? (
                      <p className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        {jobData.error ?? d.status.generationFailed}
                      </p>
                    ) : null}
                    {jobData?.status === "complete" ? (
                      <div className="space-y-2">
                        <p className="flex items-center gap-2 text-xs text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          {d.status.generationComplete}
                        </p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {jobData.artifacts.map((artifact) => (
                            <p key={artifact.key}>{artifact.fileName}</p>
                          ))}
                        </div>
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={onDownload}
                          disabled={downloadPending}
                        >
                          <Download className="h-4 w-4" />
                          {downloadPending
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
    </aside>
  );
}
