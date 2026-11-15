"use client";
import { useEffect, useState } from "react";

// Video background global: fixed di belakang semua halaman.
// Video hanya dimuat kalau user tidak minta kurangi animasi dan tidak hemat data.
export default function BackgroundVideo() {
  const [useVideo, setUseVideo] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const saveData = navigator.connection?.saveData;
    setUseVideo(!reduceMotion && !saveData);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 bg-primary"
    >
      {useVideo && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/background-poster.webp"
          className="h-full w-full object-cover"
        >
          <source src="/bg.webm" type="video/webm" />
          <source src="/bg.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
