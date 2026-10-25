"use client";
import Image from "next/image";
import { useGetHome } from "./features/public/hooks.js";
import { useEffect, useRef, useState } from "react";
import { CiSearch } from "react-icons/ci";
import { normalizeApiError } from "../lib/api/errors.js";
import notify from "../lib/notify.js";
import StoreHomePage from "../components/public/home/store-page.jsx";

const TABS = [
  { key: "toko", label: "Toko" },
  { key: "produk", label: "Produk" },
  { key: "kategori", label: "Kategori" },
  { key: "kontak", label: "Kontak" },
];

// Placeholder sementara. Ganti dengan komponen asli kalau sudah dibuat.
function PlaceholderPanel({ title }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-second/20 text-sm text-second/50">
      Halaman {title} menyusul
    </div>
  );
}

export default function Home() {
  const { data, isLoading, isError, error } = useGetHome();

  const navRef = useRef(null);
  const scrollerRef = useRef(null);
  const panelRefs = useRef([]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [panelHeight, setPanelHeight] = useState(null);

  useEffect(() => {
    if (!isError || !error) return;

    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);

  // Tinggi container mengikuti tinggi panel yang sedang aktif.
  useEffect(() => {
    if (isLoading) return;

    const panel = panelRefs.current[activeIndex];
    if (!panel) return;

    const updateHeight = () => setPanelHeight(panel.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);

    return () => observer.disconnect();
  }, [activeIndex, isLoading]);

  // Dipanggil saat user menggeser: hitung panel mana yang sedang tampil.
  function handleScroll(event) {
    const el = event.currentTarget;
    if (!el.clientWidth) return;

    const index = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.min(Math.max(index, 0), TABS.length - 1);

    if (clamped !== activeIndex) setActiveIndex(clamped);
  }

  // Dipanggil saat tab diklik: geser ke panel yang dipilih.
  function goToTab(index) {
    const el = scrollerRef.current;
    if (!el) return;

    // Kalau bar tab sedang menempel di atas (halaman sudah discroll),
    // naikkan halaman ke awal konten supaya panel baru mulai dari atas.
    const nav = navRef.current;
    if (nav && nav.getBoundingClientRect().top <= 0) {
      const navTop = nav.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: navTop, behavior: "smooth" });
    }

    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  // Kalau masih loading, tampilkan placeholder supaya gak error
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-primary">
        <p className="animate-pulse text-sm text-second/60">Memuat toko...</p>
      </div>
    );
  }

  const panels = [
    <StoreHomePage key="toko" data={data} />,
    <PlaceholderPanel key="produk" title="Produk" />,
    <PlaceholderPanel key="kategori" title="Kategori" />,
    <PlaceholderPanel key="kontak" title="Kontak" />,
  ];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-primary">
      <div className="relative w-full">
        {/* 1. BAGIAN BANNER UTAMA */}
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-second/10">
          {data?.store?.main_banner_url ? (
            <Image
              alt={`${data?.store?.name || "Toko"} banner`}
              src={data.store.main_banner_url}
              width={3000}
              height={1000}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-second/40">
              Banner belum tersedia
            </div>
          )}
        </div>

        <div className="absolute w-[80%] top-2 left-1/2 -translate-x-1/2 rounded-lg backdrop-blur-xs flex gap-2 bg-second/30 items-center px-2 py-2">
          <CiSearch />
          <input
            type="text"
            className="text-sm font-extralight outline-none bg-transparent w-full text-primary placeholder:text-primary/60"
            placeholder="Cari produk di toko ini"
          />
        </div>

        {/* 2. BAGIAN LOGO BULAT */}
        <div className="flex justify-center">
          <div className="-mt-8 sm:-mt-16 flex aspect-square w-16 sm:w-32 items-center justify-center overflow-hidden rounded-full bg-primary z-20 border-4 border-primary">
            {data?.store?.logo_url ? (
              <Image
                src={data.store.logo_url}
                alt="Logo Toko"
                width={128}
                height={128}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-[10px] text-second/50">Logo</div>
            )}
          </div>
        </div>
      </div>

      {/* Navigasi Tab: menempel di atas layar saat discroll */}
      <div
        ref={navRef}
        role="tablist"
        className="sticky top-0 z-30 mt-4 flex h-fit w-full justify-between border-b border-second/10 bg-primary pt-4 text-sm font-normal text-second"
      >
        {TABS.map((tab, index) => {
          const isActive = activeIndex === index;

          return (
            <div key={tab.key} className="flex flex-col gap-2 w-full px-2">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => goToTab(index)}
                className={`text-center w-full transition-colors ${
                  isActive ? "text-grad font-semibold" : ""
                }`}
              >
                {tab.label}
              </button>
              <div
                className={`h-[2px] w-full transition-colors ${
                  isActive ? "bg-grad" : ""
                }`}
              ></div>
            </div>
          );
        })}
      </div>

      {/* Konten: bisa digeser horizontal, ikut berganti dengan tab di atas */}
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        style={panelHeight ? { height: panelHeight } : undefined}
        className="flex w-full snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden overscroll-x-contain transition-[height] duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {panels.map((panel, index) => (
          <div
            key={TABS[index].key}
            ref={(node) => {
              panelRefs.current[index] = node;
            }}
            role="tabpanel"
            className="w-full shrink-0 snap-center snap-always p-4"
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}
