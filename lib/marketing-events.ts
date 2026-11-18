import { marketingCities, matchesCity, type MarketingCity, type CityId } from "./marketing-cities.ts";
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
// Inspect a bounded candidate pool to fill 12 cards without repeated event names.
const MARKETING_CANDIDATE_LIMIT = 60;
function eventNameKey(name: string | null) {
  return (name ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}

export async function readMarketingEvents(
  db: SupabaseClient,
  backendOrigin: string,
  now = new Date(),
  city?: MarketingCity,
): Promise<EventSelection> {
  try {
    // One bounded query, reusing the deployed schema validator and eligibility contract.
    // No detail/extras loader, no per-card RPC, no browser database client.
    let query = db
      .from("events")
      .select(EVENT_FIELDS)
      .eq("is_public", true)
      .eq("ai_moderation_status", "approved")
      .eq("users.account_status", "active")
      .or("recurrence_state.is.null,recurrence_state.eq.active")
      .eq("event_type", "standard")
      .in("status", ["scheduled", "postponed"])
      .gte("start_date", now.toISOString())
      .or(`end_date.is.null,end_date.gt.${now.toISOString()}`).not("seo_slug", "is", null)
      .order("start_date")
      .order("id")
      .limit(MARKETING_CANDIDATE_LIMIT)
      .abortSignal(AbortSignal.timeout(5000))
      ;
    if (city) query = query.ilike("country_code", city.country).or(city.aliases.map(a=>`city.ilike.${a}`).join(","));
    const { data, error } = await query.returns<unknown[]>();
    if (error || !Array.isArray(data))
      return { state: "unavailable", events: [] };
    const seenNames = new Set<string>();
    const events = data
      .filter(isPublicEventRecord)
      .filter(
        (e) =>
          (!city || matchesCity(city, e.city, e.country_code)) &&
          directPageEligible(e) &&
          e.event_type === "standard" &&
          ["scheduled", "postponed"].includes(e.status ?? "") &&
          !!isoInstant(e.start_date) &&
          Date.parse(e.start_date!) >= now.getTime() &&
          (!isoInstant(e.end_date) || Date.parse(e.end_date!) > now.getTime()),
      )
      .filter((event) => {
        const name = eventNameKey(event.name);
        if (seenNames.has(name)) return false;
        seenNames.add(name);
        return true;
      })
      .slice(0, 12)
      .map((e) => projectEventCard(e, backendOrigin));
    return { state: events.length ? "ready" : "empty", events };
  } catch {
    return { state: "unavailable", events: [] };
  }
}

export type CitySelection = EventSelection & { cities: CityId[]; selectedCity: CityId | null };
const availabilityFields = 'id,city,country_code,seo_slug,is_public,recurrence_state,ai_moderation_status,event_type,status,start_date,end_date,users!inner(account_status)';
function availableRow(value: unknown, city: MarketingCity, now: Date): boolean {
  if (!value || typeof value!=='object') return false;
  const row=value as Record<string, unknown>;
  if (!row.users || typeof row.users!=='object' || Array.isArray(row.users)) return false;
  const start=typeof row.start_date==='string'?isoInstant(row.start_date):undefined;
  const end=typeof row.end_date==='string'?isoInstant(row.end_date):undefined;
  return matchesCity(city,row.city,row.country_code) && directPageEligible({
    seo_slug: typeof row.seo_slug==='string'?row.seo_slug:null,
    is_public: row.is_public===true,
    recurrence_state: row.recurrence_state===null?null:typeof row.recurrence_state==='string'?row.recurrence_state:'invalid',
    ai_moderation_status: typeof row.ai_moderation_status==='string'?row.ai_moderation_status:null,
    event_type: typeof row.event_type==='string'?row.event_type:null,
    users: {account_status: (row.users as {account_status?: string}).account_status??null},
  }) && row.event_type==='standard' && ['scheduled','postponed'].includes(String(row.status)) &&
    !!start && Date.parse(start)>=now.getTime() && (row.end_date===null || (!!end && Date.parse(end)>now.getTime()));
}
// Fixed four availability probes, not per-card/detail queries. Only minimal
// public eligibility/location fields; no media, descriptions or card preloading.
export async function readCitySelection(db: SupabaseClient, backendOrigin: string, now=new Date()): Promise<CitySelection> {
  const probes=await Promise.all(marketingCities.map(async city=>{
    try {
      const {data,error}=await db.from('events').select(availabilityFields)
        .eq('is_public',true).eq('ai_moderation_status','approved').eq('users.account_status','active')
        .or('recurrence_state.is.null,recurrence_state.eq.active').eq('event_type','standard')
        .in('status',['scheduled','postponed']).gte('start_date',now.toISOString())
        .or(`end_date.is.null,end_date.gt.${now.toISOString()}`).not('seo_slug','is',null)
        .ilike('country_code',city.country).or(city.aliases.map(a=>`city.ilike.${a}`).join(','))
        .order('start_date').order('id').limit(12).abortSignal(AbortSignal.timeout(5000));
      return {id:city.id,failed:!!error||!Array.isArray(data),available:!error&&Array.isArray(data)&&data.some(row=>availableRow(row,city,now))};
    } catch {return {id:city.id,available:false,failed:true};}
  }));
  const cities=probes.filter(p=>p.available).map(p=>p.id);
  if(!cities.length) return {cities,selectedCity:null,events:[],state:probes.some(p=>p.failed)?'unavailable':'empty'};
  const selectedCity=cities[0];
  const result=await readMarketingEvents(db,backendOrigin,now,marketingCities.find(c=>c.id===selectedCity)!);
  return {...result,cities:result.state==='empty'?cities.filter(id=>id!==selectedCity):cities,selectedCity:result.state==='empty'?null:selectedCity};
}
