import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CookieBanner } from "@/components/cookie-banner";
import { LocaleHtmlLang } from "@/components/locale-html-lang";
import {
  defaultLocale,
  isLocale,
  type Locale,
  locales,
} from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSiteUrl } from "@/lib/site";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale: localeRaw } = await params;
  const locale = isLocale(localeRaw) ? localeRaw : defaultLocale;
  const dictionary = getDictionary(locale);
  const siteUrl = getSiteUrl();

  const languageAlternates = Object.fromEntries(
    locales.map((entry) => [entry, `/${entry}`]),
  );

  return {
    title: {
      default: `${dictionary.seo.siteTitle} | ${dictionary.seo.siteName}`,
      template: `%s | ${dictionary.seo.siteName}`,
    },
    description: dictionary.seo.siteDescription,
    keywords: dictionary.seo.keywords,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...languageAlternates,
        "x-default": `/${defaultLocale}`,
      },
    },
    openGraph: {
      type: "website",
      locale,
      siteName: dictionary.seo.siteName,
      url: `${siteUrl}/${locale}`,
      title: `${dictionary.seo.ogTitle} | ${dictionary.seo.siteName}`,
      description: dictionary.seo.ogDescription,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: dictionary.seo.siteTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${dictionary.seo.ogTitle} | ${dictionary.seo.siteName}`,
      description: dictionary.seo.ogDescription,
      images: ["/twitter-image"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale: localeRaw } = await params;
  if (!isLocale(localeRaw)) {
    notFound();
  }
  const locale: Locale = localeRaw;
  const dictionary = getDictionary(locale);

  return (
    <>
      <LocaleHtmlLang locale={locale} />
      <a href="#main-content" className="skip-link">
        {dictionary.accessibility.skipToMainContent}
      </a>
      {children}
      <footer className="mx-auto mt-10 max-w-7xl px-4 pb-24 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-4 border-t pt-4">
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
      </footer>
      <CookieBanner locale={locale} dictionary={dictionary} />
    </>
  );
}
