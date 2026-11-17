'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import maptilerLogo from '@/app/assets/maptiler-logo.svg'

type Preview = { version:number; revision:string; offsetX:number; offsetY:number; tiles:string[] }
export default function EventLocationMap({slug,directionsUrl}:{slug:string;directionsUrl:string}){
  const container=useRef<HTMLDivElement>(null),loaded=useRef(new Set<string>())
  const [preview,setPreview]=useState<Preview|null>(null)
  const [state,setState]=useState<'waiting'|'loading'|'ready'|'error'>('waiting')
  useEffect(()=>{
    const controller=new AbortController()
    let started=false
    const start=async()=>{
      if(started)return;started=true;setState('loading')
      try{
        const response=await fetch(`/events/${encodeURIComponent(slug)}/map/preview`,{cache:'no-store',credentials:'omit',signal:controller.signal})
        if(!response.ok)throw Error('Map unavailable')
        const value:Preview=await response.json()
        if(value.version!==1||typeof value.revision!=='string'||!/^[0-9a-f]{16}$/.test(value.revision)||!Number.isFinite(value.offsetX)||!Number.isFinite(value.offsetY)||value.offsetX<0||value.offsetX>1024||value.offsetY<0||value.offsetY>512||!Array.isArray(value.tiles)||value.tiles.length!==8||value.tiles.some((url,index)=>url!==`/events/${encodeURIComponent(slug)}/map/tile-${index}-${value.revision}`))throw Error('Invalid map preview')
        if(!controller.signal.aborted)setPreview(value)
      }catch{if(!controller.signal.aborted)setState('error')}
    }
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();void start()}},{rootMargin:'200px'})
    if(observer&&container.current)observer.observe(container.current)
    else void start()
    return()=>{controller.abort();observer?.disconnect()}
  },[slug])
  return <div ref={container} data-event-map={state} className="relative mt-3 h-[200px] overflow-hidden rounded-t-2xl border border-[#7C3AED]/15 bg-[#7C3AED]/5">
    {preview&&state!=='error'&&<div className={`pointer-events-none absolute left-1/2 top-1/2 grid grid-cols-4 ${state==='ready'?'opacity-100':'opacity-0'}`} style={{width:1024,height:512,transform:`translate(${-preview.offsetX}px,${-preview.offsetY}px)`}}>{preview.tiles.map(src=><Image key={src} src={src} alt="" width={256} height={256} unoptimized loading="eager" className="h-64 w-64 max-w-none" onLoad={()=>{loaded.current.add(src);if(loaded.current.size===8)setState('ready')}} onError={()=>setState('error')}/>)}</div>}
    <a href={directionsUrl} target="_blank" rel="noreferrer noopener" aria-label="Open map and directions" className="absolute inset-0 flex flex-col items-center justify-center gap-2 pb-8 text-[#7C3AED]">
      {state==='ready'?<svg aria-hidden="true" width="40" height="44" viewBox="0 0 24 28" fill="currentColor" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow"><path d="M12 0a10 10 0 0 0-10 10c0 7 10 18 10 18s10-11 10-18A10 10 0 0 0 12 0Zm0 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/></svg>:<><svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Zm0 0V3m6 3v15"/></svg><span className="text-sm font-extrabold">{state==='loading'?'Loading map…':'View map'}</span>{state==='error'&&<span className="text-xs text-[#626068]">Map preview unavailable. Open directions.</span>}</>}
      {state==='ready'&&<span className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-2 text-xs font-bold shadow">Open map ↗</span>}
    </a>
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 bg-white/95 px-2 py-1 text-[10px] text-black">
      <a href="https://www.maptiler.com/" target="_blank" rel="noreferrer noopener"><Image src={maptilerLogo.src} alt="MapTiler" width={64} height={16} unoptimized className="h-4 w-16"/></a>
      <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer noopener">© MapTiler</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">© OpenStreetMap contributors</a>
    </div>
  </div>
}
