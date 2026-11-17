import { supabase } from '@/lib/supabase'
import { ELIGIBILITY_FIELDS, readMeetupDiscoveryEnabled } from '@/lib/public-event-data'
import { sitemapIndexXml, sitemapPartitionXml, sitemapWindow, partitionBounds, sitemapPartitionKey, SITEMAP_DEADLINE_MS, type SitemapEvent } from '@/lib/event-sitemap'

const headers = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'no-store',
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  let key: string | null
  try { key = sitemapPartitionKey(query) } catch {
    return new Response('Invalid sitemap partition', { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  if (key === null) return new Response(sitemapIndexXml(), { headers })
  const window = sitemapWindow(new Date())
  const bounds = partitionBounds(key)
  const deadline = AbortSignal.timeout(SITEMAP_DEADLINE_MS)
  try {
    const meetupsEnabled = await readMeetupDiscoveryEnabled(supabase)
    const result = await sitemapPartitionXml(key, window, async (cursor, limit) => {
      let query = supabase.from('events')
        .select(`id,seo_slug,status,start_date,${ELIGIBILITY_FIELDS}`)
        .eq('is_public', true).or('recurrence_state.is.null,recurrence_state.eq.active')
        .eq('ai_moderation_status', 'approved').eq('users.account_status', 'active')
        .in('event_type', meetupsEnabled ? ['standard', 'meetup'] : ['standard'])
        .in('status', ['scheduled', 'postponed']).not('seo_slug', 'is', null)
        .gte('start_date', window.from).lte('start_date', window.to)
        .gte('id', bounds.min).order('id').limit(limit).abortSignal(deadline)
      if (bounds.max) query = query.lt('id', bounds.max)
      if (cursor) query = query.gt('id', cursor)
      const { data, error } = await query.returns<SitemapEvent[]>()
      if (error || !Array.isArray(data)) throw new Error('Sitemap backend unavailable')
      return data
    }, meetupsEnabled)
    return new Response(result.xml, { headers })
  } catch {
    console.error('Event sitemap unavailable')
    return new Response('Sitemap temporarily unavailable', {
      status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
    })
  }
}
