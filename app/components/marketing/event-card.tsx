import Image from "next/image";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { EventCardData } from "@/lib/marketing-events";
import { eventTimezone } from "@/lib/event-seo";
import EventCoverImage from "./event-cover-image";
export default function EventCard({
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
