"use client";
import Image from "next/image";
import { useGetHome } from "./features/public/hooks.js";
import { useEffect, useRef, useState } from "react";
import { CiSearch } from "react-icons/ci";
import { normalizeApiError } from "../lib/api/errors.js";
import notify from "../lib/notify.js";
import StoreHomePage from "../components/public/home/store-page.jsx";
import CamerasHomePage from "../components/public/home/cameras-page.jsx";
import ContactHomePage from "../components/public/home/contact-page.jsx";
import TermsHomePage from "../components/public/home/terms-page.jsx";

const TABS = [
  { key: "toko", label: "Toko" },
  { key: "produk", label: "Produk" },
  { key: "kontak", label: "Kontak" },

  { key: "S&K", label: "S&K" },
];

const PRODUCT_TAB_INDEX = 1;

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
  const searchRequestId = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [panelHeight, setPanelHeight] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchRequest, setSearchRequest] = useState(null);

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
  // forceScrollToNav: naikkan halaman sampai bar tab berada di atas layar.
  function goToTab(index, { forceScrollToNav = false } = {}) {
    const el = scrollerRef.current;
    if (!el) return;

    const nav = navRef.current;
    if (nav) {
      const navRect = nav.getBoundingClientRect();

      // Kalau bar tab sedang menempel (halaman sudah discroll) atau diminta
      // paksa, posisikan halaman di awal konten supaya panel baru mulai dari atas.
      if (forceScrollToNav || navRect.top <= 0) {
        window.scrollTo({
          top: navRect.top + window.scrollY,
          behavior: "smooth",
        });
      }
    }

    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  // Enter di search bar: kirim kata kunci ke halaman produk lalu pindah tab.
  function handleSearchSubmit(event) {
    event.preventDefault();

    searchRequestId.current += 1;
    setSearchRequest({
      value: searchInput.trim(),
      id: searchRequestId.current,
    });

    // Tutup keyboard di HP.
    document.activeElement?.blur();

    goToTab(PRODUCT_TAB_INDEX, { forceScrollToNav: true });
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
    <CamerasHomePage key="produk" searchRequest={searchRequest} />,
    <ContactHomePage data={data} key="kontak" title="Kontak" />,
    <TermsHomePage data={data} key="S&K" title="S&K" />,
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

        <form
          role="search"
          onSubmit={handleSearchSubmit}
          className="absolute w-[80%] top-2 left-1/2 -translate-x-1/2 rounded-lg backdrop-blur-xs flex gap-2 bg-second/30 items-center px-2 py-2"
        >
          <CiSearch />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            enterKeyHint="search"
            maxLength={100}
            aria-label="Cari produk di toko ini"
            className="text-sm font-extralight outline-none bg-transparent w-full text-primary placeholder:text-primary/60"
            placeholder="Cari produk di toko ini"
          />
        </form>

        {/* 2. BAGIAN LOGO BULAT */}
        <div className="flex justify-center items-center gap-2">
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
          <div className="bg-primary text-base lg:text-4xl text-second px-2 h-8 lg:h-16 flex items-center rounded-full -mt-8 lg:-mt-16 z-20 font-semibold">
            {" "}
            <p className="">{data?.store?.name}</p>
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
            <div
              key={tab.key}
              className="flex flex-col gap-2 w-full px-2 lg:px-16"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => goToTab(index)}
                className={`text-center cursor-pointer w-full transition-colors ${
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
