import Image from "next/image";
import { getMarketingEvents } from "@/lib/marketing-events-server";
import { APP_URL, marketingPath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { EventCardData } from "@/lib/marketing-events";
import { eventTimezone } from "@/lib/event-seo";
import Carousel from "./carousel";
import EventCoverImage from "./event-cover-image";
function EventCard({
  card,
  locale,
  d,
}: {
  card: EventCardData;
  locale: Locale;
  d: Dictionary;
}) {
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: eventTimezone(card.timezone),
  }).format(new Date(card.start));
  const price = card.multipleCurrencies
    ? d.prices
    : card.price
      ? card.price.amount === 0
        ? d.freeEntry
        : `${card.price.from ? d.from + " " : ""}${new Intl.NumberFormat(locale, { style: "currency", currency: card.price.currency, maximumFractionDigits: 2 }).format(card.price.amount)}`
      : null;
  return (
    <a href={card.url} className="event-card">
      <div className="event-cover">
        <div className="event-cover-fallback" aria-hidden="true">
          <Image src="/marketing/star.svg" alt="" width={65} height={65} />
          <span>{d.photoFallback}</span>
        </div>
        {card.image && (
          <EventCoverImage
            src={new URL(card.image).pathname}
            alt={card.title || d.event}
          />
        )}
        <time dateTime={card.start}>{date}</time>
        <span className="event-card-arrow" aria-hidden="true">
          ↗
        </span>
      </div>
      <div className="event-card-info">
        <p>
          {d.categories[card.category as keyof typeof d.categories] ?? d.event}
        </p>
        <h3>{card.title || d.event}</h3>
        <div>
          <span>{card.city || d.unknownCity}</span>
          {price && <span>{price}</span>}
        </div>
      </div>
    </a>
  );
}
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
        {selection.events.length >= 4 ? (
          <Carousel label={d.eventsTitle} previous={d.previous} next={d.next}>
            {selection.events.map((card) => (
              <EventCard key={card.id} card={card} locale={locale} d={d} />
            ))}
          </Carousel>
        ) : selection.events.length ? (
          <div className="event-grid">
            {selection.events.map((card) => (
              <EventCard key={card.id} card={card} locale={locale} d={d} />
            ))}
          </div>
        ) : (
          <div className="event-empty">
            <Image src="/marketing/star.svg" alt="" width={48} height={48} />
            <p role={selection.state === "unavailable" ? "status" : undefined}>
              {selection.state === "unavailable" ? d.unavailable : d.empty}
            </p>
            <a className="text-link" href={APP_URL}>
              {d.openApp} ↗
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
