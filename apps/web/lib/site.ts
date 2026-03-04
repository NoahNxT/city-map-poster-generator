const DEFAULT_SITE_URL = "http://localhost:3000";
const PROHIBITED_PRODUCTION_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function getSiteUrl(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    if (isProduction) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL must be set to a public HTTPS origin in production.",
      );
    }
    return DEFAULT_SITE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    if (isProduction) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is invalid. Use an absolute URL, for example https://example.com.",
      );
    }
    return DEFAULT_SITE_URL;
  }

  if (isProduction && PROHIBITED_PRODUCTION_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL cannot use localhost in production (received ${parsed.hostname}).`,
    );
  }

  return parsed.toString().replace(/\/$/, "");
}
