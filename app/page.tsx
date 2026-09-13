import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data, error } = await supabase
    .from('events')
    .select('id, name, city, seo_slug')
    .limit(5)

  if (error) {
    return <pre>{error.message}</pre>
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Evy SEO test</h1>

      {data?.map((event) => (
        <div key={event.id} style={{ marginBottom: 20 }}>
          <strong>{event.name}</strong>
          <div>{event.city}</div>
          <div>{event.seo_slug}</div>
        </div>
      ))}
    </main>
  )
}