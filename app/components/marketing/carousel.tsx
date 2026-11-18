"use client";
import { useRef, type ReactNode } from "react";
export default function Carousel({
  children,
  label,
  previous,
  next,
}: {
  children: ReactNode;
  label: string;
  previous: string;
  next: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  function move(direction: number) {
    track.current?.scrollBy({
      left: direction * track.current.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <div className="event-carousel">
      <div className="carousel-buttons">
        <button onClick={() => move(-1)} aria-label={previous}>
          ←
        </button>
        <button onClick={() => move(1)} aria-label={next}>
          →
        </button>
      </div>
      <div
        ref={track}
        className="event-track"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
