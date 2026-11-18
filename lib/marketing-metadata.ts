import { productionIndexingEnabled } from "./seo-launch.ts";
import type { Metadata } from "next";
import {
  locales,
  marketingPath,
  pageKeys,
  type Locale,
  type MarketingPage,
} from "./i18n/config.ts";
import type { Dictionary } from "./i18n/dictionaries";
const origin = "https://myevy.app";
export function marketingMetadata(
  locale: Locale,
  page: MarketingPage,
  d: Dictionary,
): Metadata {
  const title = d.metaTitles[pageKeys.indexOf(page)];
  const description = d.meta[pageKeys.indexOf(page)];
  const canonical = origin + marketingPath(locale, page);
  return {
    title,
    description,
    // Only the explicitly approved production configuration enables indexing.
    robots: { index: productionIndexingEnabled(), follow: true },
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          locales.map((l) => [l, origin + marketingPath(l, page)]),
        ),
        "x-default": origin + marketingPath("fr", page),
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Evy",
      type: "website",
      locale: {
        fr: "fr_CH",
        en: "en_GB",
        de: "de_CH",
        it: "it_CH",
        es: "es_ES",
      }[locale],
      images: [
        {
          url: origin + "/marketing/social-card.png",
          width: 1200,
          height: 630,
          alt: "Evy — Find your vibe",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [origin + "/marketing/social-card.png"],
    },
  };
}
