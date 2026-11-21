"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image.js";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCamera,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiPackage,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";

import { useGetDashboard } from "../../features/dashboard/hooks.js";
import { normalizeApiError } from "../../../lib/api/errors.js";
import notify from "../../../lib/notify.js";
import RefreshButton from "../../../components/refresh-button.jsx";

/* ApexCharts menyentuh `window`, jadi wajib client-only (tanpa SSR). */
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-xl bg-second/10" />
  ),
});

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const CONDITION_LABEL = {
  NEW: "Baru",
  SECOND: "Bekas",
};

const PAYMENT_STATUS_LABEL = {
  PAID: "Lunas",
  DP: "Sudah DP",
  UNPAID: "Belum dibayar",
};

const PAYMENT_STATUS_TONE = {
  PAID: "success",
  DP: "pending",
  UNPAID: "failure",
};

const LOW_STOCK_LIMIT = 3;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

/* Warna chart (Apex butuh hex, bukan class Tailwind) */
const CHART_COLOR = "#8b5cf6";
const CHART_MUTED = "#71717a";
const CHART_GRID = "rgba(113,113,122,0.2)";

const EMPTY_AMOUNT = { count: 0, amount: 0 };

/* -------------------------------- Formatters ------------------------------ */

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

/* Aman untuk angka negatif (pendapatan bersih bisa minus di hari refund besar) */
function formatPriceShort(value = 0) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}rb`;
  return `${sign}${Math.round(abs)}`;
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

function formatChartDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(date);
}

/* --------------------------------- Hooks ---------------------------------- */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
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

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-second/20 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
        <Icon size={24} aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-second">{message}</p>
    </div>
  );
}

function Panel({ title, description, aside, children, className = "" }) {
  return (
    <section
      className={`flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8 ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-bold text-second">{title}</h2>
          {description && (
            <p className="mt-2 text-pretty text-sm text-second/60">
              {description}
            </p>
          )}
        </div>
        {aside}
      </div>

      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Tabs({ label, idPrefix, tabs, activeKey, onChange }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-2 overflow-x-auto"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.key}`}
            aria-selected={isActive}
            aria-controls={`${idPrefix}-tabpanel`}
            onClick={() => onChange(tab.key)}
            className={`inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${FOCUS_RING} ${
              isActive
                ? "bg-grad text-primary shadow-lg shadow-second4/25"
                : "text-second/60 hover:bg-second/10 hover:text-second"
            }`}
          >
            {tab.label}
            <span
              className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-2 text-xs leading-none ${
                isActive ? "bg-primary text-second" : "bg-second/10 text-second"
              }`}
            >
              {formatNumber(tab.result?.total ?? 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------- Stat cards ------------------------------- */

const STAT_ICON_TONES = {
  neutral: "bg-grad text-primary shadow-lg shadow-second4/25",
  success: "bg-second3 text-primary",
  failure: "bg-second2 text-primary",
  pending: "bg-second4 text-primary",
};

function statusTone(value, tone) {
  return Number(value) > 0 ? tone : "neutral";
}

/* Card utama — pendapatan BERSIH (penjualan lunas dikurangi refund lunas),
   dengan rincian bruto/refund dan peringatan refund yang belum dikembalikan. */
function RevenueCard({ net, gross, refund, refundUnpaid }) {
  const hasRefund = refund.count > 0 || refund.amount > 0;
  const hasUnpaidRefund = refundUnpaid.count > 0 || refundUnpaid.amount > 0;

  return (
    <article className="flex min-w-0 flex-col justify-between gap-4 rounded-2xl bg-grad p-4 text-primary shadow-lg shadow-second4/25">
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-second">
          <FiTrendingUp size={16} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold">Pendapatan bersih bulan ini</h3>
      </div>

      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {formatPrice(net)}
        </p>
        <p className="mt-2 text-xs text-primary/90">
          Penjualan lunas dikurangi refund yang sudah dikembalikan, menurut
          tanggal pembayaran. DP yang belum dilunasi belum dihitung.
        </p>
      </div>

      {hasRefund && (
        <dl className="grid grid-cols-1 gap-4 border-t border-primary/30 pt-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-primary/90">Penjualan bruto</dt>
            <dd className="mt-2 break-words text-sm font-semibold tabular-nums">
              {formatPrice(gross)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-primary/90">
              Refund dikembalikan ({formatNumber(refund.count)} order)
            </dt>
            <dd className="mt-2 break-words text-sm font-semibold tabular-nums">
              -{formatPrice(refund.amount)}
            </dd>
          </div>
        </dl>
      )}

      {hasUnpaidRefund && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-second2"
        >
          <FiAlertTriangle size={16} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words tabular-nums">
            Refund belum dikembalikan: {formatPrice(refundUnpaid.amount)} (
            {formatNumber(refundUnpaid.count)} order)
          </span>
        </p>
      )}
    </article>
  );
}

/* Card mini — ringkas, untuk 8 metrik */
function MiniStatCard({ title, value, icon: Icon, tone = "neutral" }) {
  return (
    <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${STAT_ICON_TONES[tone]}`}
      >
        <Icon size={16} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-second/60">{title}</p>
        <p className="mt-1 break-words text-lg font-bold tabular-nums text-second">
          {value}
        </p>
      </div>
    </article>
  );
}

/* -------------------------------- Charts ---------------------------------- */

/* Tren penjualan — ApexCharts (area, smooth, gradient), nilai BERSIH */
function SalesTrendChart({ data }) {
  const reducedMotion = usePrefersReducedMotion();

  const points = useMemo(
    () =>
      (data ?? []).map((item) => ({
        date: formatChartDate(item.date),
        revenue: Number(item.revenue) || 0,
        orders: Number(item.orders) || 0,
      })),
    [data],
  );

  const hasData = points.some((item) => item.revenue !== 0 || item.orders > 0);

  /* Hari dengan refund lebih besar dari penjualan bernilai negatif,
     jadi batas bawah sumbu Y tidak boleh dikunci di 0. */
  const yMin = useMemo(
    () => Math.min(0, ...points.map((item) => item.revenue)),
    [points],
  );

  const series = useMemo(
    () => [
      { name: "Pendapatan bersih", data: points.map((item) => item.revenue) },
    ],
    [points],
  );

  const options = useMemo(
    () => ({
      colors: [CHART_COLOR],
      chart: {
        type: "area",
        fontFamily: "inherit",
        background: "transparent",
        toolbar: { show: false },
        zoom: { enabled: false },
        selection: { enabled: false },
        parentHeightOffset: 0,
        animations: {
          enabled: !reducedMotion,
          easing: "easeout",
          speed: 500,
        },
      },
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 3, lineCap: "round" },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0,
          stops: [0, 100],
        },
      },
      markers: {
        size: 0,
        strokeWidth: 2,
        strokeColors: "#ffffff",
        hover: { size: 6, sizeOffset: 0 },
      },
      grid: {
        borderColor: CHART_GRID,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        /* padding ini yang mencegah chart terpotong kiri & kanan */
        padding: { top: 0, right: 16, bottom: 0, left: 16 },
      },
      xaxis: {
        categories: points.map((item) => item.date),
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
        crosshairs: {
          stroke: { color: CHART_COLOR, width: 1, dashArray: 4 },
        },
        labels: {
          rotate: 0,
          hideOverlappingLabels: true,
          style: { colors: CHART_MUTED, fontSize: "12px" },
        },
      },
      yaxis: {
        min: yMin,
        forceNiceScale: true,
        tickAmount: 4,
        labels: {
          minWidth: 32,
          formatter: (value) => formatPriceShort(value),
          style: { colors: CHART_MUTED, fontSize: "12px" },
        },
      },
      legend: { show: false },
      tooltip: {
        theme: "light",
        marker: { show: true },
        y: { formatter: (value) => formatPrice(value) },
      },
      noData: { text: "Belum ada data penjualan." },
    }),
    [points, reducedMotion, yMin],
  );

  if (!points.length) {
    return (
      <EmptyState icon={FiTrendingUp} message="Belum ada data penjualan." />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`Grafik tren pendapatan bersih ${formatNumber(points.length)} hari terakhir`}
        className="w-full min-w-0 overflow-hidden"
      >
        <ReactApexChart
          type="area"
          height={256}
          width="100%"
          series={series}
          options={options}
        />
      </div>

      {!hasData && (
        <p className="text-center text-xs text-second/60">
          Belum ada transaksi pada rentang ini.
        </p>
      )}
    </div>
  );
}

/* Produk terlaris — ranking list dengan progress bar (tanpa library) */
function TopProductsChart({ data }) {
  // Normalisasi nama field — antisipasi backend pakai nama berbeda.
  const items = (data ?? [])
    .map((item) => ({
      name: item.name ?? item.camera_name ?? item.product_name ?? "—",
      value:
        Number(
          item.units ??
            item.total_sold ??
            item.sold ??
            item.quantity ??
            item.total ??
            0,
        ) || 0,
      revenue: Number(item.revenue ?? 0) || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (!items.length) {
    return (
      <EmptyState icon={FiPackage} message="Belum ada data produk terlaris." />
    );
  }

  const max = Math.max(...items.map((item) => item.value), 0);
  const hasData = items.some((item) => item.value > 0 || item.revenue > 0);

  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label="Peringkat produk terlaris"
        className="flex min-h-64 flex-col justify-between gap-4"
      >
        {items.map((item, index) => {
          const percent = max > 0 ? (item.value / max) * 100 : 0;
          const isTop = index === 0;

          return (
            <li key={`${item.name}-${index}`} className="flex min-w-0 gap-4">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                  isTop
                    ? "bg-grad text-primary shadow-lg shadow-second4/25"
                    : "bg-second/10 text-second"
                }`}
                aria-hidden="true"
              >
                {index + 1}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex min-w-0 items-baseline justify-between gap-4">
                  <p
                    className="truncate text-sm font-semibold text-second"
                    title={item.name}
                  >
                    {item.name}
                  </p>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-second">
                    {formatNumber(item.value)}
                    <span className="ml-2 text-xs font-medium text-second/60">
                      terjual
                    </span>
                  </p>
                </div>

                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-second/10"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                      isTop ? "bg-grad" : "bg-second4/50"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {item.revenue > 0 && (
                  <p className="text-xs tabular-nums text-second/60">
                    {formatPrice(item.revenue)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!hasData && (
        <p className="text-center text-xs text-second/60">
          Belum ada penjualan tercatat.
        </p>
      )}
    </div>
  );
}

/* ------------------------------- Camera list ------------------------------ */

function stockTag(stock) {
  if (stock === 0) return { tone: "failure", label: "Habis" };

  if (stock <= LOW_STOCK_LIMIT) {
    return { tone: "pending", label: `${formatNumber(stock)} unit` };
  }

  return { tone: "soft", label: `${formatNumber(stock)} unit` };
}

function CameraRow({ camera }) {
  const primaryImage =
    camera.images?.find((image) => image.is_primary) ?? camera.images?.[0];

  const condition = CONDITION_LABEL[camera.condition] ?? camera.condition;
  const stock = stockTag(camera.stock);

  return (
    <Link
      href={`/owner/cameras/${camera.id}`}
      className={`group flex min-w-0 items-center gap-4 rounded-xl border border-second/30 p-4 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
    >
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-second/10">
        {primaryImage?.image_url ? (
          <Image
            src={primaryImage.image_url}
            alt={camera.name}
            width={128}
            height={128}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <FiCamera size={24} className="text-second/40" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold text-second group-hover:text-second4">
          {camera.name}
        </h3>

        <div className="mt-2 flex min-w-0 items-center gap-2">
          <p className="truncate text-xs text-second/60">
            {camera.category?.name ?? "Tanpa kategori"}
          </p>
          {condition && <Tag>{condition}</Tag>}
        </div>

        <p className="mt-2 text-sm font-bold tabular-nums text-second">
          {formatPrice(camera.price)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <Tag tone={stock.tone}>{stock.label}</Tag>

        {camera.best_selling && <Tag tone="solid">Best seller</Tag>}
        {camera.promo && <Tag tone="strong">Promo</Tag>}
      </div>
    </Link>
  );
}

function CameraPanel({ dashboard }) {
  const [activeKey, setActiveKey] = useState("best");

  const tabs = [
    {
      key: "best",
      label: "Best seller",
      description: "Produk yang ditandai sebagai terlaris.",
      result: dashboard.best_selling_cameras,
      empty: "Belum ada produk best seller.",
    },
    {
      key: "promo",
      label: "Promosi",
      description: "Produk yang sedang ditandai untuk promosi.",
      result: dashboard.promo_cameras,
      empty: "Belum ada produk promosi.",
    },
    {
      key: "low",
      label: "Stok menipis",
      description: "Produk dengan stok maksimal tiga unit.",
      result: dashboard.low_stock_cameras,
      empty: "Tidak ada produk dengan stok menipis.",
    },
  ];

  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const items = active.result?.items ?? [];

  return (
    <Panel
      title="Katalog produk"
      description="Pantau produk unggulan, promosi, dan stok yang perlu diisi ulang."
    >
      <Tabs
        label="Daftar produk"
        idPrefix="camera"
        tabs={tabs}
        activeKey={active.key}
        onChange={setActiveKey}
      />

      <div
        role="tabpanel"
        id="camera-tabpanel"
        aria-labelledby={`camera-tab-${active.key}`}
      >
        <p className="text-sm text-second/60">{active.description}</p>

        {items.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((camera) => (
              <CameraRow key={camera.id} camera={camera} />
            ))}
          </div>
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
  const status = invoice.payment_status;
  const paymentLabel = PAYMENT_STATUS_LABEL[status] ?? status;
  const paymentTone = PAYMENT_STATUS_TONE[status] ?? "failure";
  const isPaid = status === "PAID";

  const total = Number(invoice.total_amount) || 0;
  const dpAmount = Number(invoice.dp_amount) || 0;
  const hasDp = dpAmount > 0;
  const dpPaid = Boolean(invoice.dp_paid);
  /* Sisa tagihan hanya bermakna setelah DP benar-benar dibayar */
  const remaining = Math.max(0, total - dpAmount);
  const showRemaining = hasDp && dpPaid && !isPaid;

  return (
    <li>
      <Link
        href={`/owner/invoices/${invoice.id}`}
        className={`group flex min-w-0 flex-col gap-4 rounded-xl border border-second/30 p-4 transition-colors hover:border-second4 hover:bg-second4/5 sm:flex-row sm:items-start sm:justify-between ${FOCUS_RING}`}
      >
        <div className="min-w-0">
          <p className="break-all font-mono text-xs font-semibold text-second/60">
            {invoice.no_invoice}
          </p>

          <h3 className="mt-2 break-words text-sm font-semibold text-second group-hover:text-second4">
            {invoice.customer_name || "Nama pelanggan tidak tersedia"}
          </h3>

          <p className="mt-2 text-xs text-second/60">
            {formatDate(invoice.created_at)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Tag tone={invoice.is_final ? "success" : "pending"}>
              <FiClock size={12} aria-hidden="true" />
              {invoice.is_final ? "Final" : "Belum final"}
            </Tag>

            <Tag tone={paymentTone}>
              <FiCreditCard size={12} aria-hidden="true" />
              {paymentLabel ?? "—"}
            </Tag>
          </div>

          <p className="text-base font-bold tabular-nums text-second">
            {formatPrice(total)}
          </p>

          {hasDp && (
            <div className="flex flex-col gap-2 sm:items-end">
              <p className="text-xs tabular-nums text-second/60">
                DP {formatPrice(dpAmount)} ·{" "}
                {dpPaid ? "sudah dibayar" : "belum dibayar"}
              </p>

              {showRemaining && (
                <p className="text-xs font-semibold tabular-nums text-second">
                  Sisa {formatPrice(remaining)}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-second/60">
            {formatNumber(invoice.item_count)} item
          </p>
        </div>
      </Link>
    </li>
  );
}

function InvoicePanel({ dashboard }) {
  const [activeKey, setActiveKey] = useState("pending");

  const tabs = [
    {
      key: "pending",
      label: "Belum final",
      description: "Invoice yang masih perlu diproses.",
      result: dashboard.pending_invoices,
      empty: "Tidak ada invoice yang belum final.",
      icon: FiCheckCircle,
    },
    {
      key: "unpaid",
      label: "Belum lunas",
      description:
        "Invoice yang belum dilunasi, termasuk yang baru membayar DP.",
      result: dashboard.unpaid_invoices,
      empty: "Tidak ada invoice yang belum lunas.",
      icon: FiAlertCircle,
    },
  ];

  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const items = active.result?.items ?? [];

  return (
    <Panel
      title="Invoice"
      description="Pantau status pembayaran, DP, dan invoice yang menunggu tindakan."
    >
      <Tabs
        label="Daftar invoice"
        idPrefix="invoice"
        tabs={tabs}
        activeKey={active.key}
        onChange={setActiveKey}
      />

      <div
        role="tabpanel"
        id="invoice-tabpanel"
        aria-labelledby={`invoice-tab-${active.key}`}
      >
        <p className="text-sm text-second/60">{active.description}</p>

        {items.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState icon={active.icon} message={active.empty} />
          </div>
        )}
      </div>
    </Panel>
  );
}

/* --------------------------------- States --------------------------------- */

function LoadingState() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16"
    >
      <span className="sr-only">Memuat dashboard…</span>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-second/10" />
          <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
        </div>
        <div className="h-8 w-32 animate-pulse rounded-xl bg-second/10" />
      </header>
      <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
        <FiAlertTriangle
          size={32}
          className="text-second2"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-lg font-bold text-second">
          Gagal memuat dashboard
        </h2>
        <p className="mt-2 max-w-md text-sm text-second/60">
          Periksa koneksi atau sesi autentikasi Anda, lalu coba kembali.
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
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function OwnerDashboardPage() {
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
  const salesTrend = dashboard.charts?.sales_trend ?? [];
  const topProducts = dashboard.charts?.top_products ?? [];

  const netRevenue = summary.revenue_this_month ?? 0;
  const grossRevenue = summary.revenue_gross_this_month ?? netRevenue;
  const refundPaid = summary.refund_this_month ?? EMPTY_AMOUNT;
  const refundUnpaid = summary.refund_unpaid ?? EMPTY_AMOUNT;

  /* 4 card mini yang paling penting (sisanya disembunyikan) */
  const miniStats = [
    {
      title: "Total produk",
      value: formatNumber(cameras.total),
      icon: FiCamera,
      tone: "neutral",
    },
    {
      title: "Stok habis",
      value: formatNumber(cameras.out_of_stock),
      icon: FiPackage,
      tone: statusTone(cameras.out_of_stock, "failure"),
    },
    {
      title: "Invoice hari ini",
      value: formatNumber(invoices.today),
      icon: FiClock,
      tone: "neutral",
    },
    {
      title: "Invoice belum lunas",
      value: formatNumber(invoices.unpaid),
      icon: FiAlertCircle,
      tone: statusTone(invoices.unpaid, "failure"),
    },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
            <span className="text-grad">Dashboard</span>
          </h1>

          <p className="mt-2 text-pretty text-sm text-second/60">
            Ringkasan aktivitas dan kondisi katalog Anda.
          </p>
        </div>
        <RefreshButton
          onClick={() => refetch()}
          isFetching={isFetching}
          ariaLabel="Perbarui data dashboard"
        ></RefreshButton>
      </header>

      {/* Ringkasan statistik — compact */}
      <section aria-label="Ringkasan statistik" className="flex flex-col gap-4">
        <RevenueCard
          net={netRevenue}
          gross={grossRevenue}
          refund={refundPaid}
          refundUnpaid={refundUnpaid}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {miniStats.map((stat) => (
            <MiniStatCard key={stat.title} {...stat} />
          ))}
        </div>
      </section>

      {/* Chart */}
      <section
        aria-label="Visualisasi data"
        className="grid grid-cols-1 gap-8 lg:grid-cols-2"
      >
        <Panel
          title="Tren penjualan"
          description="Pendapatan bersih per hari bulan ini, setelah dikurangi refund."
          aside={
            <Tag tone="strong">{formatNumber(salesTrend.length)} hari</Tag>
          }
        >
          <SalesTrendChart data={salesTrend} />
        </Panel>

        <Panel
          title="Produk terlaris"
          description="5 produk dengan penjualan tertinggi."
          aside={
            <Tag tone="strong">
              Top {formatNumber(Math.min(topProducts.length, 5))}
            </Tag>
          }
        >
          <TopProductsChart data={topProducts} />
        </Panel>
      </section>

      <CameraPanel dashboard={dashboard} />
      <InvoicePanel dashboard={dashboard} />
    </div>
  );
}
