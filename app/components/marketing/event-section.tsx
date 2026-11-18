import CityEvents from "./city-events";
import { getMarketingEvents } from "@/lib/marketing-events-server";
import { marketingPath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
export default async function EventSection({
  locale,
  d,
  discovery = false,
}: {
  locale: Locale;
  d: Dictionary;
  discovery?: boolean;
}) {
  const selection = await getMarketingEvents();
  return (
    <section
      className={`section events-section ${discovery ? "discovery-section" : ""}`}
      id="live-events"
    >
      <div className="container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{d.eventsTag}</p>
            <h2>{d.eventsTitle}</h2>
            <p className="muted">{d.eventsIntro}</p>
          </div>
          {!discovery && (
            <a className="text-link" href={marketingPath(locale, "events")}>
              {d.allEvents} <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        <CityEvents initial={selection} locale={locale} d={d} />
      </div>
    </section>
  );
}
