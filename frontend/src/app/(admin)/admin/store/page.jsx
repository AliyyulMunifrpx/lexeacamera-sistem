"use client";

import { useEffect } from "react";
import Link from "next/link.js";
import Image from "next/image.js";
import {
  FiAlertCircle,
  FiEdit,
  FiExternalLink,
  FiFacebook,
  FiFileText,
  FiImage,
  FiInstagram,
  FiLoader,
  FiMapPin,
  FiMessageCircle,
  FiMusic,
  FiRefreshCw,
  FiShoppingBag,
} from "react-icons/fi";

import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import { useGetStore } from "../../../features/store/hooks.js";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

function isEmbeddableMapUrl(url) {
  return (
    typeof url === "string" &&
    url.startsWith("https://www.google.com/maps/embed")
  );
}

export default function StorePage() {
  const query = useGetStore();

  const { data: store, isPending, isError, isFetching, error, refetch } = query;

  const isStoreNotFound =
    isError && error?.response?.data?.errors === "STORE_NOT_FOUND";

  useEffect(() => {
    if (!isError || !error || isStoreNotFound) return;

    notify.error(normalizeApiError(error).message);
  }, [isError, error, isStoreNotFound]);

  if (isPending) {
    return (
      <div
        className="flex min-h-64 items-center justify-center gap-3"
        role="status"
        aria-live="polite"
      >
        <FiLoader className="animate-spin text-second" size={22} />
        <span className="text-sm text-second/60">Memuat profil toko...</span>
      </div>
    );
  }

  if (isStoreNotFound) {
    return (
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-second/20 px-6 py-16 text-center">
        <FiShoppingBag size={36} className="text-second/30" />

        <div>
          <h2 className="font-semibold text-second">
            Profil toko belum dibuat
          </h2>

          <p className="mt-2 max-w-sm text-sm text-second/60">
            Buat profil toko untuk mengatur identitas, informasi kontak, logo,
            banner utama, serta syarat dan ketentuan.
          </p>
        </div>

        <Link
          href="/admin/store/create"
          className={`inline-flex items-center justify-center rounded-full bg-second px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-second/80 ${FOCUS_RING}`}
        >
          Buat profil toko
        </Link>
      </div>
    );
  }

  if (isError && !store) {
    return (
      <div className="space-y-4 rounded-2xl border border-second/30 p-6">
        <div className="flex items-center gap-2">
          <FiAlertCircle size={20} className="text-second" />
          <h2 className="font-semibold text-second">
            Gagal memuat profil toko
          </h2>
        </div>

        <p className="text-sm text-second/60">
          Periksa koneksi atau sesi Anda, kemudian coba kembali.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const contacts = [
    { icon: FiMessageCircle, label: "WhatsApp", value: store?.whatsapp },
    { icon: FiInstagram, label: "Instagram", value: store?.instagram },
    { icon: FiMusic, label: "TikTok", value: store?.tiktok },
    { icon: FiFacebook, label: "Facebook", value: store?.facebook },
  ];

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="">
          <div className="flex items-center gap-2">
            <FiShoppingBag size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Profil Toko
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            Informasi dan identitas toko yang digunakan pada aplikasi.
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-fit">
          {" "}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data dashboard"
            className={`inline-flex px-4 py-2 items-center gap-2 rounded-full border border-second/30 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={isFetching ? "animate-spin" : ""}
            />
            {isFetching ? "Memperbarui..." : "Perbarui"}
          </button>
          <Link
            href="/admin/store/edit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-4 w-full md:w-fit py-2 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
          >
            <FiEdit size={18} />
            Edit Toko
          </Link>
        </div>
      </div>

      <div
        className={`space-y-6 transition-opacity duration-200 ${
          isFetching ? "opacity-50" : "opacity-100"
        }`}
      >
        <section className="flex flex-col items-center">
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-second/10 bg-grad">
            {store.main_banner_url ? (
              <Image
                src={store.main_banner_url}
                alt="Banner utama toko"
                width={1920}
                height={1080}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-primary/70">
                <FiImage size={24} />
                <span className="text-xs">
                  Banner utama belum diisi (1920 × 1080 px)
                </span>
              </div>
            )}
          </div>

          <div className="relative -mt-8 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-primary bg-primary text-second ring-1 ring-second/10">
            {store.logo_url ? (
              <Image
                src={store.logo_url}
                alt={`Logo ${store.name}`}
                width={128}
                height={128}
                className="h-full w-full object-contain"
              />
            ) : (
              <FiShoppingBag size={24} />
            )}
          </div>

          <h2 className="mt-4 max-w-full break-words text-center text-2xl font-bold tracking-tight text-second sm:text-3xl">
            {store.name}
          </h2>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-second/10 p-4 sm:p-6 h-full">
            <div className="flex items-center gap-2">
              <FiMessageCircle size={16} className="shrink-0 text-second" />
              <h2 className="text-lg font-bold text-second">
                Informasi kontak
              </h2>
            </div>

            <ul className="mt-4 divide-y divide-second/10">
              {contacts.map(({ icon: Icon, label, value }) => (
                <li
                  key={label}
                  className="flex min-w-0 items-center gap-4 py-4"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-second/5 text-second">
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs text-second/60">{label}</p>

                    <p
                      className={`mt-1 break-words text-sm font-semibold ${
                        value ? "text-second" : "text-second/40"
                      }`}
                    >
                      {value || "Belum diisi"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="h-full min-w-0 rounded-2xl border border-second/10 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <FiMapPin size={16} className="shrink-0 text-second" />
              <h2 className="text-lg font-bold text-second">Alamat toko</h2>
            </div>

            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-second">
              {store.address || "Alamat belum diisi"}
            </p>

            <div className="mt-4 border-t border-second/10 pt-4">
              <p className="text-xs text-second/60">Lokasi di peta</p>

              {isEmbeddableMapUrl(store.map_url) ? (
                <div className="mt-2 aspect-video w-full overflow-hidden rounded-2xl border border-second/10 bg-second/5">
                  <iframe
                    src={store.map_url}
                    title={`Peta lokasi ${store.name}`}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full w-full border-0"
                  />
                </div>
              ) : store.map_url ? (
                <a
                  href={store.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-second/30 px-4 py-2 text-sm font-semibold text-second transition-colors hover:bg-second/5 ${FOCUS_RING}`}
                >
                  <FiExternalLink size={16} className="shrink-0" />
                  <span className="truncate">Buka di Google Maps</span>
                </a>
              ) : (
                <p className="mt-2 text-sm font-semibold text-second/40">
                  Link peta belum diisi
                </p>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-second/10 p-4 sm:p-6 md:col-span-2">
            <div className="flex items-center gap-2">
              <FiFileText size={16} className="shrink-0 text-second" />
              <h2 className="text-lg font-bold text-second">
                Syarat dan ketentuan
              </h2>
            </div>

            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-second/80">
              {store.terms_and_condition || "Syarat dan ketentuan belum diisi"}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
