"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link.js";
import PriceLabel from "../../../components/price-label.jsx";
import Image from "next/image.js";

const AUTOPLAY_MS = 2000;

/* Satu slide: gambar banner di belakang, produk (kalau ada) di atasnya. */
export function BannerSlide({ banner, products, priority, ariaHidden }) {
  return (
    <div
      aria-hidden={ariaHidden || undefined}
      className="w-full shrink-0 snap-center aspect-[2/3] grid grid-rows-3 grid-cols-1 overflow-hidden"
    >
      <div className="row-start-1 row-end-4 col-start-1 col-end-2 bg-black relative z-10">
        {banner.banner_url && (
          <Image
            alt={banner.is_promo ? "promo banner" : "banner"}
            src={banner.banner_url}
            fill
            sizes="100vw"
            priority={priority}
          />
        )}
      </div>

      {products.length > 0 && (
        <div className="row-start-2 row-end-4 col-start-1 col-end-2 grid grid-cols-2 z-20 gap-2 p-2">
          {products.map((item) => (
            <Link
              href={`/${item.id}`}
              key={item.id}
              tabIndex={ariaHidden ? -1 : undefined}
              className="w-full aspect-square relative mt-auto mx-auto"
            >
              {item.image_url ? (
                <Image
                  alt={`${item.name} photo`}
                  fill
                  src={item.image_url}
                  className="w-full h-full object-cover"
                />
              ) : (
                ""
              )}

              <PriceLabel item={item} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BannerCarousel({ slides }) {
  const count = slides.length;
  const loop = count > 1;

  // Loop: [salinan slide terakhir, ...slide asli, salinan slide pertama]
  const items = loop
    ? [
        { ...slides[count - 1], clone: "head" },
        ...slides.map((slide) => ({ ...slide, clone: null })),
        { ...slides[0], clone: "tail" },
      ]
    : slides.map((slide) => ({ ...slide, clone: null }));

  const trackRef = useRef(null);
  const settleTimer = useRef(null);
  const lastInteract = useRef(0);
  const touching = useRef(false);
  const hovering = useRef(false);
  const [active, setActive] = useState(0);

  /* Pindah posisi tanpa animasi (dan tanpa snap supaya tidak "tarik balik"). */
  function jumpTo(position) {
    const track = trackRef.current;
    if (!track) return;
    track.style.scrollSnapType = "none";
    track.scrollLeft = position * track.clientWidth;
    requestAnimationFrame(() => {
      track.style.scrollSnapType = "";
    });
  }

  function currentPosition() {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return 0;
    return Math.round(track.scrollLeft / track.clientWidth);
  }

  // Mulai dari slide asli pertama (posisi 1) saat loop aktif.
  useLayoutEffect(() => {
    if (loop) jumpTo(1);
    setActive(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // Jaga posisi saat ukuran layar berubah.
  useEffect(() => {
    function handleResize() {
      jumpTo(loop ? active + 1 : active);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, active]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  function handleScroll() {
    const position = currentPosition();
    const real = loop ? (((position - 1) % count) + count) % count : position;
    setActive((current) => (current === real ? current : real));

    // Setelah scroll berhenti: kalau berhenti di salinan, lompat ke slide aslinya.
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!loop) return;
      const settled = currentPosition();
      if (settled === 0) jumpTo(count);
      else if (settled === count + 1) jumpTo(1);
    }, 100);
  }

  function goTo(index) {
    const track = trackRef.current;
    if (!track) return;
    lastInteract.current = Date.now();
    const position = loop ? index + 1 : index;
    track.scrollTo({ left: position * track.clientWidth, behavior: "smooth" });
  }

  // Geser otomatis tiap 3 detik.
  useEffect(() => {
    if (!loop) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      if (document.hidden || touching.current || hovering.current) return;
      if (Date.now() - lastInteract.current < AUTOPLAY_MS) return;

      track.scrollTo({
        left: (currentPosition() + 1) * track.clientWidth,
        behavior: "smooth",
      });
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [loop, count]);

  function startTouch() {
    touching.current = true;
    lastInteract.current = Date.now();
  }

  function endTouch() {
    touching.current = false;
    lastInteract.current = Date.now();
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onTouchStart={startTouch}
        onTouchEnd={endTouch}
        onTouchCancel={endTouch}
        onWheel={() => {
          lastInteract.current = Date.now();
        }}
        onMouseEnter={() => {
          hovering.current = true;
        }}
        onMouseLeave={() => {
          hovering.current = false;
          lastInteract.current = Date.now();
        }}
        className="flex w-full overflow-x-auto snap-x snap-mandatory rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((slide, index) => (
          <BannerSlide
            key={
              slide.clone ? `clone-${slide.clone}` : (slide.banner.id ?? index)
            }
            banner={slide.banner}
            products={slide.products}
            priority={!slide.clone && (loop ? index === 1 : index === 0)}
            ariaHidden={Boolean(slide.clone)}
          />
        ))}
      </div>

      {loop && (
        <div
          role="tablist"
          aria-label="Penanda banner"
          className="flex items-center justify-center gap-2"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.banner.id ?? index}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-label={`Banner ${index + 1}`}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all ${
                active === index ? "w-4 bg-black" : "w-2 bg-black/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
