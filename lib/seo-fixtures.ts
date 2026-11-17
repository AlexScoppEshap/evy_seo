import type { PublicEvent } from './event-seo.ts'

// Unsigned local transport fixture, never a Supabase credential.
export const FIXTURE_ANON_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.fixture_signature'

export const publicEventFixture: PublicEvent = {
  id: '10000000-0000-0000-0000-000000000001', seo_slug: 'friday-edition-1',
  name: 'Friday live', description: 'Original organizer description.', category: 'music',
  is_public: true, recurrence_state: null,
  ai_moderation_status: 'approved', event_type: 'standard', meetup_subcategory: null,
  note: null, series_id: null, gallery_image_urls: null,
  participation_mode: 'open', participation_capacity: null,
  event_styles: [],
  image_url: null, venue_name: 'Club', address: null, npa: null, city: 'Lausanne',
  region_code: 'VD', country_code: 'CH', timezone: 'Europe/Zurich',
  start_date: '2026-10-23T21:30:00Z', end_date: '2026-10-24T02:00:00Z',
  price: null, currency_code: 'CHF', ticketing_url: 'https://tickets.example/event',
  artists: ['Artist'], creator_id: 'creator', external_organizer_name: null,
  users: { fullname: 'Organizer', username: 'organizer', profileimageurl: null, account_status: 'active' }, event_ticket_types: [],
  status: 'scheduled', previous_start_at: null, likescount: 0, participantscount: 0,
}
