import { type NextRequest, NextResponse } from "next/server";

import {
  LOCALE_COOKIE_NAME,
  isLocale,
  localeFromAcceptLanguage,
} from "./lib/i18n/config";

function localeFromRequest(request: NextRequest): string {
  const localeCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (localeCookie && isLocale(localeCookie)) {
    return localeCookie;
  }

  return localeFromAcceptLanguage(request.headers.get("accept-language"));
}

export function proxy(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && isLocale(firstSegment)) {
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE_NAME)?.value !== firstSegment) {
      response.cookies.set(LOCALE_COOKIE_NAME, firstSegment, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return response;
  }

  const locale = localeFromRequest(request);
  const redirectUrl = request.nextUrl.clone();
  const normalizedPath = pathname === "/" ? "" : pathname;
  redirectUrl.pathname = `/${locale}${normalizedPath}`;

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image|twitter-image|health|.*\\..*).*)",
  ],
};
