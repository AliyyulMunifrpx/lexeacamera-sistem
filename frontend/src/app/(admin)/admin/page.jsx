"use client";

import { useEffect, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiCamera,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiPackage,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";

import { useGetDashboard } from "../../features/dashboard/hooks.js";
import { normalizeApiError } from "../../../lib/api/errors.js";
import notify from "../../../lib/notify.js";

/* -------------------------------------------------------------------------- */
/*  Design rules                                                              */
/*  Spacing : only 2, 4, 8, 16 (padding, margin, gap, size, height)           */
/*  Color   : only primary, second, grad (opacity steps of the same color)    */
/* -------------------------------------------------------------------------- */

const CONDITION_LABEL = {
  NEW: "Baru",
  SECOND: "Bekas",
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

function formatPrice(value = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/70",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
  };

  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-second/20 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-second/5 text-second/40">
        <Icon size={24} />
      </div>
      <p className="text-sm font-medium text-second">{message}</p>
    </div>
  );
}

function ViewAllLink({ href, total }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-8 w-fit shrink-0 items-center rounded-full border border-second/30 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 ${FOCUS_RING}`}
    >
      Lihat semua ({formatNumber(total)})
    </Link>
  );
}

function Panel({ title, description, children, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-second/30 p-4 sm:p-8 ${className}`}
    >
      <div>
        <h2 className="text-lg font-bold text-second">{title}</h2>
        <p className="mt-2 text-sm text-second/60">{description}</p>
      </div>

      {children}
    </section>
  );
}

/* ------------------------------- Stat cards ------------------------------- */

function StatCard({ title, value, description, icon: Icon, featured = false }) {
  return (
    <article
      className={`flex min-w-0 flex-col justify-between gap-8 rounded-2xl p-4 sm:p-8 ${
        featured
          ? "bg-grad text-primary"
          : "border border-second/30 text-second"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            featured ? "bg-primary text-second" : "bg-grad text-primary"
          }`}
        >
          <Icon size={16} />
        </div>

        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      <div className="min-w-0">
        <p
          className={`break-words font-bold tracking-tight ${
            featured ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
          }`}
        >
          {value}
        </p>

        <p
          className={`mt-2 text-xs ${
            featured ? "text-primary/70" : "text-second/60"
          }`}
        >
          {description}
        </p>
      </div>
    </article>
  );
}

/* ------------------------------- Camera list ------------------------------ */

function CameraRow({ camera, showStock = false }) {
  const primaryImage =
    camera.images?.find((image) => image.is_primary) ?? camera.images?.[0];

  const condition = CONDITION_LABEL[camera.condition] ?? camera.condition;

  return (
    <li>
      <Link
        href={`/admin/cameras/${camera.id}`}
        className={`group flex min-w-0 items-center gap-4 py-4 ${FOCUS_RING}`}
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-second/5">
          {primaryImage?.image_url ? (
            <Image
              src={primaryImage.image_url}
              alt={camera.name}
              width={128}
              height={128}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <FiCamera size={24} className="text-second/30" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-second">
            {camera.name}
          </h3>

          <div className="mt-2 flex min-w-0 items-center gap-2">
            <p className="truncate text-xs text-second/60">
              {camera.category?.name ?? "Tanpa kategori"}
            </p>
            {condition && <Tag>{condition}</Tag>}
          </div>

          <p className="mt-2 text-sm font-bold text-second">
            {formatPrice(camera.price)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {showStock && (
            <Tag tone={camera.stock === 0 ? "solid" : "soft"}>
              {camera.stock === 0
                ? "Habis"
                : `${formatNumber(camera.stock)} unit`}
            </Tag>
          )}

          {camera.best_selling && <Tag tone="grad">Best seller</Tag>}
          {camera.promo && <Tag tone="grad">Promo</Tag>}
        </div>
      </Link>
    </li>
  );
}

function CameraPanel({ dashboard }) {
  const [activeKey, setActiveKey] = useState("best");

  const tabs = [
    {
      key: "best",
      label: "Best seller",
      description: "Kamera yang ditandai sebagai produk terlaris.",
      result: dashboard.best_selling_cameras,
      empty: "Belum ada kamera best seller.",
    },
    {
      key: "promo",
      label: "Promosi",
      description: "Kamera yang sedang ditandai untuk promosi.",
      result: dashboard.promo_cameras,
      empty: "Belum ada kamera promosi.",
    },
    {
      key: "low",
      label: "Stok menipis",
      description: "Kamera dengan stok maksimal tiga unit.",
      result: dashboard.low_stock_cameras,
      empty: "Tidak ada kamera dengan stok menipis.",
      showStock: true,
    },
  ];

  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const items = active.result?.items ?? [];
  const total = active.result?.total ?? 0;

  return (
    <Panel
      title="Katalog kamera"
      description="Pantau produk unggulan, promosi, dan stok yang perlu diisi ulang."
      className="xl:col-span-3"
    >
      <div
        role="tablist"
        aria-label="Daftar kamera"
        className="mt-8 flex gap-2 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`camera-tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls="camera-tabpanel"
              onClick={() => setActiveKey(tab.key)}
              className={`inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${FOCUS_RING} ${
                isActive
                  ? "bg-second text-primary"
                  : "text-second/60 hover:bg-second/5 hover:text-second"
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-2 text-xs leading-none ${
                  isActive ? "bg-primary/20 text-primary" : "bg-second/10"
                }`}
              >
                {formatNumber(tab.result?.total ?? 0)}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="camera-tabpanel"
        aria-labelledby={`camera-tab-${active.key}`}
        className="mt-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-second/60">{active.description}</p>
          <ViewAllLink href="/admin/cameras" total={total} />
        </div>

        {items.length > 0 ? (
          <ul className="mt-4 divide-y divide-second/10">
            {items.map((camera) => (
              <CameraRow
                key={camera.id}
                camera={camera}
                showStock={active.showStock}
              />
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState icon={FiCamera} message={active.empty} />
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------- Invoice list ----------------------------- */

function InvoiceRow({ invoice }) {
  return (
    <li className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="break-all font-mono text-xs font-semibold text-second/60">
          {invoice.no_invoice}
        </p>

        <h3 className="mt-2 break-words text-sm font-semibold text-second">
          {invoice.customer_name || "Nama pelanggan tidak tersedia"}
        </h3>

        <p className="mt-2 text-xs text-second/60">
          {invoice.store_name || "—"}
        </p>
        <p className="mt-2 text-xs text-second/60">
          {formatDate(invoice.created_at)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <Tag tone="soft">
          <FiClock size={12} />
          Belum final
        </Tag>

        <p className="text-base font-bold text-second">
          {formatPrice(invoice.total_amount)}
        </p>

        <p className="text-xs text-second/60">
          {formatNumber(invoice.item_count)} item
        </p>
      </div>
    </li>
  );
}

function InvoicePanel({ result }) {
  const items = result?.items ?? [];
  const total = result?.total ?? 0;

  return (
    <Panel
      title="Invoice belum final"
      description="Invoice yang masih perlu diproses."
      className="xl:col-span-2 h-full"
    >
      <div className="mt-8 flex justify-start">
        <ViewAllLink href="/admin/invoices" total={total} />
      </div>

      {items.length > 0 ? (
        <ul className="mt-4 divide-y divide-second/10">
          {items.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <EmptyState
            icon={FiCheckCircle}
            message="Tidak ada invoice pending."
          />
        </div>
      )}
    </Panel>
  );
}

/* --------------------------------- States --------------------------------- */

function LoadingState() {
  return (
    <div
      className="flex items-center justify-center gap-4 py-16 text-sm text-second/60"
      role="status"
      aria-live="polite"
    >
      <FiLoader className="animate-spin" size={24} />
      Memuat dashboard...
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-second/30 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-second/5 text-second/40">
        <FiAlertTriangle size={24} />
      </div>

      <div>
        <h2 className="font-semibold text-second">Gagal memuat dashboard</h2>
        <p className="mt-2 max-w-sm text-sm text-second/60">
          Periksa koneksi atau sesi autentikasi Anda, lalu coba kembali.
        </p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={isFetching}
        className={`inline-flex h-8 items-center gap-2 rounded-full bg-second px-4 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:opacity-50 ${FOCUS_RING}`}
      >
        <FiRefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
        Coba lagi
      </button>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function AdminDashboardPage() {
  const query = useGetDashboard();

  const {
    data: dashboard,
    isPending,
    isError,
    error,
    isFetching,
    refetch,
  } = query;

  useEffect(() => {
    if (!isError || !error) return;

    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !dashboard) {
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
  }

  const summary = dashboard.summary;
  const cameras = summary.cameras;
  const invoices = summary.invoices;

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Dashboard
          </h1>

          <p className="mt-2 text-sm text-second/60">
            Ringkasan aktivitas dan kondisi katalog Anda.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Perbarui data dashboard"
          className={`inline-flex px-4 py-2 items-center gap-2 rounded-full border border-second/30 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-60 ${FOCUS_RING}`}
        >
          <FiRefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          {isFetching ? "Memperbarui..." : "Perbarui"}
        </button>
      </header>

      <section
        aria-label="Ringkasan statistik"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <StatCard
          featured
          title="Pendapatan bulan ini"
          value={formatPrice(summary.revenue_this_month)}
          description="Dari invoice final bulan berjalan"
          icon={FiTrendingUp}
        />

        <StatCard
          title="Total kamera"
          value={formatNumber(cameras.total)}
          description="Kamera aktif di katalog"
          icon={FiCamera}
        />

        <StatCard
          title="Stok habis"
          value={formatNumber(cameras.out_of_stock)}
          description="Kamera aktif dengan stok nol"
          icon={FiPackage}
        />

        <StatCard
          title="Total invoice"
          value={formatNumber(invoices.total)}
          description="Seluruh invoice"
          icon={FiFileText}
        />

        <StatCard
          title="Invoice belum final"
          value={formatNumber(invoices.pending)}
          description="Menunggu proses lebih lanjut"
          icon={FiClock}
        />

        <StatCard
          title="Invoice hari ini"
          value={formatNumber(invoices.today)}
          description="Dibuat hari ini, waktu WIB"
          icon={FiCheckCircle}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-5">
        <CameraPanel dashboard={dashboard} />
        <InvoicePanel result={dashboard.pending_invoices} />
      </div>
    </div>
  );
}
