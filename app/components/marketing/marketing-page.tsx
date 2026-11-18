import { Suspense } from "react";
import { mobileApplicationJsonLd } from "@/lib/mobile-application";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  marketingPath,
  type Locale,
  type MarketingPage,
} from "@/lib/i18n/config";
import { Header, Footer } from "./site-shell";
import { Hero, Meetups, Features, Organizers, Download } from "./sections";
import EventSection from "./event-section";
export default async function MarketingPageView({
  locale,
  page,
}: {
  locale: Locale;
  page: MarketingPage;
}) {
  const d = await getDictionary(locale);
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://myevy.app/#organization",
        name: "Evy",
        url: "https://myevy.app",
        logo: "https://myevy.app/marketing/evy-logo.png",
      },
      {
        "@type": "WebSite",
        "@id": "https://myevy.app/#website",
        name: "Evy",
        url: "https://myevy.app",
        inLanguage: ["fr", "en", "de", "it", "es"],
        publisher: { "@id": "https://myevy.app/#organization" },
      },
    ],
  };
  return (
    <div className="marketing-site">
      <Header locale={locale} page={page} d={d} />
      <main id="main" tabIndex={-1}>
        {page === "download" && <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(mobileApplicationJsonLd(locale)).replace(/</g, "\\u003c") }} />}

        {page === "home" && (
          <>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
              }}
            />
            <Hero locale={locale} d={d} />
            <Suspense
              fallback={
                <div className="event-loading container" aria-busy="true">
                  <h2>{d.eventsTitle}</h2>
                </div>
              }
            >
              <EventSection locale={locale} d={d} />
            </Suspense>
            <Meetups locale={locale} d={d} />
            <Features d={d} />
            <Organizers locale={locale} d={d} />
            <Download d={d} />
          </>
        )}
        {page !== "home" && (
          <div className="subpage">
            <div className="container">
              <a className="back-link" href={marketingPath(locale)}>
                ← {d.back}
              </a>
            </div>
            {page === "meetups" && (
              <>
                <Meetups locale={locale} d={d} standalone />
                <Download d={d} />
              </>
            )}
            {page === "organizers" && (
              <>
                <Organizers locale={locale} d={d} standalone />
                <Download d={d} />
              </>
            )}
            {page === "download" && <Download d={d} standalone />}
            {page === "events" && (
              <>
                <div className="container discovery-heading">
                  <p className="eyebrow">FIND YOUR VIBE</p>
                  <h1>{d.discoveryTitle}</h1>
                  <p>{d.discoveryIntro}</p>
                </div>
                <Suspense
                  fallback={
                    <div className="event-loading container" aria-busy="true">
                      <h2>{d.eventsTitle}</h2>
                    </div>
                  }
                >
                  <EventSection locale={locale} d={d} discovery />
                </Suspense>
                <Download d={d} />
              </>
            )}
          </div>
        )}
      </main>
      <Footer locale={locale} page={page} d={d} />
    </div>
  );
}
