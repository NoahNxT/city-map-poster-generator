import type {
  ExportCompleteUpload,
  ExportInitRequest,
  ExportInitResponse,
  ExportState,
  FontSuggestion,
  JobState,
  LocationSuggestion,
  PosterRequest,
  RenderSnapshotPayload,
  RenderSnapshotRequest,
  Theme,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const CLIENT_CACHE_PREFIX = "cmpg:api-cache:v1:";
const THEMES_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const LOCATIONS_CACHE_TTL_MS = 10 * 60 * 1000;
const FONTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FONT_BUNDLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type ClientCacheEntry<T> = {
  expiresAt: number;
  value: T;
  etag?: string;
};

const memoryCache = new Map<string, ClientCacheEntry<unknown>>();

function hasLocalStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function buildStorageKey(cacheKey: string): string {
  return `${CLIENT_CACHE_PREFIX}${cacheKey}`;
}

function readCacheEntry<T>(cacheKey: string): ClientCacheEntry<T> | null {
  const now = Date.now();
  const inMemory = memoryCache.get(cacheKey) as ClientCacheEntry<T> | undefined;
  if (inMemory) {
    if (inMemory.expiresAt > now) {
      return inMemory;
    }
    memoryCache.delete(cacheKey);
  }

  if (!hasLocalStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(cacheKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ClientCacheEntry<T>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now
    ) {
      window.localStorage.removeItem(buildStorageKey(cacheKey));
      return null;
    }
    memoryCache.set(cacheKey, parsed as ClientCacheEntry<unknown>);
    return parsed;
  } catch {
    return null;
  }
}

function writeCacheEntry<T>(
  cacheKey: string,
  value: T,
  ttlMs: number,
  etag?: string,
): void {
  const entry: ClientCacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
    etag,
  };
  memoryCache.set(cacheKey, entry as ClientCacheEntry<unknown>);
  if (!hasLocalStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(
      buildStorageKey(cacheKey),
      JSON.stringify(entry),
    );
  } catch {
    // Ignore storage quota errors.
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as {
        detail?: string;
        message?: string;
      };
      throw new Error(
        payload.detail ||
          payload.message ||
          `Request failed with status ${response.status}`,
      );
    }
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function fetchJSONWithClientCache<T>({
  cacheKey,
  ttlMs,
  url,
  requestInit,
  transform,
}: {
  cacheKey: string;
  ttlMs: number;
  url: string;
  requestInit?: RequestInit;
  transform?: (payload: T) => T;
}): Promise<T> {
  const cached = readCacheEntry<T>(cacheKey);
  const headers = new Headers(requestInit?.headers ?? {});
  if (cached?.etag) {
    headers.set("If-None-Match", cached.etag);
  }

  const response = await fetch(url, {
    ...requestInit,
    cache: "default",
    headers,
  });

  if (response.status === 304 && cached) {
    return cached.value;
  }

  const payload = await parseResponse<T>(response);
  const value = transform ? transform(payload) : payload;
  writeCacheEntry(
    cacheKey,
    value,
    ttlMs,
    response.headers.get("etag") ?? undefined,
  );
  return value;
}

export async function fetchThemes(): Promise<Theme[]> {
  const payload = await fetchJSONWithClientCache<{ themes: Theme[] }>({
    cacheKey: "themes",
    ttlMs: THEMES_CACHE_TTL_MS,
    url: `${API_BASE}/v2/themes`,
  });
  return payload.themes;
}

export async function fetchLocations(
  query: string,
  options?: {
    disableRateLimit?: boolean;
    signal?: AbortSignal;
  },
): Promise<LocationSuggestion[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    limit: "8",
  });
  const shouldCache = !options?.disableRateLimit;
  if (!shouldCache) {
    const response = await fetch(
      `${API_BASE}/v2/locations?${params.toString()}`,
      {
        headers: { "x-dev-no-rate-limit": "1" },
        signal: options?.signal,
      },
    );
    const payload = await parseResponse<{ suggestions: LocationSuggestion[] }>(
      response,
    );
    return payload.suggestions;
  }
  const payload = await fetchJSONWithClientCache<{
    suggestions: LocationSuggestion[];
  }>({
    cacheKey: `locations:${normalizedQuery}`,
    ttlMs: LOCATIONS_CACHE_TTL_MS,
    url: `${API_BASE}/v2/locations?${params.toString()}`,
    requestInit: options?.signal ? { signal: options.signal } : undefined,
  });
  return payload.suggestions;
}

export async function fetchFonts(
  query: string,
  options?: {
    disableRateLimit?: boolean;
    signal?: AbortSignal;
  },
): Promise<FontSuggestion[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const params = new URLSearchParams({
    q: query,
    limit: "12",
  });
  const shouldCache = !options?.disableRateLimit;
  if (!shouldCache) {
    const response = await fetch(`${API_BASE}/v2/fonts?${params.toString()}`, {
      headers: { "x-dev-no-rate-limit": "1" },
      signal: options?.signal,
    });
    const payload = await parseResponse<{ suggestions: FontSuggestion[] }>(
      response,
    );
    return payload.suggestions;
  }
  const payload = await fetchJSONWithClientCache<{
    suggestions: FontSuggestion[];
  }>({
    cacheKey: `fonts:${normalizedQuery}`,
    ttlMs: FONTS_CACHE_TTL_MS,
    url: `${API_BASE}/v2/fonts?${params.toString()}`,
    requestInit: options?.signal ? { signal: options.signal } : undefined,
  });
  return payload.suggestions;
}

export async function fetchPreview(
  payload: PosterRequest,
  options?: {
    disableRateLimit?: boolean;
    signal?: AbortSignal;
  },
): Promise<{ previewUrl: string; cacheHit: boolean; expiresAt: string }> {
  const response = await fetch(`${API_BASE}/v2/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.disableRateLimit ? { "x-dev-no-rate-limit": "1" } : {}),
    },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  return parseResponse(response);
}

export async function createJob(
  payload: PosterRequest,
  captchaToken?: string,
  options?: {
    disableRateLimit?: boolean;
    disableCaptchaCheck?: boolean;
  },
): Promise<{ jobId: string; status: string; createdAt: string }> {
  const response = await fetch(`${API_BASE}/v2/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.disableRateLimit ? { "x-dev-no-rate-limit": "1" } : {}),
      ...(options?.disableCaptchaCheck ? { "x-dev-no-captcha": "1" } : {}),
    },
    body: JSON.stringify({ payload, captchaToken }),
  });
  return parseResponse(response);
}

export async function fetchJob(jobId: string): Promise<JobState> {
  const response = await fetch(`${API_BASE}/v2/jobs/${jobId}`, {
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function fetchDownload(
  jobId: string,
): Promise<{ url: string; expiresAt: string }> {
  const response = await fetch(`${API_BASE}/v2/jobs/${jobId}/download`, {
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function fetchApiHealth(): Promise<{
  status: string;
  service: string;
  time: string;
}> {
  const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  return parseResponse(response);
}

async function parseGzipJSON<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Gzip decompression is not supported in this browser");
  }
  const raw = await response.arrayBuffer();
  const ds = new DecompressionStream("gzip");
  // Start reading before writing to avoid stream backpressure deadlocks.
  const readPromise = new Response(ds.readable).arrayBuffer();
  const writer = ds.writable.getWriter();
  await writer.write(new Uint8Array(raw));
  await writer.close();
  const decompressed = await readPromise;
  const text = new TextDecoder().decode(decompressed);
  return JSON.parse(text) as T;
}

export async function fetchRenderSnapshot(
  payload: RenderSnapshotRequest,
  options?: {
    disableRateLimit?: boolean;
    signal?: AbortSignal;
  },
): Promise<RenderSnapshotPayload> {
  const headers = {
    "Content-Type": "application/json",
    ...(options?.disableRateLimit ? { "x-dev-no-rate-limit": "1" } : {}),
  };

  const response = await fetch(`${API_BASE}/v2/render/snapshot`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: options?.signal,
  });
  if (!response.ok) {
    return parseResponse<RenderSnapshotPayload>(response);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return parseResponse<RenderSnapshotPayload>(response);
  }

  try {
    return await parseGzipJSON<RenderSnapshotPayload>(response);
  } catch {
    const jsonResponse = await fetch(
      `${API_BASE}/v2/render/snapshot?encoding=json`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: options?.signal,
      },
    );
    return parseResponse<RenderSnapshotPayload>(jsonResponse);
  }
}

export async function fetchFontBundle(
  family: string,
  weights = "300,400,700",
): Promise<ArrayBuffer> {
  const encodedFamily = encodeURIComponent(family.trim());
  const params = new URLSearchParams({ weights });
  const response = await fetch(
    `${API_BASE}/v2/fonts/${encodedFamily}/bundle?${params.toString()}`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Font bundle request failed with status ${response.status}`,
    );
  }
  return response.arrayBuffer();
}

export type FontBundleData = {
  family: string;
  weights: string[];
  files: Record<string, string>;
};

export async function fetchFontBundleData(
  family: string,
  weights = "300,400,700",
): Promise<FontBundleData> {
  const normalizedFamily = family.trim();
  const encodedFamily = encodeURIComponent(normalizedFamily);
  const params = new URLSearchParams({ weights, encoding: "json" });
  return fetchJSONWithClientCache<FontBundleData>({
    cacheKey: `font-bundle:${normalizedFamily.toLowerCase()}:${weights}`,
    ttlMs: FONT_BUNDLE_CACHE_TTL_MS,
    url: `${API_BASE}/v2/fonts/${encodedFamily}/bundle?${params.toString()}`,
  });
}

export async function initExport(
  payload: ExportInitRequest,
  options?: {
    disableRateLimit?: boolean;
    disableCaptchaCheck?: boolean;
  },
): Promise<ExportInitResponse> {
  const response = await fetch(`${API_BASE}/v2/exports/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.disableRateLimit ? { "x-dev-no-rate-limit": "1" } : {}),
      ...(options?.disableCaptchaCheck ? { "x-dev-no-captcha": "1" } : {}),
    },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function uploadExportArtifact(
  uploadUrl: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: bytes,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      body || `Export upload failed with status ${response.status}`,
    );
  }
}

export async function completeExport(
  exportId: string,
  uploads: ExportCompleteUpload[],
  downloadKey: string,
): Promise<ExportState> {
  const response = await fetch(`${API_BASE}/v2/exports/${exportId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uploads, downloadKey }),
  });
  return parseResponse(response);
}

export async function fetchExport(exportId: string): Promise<ExportState> {
  const response = await fetch(`${API_BASE}/v2/exports/${exportId}`, {
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function fetchExportDownload(
  exportId: string,
): Promise<{ url: string; expiresAt: string }> {
  const response = await fetch(`${API_BASE}/v2/exports/${exportId}/download`, {
    cache: "no-store",
  });
  return parseResponse(response);
}
