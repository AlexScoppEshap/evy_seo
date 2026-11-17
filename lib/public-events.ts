import 'server-only'
import { cache } from 'react'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { supabase, publicBackendUrl } from './supabase'
import { presentPublicEvent, readPublicEventGallery } from './event-media'
import { readEventDetailExtras } from './event-detail-data'
import { readPublicEvent, readOtherDates } from './public-event-data'
import type { PublicEvent } from './event-seo'

export const getPublicEvent = cache(async (slug: string) => {
  await connection()
  const event = await readPublicEvent(supabase, slug)
  if (!event) notFound()
  return presentPublicEvent(await readPublicEventGallery(supabase, event, publicBackendUrl), publicBackendUrl)
})

export function getOtherDates(anchor: PublicEvent) {
  return readOtherDates(supabase, anchor)
}

export async function getEventDetailExtras(anchor: PublicEvent) {
  const extras = await readEventDetailExtras(supabase, anchor)
  return { ...extras, related: extras.related.map(event => presentPublicEvent(event, publicBackendUrl)) }
}
