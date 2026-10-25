"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiExternalLink,
  FiLoader,
  FiShoppingBag,
  FiShoppingCart,
  FiX,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";

import {
  useGetCamera,
  useGetCameras,
  useGetHome,
} from "../../features/public/hooks.js";
import { normalizeApiError } from "../../../lib/api/errors.js";
import notify from "../../../lib/notify.js";
// Sesuaikan path dua import ini dengan lokasi file kamu.
import MasonryGrid from "./../../../components/public/home/masonry-grid";
import CameraCard from "../../../components/public/home/camera-card.jsx";

const RELATED_LIMIT = 18;

const priceFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function formatPrice(value) {
  const number = Number(value);

  if (value === null || value === undefined || Number.isNaN(number)) {
    return "0";
  }

  return priceFormatter.format(number);
}

const CONDITION_LABEL = {
  NEW: "Baru",
  SECOND: "Bekas",
};

// Nomor dari API bisa "0823...", "62823...", atau "823...". Hasilnya selalu berawalan 62.
function normalizeWhatsapp(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

// Teks panjang: kalau tingginya lebih dari setengah tinggi layar,
// dipotong di setengah layar dan diberi tombol "Selengkapnya".
function ExpandableText({ text }) {
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const node = textRef.current;
    if (!node) return;

    function measure() {
      const max = Math.round(window.innerHeight / 2);
      setLimit(max);
      setOverflowing(node.scrollHeight > max);
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text]);

  const isClamped = overflowing && !expanded;

  return (
    <div>
      <div
        className="relative overflow-hidden"
        style={isClamped ? { maxHeight: limit } : undefined}
      >
        <p
          ref={textRef}
          className="whitespace-pre-line break-words text-sm text-second/70"
        >
          {text}
        </p>

        {isClamped && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-primary to-transparent" />
        )}
      </div>

      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          aria-expanded={expanded}
          className="mt-2 text-sm font-light text-center w-full text-second/50 "
        >
          {expanded ? "Lebih sedikit ^" : "Selengkapnya ˅"}
        </button>
      )}
    </div>
  );
}

// Tombol pembelian. Dipakai dua kali: sebagai dock di HP dan sebagai blok di desktop.
function BuyButtons({
  variant,
  cameraId,
  isOutOfStock,
  hasMarketplaces,
  hasWhatsapp,
  onOpenMarketplaces,
  onWhatsapp,
}) {
  const isDock = variant === "dock";

  const secondaryClass = `flex h-12 items-center justify-center gap-2  text-sm font-semibold px-4 text-second transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-50 ${
    isDock ? "" : "w-full"
  }`;

  const primaryClass = `flex h-12 items-center justify-center gap-2 bg-second  text-sm font-semibold px-4 text-primary transition-colors hover:bg-second/80 ${
    isDock ? "flex-1" : "w-full"
  }`;

  return (
    <div className={isDock ? "flex items-center gap-2" : "flex flex-col gap-2"}>
      {hasMarketplaces && (
        <button
          type="button"
          onClick={onOpenMarketplaces}
          aria-label="Beli lewat marketplace"
          className={secondaryClass}
        >
          <FiShoppingBag size={24} />
          <span className={isDock ? "hidden min-[400px]:inline" : ""}>
            Marketplace
          </span>
        </button>
      )}

      {hasWhatsapp && (
        <button
          type="button"
          onClick={onWhatsapp}
          disabled={isOutOfStock}
          aria-label="Beli lewat WhatsApp"
          className={secondaryClass}
        >
          <FaWhatsapp size={24} />
          <span className={isDock ? "hidden min-[400px]:inline" : ""}>
            WhatsApp
          </span>
        </button>
      )}

      {isOutOfStock ? (
        <button
          type="button"
          disabled
          className={`${primaryClass} cursor-not-allowed opacity-50`}
        >
          <FiShoppingCart size={24} />
          Stok habis
        </button>
      ) : (
        <Link href={`/pesan?camera_id=${cameraId}`} className={primaryClass}>
          <FiShoppingCart size={24} />
          Beli langsung
        </Link>
      )}
    </div>
  );
}

function CameraDetailFallback() {
  return (
    <div className="flex h-[100dvh] items-center bg-primary justify-center gap-2 text-sm text-second/60">
      <FiLoader className="animate-spin" size={22} />
      Memuat detail kamera...
    </div>
  );
}

function CameraDetailContent() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const cameraQuery = useGetCamera(id);
  const homeQuery = useGetHome(); // sudah di-cache dari halaman utama, dipakai untuk nomor WhatsApp toko

  const sliderRef = useRef(null);

  const [activeImage, setActiveImage] = useState(0);
  const [showMarketplaces, setShowMarketplaces] = useState(false);

  // Response API: { data: {...} }. Dua bentuk ditangani, tergantung hook mengembalikan apa.
  const camera = cameraQuery.data?.data ?? cameraQuery.data;
  const store = homeQuery.data?.store;

  // Rekomendasi: kamera lain di kategori yang sama. Baru jalan setelah kategori diketahui.
  const categoryId = camera?.category?.id ?? "";
  const relatedQuery = useGetCameras(
    { category_id: categoryId, sort: "newest" },
    { enabled: Boolean(categoryId) },
  );
  const rawRelated = relatedQuery.data?.data ?? [];

  const relatedMasih = rawRelated.filter(
    (item) => item.id !== camera?.id && item.stock !== 0,
  );

  const relatedHabis = rawRelated.filter(
    (item) => item.id !== camera?.id && item.stock === 0,
  );

  const relatedCameras = [...relatedMasih, ...relatedHabis].slice(
    0,
    RELATED_LIMIT,
  );
  useEffect(() => {
    if (!cameraQuery.isError || !cameraQuery.error) return;

    const apiError = normalizeApiError(cameraQuery.error);
    notify.error(apiError.message);
  }, [cameraQuery.isError, cameraQuery.error]);

  // Pindah ke kamera lain (misalnya dari rekomendasi): reset galeri dan modal.
  const currentCameraId = camera?.id;
  useEffect(() => {
    setActiveImage(0);
    setShowMarketplaces(false);

    if (sliderRef.current) sliderRef.current.scrollLeft = 0;
  }, [currentCameraId]);

  // Modal marketplace: kunci scroll halaman dan tutup dengan tombol Escape.
  useEffect(() => {
    if (!showMarketplaces) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") setShowMarketplaces(false);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMarketplaces]);

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  // Geser foto: hitung foto mana yang sedang tampil.
  function handleSliderScroll(event, total) {
    const el = event.currentTarget;
    if (!el.clientWidth) return;

    const index = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.min(Math.max(index, 0), total - 1);

    if (clamped !== activeImage) setActiveImage(clamped);
  }

  // Klik thumbnail (desktop): geser slider ke foto itu.
  function goToImage(index) {
    const el = sliderRef.current;
    if (!el) return;

    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  if (cameraQuery.isPending) {
    return <CameraDetailFallback />;
  }

  if (cameraQuery.isError || !camera) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="font-semibold text-second">Kamera tidak ditemukan</h1>
        <p className="text-sm text-second/60">
          Produk ini mungkin sudah dihapus atau terjadi gangguan koneksi.
        </p>

        <div className="flex gap-2">
          <Link
            href="/"
            className="flex h-8 items-center rounded-full border border-second/15 px-4 text-sm font-semibold text-second"
          >
            Ke beranda
          </Link>

          <button
            type="button"
            onClick={() => cameraQuery.refetch()}
            disabled={cameraQuery.isFetching}
            className="flex h-8 items-center rounded-full bg-second px-4 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {cameraQuery.isFetching ? "Memuat..." : "Coba lagi"}
          </button>
        </div>
      </div>
    );
  }

  // Gambar utama selalu di urutan pertama.
  const images = [...(camera.images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  );

  const marketplaces = (camera.marketplaces ?? []).filter(
    (item) => item.product_url,
  );

  const isOutOfStock = Number(camera.stock) <= 0;
  const whatsapp = normalizeWhatsapp(store?.whatsapp);

  function buyViaWhatsapp() {
    const message = [
      "Halo, saya tertarik dengan produk ini:",
      `${camera.name} (${CONDITION_LABEL[camera.condition] ?? camera.condition})`,
      `Harga: Rp${formatPrice(camera.price)}`,
      window.location.href,
    ].join("\n");

    window.open(
      `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const buyButtonProps = {
    cameraId: camera.id,
    isOutOfStock,
    hasMarketplaces: marketplaces.length > 0,
    hasWhatsapp: Boolean(whatsapp),
    onOpenMarketplaces: () => setShowMarketplaces(true),
    onWhatsapp: buyViaWhatsapp,
  };

  return (
    <>
      {/* Konten halaman. space-y hanya berlaku di sini. */}
      <div className="mx-auto w-full space-y-4 bg-primary p-4 pb-[calc(5rem+max(0.5rem,env(safe-area-inset-bottom)))] md:pb-8">
        {/* Tombol kembali: menempel di atas layar saat discroll */}
        <div className="sticky top-0 z-30 -mx-4 -mt-4 bg-primary px-4 py-4">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 text-sm text-second/60 transition-colors hover:text-second"
          >
            <FiArrowLeft size={18} />
            Kembali
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-rows-[auto_1fr]">
          {/* Galeri. Di xl memanjang dua baris, di kiri info dan deskripsi. */}
          <div className="space-y-4 xl:row-span-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-second/5">
              {images.length > 0 ? (
                <div
                  ref={sliderRef}
                  onScroll={(event) => handleSliderScroll(event, images.length)}
                  className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative h-full w-full shrink-0 snap-center snap-always"
                    >
                      <Image
                        src={image.image_url}
                        alt={`${camera.name} ${index + 1}`}
                        fill
                        priority={index === 0}
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-second/40">
                  No image
                </div>
              )}

              {isOutOfStock && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="flex h-8 items-center rounded-full bg-primary px-4 text-sm font-semibold text-second">
                    Stok habis
                  </span>
                </div>
              )}

              {/* Indikator: foto sekarang / total foto */}
              {images.length > 1 && (
                <span
                  aria-live="polite"
                  className="pointer-events-none absolute bottom-2 right-2 flex h-8 items-center rounded-full bg-black/60 px-2 text-sm font-semibold text-white"
                >
                  {activeImage + 1}/{images.length}
                </span>
              )}
            </div>

            {/* Thumbnail hanya di desktop */}
            {images.length > 1 && (
              <div className="hidden grid-cols-5 gap-2 md:grid">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => goToImage(index)}
                    aria-label={`Lihat gambar ${index + 1}`}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-second/5 transition-colors ${
                      index === activeImage
                        ? "border-second"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={image.image_url}
                      alt={`${camera.name} ${index + 1}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="break-words text-base font-bold tracking-tight text-second">
                {camera.name}
              </h1>

              <p className="text-base font-semibold text-grad">
                <span className="text-base">Rp</span>
                {formatPrice(camera.price)}
              </p>

              <p className="text-sm text-second/60">
                {isOutOfStock ? "Stok habis" : `Stok tersedia: ${camera.stock}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="flex py-1 items-center rounded-full bg-second2 px-2 text-primary">
                {CONDITION_LABEL[camera.condition] ?? camera.condition}
              </span>

              {camera.category?.name && (
                <span className="flex py-1 items-center rounded-full border border-second/20 px-2 text-second/70">
                  {camera.category.name}
                </span>
              )}

              {camera.promo && (
                <span className="flex h-8 items-center rounded-full bg-red-500 px-2 text-white">
                  Promo
                </span>
              )}

              {camera.best_selling && (
                <span className="flex h-8 items-center rounded-full bg-yellow-500 px-2 text-black">
                  Best seller
                </span>
              )}
            </div>

            {/* Tombol beli versi desktop (di HP pakai dock di bawah layar) */}
            <div className="hidden md:block">
              <BuyButtons variant="inline" {...buyButtonProps} />
            </div>
          </div>

          {/* Deskripsi + kelengkapan.
              Di bawah xl: satu blok selebar halaman di bawah galeri dan info
              (2 kolom di md). Di xl: di kolom kanan, di bawah tombol beli,
              ditumpuk atas-bawah. */}
          {(camera.description || camera.inclusions) && (
            <div className="grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:grid-cols-1 xl:self-start">
              {camera.description && (
                <section className="space-y-2">
                  <h2 className="font-semibold text-second text-base">
                    Deskripsi
                  </h2>
                  <ExpandableText key={camera.id} text={camera.description} />
                </section>
              )}

              {camera.inclusions && (
                <section className="space-y-2">
                  <h2 className="font-semibold text-base text-second">
                    Kelengkapan
                  </h2>
                  <ExpandableText key={camera.id} text={camera.inclusions} />
                </section>
              )}
            </div>
          )}
        </div>

        {/* Kamu mungkin juga suka: kamera lain di kategori yang sama */}
        {relatedCameras.length > 0 && (
          <section className="space-y-4 pt-4">
            <h2 className="font-semibold text-sm text-center w-full text-second">
              ------- Kamu mungkin juga suka ------
            </h2>
            <div className="w-full grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {relatedCameras.map((item) => (
                <CameraCard key={item.id} data={item} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Dock tombol beli (HP). z-[60] supaya tetap di atas lapisan gelap modal. */}
      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-second/10 bg-primary md:hidden">
        <BuyButtons variant="dock" {...buyButtonProps} />
      </div>

      {/* Modal kecil marketplace: melayang di atas dock */}
      {showMarketplaces && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Pilih marketplace"
        >
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setShowMarketplaces(false)}
            className="absolute inset-0 bg-black/50"
          />

          {/* Di HP: margin bawah = tinggi dock (8 + 48 + 8px / safe area) + jarak 8px. */}
          <div className="relative mx-2 mb-[calc(4rem+max(0.5rem,env(safe-area-inset-bottom)))] w-[calc(100%-1rem)] max-w-md space-y-4 rounded-md bg-primary p-4 md:mx-0 md:mb-0 md:w-full">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-second">Beli di marketplace</h2>

              <button
                type="button"
                onClick={() => setShowMarketplaces(false)}
                aria-label="Tutup"
                className="flex size-8 items-center justify-center rounded-md text-second/50 transition-colors hover:bg-second/5 hover:text-second"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="max-h-[50dvh] space-y-4 overflow-y-auto">
              {marketplaces.map((marketplace) => (
                <a
                  key={marketplace.id}
                  href={marketplace.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-md transition-colors hover:bg-second/5"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                    {marketplace.logo_url ? (
                      <Image
                        src={marketplace.logo_url}
                        alt={`Logo ${marketplace.name}`}
                        width={80}
                        height={80}
                        unoptimized
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <FiShoppingBag size={18} className="text-second/40" />
                    )}
                  </div>

                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-second">
                    {marketplace.name}
                  </span>

                  <FiExternalLink
                    size={16}
                    className="shrink-0 text-second/30 transition-colors group-hover:text-second"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Suspense wajib karena useParams() membaca data runtime.
export default function CameraDetail() {
  return (
    <Suspense fallback={<CameraDetailFallback />}>
      <CameraDetailContent />
    </Suspense>
  );
}
