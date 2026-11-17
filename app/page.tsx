import type { Metadata } from 'next'
import { PUBLIC_ORIGIN } from '@/lib/event-seo'

// The canonical homepage belongs to WordPress. This origin landing must never
// read event data, disclose diagnostics or redirect back through an unknown proxy.
export const metadata: Metadata = {
  title: 'Evy',
  description: 'Discover events with Evy.',
  robots: { index: false, follow: true },
  alternates: { canonical: `${PUBLIC_ORIGIN}/` },
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">Evy</h1>
      <p>Discover events and find your vibe.</p>
      <a href={PUBLIC_ORIGIN} className="font-semibold underline">Visit Evy</a>
    </main>
  )
}
