export const locales = ["en", "nl", "fr", "de", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
};

export const LOCALE_COOKIE_NAME = "site_locale";
export const COOKIE_CONSENT_COOKIE_NAME = "site_cookie_consent";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

function normalizeLanguageTag(languageTag: string): string {
  return languageTag.toLowerCase().split("-")[0] ?? "";
}

export function localeFromAcceptLanguage(
  acceptLanguageHeader: string | null,
): Locale {
  if (!acceptLanguageHeader) {
    return defaultLocale;
  }

  const candidates = acceptLanguageHeader
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [tag, qualityRaw] = item.split(";q=");
      const quality = qualityRaw ? Number.parseFloat(qualityRaw) : 1;
      return {
        locale: normalizeLanguageTag(tag ?? ""),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const candidate of candidates) {
    if (isLocale(candidate.locale)) {
      return candidate.locale;
    }
  }

  return defaultLocale;
}
