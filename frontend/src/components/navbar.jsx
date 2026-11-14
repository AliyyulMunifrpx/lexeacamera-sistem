"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { usePathname, useRouter } from "next/navigation.js";
import { IoClose, IoSearchSharp } from "react-icons/io5";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
import { SiShopee } from "react-icons/si";

/* Daftar menu. Tambah, hapus, atau ubah urutan cukup di sini. */
const MENU_ITEMS = [
  { label: "Beranda", href: "/" },
  { label: "Produk", href: "/products" },
  { label: "Kontak", href: "/contact" },
  { label: "Syarat dan Ketentuan", href: "/terms-and-condition" },
];

const SEARCH_PATH = "/products";
const WA_MESSAGE = "Halo, saya ingin bertanya.";
const DESKTOP_QUERY = "(min-width: 1024px)"; // sama dengan breakpoint lg

/* Tambah https:// kalau link dari database belum punya protokol. */
function normalizeUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/* 0812-3456 / +62 812 3456 -> 628123456 */
function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

/**
 * instagram: store.instagram
 * shopee: store.facebook (kolom facebook dipakai untuk link Shopee)
 * whatsapp: nomor WA toko (store.phone atau kolom WA yang kamu pakai)
 */
export default function Navbar({
  logo,
  name,
  instagram = "",
  shopee = "",
  whatsapp = "",
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const burgerRef = useRef(null);
  const closeRef = useRef(null);
  const searchBtnRef = useRef(null);
  const searchInputRef = useRef(null);

  const instagramUrl = normalizeUrl(instagram);
  const shopeeUrl = normalizeUrl(shopee);
  const phone = normalizePhone(whatsapp);
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(WA_MESSAGE)}`
    : "";

  const socials = [
    { label: "Instagram", href: instagramUrl, icon: FaInstagram },
    { label: "Shopee", href: shopeeUrl, icon: SiShopee },
  ].filter((item) => item.href);

  // Tutup menu dan pencarian kalau pindah halaman.
  useEffect(() => {
    setOpen(false);
    setSearching(false);
  }, [pathname]);

  // Layar membesar ke desktop: tutup panel burger dan pencarian mobile.
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    function handleChange(event) {
      if (event.matches) {
        setOpen(false);
        setSearching(false);
      }
    }
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  // Menu terbuka: kunci scroll, Escape menutup, fokus ke tombol tutup.
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Pencarian mobile terbuka: fokus ke input.
  useEffect(() => {
    if (searching) searchInputRef.current?.focus({ preventScroll: true });
  }, [searching]);

  function closeMenu() {
    setOpen(false);
    burgerRef.current?.focus();
  }

  function closeSearch() {
    setSearching(false);
    searchBtnRef.current?.focus();
  }

  function handleSearch(event) {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) return;
    router.push(`${SEARCH_PATH}?search=${encodeURIComponent(keyword)}`);
    setSearching(false);
  }

  function handleBurger() {
    if (searching) closeSearch();
    else setOpen(true);
  }

  return (
    <>
      {/* ------------------------------ Mobile ------------------------------ */}
      <div className="h-16 w-full fixed top-0 left-0 bg-primary px-4 z-30 overflow-hidden backdrop-blur-md lg:hidden">
        {/*
          Grid 4 kolom: logo | ikon cari | input | burger.
          Idle:      logo melebar, input 0.
          Mencari:   logo 0, input melebar -> ikon cari bergeser ke kiri.
        */}

        <form
          role="search"
          onSubmit={handleSearch}
          className={`grid h-full w-full items-center transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
            searching
              ? "[grid-template-columns:0fr_2.5rem_1fr_2rem]"
              : "[grid-template-columns:1fr_2.5rem_0fr_2rem]"
          }`}
        >
          {/* Logo + nama */}
          <div
            aria-hidden={searching || undefined}
            className={`flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap transition-opacity duration-300 motion-reduce:transition-none ${
              searching ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <div className="aspect-square relative h-8 shrink-0">
              <Image
                alt="store logo"
                src={logo}
                fill
                className="rounded-full w-full h-full"
              />
            </div>

            <h2 className="text-3xl text-grad font-bold">{name}</h2>
          </div>

          {/* Ikon cari: membuka pencarian, atau mengirim kalau sudah terbuka */}
          <button
            ref={searchBtnRef}
            type={searching ? "submit" : "button"}
            onClick={searching ? undefined : () => setSearching(true)}
            aria-label={searching ? "Kirim pencarian" : "Cari produk"}
            className="flex size-8 items-center justify-center"
          >
            <IoSearchSharp className="w-8 h-8 text-second" aria-hidden="true" />
          </button>

          {/* Input pencarian: melebar ke kanan dari ikon cari */}
          <div className="min-w-0 overflow-hidden">
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Cari produk"
              autoComplete="off"
              enterKeyHint="search"
              tabIndex={searching ? undefined : -1}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeSearch();
              }}
              placeholder="Cari kamera…"
              className={`h-10 w-[calc(100%-0.5rem)] rounded-full border border-second/30 bg-primary px-4 text-base text-second outline-none transition-[opacity,visibility] duration-300 focus:border-second4 motion-reduce:transition-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden ${
                searching ? "visible opacity-100" : "invisible opacity-0"
              }`}
            />
          </div>

          {/* Burger: berubah jadi X saat pencarian terbuka */}
          <button
            ref={burgerRef}
            type="button"
            onClick={handleBurger}
            aria-label={searching ? "Tutup pencarian" : "Buka menu"}
            aria-expanded={searching ? undefined : open}
            aria-controls={searching ? undefined : "mobile-menu"}
            className="flex size-8 flex-col items-center justify-center gap-1.5"
          >
            <span
              aria-hidden="true"
              className={`block h-0.5 w-6 rounded-full bg-second transition-transform duration-300 motion-reduce:transition-none ${
                searching ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              aria-hidden="true"
              className={`block h-0.5 w-6 rounded-full bg-second transition-opacity duration-300 motion-reduce:transition-none ${
                searching ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              aria-hidden="true"
              className={`block h-0.5 w-6 rounded-full bg-second transition-transform duration-300 motion-reduce:transition-none ${
                searching ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </button>
        </form>
      </div>

      {/* Latar gelap (mobile) */}
      <div
        onClick={closeMenu}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel menu (mobile) */}
      <nav
        id="mobile-menu"
        aria-label="Menu utama"
        className={`fixed top-0 right-0 z-50 flex h-dvh w-72 max-w-[80%] flex-col bg-primary shadow-2xl transition-all backdrop-blur-md duration-300 motion-reduce:transition-none lg:hidden ${
          open ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <span className="text-xl font-bold text-grad">Menu</span>
          <button
            ref={closeRef}
            type="button"
            onClick={closeMenu}
            aria-label="Tutup menu"
          >
            <IoClose className="w-8 h-8 text-second" aria-hidden="true" />
          </button>
        </div>

        <ul className="flex flex-col gap-1 px-4 py-2">
          {MENU_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-xl  py-3 text-lg font-medium transition-colors ${
                    active
                      ? "bg-second/10 text-grad font-bold"
                      : "text-second hover:bg-second/5"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Tombol WhatsApp */}
        {waUrl && (
          <div className="w-full px-4 pt-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-grad px-4 py-3 text-base font-bold text-primary"
            >
              <FaWhatsapp className="w-5 h-5" aria-hidden="true" />
              Ngobrol dengan kami
            </a>
          </div>
        )}

        {/* Sosial media di dasar panel */}
        {socials.length > 0 && (
          <div className="mt-auto flex items-center justify-center gap-4 border-t border-second/10 px-4 py-4">
            {socials.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex size-10 items-center justify-center rounded-full bg-second/5 text-second transition-colors hover:text-second4"
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ------------------------------ Desktop ----------------------------- */}
      <header className="fixed top-0 left-0 z-30 hidden h-16 w-full bg-primary lg:block">
        <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-8 px-4">
          {/* Kiri: logo + nama */}
          <Link href="/" className="flex w-fit items-center gap-2">
            <div className="aspect-square relative h-8">
              <Image
                alt="store logo"
                src={logo}
                fill
                className="rounded-full w-full h-full"
              />
            </div>
            <span className="text-3xl text-grad font-bold">{name}</span>
          </Link>

          {/* Tengah: menu */}
          <nav aria-label="Menu desktop">
            <ul className="flex items-center justify-center gap-16">
              {MENU_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block whitespace-nowrap border-b-2 py-1 text-base font-medium transition-colors ${
                        active
                          ? "border-grad text-second2 font-bold"
                          : "border-transparent text-second hover:text-second2"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Kanan: cari + WhatsApp, mepet kanan */}
          <div className="flex items-center justify-end gap-2">
            {/* Wrapper selebar tetap supaya tombol WA tidak bergeser */}
            <form
              role="search"
              onSubmit={handleSearch}
              className="relative h-10 w-40 shrink-0"
            >
              {/* Kotak ini menempel di kanan dan melebar ke kiri saat fokus */}
              <div className="absolute right-0 top-0 h-10 w-40 transition-[width] duration-300 ease-out focus-within:w-72 motion-reduce:transition-none">
                <IoSearchSharp
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-second/60"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Cari produk"
                  autoComplete="off"
                  enterKeyHint="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari kamera…"
                  className="h-10 w-full rounded-full border border-second/30 bg-primary pl-10 pr-4 text-base text-second outline-none focus:border-second4 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden"
                />
              </div>
            </form>

            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-grad px-4 py-2 text-base font-bold text-primary"
              >
                <FaWhatsapp className="w-5 h-5" aria-hidden="true" />
                Ngobrol dengan kami
              </a>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
