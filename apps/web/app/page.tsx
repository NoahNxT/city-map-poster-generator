import type { Metadata } from "next";

import { PosterGenerator } from "@/components/poster-generator";
import { getSiteUrl } from "@/lib/site";

const faqItems = [
  {
    question: "Can I generate map posters without creating an account?",
    answer:
      "Yes. You can generate and download posters instantly without signing in.",
  },
  {
    question: "Which formats are available for export?",
    answer:
      "You can export posters as PNG, SVG, and PDF depending on your workflow.",
  },
  {
    question: "Can I customize typography and map style?",
    answer:
      "Yes. You can pick from built-in themes, adjust typography settings, and control visual layers for export.",
  },
  {
    question: "Is the preview exactly the same as the final export?",
    answer:
      "The preview is a close approximation. Final exported output can vary slightly based on rendering settings.",
  },
];

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Generate Custom City Map Posters",
  description:
    "Design and download custom city map posters in minutes with powerful controls and built-in themes.",
  alternates: {
    canonical: "/",
  },
};

export default function Page() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "City Map Poster Generator",
      url: siteUrl,
      description:
        "Create and export custom city map posters online without sign-up.",
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "City Map Poster Generator",
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Generate city map posters with themes, typography controls, and export options.",
      url: siteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ];

  return (
    <>
      <PosterGenerator />
      <section className="mx-auto mb-20 max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <h2 className="font-heading text-2xl tracking-tight text-foreground sm:text-3xl">
            Built for fast poster creation and conversion
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            From instant location lookup to print-ready exports, this generator
            is designed for creators, print shops, and agencies that need
            reliable map poster output without onboarding friction.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-dashed p-4">
              <h3 className="font-semibold text-foreground">
                No account required
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start generating immediately and keep user drop-off low.
              </p>
            </article>
            <article className="rounded-lg border border-dashed p-4">
              <h3 className="font-semibold text-foreground">
                Print and web formats
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Export as PNG, SVG, or PDF for social sharing and production.
              </p>
            </article>
            <article className="rounded-lg border border-dashed p-4">
              <h3 className="font-semibold text-foreground">
                Theme and text control
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Tailor style, typography, and map layers for each use case.
              </p>
            </article>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <h2 className="font-heading text-2xl tracking-tight text-foreground sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="mt-5 space-y-3">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="group rounded-lg border border-dashed px-4 py-3"
              >
                <summary className="font-medium text-foreground">
                  {item.question}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </>
  );
}
