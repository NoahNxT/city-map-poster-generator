import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PosterGenerator } from "@/components/poster-generator";
import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { getDictionary, getHomeDictionary } from "@/lib/i18n/dictionaries";
import { getSiteUrl } from "@/lib/site";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale: localeRaw } = await params;
  const locale = isLocale(localeRaw) ? localeRaw : defaultLocale;
  const dictionary = getDictionary(locale);
  const languageAlternates = Object.fromEntries(
    locales.map((entry) => [entry, `/${entry}`]),
  );
  return {
    title: dictionary.seo.homepageTitle,
    description: dictionary.seo.homepageDescription,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...languageAlternates,
        "x-default": `/${defaultLocale}`,
      },
    },
  };
}

export default async function LocaleHomePage({ params }: LocalePageProps) {
  const { locale: localeRaw } = await params;
  if (!isLocale(localeRaw)) {
    notFound();
  }
  const locale = localeRaw;
  const dictionary = getDictionary(locale);
  const homeDictionary = getHomeDictionary(locale);
  const siteUrl = getSiteUrl();

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: dictionary.seo.siteName,
      url: `${siteUrl}/${locale}`,
      description: dictionary.seo.siteDescription,
      inLanguage: locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: dictionary.seo.siteName,
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description: dictionary.seo.siteDescription,
      url: `${siteUrl}/${locale}`,
    },
  ];

  return (
    <>
      <PosterGenerator locale={locale} dictionary={homeDictionary} />
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </>
  );
}
