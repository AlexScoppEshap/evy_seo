'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'

export function EventHeroPhotos({ images, title }: { images: string[]; title: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const move = (offset: number) => {
    const element = track.current
    if (element) element.scrollTo({ left: Math.max(0, Math.min(images.length - 1, active + offset)) * element.clientWidth, behavior: 'smooth' })
  }
  return (
    <div role="group" aria-label="Event photos" aria-roledescription="carousel" className="h-full">
      <div ref={track} onScroll={event => {
        const element = event.currentTarget
        if (element.clientWidth) setActive(Math.max(0, Math.min(images.length - 1, Math.round(element.scrollLeft / element.clientWidth))))
      }} className="flex h-full snap-x snap-mandatory overflow-x-auto" tabIndex={images.length > 1 ? 0 : -1}>
        {images.map((src, index) => <a href={src} target="_blank" rel="noreferrer noopener" aria-label={`Open event photo ${index + 1}`} key={src} className="relative block h-full w-full shrink-0 snap-center"><Image src={src} alt={`${title} — photo ${index + 1}`} fill unoptimized priority={index === 0} sizes="(min-width: 768px) 768px, 100vw" className="object-cover" /></a>)}
      </div>
      {images.length > 1 && <>
        <button type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous photo" className="absolute left-3 top-1/2 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-xl text-white disabled:opacity-30">‹</button>
        <button type="button" onClick={() => move(1)} disabled={active === images.length - 1} aria-label="Next photo" className="absolute right-3 top-1/2 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-xl text-white disabled:opacity-30">›</button>
        <span className="absolute right-4 top-32 z-10 rounded-full bg-black/50 px-2 py-1 text-xs font-semibold text-white" aria-live="polite">{active + 1} / {images.length}</span>
      </>}
    </div>
  )
}

export function EventPhotoGrid({ images, title, fullImages = images, captions = [] }: { images: string[]; title: string; fullImages?: string[]; captions?: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const open = (index: number) => {
    const element = dialog.current
    if (!element || typeof element.showModal !== 'function') return false
    try { element.showModal(); setSelected(index); return true } catch { return false }
  }
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((url, index) => <figure key={url} className="min-w-0"><a href={fullImages[index] ?? url} target="_blank" rel="noreferrer noopener" onClick={event => { if (open(index)) event.preventDefault() }} aria-label={`Open event photo ${index + 1}`} className="block overflow-hidden rounded-2xl bg-black/5 focus-visible:outline-2"><Image src={url} alt={`${title} — photo ${index + 1}`} width={320} height={240} unoptimized className="aspect-[4/3] w-full object-cover" /></a>{captions[index] && <figcaption className="mt-1 truncate text-xs text-[#626068]">{captions[index]}</figcaption>}</figure>)}
      </div>
      <dialog ref={dialog} onClose={() => setSelected(null)} aria-label="Event photo viewer" className="fixed inset-0 m-auto w-[min(96vw,1100px)] rounded-2xl bg-[#121114] p-4 text-white backdrop:bg-black/80">
        <div className="mb-3 flex items-center justify-between gap-3"><p className="min-w-0 break-words text-sm">{title} · {(selected ?? 0) + 1} / {images.length}</p><button type="button" onClick={() => dialog.current?.close()} className="rounded-full px-3 py-2 font-bold" aria-label="Close photo viewer">Close ✕</button></div>
        {selected !== null && fullImages[selected] && <Image src={fullImages[selected]} alt={`${title} — photo ${selected + 1}`} width={1200} height={900} unoptimized className="max-h-[72vh] w-full object-contain" />}
        <div className="mt-3 flex justify-between gap-3"><button type="button" disabled={selected === null || selected === 0} onClick={() => setSelected(index => index === null ? null : index - 1)} className="rounded-xl px-4 py-2 disabled:opacity-30">Previous</button><button type="button" disabled={selected === null || selected === images.length - 1} onClick={() => setSelected(index => index === null ? null : index + 1)} className="rounded-xl px-4 py-2 disabled:opacity-30">Next</button></div>
      </dialog>
    </>
  )
}
