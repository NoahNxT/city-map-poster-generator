import type {
  FontSuggestion,
  JobState,
  LocationSuggestion,
  PosterRequest,
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
