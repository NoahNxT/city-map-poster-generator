import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const routes = ["/", "/privacy-policy", "/cookie-policy"];
  return locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${siteUrl}/${locale}${route === "/" ? "" : route}`,
      lastModified: now,
      changeFrequency: route === "/" ? "daily" : "weekly",
      priority: route === "/" ? 1 : 0.6,
    })),
  );
}
