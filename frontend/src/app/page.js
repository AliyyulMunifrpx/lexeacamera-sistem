"use client";
import Image from "next/image";
import { useGetHome } from "./features/public/hooks.js";
import { useEffect } from "react";
import { CiSearch } from "react-icons/ci";
import Link from "next/link.js";
import { normalizeApiError } from "../lib/api/errors.js";
import notify from "../lib/notify.js";

export default function Home() {
  const { data, isLoading, isError, error } = useGetHome();

  // Karena cuma ada 1 best seller di DB, ambil index [0]-nya langsung
  const bestSellingBanner = data?.banners?.find(
    (item) => item.is_best_seller === true,
  );
  const promoBanner = data?.banners?.find((item) => item.is_promo === true);
  useEffect(() => {
    if (!isError || !error) return;

    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);

  // Kalau masih loading, tampilkan placeholder supaya gak error
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-primary">
        <p className="animate-pulse text-sm text-second/60">Memuat toko...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-primary">
      <div className="relative w-full">
        {/* 1. BAGIAN BANNER UTAMA */}
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-second/10">
          {data?.store?.main_banner_url ? (
            <Image
              alt={`${data?.store?.name || "Toko"} banner`}
              src={data.store.main_banner_url}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-second/40">
              Banner belum tersedia
            </div>
          )}
        </div>

        <div className="absolute w-[80%] top-2 left-1/2 -translate-x-1/2 rounded-lg backdrop-blur-xs flex gap-2 bg-second/30 items-center px-2 py-1">
          <CiSearch />
          <input
            type="text"
            className="text-sm font-extralight outline-none bg-transparent w-full text-primary placeholder:text-primary/60"
            placeholder="Cari produk di toko ini"
          />
        </div>

        {/* 2. BAGIAN LOGO BULAT */}
        <div className="flex justify-center">
          <div className="-mt-8 sm:-mt-16 flex aspect-square w-16 sm:w-32 items-center justify-center overflow-hidden rounded-full bg-primary shadow-xl z-20 border-4 border-primary">
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

      {/* Navigasi Tab */}
      <div className="w-full h-fit flex justify-between text-second font-normal mt-8 text-xs">
        <div className="flex flex-col gap-2 w-full px-2">
          <Link
            href={"/"}
            className="text-center w-full text-grad font-semibold"
          >
            Toko
          </Link>
          <div className="h-[2px] w-full bg-grad"></div>
        </div>
        <div className="flex flex-col gap-2 w-full px-2">
          <Link href={"/"} className="text-center w-full">
            Produk
          </Link>
          <div className="h-[2px] w-full"></div>
        </div>
        <div className="flex flex-col gap-2 w-full px-2">
          <Link href={"/"} className="text-center w-full">
            Kategori
          </Link>
          <div className="h-[2px] w-full"></div>
        </div>
        <div className="flex flex-col gap-2 w-full px-2">
          <Link href={"/"} className="text-center w-full">
            Kontak
          </Link>
          <div className="h-[2px] w-full"></div>
        </div>
      </div>

      <div className="w-full min-h-[100dvh] p-4">
        <div className="w-full h-full flex flex-col gap-4">
          <div className="w-full aspect-[2/3] relative">
            {" "}
            <div className="w-full aspect-[2/3] absolute inset-0 ">
              {bestSellingBanner?.banner_url ? (
                <Image
                  src={bestSellingBanner.banner_url}
                  alt="best selling banner"
                  fill
                  className=""
                />
              ) : (
                <div className="w-full h-full bg-grad"></div>
              )}
            </div>
            <div className="w-full absolute aspect-square bottom-0 left-0 grid grid-cols-2 p-4 gap-4">
              {data?.best_selling_cameras.map((item, i) => {
                return (
                  <Link
                    href={`/${item.id}`}
                    key={item.id}
                    className="w-full aspect-square relative mt-auto mx-auto"
                  >
                    <Image
                      alt={`${item.name} photo`}
                      fill
                      src={item.image_url}
                    ></Image>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="w-full aspect-[2/3] relative">
            {" "}
            <div className="w-full aspect-[2/3] absolute inset-0 ">
              {promoBanner?.banner_url ? (
                <Image
                  src={promoBanner.banner_url}
                  alt="best selling banner"
                  fill
                  className=""
                />
              ) : (
                <div className="w-full h-full bg-grad"></div>
              )}
            </div>
            <div className="w-full absolute aspect-square bottom-0 left-0 grid grid-cols-2 p-4 gap-4">
              {data?.promo_cameras.map((item, i) => {
                return (
                  <Link
                    href={`/${item.id}`}
                    key={item.id}
                    className="w-full aspect-square relative mt-auto mx-auto"
                  >
                    <Image
                      alt={`${item.name} photo`}
                      fill
                      src={item.image_url}
                    ></Image>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="w-full grid grid-cols-2">
            {data?.cameras.map((item) => {
              return (
                <div
                  key={item.id}
                  className="w-40 h-50 bg-black flex flex-col gap-4"
                >
                  <div className="w-full aspect-square relative">
                    <Image
                      alt={`${item.name} photo`}
                      src={item.image_url}
                      fill
                    ></Image>{" "}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
