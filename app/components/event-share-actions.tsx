'use client'

import { useState } from 'react'
import { sharePublicEvent } from '@/lib/event-share'

export default function EventShareActions({ title, url, appUrl }: { title: string; url: string; appUrl: string }) {
  const [message, setMessage] = useState('')
  return (
    <details className="relative text-left">
      <summary aria-label="Share event" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full bg-black/30 text-white ring-1 ring-white/25 backdrop-blur [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m-5-7 5-5 5 5M5 13v6h14v-6" /></svg>
      </summary>
      <div className="absolute right-0 top-12 z-40 w-56 rounded-2xl border border-black/10 bg-white p-2 text-sm font-semibold text-[#18171B] shadow-xl">
        <button className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-black/5" onClick={async () => {
          const result = await sharePublicEvent({ title, url }, navigator)
          setMessage(result === 'copied' ? 'Link copied' : result === 'unavailable' ? 'Use email or copy the address from your browser.' : '')
        }}>Share or copy link</button>
        <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`} className="block rounded-xl px-3 py-2.5 hover:bg-black/5">Share by email</a>
        <a href={appUrl} className="block rounded-xl px-3 py-2.5 hover:bg-black/5">Share in Evy</a>
        <p role="status" className="px-3 text-xs text-[#626068]">{message}</p>
      </div>
    </details>
  )
}
