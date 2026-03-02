/// <reference lib="webworker" />

import type {
  PosterRequest,
  RenderSnapshotPayload,
  SnapshotWay,
  Theme,
} from "@/lib/types";

type RenderMessage = {
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

type DisposeMessage = {
  type: "dispose";
  id: string;
};

type WorkerMessage = RenderMessage | DisposeMessage;

type WorkerSuccess = {
  type: "rendered";
  id: string;
  dataUrl: string;
};

type WorkerError = {
  type: "error";
  id: string;
  message: string;
};

const DEFAULT_BG = "#F5EDE4";
const DEFAULT_TEXT = "#8B4513";
const DEFAULT_WATER = "#A8C4C4";
const DEFAULT_PARKS = "#E8E0D0";
const loadedFontFamilies = new Map<string, Promise<void>>();

type WorkerFontFace = {
  load: () => Promise<WorkerFontFace>;
};

type WorkerFontScope = {
  FontFace?: new (
    family: string,
    source: ArrayBuffer,
    descriptors?: { weight?: string; style?: string },
  ) => WorkerFontFace;
  fonts?: {
    add: (font: WorkerFontFace) => void;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function axisToCanvasY(axisY: number, canvasHeight: number): number {
  return (1 - axisY) * canvasHeight;
}

function formatCoords(lat: number, lon: number): string {
  const latHem = lat < 0 ? "S" : "N";
  const lonHem = lon < 0 ? "W" : "E";
  return `${Math.abs(lat).toFixed(4)}° ${latHem} / ${Math.abs(lon).toFixed(4)}° ${lonHem}`;
}

function isLikelyLatin(input: string): boolean {
  for (const char of input) {
    if (
      (char >= "A" && char <= "Z") ||
      (char >= "a" && char <= "z") ||
      (char >= "0" && char <= "9") ||
      ` '"".,-()`.includes(char)
    ) {
      continue;
    }
    return false;
  }
  return true;
}

function hexToRgba(hex: string, alpha: number): string {
  const trimmed = hex.trim().replace("#", "");
  const normalized =
    trimmed.length === 3
      ? `${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`
      : trimmed;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${Number.isFinite(r) ? r : 0}, ${Number.isFinite(g) ? g : 0}, ${Number.isFinite(b) ? b : 0}, ${clamp(alpha, 0, 1)})`;
}

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function ensureWorkerFonts(
  fontBundle: RenderMessage["fontBundle"],
): Promise<void> {
  if (!fontBundle) {
    return;
  }
  const family = fontBundle.family.trim();
  if (!family) {
    return;
  }

  const workerScope = self as unknown as WorkerFontScope;
  const FontFaceCtor = workerScope.FontFace;
  const fontSet = workerScope.fonts;
  if (!FontFaceCtor || !fontSet) {
    return;
  }

  const cacheKey = family.toLowerCase();
  const existing = loadedFontFamilies.get(cacheKey);
  if (existing) {
    await existing;
    return;
  }

  const loadPromise = (async () => {
    const files = fontBundle.files ?? {};
    const regular = files["400"] ?? "";
    for (const weight of ["300", "400", "700"]) {
      const encoded = files[weight] ?? regular;
      if (!encoded) {
        continue;
      }
      const face = new FontFaceCtor(family, decodeBase64(encoded), {
        weight,
        style: "normal",
      });
      const loaded = await face.load();
      fontSet.add(loaded);
    }
  })();

  loadedFontFamilies.set(cacheKey, loadPromise);
  try {
    await loadPromise;
  } catch (error) {
    loadedFontFamilies.delete(cacheKey);
    throw error;
  }
}

function projectNodes(
  snapshot: RenderSnapshotPayload,
  targetAspect: number,
): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  const centerLat = snapshot.resolvedLat;
  const centerLon = snapshot.resolvedLon;
  const distanceMeters = snapshot.distance;
  let aspect = targetAspect;
  if (aspect <= 0) {
    aspect = 1;
  }

  let halfHeightMeters = distanceMeters;
  let halfWidthMeters = distanceMeters;
  if (aspect >= 1) {
    halfHeightMeters /= aspect;
  } else {
    halfWidthMeters *= aspect;
  }
  const metersPerDegreeLat = 111_320;
  let latScale = Math.cos((centerLat * Math.PI) / 180);
  if (Math.abs(latScale) < 0.0001) {
    latScale = 0.0001;
  }
  const halfLat = halfHeightMeters / metersPerDegreeLat;
  const halfLon = halfWidthMeters / (metersPerDegreeLat * latScale);
  const minLon = centerLon - halfLon;
  const maxLon = centerLon + halfLon;
  const minLat = centerLat - halfLat;
  const maxLat = centerLat + halfLat;
  const spanLon = Math.max(maxLon - minLon, 1e-6);
  const spanLat = Math.max(maxLat - minLat, 1e-6);

  for (const node of snapshot.nodes) {
    const nx = (node.lon - minLon) / spanLon;
    const ny = (node.lat - minLat) / spanLat;
    out.set(node.id, { x: nx, y: 1 - ny });
  }
  return out;
}

function roadColor(theme: Theme, highway: string): string {
  const colors = theme.colors ?? {};
  switch (highway) {
    case "motorway":
    case "motorway_link":
      return colors.road_motorway ?? "#A0522D";
    case "trunk":
    case "trunk_link":
    case "primary":
    case "primary_link":
      return colors.road_primary ?? "#B8653A";
    case "secondary":
    case "secondary_link":
      return colors.road_secondary ?? "#C9846A";
    case "tertiary":
    case "tertiary_link":
    case "unclassified":
      return colors.road_tertiary ?? "#D9A08A";
    case "residential":
    case "living_street":
    case "service":
      return colors.road_residential ?? "#E5C4B0";
    default:
      return colors.road_default ?? "#D9A08A";
  }
}

function roadWidth(highway: string, scaleFactor: number): number {
  let base = 0.9;
  switch (highway) {
    case "motorway":
    case "motorway_link":
      base = 2.3;
      break;
    case "trunk":
    case "trunk_link":
    case "primary":
    case "primary_link":
      base = 1.8;
      break;
    case "secondary":
    case "secondary_link":
      base = 1.4;
      break;
    case "tertiary":
    case "tertiary_link":
    case "unclassified":
      base = 1.1;
      break;
    case "residential":
    case "living_street":
    case "service":
      base = 0.8;
      break;
    default:
      break;
  }
  return Math.max(0.2, base * scaleFactor * 0.75);
}

function drawWayLine(
  ctx: OffscreenCanvasRenderingContext2D,
  way: SnapshotWay,
  projected: Map<number, { x: number; y: number }>,
  width: number,
  height: number,
): void {
  let started = false;
  ctx.beginPath();
  for (const nodeId of way.nodes) {
    const point = projected.get(nodeId);
    if (!point) continue;
    const x = point.x * width;
    const y = point.y * height;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (started) {
    ctx.stroke();
  }
}

function drawWayPolygon(
  ctx: OffscreenCanvasRenderingContext2D,
  way: SnapshotWay,
  projected: Map<number, { x: number; y: number }>,
  width: number,
  height: number,
): void {
  if (
    way.nodes.length < 3 ||
    way.nodes[0] !== way.nodes[way.nodes.length - 1]
  ) {
    return;
  }
  let started = false;
  ctx.beginPath();
  for (const nodeId of way.nodes) {
    const point = projected.get(nodeId);
    if (!point) continue;
    const x = point.x * width;
    const y = point.y * height;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (started) {
    ctx.closePath();
    ctx.fill();
  }
}

type LabelSpec = {
  color: string;
  displayCity: string;
  displayCountry: string;
  coords: string;
  cityY: number;
  countryY: number;
  coordsY: number;
  dividerY: number;
  citySizePx: number;
  countrySizePx: number;
  coordsSizePx: number;
  dividerWidthPx: number;
  attrSizePx: number;
  blur: null | {
    panelX: number;
    panelY: number;
    panelW: number;
    panelH: number;
    cornerRadius: number;
    layers: number;
    edgeAlpha: number;
    coreAlpha: number;
    blurSize: number;
  };
};

function computeLabelSpec(
  payload: PosterRequest,
  theme: Theme,
  height: number,
  lat: number,
  lon: number,
): LabelSpec {
  const themeText = theme.colors?.text ?? DEFAULT_TEXT;
  const color = payload.textColor?.trim() || themeText;

  const scaleFactor = Math.min(payload.width, payload.height) / 12;
  const baseMain = 60;
  const baseSub = 22;
  const baseCoords = 14;

  const cityRaw = payload.city.trim();
  let displayCity = cityRaw;
  if (isLikelyLatin(displayCity)) {
    displayCity = Array.from(displayCity.toUpperCase()).join("  ");
  }
  const displayCountry = payload.country.trim().toUpperCase();
  let citySize = (payload.cityFontSize ?? baseMain) * scaleFactor;
  if (!payload.cityFontSize && cityRaw.length > 10) {
    citySize = Math.max(citySize * (10 / cityRaw.length), 10 * scaleFactor);
  }
  const countrySize = (payload.countryFontSize ?? baseSub) * scaleFactor;
  const coordsSize = baseCoords * scaleFactor;
  const attrSize = Math.max(4, 5 * scaleFactor);
  const dynamicGapScale = Math.max(
    Math.max(
      citySize / Math.max(baseMain * scaleFactor, 1e-6),
      countrySize / Math.max(baseSub * scaleFactor, 1e-6),
    ),
    1,
  );
  const gap = 0.0036 * payload.labelPaddingScale * dynamicGapScale;

  const pointToAxis = 1 / (payload.height * 72);
  const cityAscent = citySize * 0.74 * pointToAxis;
  const cityDesc = citySize * 0.26 * pointToAxis;
  const countryAscent = countrySize * 0.72 * pointToAxis;
  const countryDesc = countrySize * 0.28 * pointToAxis;
  const coordsAscent = coordsSize * 0.7 * pointToAxis;
  const coordsDesc = coordsSize * 0.3 * pointToAxis;

  let coordsY = 0.058;
  let countryY = coordsY + coordsAscent + countryDesc + gap;
  let dividerY = countryY + countryAscent + gap;
  let cityY = dividerY + cityDesc + gap;

  const top = cityY + cityAscent;
  if (top > 0.34) {
    const shift = top - 0.34;
    coordsY -= shift;
    countryY -= shift;
    dividerY -= shift;
    cityY -= shift;
  }
  const bottom = coordsY - coordsDesc;
  if (bottom < 0.038) {
    const shift = 0.038 - bottom;
    coordsY += shift;
    countryY += shift;
    dividerY += shift;
    cityY += shift;
  }

  let blur: LabelSpec["blur"] = null;
  if (payload.textBlurEnabled) {
    const blurSize = clamp(payload.textBlurSize, 0.6, 2.5);
    const blurStrength = clamp(payload.textBlurStrength, 0, 30);
    const blurScale = clamp(blurStrength / 30, 0, 1);
    const cityRuneCount = Math.max(Array.from(cityRaw).length, 4);
    const sizeScale = clamp(
      citySize / Math.max(baseMain * scaleFactor, 1e-6),
      0.7,
      2.2,
    );
    const textWidthEstimate = clamp(
      0.34 + cityRuneCount * 0.018 * sizeScale,
      0.42,
      0.9,
    );
    const panelW = clamp(textWidthEstimate + 0.1 * blurSize, 0.44, 0.94);
    const blurMargin = gap * 1.7;
    const blockBottom = coordsY - coordsDesc - blurMargin;
    const blockTop = cityY + cityAscent + blurMargin;
    const panelH = clamp(blockTop - blockBottom + 0.045 * blurSize, 0.12, 0.42);
    const centerY = (blockTop + blockBottom) / 2;
    blur = {
      panelX: 0.5 - panelW / 2,
      panelY: clamp(centerY - panelH / 2, 0.01, 1 - panelH - 0.01),
      panelW,
      panelH,
      cornerRadius: 0.026 * blurSize,
      layers: Math.max(6, Math.round(10 + blurScale * 12)),
      edgeAlpha: 0.18 + 0.32 * blurScale,
      coreAlpha: 0.42 + 0.4 * blurScale,
      blurSize,
    };
  }

  return {
    color,
    displayCity,
    displayCountry,
    coords: formatCoords(lat, lon),
    cityY,
    countryY,
    coordsY,
    dividerY,
    citySizePx: citySize * (height / (payload.height * 72)),
    countrySizePx: countrySize * (height / (payload.height * 72)),
    coordsSizePx: coordsSize * (height / (payload.height * 72)),
    dividerWidthPx:
      Math.max(1.1, 1.9 * scaleFactor) * (height / (payload.height * 72)),
    attrSizePx: attrSize * (height / (payload.height * 72)),
    blur,
  };
}

function drawLabelBlock(
  ctx: OffscreenCanvasRenderingContext2D,
  labels: LabelSpec,
  theme: Theme,
  width: number,
  height: number,
  fontFamily: string,
): void {
  if (labels.blur) {
    const fill = hexToRgba(theme.colors?.bg ?? DEFAULT_BG, 1);
    for (let layer = labels.blur.layers; layer > 0; layer -= 1) {
      const t = layer / labels.blur.layers;
      const spread = (1 - t) * (0.06 * labels.blur.blurSize);
      const alpha = (labels.blur.edgeAlpha * (t * t)) / labels.blur.layers;
      const x = (labels.blur.panelX - spread) * width;
      const y = axisToCanvasY(
        labels.blur.panelY + labels.blur.panelH + spread,
        height,
      );
      const w = (labels.blur.panelW + spread * 2) * width;
      const h = (labels.blur.panelH + spread * 2) * height;
      const r = (labels.blur.cornerRadius + spread) * Math.min(width, height);
      ctx.fillStyle = fill.replace("1)", `${clamp(alpha, 0, 1)})`);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }
    {
      const x = labels.blur.panelX * width;
      const y = axisToCanvasY(labels.blur.panelY + labels.blur.panelH, height);
      const w = labels.blur.panelW * width;
      const h = labels.blur.panelH * height;
      const r = labels.blur.cornerRadius * Math.min(width, height);
      ctx.fillStyle = fill.replace(
        "1)",
        `${clamp(labels.blur.coreAlpha, 0, 1)})`,
      );
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }
  }

  const defaultFamily = fontFamily.trim() || "Roboto";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = labels.color;
  ctx.font = `700 ${labels.citySizePx}px "${defaultFamily}", sans-serif`;
  ctx.fillText(
    labels.displayCity,
    width * 0.5,
    axisToCanvasY(labels.cityY, height),
  );

  ctx.font = `300 ${labels.countrySizePx}px "${defaultFamily}", sans-serif`;
  ctx.fillText(
    labels.displayCountry,
    width * 0.5,
    axisToCanvasY(labels.countryY, height),
  );

  ctx.fillStyle = hexToRgba(labels.color, 0.72);
  ctx.font = `400 ${labels.coordsSizePx}px "${defaultFamily}", sans-serif`;
  ctx.fillText(
    labels.coords,
    width * 0.5,
    axisToCanvasY(labels.coordsY, height),
  );

  const dividerY = axisToCanvasY(labels.dividerY, height);
  ctx.lineCap = "round";
  ctx.strokeStyle = hexToRgba(theme.colors?.bg ?? DEFAULT_BG, 0.82);
  ctx.lineWidth = labels.dividerWidthPx * 2.2;
  ctx.beginPath();
  ctx.moveTo(width * 0.4, dividerY);
  ctx.lineTo(width * 0.6, dividerY);
  ctx.stroke();

  ctx.strokeStyle = hexToRgba(labels.color, 0.95);
  ctx.lineWidth = Math.max(0.9, labels.dividerWidthPx);
  ctx.beginPath();
  ctx.moveTo(width * 0.4, dividerY);
  ctx.lineTo(width * 0.6, dividerY);
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = hexToRgba(labels.color, 0.35);
  ctx.font = `300 ${labels.attrSizePx}px "${defaultFamily}", sans-serif`;
  ctx.fillText(
    "© OpenStreetMap contributors",
    width * 0.995,
    axisToCanvasY(0.006, height),
  );
}

function drawGradient(
  ctx: OffscreenCanvasRenderingContext2D,
  color: string,
  width: number,
  height: number,
): void {
  for (let i = 0; i < 90; i += 1) {
    const t = i / 90;
    const alpha = (1 - t) * 0.3;
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.fillRect(0, height - (i + 1), width, 1);
    ctx.fillRect(0, i, width, 1);
  }
}

async function renderToDataUrl(
  payload: PosterRequest,
  snapshot: RenderSnapshotPayload,
  theme: Theme,
  pixelWidth: number,
  pixelHeight: number,
  fontBundle: RenderMessage["fontBundle"],
): Promise<string> {
  const canvas = new OffscreenCanvas(pixelWidth, pixelHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Cannot acquire 2D context");
  }

  const colors = theme.colors ?? {};
  const bg = colors.bg ?? DEFAULT_BG;
  const waterColor = colors.water ?? DEFAULT_WATER;
  const parksColor = colors.parks ?? DEFAULT_PARKS;
  const gradientColor = colors.gradient_color ?? bg;

  try {
    await ensureWorkerFonts(fontBundle);
  } catch {
    // Keep rendering with fallback fonts when custom font loading fails.
  }

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  const projected = projectNodes(snapshot, pixelWidth / pixelHeight);

  if (payload.includeWater) {
    ctx.fillStyle = waterColor;
    for (const way of snapshot.water) {
      drawWayPolygon(ctx, way, projected, pixelWidth, pixelHeight);
    }
  }
  if (payload.includeParks) {
    ctx.fillStyle = parksColor;
    for (const way of snapshot.parks) {
      drawWayPolygon(ctx, way, projected, pixelWidth, pixelHeight);
    }
  }

  const scaleFactor = Math.min(payload.width, payload.height) / 12;
  for (const way of snapshot.roads) {
    const highway = way.tags?.highway ?? "";
    ctx.strokeStyle = roadColor(theme, highway);
    ctx.lineWidth = roadWidth(highway, scaleFactor);
    drawWayLine(ctx, way, projected, pixelWidth, pixelHeight);
  }

  drawGradient(ctx, gradientColor, pixelWidth, pixelHeight);
  const labels = computeLabelSpec(
    payload,
    theme,
    pixelHeight,
    snapshot.resolvedLat,
    snapshot.resolvedLon,
  );
  drawLabelBlock(
    ctx,
    labels,
    theme,
    pixelWidth,
    pixelHeight,
    payload.fontFamily ?? "",
  );

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === "dispose") {
    const success: WorkerSuccess = {
      type: "rendered",
      id: message.id,
      dataUrl: "",
    };
    self.postMessage(success);
    return;
  }

  try {
    const dataUrl = await renderToDataUrl(
      message.payload,
      message.snapshot,
      message.theme,
      Math.max(200, Math.round(message.pixelWidth)),
      Math.max(200, Math.round(message.pixelHeight)),
      message.fontBundle,
    );
    const response: WorkerSuccess = {
      type: "rendered",
      id: message.id,
      dataUrl,
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerError = {
      type: "error",
      id: message.id,
      message:
        error instanceof Error ? error.message : "Renderer worker failed",
    };
    self.postMessage(response);
  }
};
