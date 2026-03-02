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

export async function fetchThemes(): Promise<Theme[]> {
  const response = await fetch(`${API_BASE}/v2/themes`, { cache: "no-store" });
  const payload = await parseResponse<{ themes: Theme[] }>(response);
  return payload.themes;
}

export async function fetchLocations(
  query: string,
  options?: {
    disableRateLimit?: boolean;
  },
): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "8",
  });
  const response = await fetch(
    `${API_BASE}/v2/locations?${params.toString()}`,
    {
      cache: "no-store",
      headers: options?.disableRateLimit
        ? { "x-dev-no-rate-limit": "1" }
        : undefined,
    },
  );
  const payload = await parseResponse<{ suggestions: LocationSuggestion[] }>(
    response,
  );
  return payload.suggestions;
}

export async function fetchFonts(
  query: string,
  options?: {
    disableRateLimit?: boolean;
  },
): Promise<FontSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "12",
  });
  const response = await fetch(`${API_BASE}/v2/fonts?${params.toString()}`, {
    cache: "no-store",
    headers: options?.disableRateLimit
      ? { "x-dev-no-rate-limit": "1" }
      : undefined,
  });
  const payload = await parseResponse<{ suggestions: FontSuggestion[] }>(
    response,
  );
  return payload.suggestions;
}

export async function fetchPreview(
  payload: PosterRequest,
  options?: {
    disableRateLimit?: boolean;
  },
): Promise<{ previewUrl: string; cacheHit: boolean; expiresAt: string }> {
  const response = await fetch(`${API_BASE}/v2/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.disableRateLimit ? { "x-dev-no-rate-limit": "1" } : {}),
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function createJob(
  payload: PosterRequest,
  captchaToken?: string,
  options?: {
    disableRateLimit?: boolean;
  },
): Promise<{ jobId: string; status: string; createdAt: string }> {
  const response = await fetch(`${API_BASE}/v2/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.disableRateLimit ? { "x-dev-no-rate-limit": "1" } : {}),
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
  const writer = ds.writable.getWriter();
  await writer.write(raw);
  await writer.close();
  const decompressed = await new Response(ds.readable).arrayBuffer();
  const text = new TextDecoder().decode(decompressed);
  return JSON.parse(text) as T;
}

export async function fetchRenderSnapshot(
  payload: RenderSnapshotRequest,
  options?: {
    disableRateLimit?: boolean;
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

export async function initExport(
  payload: ExportInitRequest,
  options?: {
    disableRateLimit?: boolean;
  },
): Promise<ExportInitResponse> {
  const response = await fetch(`${API_BASE}/v2/exports/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.disableRateLimit ? { "x-dev-no-rate-limit": "1" } : {}),
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
