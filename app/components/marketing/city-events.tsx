"use client";
import Image from 'next/image';
import { useId, useRef, useState, useEffect } from 'react';
import { APP_URL, type Locale } from '@/lib/i18n/config';
import { cityLabel, type CityId } from '@/lib/marketing-cities';
import type { CitySelection, EventSelection } from '@/lib/marketing-events';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import Carousel from './carousel';
import EventCard from './event-card';
export default function CityEvents({initial,locale,d}:{initial:CitySelection;locale:Locale;d:Dictionary}) {
  const [selection,setSelection]=useState(initial);
  const [loading,setLoading]=useState<CityId|null>(null);
  const request=useRef<AbortController|null>(null);
  const panel=useRef<HTMLDivElement>(null);
  const panelId=useId();
  useEffect(()=>()=>request.current?.abort(),[]);
  async function choose(city:CityId) {
    if(city===selection.selectedCity && selection.state==='ready' && !loading)return;
    request.current?.abort();const controller=new AbortController();request.current=controller;
    setLoading(city);
    // Remove previous city cards while loading; no stale response may win a race.
    setSelection(s=>({...s,selectedCity:city,events:[]}));
    try {
      const response=await fetch(`/api/marketing/events?city=${encodeURIComponent(city)}`,{signal:controller.signal,cache:'no-store'});
      if(!response.ok)throw Error('Unavailable');
      const result:EventSelection=await response.json();
      if(controller.signal.aborted)return;
      if(!['ready','empty'].includes(result.state)||!Array.isArray(result.events))throw Error('Unavailable');
      setSelection(s=>({...s,...result,selectedCity:result.state==='empty'?null:city,cities:result.state==='empty'?s.cities.filter(id=>id!==city):s.cities}));
      if(result.state==='empty')panel.current?.focus({preventScroll:true});
    }catch {
      if(!controller.signal.aborted)setSelection(s=>({...s,state:'unavailable',events:[],selectedCity:city}));
    }finally {if(!controller.signal.aborted)setLoading(null);}
  }
  return <>
    {!!selection.cities.length && <div className="city-pills" role="group" aria-label={d.cityPicker}>
      {selection.cities.map(city=><button key={city} type="button" aria-pressed={selection.selectedCity===city} aria-controls={panelId} onClick={()=>choose(city)}>{cityLabel(city,locale)}</button>)}
    </div>}
    <div id={panelId} ref={panel} tabIndex={-1} aria-busy={!!loading}>
      <p className="city-status" role="status" aria-live="polite" hidden={!loading}>{loading?d.cityLoading:''}</p>
      {selection.events.length ? <Carousel key={selection.selectedCity} label={d.eventsTitle} previous={d.previous} next={d.next}>
        {selection.events.map(card=><EventCard key={card.id} card={card} locale={locale} d={d}/>)}
      </Carousel> : <div className="event-empty">
        <Image src="/marketing/star.svg" alt="" width={48} height={48}/>
        <p role={loading?undefined:"status"}>{loading?null:selection.state==='unavailable'?d.unavailable:d.empty}</p>
        {!loading&&<a className="text-link" href={APP_URL}>{d.openApp} ↗</a>}
      </div>}
    </div>
  </>;
}
