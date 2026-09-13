import { supabase } from '@/lib/supabase'

export default async function sitemap() {
  const { data: events, error } = await supabase
    .from('events')
    .select('seo_slug')
    .not('seo_slug', 'is', null)

  if (error) {
    console.error('Sitemap error:', error)
    return []
  }

  return (events ?? []).map((event) => ({
    url: `https://myevy.app/events/${event.seo_slug}`,
  }))
}