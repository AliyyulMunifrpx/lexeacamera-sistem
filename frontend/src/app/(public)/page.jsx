"use client";

import Image from "next/image.js";
import Link from "next/link.js";
import { useGetHome, useGetPublicStore } from "./../features/public/hooks.js";
import BannerCarousel, {
  BannerSlide,
} from "../../components/public/home/banner-carousel.jsx";
import CameraSection from "../../components/public/home/cameras-page.jsx";

const SKELETON = "animate-pulse rounded-xl bg-second/10";

function HomeSkeleton() {
  return (
    <div role="status" aria-label="Memuat beranda" className="contents">
      {/* Banner promo / best seller */}
      <div className="lg:hidden">
        <div className={`${SKELETON} aspect-[2/3] w-full`} />
      </div>
      <div className="hidden grid-cols-3 gap-4 lg:grid">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={`${SKELETON} aspect-[2/3] w-full`} />
        ))}
      </div>

      {/* Judul */}
      <div className="py-4">
        <div className="h-7 w-48 animate-pulse rounded bg-second/10" />
      </div>

      {/* Grid produk */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className={`${SKELETON} aspect-square w-full`} />
            <div className="h-4 w-3/4 animate-pulse rounded bg-second/10" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-second/10" />
          </div>
        ))}
      </div>

      <span className="sr-only">Memuat…</span>
    </div>
  );
}

export default function Home() {
  const { data: store, isPending: storePending } = useGetPublicStore();
  const {
    data: homeData,
    isPending: homePending,
    isError: homeError,
    refetch,
    isFetching,
  } = useGetHome();

  const cameras = homeData?.cameras;
  const promoCamera = homeData?.promo_cameras ?? [];
  const bestSellingCamera = homeData?.best_selling_cameras ?? [];
  console.log(store?.main_banner_url);
  // Promo / best seller hanya tampil kalau ada produknya. Banner reguler tanpa produk.
  const slides = (homeData?.banners ?? []).flatMap((banner) => {
    if (banner.is_promo) {
      return promoCamera.length > 0 ? [{ banner, products: promoCamera }] : [];
    }
    if (banner.is_best_seller) {
      return bestSellingCamera.length > 0
        ? [{ banner, products: bestSellingCamera }]
        : [];
    }
    return [{ banner, products: [] }];
  });

  // Kunci berubah kalau susunan slide berubah, supaya carousel mulai ulang dengan benar.
  const slidesKey = slides.map((slide) => slide.banner.id).join("|");

  return (
    <div className="w-full min-h-[100dvh] bg-second/10 px-4 pt-16 flex flex-col gap-4">
      {/* Banner utama */}
      <div className="w-full aspect-[3/1] relative">
        {store?.main_banner_url ? (
          <Image
            alt={`${store?.name || "Store"} main banner`}
            src={store?.main_banner_url}
            fill
            sizes="100vw"
            className="rounded-xl object-cover"
          />
        ) : (
          storePending && <div className={`${SKELETON} absolute inset-0`} />
        )}
      </div>

      {homePending ? (
        <HomeSkeleton />
      ) : homeError && !homeData ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-second/30 bg-primary px-4 py-16 text-center">
          <p role="alert" className="font-semibold text-second">
            Gagal memuat beranda.
          </p>
          <p className="text-sm text-second/60">
            Periksa koneksi Anda, lalu coba lagi.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-full bg-grad px-4 py-2 text-sm font-bold text-primary disabled:opacity-60"
          >
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      ) : (
        <>
          {slides.length > 0 && (
            <>
              {/* HP/tablet: carousel */}
              <div className="lg:hidden">
                <BannerCarousel key={slidesKey} slides={slides} />
              </div>

              {/* Desktop: berjajar 3 kolom, tanpa carousel */}
              <div className="hidden grid-cols-3 gap-4 lg:grid">
                {slides.map((slide, index) => (
                  <div
                    key={slide.banner.id ?? index}
                    className="overflow-hidden rounded-xl"
                  >
                    <BannerSlide
                      banner={slide.banner}
                      products={slide.products}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-xl py-4 text-second">
            Rekomendasi <span className="font-bold text-grad">Untukmu</span>
          </p>

          <CameraSection data={cameras} />
          <Link
            className="w-full py-2 rounded-full bg-grad text-center text-primary font-bold my-4 lg:w-fit px-4 mx-auto"
            href={"/products"}
          >
            Lihat Produk Lengkap
          </Link>
        </>
      )}
    </div>
  );
}
