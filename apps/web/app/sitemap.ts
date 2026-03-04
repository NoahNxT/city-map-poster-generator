import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/site";

function resolveLastModifiedDate(): Date {
  const explicitISO =
    process.env.SITEMAP_LAST_MODIFIED?.trim() ||
    process.env.NEXT_PUBLIC_SITEMAP_LAST_MODIFIED?.trim();
  if (explicitISO) {
    const parsed = new Date(explicitISO);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH?.trim();
  if (sourceDateEpoch) {
    const seconds = Number(sourceDateEpoch);
    if (Number.isFinite(seconds) && seconds > 0) {
      return new Date(seconds * 1000);
    }
  }

  return new Date("2025-01-01T00:00:00.000Z");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = resolveLastModifiedDate();

  const routes = ["/", "/privacy-policy", "/cookie-policy"];
  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${siteUrl}/${locale}${route === "/" ? "" : route}`,
      lastModified,
      changeFrequency: route === "/" ? "daily" : "weekly",
      priority: route === "/" ? 1 : 0.6,
    })),
  );
}
