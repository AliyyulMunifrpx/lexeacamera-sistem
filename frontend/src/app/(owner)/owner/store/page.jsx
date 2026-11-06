"use client";

import { useEffect } from "react";
import Link from "next/link.js";
import Image from "next/image.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
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
  FiPlus,
  FiRefreshCw,
  FiShoppingBag,
} from "react-icons/fi";

import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import { useGetStore } from "../../../features/store/hooks.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

function isEmbeddableMapUrl(url) {
  return (
    typeof url === "string" &&
    url.startsWith("https://www.google.com/maps/embed")
  );
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ContactRow({ icon: Icon, label, value }) {
  return (
    <li className="flex min-w-0 items-start gap-4 py-2">
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-second/60">{label}</p>
        <p
          className={`mt-2 break-words text-sm font-semibold ${
            value ? "text-second" : "text-second/50"
          }`}
        >
          {value || "Belum diisi"}
        </p>
      </div>
    </li>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
        >
          <Icon size={16} />
        </div>
        <h2 className="text-lg font-bold text-second">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
        <div className="h-8 w-40 animate-pulse rounded-xl bg-second/10" />
      </header>
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
      </div>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

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
    return <LoadingState />;
  }

  if (isStoreNotFound) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiShoppingBag size={16} />
            </div>
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Profil <span className="text-grad">Toko</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Informasi dan identitas toko yang digunakan pada aplikasi.
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
            <FiShoppingBag size={24} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-second">
            Profil toko belum dibuat
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Buat profil toko untuk mengatur identitas, informasi kontak, logo,
            banner utama, serta syarat dan ketentuan.
          </p>
          <Link
            href="/owner/store/create"
            className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
          >
            <FiPlus size={16} aria-hidden="true" />
            Buat profil toko
          </Link>
        </div>
      </div>
    );
  }

  if (isError && !store) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiShoppingBag size={16} />
            </div>
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Profil <span className="text-grad">Toko</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Informasi dan identitas toko yang digunakan pada aplikasi.
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat profil toko
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau sesi Anda, kemudian coba kembali.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
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
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiShoppingBag size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Profil <span className="text-grad">Toko</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Informasi dan identitas toko yang digunakan pada aplikasi.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data toko"
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </button>

          <Link
            href="/owner/store/edit"
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
          >
            <FiEdit size={16} aria-hidden="true" />
            Edit Toko
          </Link>
        </div>
      </header>

      {/* Content */}
      <div
        className={`flex flex-col gap-8 transition-opacity duration-200 ${
          isFetching ? "opacity-40" : "opacity-100"
        }`}
      >
        {/* Banner + logo + nama */}
        <section className="flex flex-col items-center">
          <div className="aspect-[3/1] w-full overflow-hidden rounded-2xl border border-second/30 bg-second/10 shadow-xl shadow-second/5">
            {store.main_banner_url ? (
              <Image
                src={store.main_banner_url}
                alt="Banner utama toko"
                width={3000}
                height={1000}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-second/40">
                <FiImage size={28} aria-hidden="true" />
                <span className="text-xs">
                  Banner utama belum diisi (1920 × 1080 px)
                </span>
              </div>
            )}
          </div>

          <div className="relative -mt-12 flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-primary bg-primary text-second shadow-lg shadow-second4/20">
            {store.logo_url ? (
              <Image
                src={store.logo_url}
                alt={`Logo ${store.name}`}
                width={128}
                height={128}
                className="h-full w-full object-contain"
              />
            ) : (
              <FiShoppingBag size={24} aria-hidden="true" />
            )}
          </div>

          <h2 className="mt-4 max-w-full break-words text-center text-2xl font-bold tracking-tight text-second sm:text-3xl">
            {store.name}
          </h2>
        </section>

        {/* Grid panel */}
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
          <Panel title="Informasi kontak" icon={FiMessageCircle}>
            <ul className="divide-y divide-second/10">
              {contacts.map((contact) => (
                <ContactRow key={contact.label} {...contact} />
              ))}
            </ul>
          </Panel>

          <Panel title="Alamat toko" icon={FiMapPin}>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-second">
              {store.address || "Alamat belum diisi"}
            </p>

            <div className="border-t border-second/30 pt-4">
              <p className="text-xs text-second/60">Lokasi di peta</p>

              {isEmbeddableMapUrl(store.map_url) ? (
                <div className="mt-2 aspect-video w-full overflow-hidden rounded-xl border border-second/30">
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
                  className={`${BTN_BASE} mt-2 max-w-full border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                >
                  <FiExternalLink size={16} aria-hidden="true" />
                  <span className="truncate">Buka di Google Maps</span>
                </a>
              ) : (
                <p className="mt-2 text-sm text-second/50">
                  Link peta belum diisi
                </p>
              )}
            </div>
          </Panel>

          <div className="md:col-span-2">
            <Panel title="Syarat dan ketentuan" icon={FiFileText}>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-second/80">
                {store.terms_and_condition ||
                  "Syarat dan ketentuan belum diisi"}
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
