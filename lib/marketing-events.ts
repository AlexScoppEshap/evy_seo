import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_FIELDS, isPublicEventRecord } from "./public-event-data.ts";
import {
  directPageEligible,
  eventUrl,
  isoInstant,
  type PublicEvent,
} from "./event-seo.ts";
import { seoMediaUrl } from "./event-media.ts";
import { eventTickets } from "./event-presentation.ts";
export type EventCardData = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  start: string;
  timezone: string | null;
  city: string;
  category: string | null;
  price: { amount: number; currency: string; from: boolean } | null;
  multipleCurrencies: boolean;
};
export type EventSelection = {
  state: "ready" | "empty" | "unavailable";
  events: EventCardData[];
};
export function projectEventCard(
  event: PublicEvent,
  backendOrigin: string,
): EventCardData {
  // The existing media route resolves approved managed-gallery covers as well as
  // legacy images, rechecking eligibility at request time. No per-card gallery RPC.
  void backendOrigin;
  // Marketing prices require a stored currency: do not infer USD for missing data.
  const storedCurrency = event.currency_code?.trim().toUpperCase();
  const currency =
    storedCurrency &&
    Intl.supportedValuesOf("currency").includes(storedCurrency)
      ? storedCurrency
      : undefined;
  const tickets = eventTickets({
    ...event,
    event_ticket_types:
      event.event_ticket_types?.filter((t) => t.currency?.trim() || currency) ??
      null,
  });
  const currencies = new Set(tickets.map((t) => t.currency));
  const lowest =
    currencies.size === 1
      ? tickets.reduce<(typeof tickets)[number] | null>(
          (a, b) => (!a || b.price < a.price ? b : a),
          null,
        )
      : null;
  const legacy =
    !event.event_ticket_types?.length &&
    event.price !== null &&
    Number.isFinite(event.price) &&
    event.price >= 0 &&
    currency
      ? { amount: event.price, currency, from: false }
      : null;
  return {
    id: event.id,
    title: event.name?.trim() || "",
    url: eventUrl(event.seo_slug!),
    image: seoMediaUrl(event.seo_slug!, "cover"),
    start: event.start_date!,
    timezone: event.timezone,
    city: event.city?.trim() || "",
    category: event.category,
    price: lowest
      ? {
          amount: lowest.price,
          currency: lowest.currency,
          from: tickets.length > 1,
        }
      : legacy,
    multipleCurrencies: currencies.size > 1,
  };
}
export async function readMarketingEvents(
  db: SupabaseClient,
  backendOrigin: string,
  now = new Date(),
): Promise<EventSelection> {
  try {
    // One bounded query, reusing the deployed schema validator and eligibility contract.
    // No detail/extras loader, no per-card RPC, no browser database client.
    const { data, error } = await db
      .from("events")
      .select(EVENT_FIELDS)
      .eq("is_public", true)
      .eq("ai_moderation_status", "approved")
      .eq("users.account_status", "active")
      .or("recurrence_state.is.null,recurrence_state.eq.active")
      .eq("event_type", "standard")
      .in("status", ["scheduled", "postponed"])
      .gte("start_date", now.toISOString())
      .order("start_date")
      .order("id")
      .limit(12)
      .abortSignal(AbortSignal.timeout(5000))
      .returns<unknown[]>();
    if (error || !Array.isArray(data))
      return { state: "unavailable", events: [] };
    const events = data
      .filter(isPublicEventRecord)
      .filter(
        (e) =>
          directPageEligible(e) &&
          e.event_type === "standard" &&
          ["scheduled", "postponed"].includes(e.status ?? "") &&
          !!isoInstant(e.start_date) &&
          Date.parse(e.start_date!) >= now.getTime() &&
          (!isoInstant(e.end_date) || Date.parse(e.end_date!) > now.getTime()),
      )
      .slice(0, 12)
      .map((e) => projectEventCard(e, backendOrigin));
    return { state: events.length ? "ready" : "empty", events };
  } catch {
    return { state: "unavailable", events: [] };
  }
}
