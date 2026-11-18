// Declarative identifiers only. No listeners, network calls, storage or cookies.
export const conversionEvents = [
  "page_view",
  "event_view",
  "app_store_click",
  "google_play_click",
  "open_in_evy_click",
  "meetup_cta_click",
  "organizer_cta_click",
] as const;
export type ConversionEvent = (typeof conversionEvents)[number];
export function conversionAttributes(
  event: ConversionEvent,
  placement: string,
) {
  return { "data-conversion": event, "data-placement": placement };
}
