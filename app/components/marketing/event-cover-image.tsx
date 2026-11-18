"use client";
import Image from "next/image";
import { useState } from "react";
// Missing or withdrawn covers fall back honestly; never retry a signed source URL.
export default function EventCoverImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? null : (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 600px) 80vw, 320px"
      unoptimized
      onError={() => setFailed(true)}
      className="event-cover-photo"
    />
  );
}
