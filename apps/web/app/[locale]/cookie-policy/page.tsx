import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { defaultLocale, isLocale, locales } from "@/lib/i18n/config";
import { getPolicyDictionary } from "@/lib/i18n/dictionaries";

type PolicyPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PolicyPageProps): Promise<Metadata> {
  const { locale: localeRaw } = await params;
  const locale = isLocale(localeRaw) ? localeRaw : defaultLocale;
  const dictionary = getPolicyDictionary(locale);
  const languageAlternates = Object.fromEntries(
    locales.map((entry) => [entry, `/${entry}/cookie-policy`]),
  );
  return {
    title: dictionary.seo.cookiesTitle,
    description: dictionary.seo.cookiesDescription,
    alternates: {
      canonical: `/${locale}/cookie-policy`,
      languages: {
        ...languageAlternates,
        "x-default": `/${defaultLocale}/cookie-policy`,
      },
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CookiePolicyPage({ params }: PolicyPageProps) {
  const { locale: localeRaw } = await params;
  if (!isLocale(localeRaw)) {
    notFound();
  }

  const dictionary = getPolicyDictionary(localeRaw);
  const policy = dictionary.policies.cookies;

  return (
    <main
      id="main-content"
      className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <h1 className="font-heading text-3xl tracking-tight text-foreground sm:text-4xl">
        {policy.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{policy.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {policy.updatedLabel}: {policy.updatedAt}
      </p>

      <div className="mt-6 rounded-lg border bg-card p-5">
        <p className="text-sm text-foreground">{policy.intro}</p>
        <div className="mt-5 space-y-4">
          {policy.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
