import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { readMarketingEvents, projectEventCard } from "./marketing-events.ts";
import {
  publicEventFixture as base,
  FIXTURE_ANON_KEY,
} from "./seo-fixtures.ts";
const now = new Date("2026-10-12T12:00:00Z");
function dbWith(rows: unknown, status = 200) {
  const calls: URL[] = [];
  const db = createClient("https://fixture.supabase.co", FIXTURE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      fetch: async (input) => {
        calls.push(new URL(String(input)));
        return new Response(JSON.stringify(rows), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  return { db, calls };
}
test("marketing list fails closed and performs one bounded query with required filters", async () => {
  const rows = [
    base,
    { ...base, is_public: false },
    { ...base, ai_moderation_status: "quarantined" },
    { ...base, users: { ...base.users, account_status: "pending_deletion" } },
    { ...base, recurrence_state: "excluded" },
    { ...base, status: "cancelled" },
    { ...base, start_date: "2020-01-01T00:00:00Z" },
    { ...base, end_date: "2020-01-01T00:00:00Z" },
    { ...base, event_type: "meetup" },
    { ...base, seo_slug: null },
  ];
  const { db, calls } = dbWith(rows);
  const result = await readMarketingEvents(
    db,
    "https://fixture.supabase.co",
    now,
  );
  assert.equal(result.events.length, 1);
  assert.equal(calls.length, 1);
  const q = calls[0].searchParams;
  assert.equal(q.get("limit"), "12");
  assert.equal(q.get("is_public"), "eq.true");
  assert.equal(q.get("ai_moderation_status"), "eq.approved");
  assert.equal(q.get("users.account_status"), "eq.active");
  assert.equal(q.get("event_type"), "eq.standard");
  assert.equal(q.get("status"), "in.(scheduled,postponed)");
  assert.ok(q.get("start_date")?.startsWith("gte."));
  assert.equal(
    result.events[0].url,
    "https://myevy.app/events/friday-edition-1",
  );
});
test("cards strip source URLs and private fields, never invent a zero price", () => {
  const event = {
    ...base,
    image_url: `https://fixture.supabase.co/functions/v1/ik-storage?action=proxy&bucket_kind=event&key=events/${base.id}/cover.jpg&token=synthetic_public_signature_123456`,
    price: null,
  };
  const card = projectEventCard(event, "https://fixture.supabase.co");
  assert.equal(card.price, null);
  assert.equal(
    card.image,
    "https://myevy.app/events/friday-edition-1/media/cover",
  );
  assert.doesNotMatch(
    JSON.stringify(card),
    /synthetic|token|creator|description|users/,
  );
  assert.equal(
    projectEventCard({ ...event, price: 0 }, "https://fixture.supabase.co")
      .price?.amount,
    0,
  );
  assert.equal(
    projectEventCard(
      { ...event, price: 20, currency_code: null },
      "https://fixture.supabase.co",
    ).price,
    null,
  );
});
test("mixed currencies are not compared and outages differ from empty inventory", async () => {
  const e = {
    ...base,
    event_ticket_types: [
      { name: "A", price: 10, currency: "CHF", sort_order: 0 },
      { name: "B", price: 8, currency: "EUR", sort_order: 1 },
    ],
  };
  const card = projectEventCard(e, "https://fixture.supabase.co");
  assert.equal(card.price, null);
  assert.equal(card.multipleCurrencies, true);
  assert.equal(
    (
      await readMarketingEvents(
        dbWith([]).db,
        "https://fixture.supabase.co",
        now,
      )
    ).state,
    "empty",
  );
  assert.equal(
    (
      await readMarketingEvents(
        dbWith({}, 503).db,
        "https://fixture.supabase.co",
        now,
      )
    ).state,
    "unavailable",
  );
});
