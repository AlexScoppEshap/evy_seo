"use client";
import { useRef, useState, useEffect, type ReactNode, type PointerEvent } from "react";
export default function Carousel({children,label,previous,next}:{children:ReactNode;label:string;previous:string;next:string}) {
  const track=useRef<HTMLDivElement>(null);
  const gesture=useRef<{id:number;x:number;y:number;left:number;active:boolean}|null>(null);
  const suppressClick=useRef(false);
  const snapFrame=useRef<number|null>(null);
  function cancelSnap() {if(snapFrame.current!==null){cancelAnimationFrame(snapFrame.current);snapFrame.current=null;}}
  useEffect(()=>()=>cancelSnap(),[]);
  const [dragging,setDragging]=useState(false);
  const behavior=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'instant' as const:'smooth' as const;
  function move(direction:number) {cancelSnap();track.current?.scrollBy({left:direction*track.current.clientWidth*.8,behavior:behavior()});}
  function finish(e:PointerEvent<HTMLDivElement>) {
    const g=gesture.current;if(!g||g.id!==e.pointerId)return;
    gesture.current=null;setDragging(false);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(g.active){
      const element=e.currentTarget;
      const cards=Array.from(element.children) as HTMLElement[];
      const nearest=cards.reduce<HTMLElement|null>((a,b)=>!a||Math.abs(b.offsetLeft-element.scrollLeft)<Math.abs(a.offsetLeft-element.scrollLeft)?b:a,null);
      cancelSnap();
      if(nearest)snapFrame.current=requestAnimationFrame(()=>{snapFrame.current=null;element.scrollTo({left:nearest.offsetLeft,behavior:behavior()});});
    }
  }
  return <div className="event-carousel">
    <div className="carousel-buttons"><button type="button" onClick={()=>move(-1)} aria-label={previous}>←</button><button type="button" onClick={()=>move(1)} aria-label={next}>→</button></div>
    <div ref={track} className="event-track" data-dragging={dragging||undefined} role="region" aria-label={label} tabIndex={0}
      onDragStart={e=>e.preventDefault()}
      onPointerDown={e=>{if(e.pointerType!=='mouse'||e.button!==0||e.metaKey||e.ctrlKey)return;cancelSnap();suppressClick.current=false;gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,active:false};}}
      onPointerMove={e=>{
        const g=gesture.current;if(!g||g.id!==e.pointerId)return;
        const dx=e.clientX-g.x,dy=e.clientY-g.y;
        if(!g.active){if(Math.abs(dx)<6||Math.abs(dx)<=Math.abs(dy))return;g.active=true;suppressClick.current=true;setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus({preventScroll:true});}
        e.preventDefault();e.currentTarget.scrollLeft=g.left-dx;
      }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onClickCapture={e=>{if(suppressClick.current&&e.detail>0){e.preventDefault();e.stopPropagation();}suppressClick.current=false;}}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();cancelSnap();e.currentTarget.scrollTo({left:e.key==='Home'?0:e.currentTarget.scrollWidth,behavior:behavior()});}}}
    >{children}</div>
  </div>;
}
