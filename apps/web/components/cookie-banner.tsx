"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  LOCALE_COOKIE_NAME,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function getCookieValue(name: string): string | null {
  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    if (!cookie.startsWith(`${name}=`)) {
      continue;
    }
    return decodeURIComponent(cookie.slice(name.length + 1));
  }
  return null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not consistently available across all target browsers.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function CookieBanner({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getCookieValue(COOKIE_CONSENT_COOKIE_NAME);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  if (!visible) {
    return null;
  }

  function handleConsent(value: "accepted" | "essential"): void {
    const maxAge = 60 * 60 * 24 * 365;
    setCookie(COOKIE_CONSENT_COOKIE_NAME, value, maxAge);
    setCookie(LOCALE_COOKIE_NAME, locale, maxAge);
    setVisible(false);
  }

  return (
    <section
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur"
      aria-labelledby="cookie-banner-title"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p
            id="cookie-banner-title"
            className="text-sm font-semibold text-foreground"
          >
            {dictionary.cookieBanner.title}
          </p>
          <p className="max-w-3xl text-xs text-muted-foreground sm:text-sm">
            {dictionary.cookieBanner.description}
          </p>
          <div className="flex items-center gap-3 text-xs">
            <Link
              className="underline decoration-dotted underline-offset-4"
              href={`/${locale}/privacy-policy`}
            >
              {dictionary.footer.privacyPolicy}
            </Link>
            <Link
              className="underline decoration-dotted underline-offset-4"
              href={`/${locale}/cookie-policy`}
            >
              {dictionary.footer.cookiePolicy}
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleConsent("essential")}
          >
            {dictionary.cookieBanner.essentialOnly}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleConsent("accepted")}
          >
            {dictionary.cookieBanner.acceptAll}
          </Button>
        </div>
      </div>
    </section>
  );
}
