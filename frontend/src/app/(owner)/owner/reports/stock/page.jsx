"use client";

import { useState } from "react";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBox,
  FiLayers,
  FiLoader,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";

import { useGetReportStockValue } from "../../../../features/reports/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";

/* -------------------------------------------------------------------------- */
/*  Design rules                                                              */
/* -------------------------------------------------------------------------- */

const BACK_PATH = "/owner/reports";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

/* -------------------------------- Formatters ------------------------------ */

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

function formatRupiah(value = 0) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "-" : ""}Rp ${new Intl.NumberFormat("id-ID").format(Math.abs(rounded))}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

/* ------------------------------ Error Mapping ----------------------------- */

function explainError(error) {
  const status = error?.response?.status;

  if (status === 401) {
    return {
      title: "Sesi Anda telah berakhir",
      description: "Silakan login ulang.",
    };
  }
  if (status === 403) {
    return {
      title: "Anda tidak punya akses",
      description: "Akun Anda tidak punya izin untuk membuka laporan ini.",
    };
  }
  if (status >= 500) {
    return {
      title: "Server sedang bermasalah",
      description: "Coba lagi beberapa saat.",
    };
  }
  if (error?.code === "ERR_NETWORK" || status === undefined) {
    return {
      title: "Koneksi ke server gagal",
      description: "Periksa koneksi internet Anda, lalu coba lagi.",
    };
  }
  return {
    title: "Gagal memuat nilai stok",
    description:
      normalizeApiError(error).message || "Terjadi kesalahan tak terduga.",
  };
}

/* ------------------------------ Small pieces ------------------------------ */

function StatCard({ icon: Icon, label, value, hint, tone = "neutral" }) {
  const iconTones = {
    neutral: "bg-grad text-primary shadow-lg shadow-second4/25",
    success: "bg-second3 text-primary shadow-lg shadow-second3/25",
    failure: "bg-second2 text-primary shadow-lg shadow-second2/25",
    pending: "bg-second4 text-primary shadow-lg shadow-second4/25",
  };

  return (
    <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${iconTones[tone]}`}
      >
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-second/60">{label}</p>
        <p className="mt-1 break-words text-lg font-bold tabular-nums text-second">
          {value}
        </p>
        {hint && (
          <p className="mt-0.5 truncate text-xs tabular-nums text-second/60">
            {hint}
          </p>
        )}
      </div>
    </article>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ error, onRetry, isFetching }) {
  const info = explainError(error);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center"
    >
      <FiAlertTriangle size={32} className="text-second2" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold text-second">{info.title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-second/60">
        {info.description}
      </p>
      <button
        type="button"
        onClick={onRetry}
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
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function StockReportPage() {
  const query = useGetReportStockValue();
  const data = query.data;
  const stock = data?.stock;
  const purchased = data?.purchased;
  const categories = data?.by_category ?? [];

  if (query.isPending) {
    return <LoadingState />;
  }

  if (query.isError && !query.data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <Link
            href={BACK_PATH}
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke laporan
          </Link>
        </header>
        <ErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          isFetching={query.isFetching}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <Link
          href={BACK_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke laporan
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
              <FiBox size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Nilai <span className="text-grad">Stok</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Posisi persediaan hari ini. Hanya kamera aktif dengan stok lebih
                dari nol.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              aria-label="Perbarui data"
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              <FiRefreshCw
                size={16}
                className={
                  query.isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : ""
                }
                aria-hidden="true"
              />
              {query.isFetching ? "Memperbarui…" : "Perbarui"}
            </button>
          </div>
        </div>

        {data?.as_of && (
          <p className="text-xs tabular-nums text-second/60">
            Snapshot per {formatDateTime(data.as_of)}
          </p>
        )}
      </header>

      {/* Ringkasan stok */}
      {stock && (
        <section
          aria-label="Ringkasan stok"
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${
            query.isFetching ? "opacity-60" : ""
          }`}
        >
          <StatCard
            icon={FiBox}
            label="Produk aktif"
            value={formatNumber(stock.products)}
            hint={`${formatNumber(stock.units)} unit tersedia`}
          />
          <StatCard
            icon={FiLayers}
            label="Nilai modal"
            value={formatRupiah(stock.cost_value)}
            hint="Modal × stok saat ini"
            tone="neutral"
          />
          <StatCard
            icon={FiTrendingUp}
            label="Nilai jual"
            value={formatRupiah(stock.price_value)}
            hint="Harga jual × stok saat ini"
            tone="success"
          />
          <StatCard
            icon={FiTrendingUp}
            label="Potensi profit"
            value={formatRupiah(stock.potential_profit)}
            hint="Jika semua stok terjual penuh"
            tone="pending"
          />
        </section>
      )}

      {/* Detail modal */}
      {purchased && (
        <section
          aria-label="Modal pembelian"
          className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
        >
          <div>
            <h2 className="text-lg font-bold text-second">Modal pembelian</h2>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Gambaran modal seluruh barang yang pernah dibeli: terjual + stok
              saat ini. Bukan modal per bulan.
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-second/[0.03] p-4">
              <dt className="text-xs text-second/60">Modal terjual</dt>
              <dd className="mt-2 text-lg font-bold tabular-nums text-second">
                {formatRupiah(purchased.sold_cost)}
              </dd>
              <p className="mt-2 text-xs text-second/60">
                Modal barang yang sudah terjual sepanjang waktu
              </p>
            </div>
            <div className="rounded-xl bg-second/[0.03] p-4">
              <dt className="text-xs text-second/60">Modal stok</dt>
              <dd className="mt-2 text-lg font-bold tabular-nums text-second">
                {formatRupiah(purchased.stock_cost)}
              </dd>
              <p className="mt-2 text-xs text-second/60">
                Modal barang yang masih ada di stok
              </p>
            </div>
            <div className="rounded-xl bg-grad p-4 text-primary shadow-lg shadow-second4/25">
              <dt className="text-xs text-primary/90">Total modal</dt>
              <dd className="mt-2 text-lg font-bold tabular-nums">
                {formatRupiah(purchased.total_cost)}
              </dd>
              <p className="mt-2 text-xs text-primary/90">
                Terjual + stok saat ini
              </p>
            </div>
          </dl>
        </section>
      )}

      {/* Per kategori */}
      <section
        aria-label="Nilai stok per kategori"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">
            Nilai stok per kategori
          </h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Diurutkan dari nilai modal terbesar. Kategori "Tanpa kategori"
            berisi kamera yang belum diberi kategori.
          </p>
        </div>

        {categories.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-second/30">
            <table className="min-w-full text-left">
              <thead className="bg-second/[0.03] text-xs text-second/70">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Kategori
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Produk
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Unit
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Nilai modal
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Nilai jual
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-second/10">
                {categories.map((cat, index) => (
                  <tr
                    key={cat.id ?? `no-category-${index}`}
                    className="transition-colors hover:bg-second4/5"
                  >
                    <td className="px-4 py-3 text-sm text-second">
                      {cat.name ?? "Tanpa kategori"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-second">
                      {formatNumber(cat.products)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-second">
                      {formatNumber(cat.units)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-second">
                      {formatRupiah(cat.cost_value)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-second">
                      {formatRupiah(cat.price_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-second/20 bg-primary px-4 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiBox size={24} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-semibold text-second">
              Belum ada stok tersedia
            </p>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              Tambahkan kamera dengan stok lebih dari nol agar nilai persediaan
              muncul di sini.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
