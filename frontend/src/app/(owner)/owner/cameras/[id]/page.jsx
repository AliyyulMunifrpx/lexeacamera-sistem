"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiCalendar,
  FiCamera,
  FiCheck,
  FiCopy,
  FiDollarSign,
  FiExternalLink,
  FiLayers,
  FiLoader,
  FiPackage,
  FiPercent,
  FiTag,
  FiTrash2,
  FiTrendingUp,
  FiAlertCircle,
  FiAlertTriangle,
} from "react-icons/fi";

import Image from "next/image.js";
import {
  useDeleteCamera,
  useGetCamera,
} from "../../../../features/cameras/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import DeleteCameraModal from "../../../../../components/owner/delete-camera-modal.jsx";
import PrimaryButton from "../../../../../components/primary-button.jsx";
import CancelButton from "../../../../../components/cancel-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const CONDITION_LABEL = {
  NEW: "Baru",
  SECOND: "Bekas",
};

/* -------------------------------- Formatters ------------------------------ */

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

function formatPrice(price = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatPercent(value = 0) {
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime && { hour: "2-digit", minute: "2-digit" }),
  });
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline", icon: Icon }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
    blue: "bg-second3/10 text-second3",
    violet: "bg-second4/10 text-second4",
    red: "bg-second2/10 text-second2",
    muted: "bg-second/5 text-second/60",
  };

  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

function ErrorText({ id, children }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function DetailItem({ label, children, mono = false, copyable = false }) {
  const [copied, setCopied] = useState(false);
  const hasValue =
    children !== undefined && children !== null && children !== "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(String(children));
      setCopied(true);
      notify.success(`${label} disalin.`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Gagal menyalin ke clipboard.");
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <dt className="text-xs text-second/60">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-sm font-medium text-second">
        <span className={`min-w-0 break-words ${mono ? "font-mono" : ""}`}>
          {hasValue ? children : "—"}
        </span>

        {copyable && hasValue && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Salin ${label}`}
            className={`shrink-0 rounded-xl p-2 text-second/60 transition-colors hover:bg-second/10 hover:text-second ${FOCUS_RING}`}
          >
            {copied ? (
              <FiCheck size={14} aria-hidden="true" />
            ) : (
              <FiCopy size={14} aria-hidden="true" />
            )}
          </button>
        )}
      </dd>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
        <Icon size={16} aria-hidden="true" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-second/60">{label}</p>
        <p className="mt-2 truncate text-sm font-semibold tabular-nums text-second">
          {value}
        </p>
      </div>
    </div>
  );
}

function FinanceRow({ label, value, hint, valueClassName = "text-second" }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <dt className="text-sm text-second/70">{label}</dt>
        {hint && <p className="mt-2 text-xs text-second/50">{hint}</p>}
      </div>
      <dd
        className={`shrink-0 text-right text-sm font-semibold tabular-nums ${valueClassName}`}
      >
        {value}
      </dd>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-second/50">
      {children}
    </h3>
  );
}

/* --------------------------------- States --------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-48 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry, isFetching, onBack }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header>
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar produk
        </button>
      </header>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
        <FiAlertTriangle
          size={32}
          className="text-second2"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-lg font-bold text-second">
          Gagal memuat detail produk
        </h2>
        <p className="mt-2 max-w-md text-sm text-second/60">
          Data produk tidak ditemukan atau gagal dimuat.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
          >
            Kembali
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isFetching}
              className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              <FiLoader
                className={
                  isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : "hidden"
                }
                size={16}
                aria-hidden="true"
              />
              {isFetching ? "Memuat…" : "Coba lagi"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function CameraDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedImageKey, setSelectedImageKey] = useState(null);

  const deleteCam = useDeleteCamera();

  const {
    data: camera,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetCamera(id);

  useEffect(() => {
    if (!isError || !error) return;
    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);

  const images = useMemo(() => camera?.images ?? [], [camera]);
  const marketplaces = camera?.marketplaceLinks ?? [];

  const activeImage = useMemo(() => {
    if (images.length === 0) return null;
    const selected = images.find(
      (img) => (img.id ?? img.image_url) === selectedImageKey,
    );
    return selected ?? images.find((img) => img.is_primary) ?? images[0];
  }, [images, selectedImageKey]);

  async function handleDeleteCamera() {
    try {
      await deleteCam.mutateAsync(id);
      setShowDeleteModal(false);
      notify.success("Produk berhasil dihapus.");
      router.replace("/owner/cameras");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError || !camera) {
    return (
      <ErrorState
        onRetry={isError ? () => refetch() : undefined}
        isFetching={isFetching}
        onBack={() => router.push("/owner/cameras")}
      />
    );
  }

  /* ----- Turunan data ----- */
  const price = toNumber(camera.price) ?? 0;
  const capital = toNumber(camera.capital);
  const strikethrough = toNumber(camera.strikethrough_price);
  const stock = toNumber(camera.stock) ?? 0;
  const shutterCount = toNumber(camera.shutter_count);

  const hasDiscount = strikethrough !== null && strikethrough > price;
  const discountPercent = hasDiscount
    ? Math.round(((strikethrough - price) / strikethrough) * 100)
    : 0;

  const profit =
    toNumber(camera.profit) ?? (capital !== null ? price - capital : null);
  const margin = profit !== null && price > 0 ? (profit / price) * 100 : null;
  const markup = profit !== null && capital ? (profit / capital) * 100 : null;

  const stockCapital = capital !== null ? capital * stock : null;
  const stockValue = price * stock;
  const stockProfit = profit !== null ? profit * stock : null;

  const isLoss = profit !== null && profit < 0;
  const stockLow = stock > 0 && stock <= 3;
  const outOfStock = stock <= 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Navigasi */}
      <nav aria-label="Navigasi halaman">
        <Link
          href="/owner/cameras"
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar produk
        </Link>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiCamera size={16} />
          </div>

          <div className="min-w-0">
            <p className="text-sm text-second/60">Detail Produk</p>
            <h1 className="mt-2 text-balance break-words text-2xl font-bold tracking-tight text-second sm:text-3xl">
              {camera.name}
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Informasi lengkap produk dalam katalog penjualan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Tag tone={camera.condition === "NEW" ? "blue" : "violet"}>
            {CONDITION_LABEL[camera.condition] ?? camera.condition ?? "—"}
          </Tag>

          <Tag tone={camera.promo ? "grad" : "muted"}>
            {camera.promo ? "Promosi aktif" : "Tanpa promosi"}
          </Tag>

          <Tag tone={camera.best_selling ? "violet" : "muted"}>
            {camera.best_selling ? "Best seller" : "Bukan best seller"}
          </Tag>

          {camera.is_deleted && <Tag tone="failure">Dihapus</Tag>}
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        {/* ============ Kolom kiri: Galeri ============ */}
        <section
          aria-label="Galeri gambar produk"
          className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8 lg:sticky lg:top-16"
        >
          <div className="relative aspect-square overflow-hidden rounded-xl bg-second/[0.03]">
            {activeImage?.image_url ? (
              <Image
                key={activeImage.image_url}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                src={activeImage.image_url}
                alt={camera.name}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-second/40">
                <FiCamera size={48} aria-hidden="true" />
                <span className="text-sm">Gambar tidak tersedia</span>
              </div>
            )}

            {hasDiscount && (
              <span className="absolute left-4 top-4 z-10 rounded-full bg-grad px-2 py-1 text-xs font-bold tabular-nums text-primary shadow-lg shadow-second4/25">
                Hemat {discountPercent}%
              </span>
            )}
          </div>

          {images.length > 0 && (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {images.map((image, index) => {
                const key = image.id ?? image.image_url ?? index;
                const isSelected =
                  (activeImage?.id ?? activeImage?.image_url) ===
                  (image.id ?? image.image_url);

                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedImageKey(image.id ?? image.image_url)
                      }
                      aria-label={`Tampilkan gambar ${index + 1} dari ${images.length}${
                        image.is_primary ? " (utama)" : ""
                      }`}
                      aria-pressed={isSelected}
                      className={`relative block aspect-square w-full overflow-hidden rounded-xl bg-second/[0.03] transition-opacity ${FOCUS_RING} ${
                        isSelected
                          ? "ring-2 ring-second4 ring-offset-2 ring-offset-primary"
                          : "border border-second/30 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {image.image_url ? (
                        <Image
                          fill
                          sizes="(min-width: 1024px) 10vw, 25vw"
                          src={image.image_url}
                          alt=""
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center">
                          <FiCamera
                            className="text-second/40"
                            size={22}
                            aria-hidden="true"
                          />
                        </span>
                      )}

                      {image.is_primary && (
                        <span className="absolute left-2 top-2 z-10 rounded-full bg-grad px-2 py-1 text-[10px] font-semibold text-primary">
                          Utama
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs tabular-nums text-second/50">
            {images.length} gambar
            {images[0]?.created_at && (
              <> · diunggah {formatDate(images[0].created_at)}</>
            )}
          </p>
        </section>

        {/* ============ Kolom kanan: Informasi ============ */}
        <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          {/* Nama + kategori */}
          <div className="min-w-0">
            {camera.category?.name && (
              <Tag tone="violet" icon={FiLayers}>
                {camera.category.name}
              </Tag>
            )}

            <h2 className="mt-4 text-balance break-words text-2xl font-bold text-second">
              {camera.name}
            </h2>
          </div>

          {/* Harga */}
          <div>
            <p className="text-sm text-second/60">Harga jual</p>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="text-3xl font-bold tabular-nums text-second">
                {formatPrice(price)}
              </p>

              {hasDiscount && (
                <>
                  <p className="text-base tabular-nums text-second/40 line-through">
                    <span className="sr-only">Harga sebelum diskon </span>
                    {formatPrice(strikethrough)}
                  </p>
                  <Tag tone="failure">-{discountPercent}%</Tag>
                </>
              )}
            </div>

            {hasDiscount && (
              <p className="mt-2 text-xs tabular-nums text-second/50">
                Potongan {formatPrice(strikethrough - price)} dari harga coret.
              </p>
            )}
          </div>

          {/* Ringkasan */}
          <div className="grid grid-cols-1 gap-4 border-y border-second/30 py-4 sm:grid-cols-3">
            <StatTile
              icon={FiPackage}
              label="Stok"
              value={outOfStock ? "Habis" : `${formatNumber(stock)} unit`}
            />
            <StatTile
              icon={FiTag}
              label="Kondisi"
              value={
                CONDITION_LABEL[camera.condition] ?? camera.condition ?? "—"
              }
            />
            <StatTile
              icon={FiCamera}
              label="Shutter count"
              value={
                shutterCount !== null
                  ? `${formatNumber(shutterCount)} klik`
                  : "—"
              }
            />
          </div>

          {(stockLow || outOfStock) && (
            <p
              className={`rounded-xl px-4 py-2 text-sm ${
                outOfStock
                  ? "bg-second2/10 text-second2"
                  : "bg-second4/10 text-second4"
              }`}
            >
              {outOfStock
                ? "Stok habis. Tambahkan stok agar produk bisa dijual."
                : `Stok menipis — tersisa ${formatNumber(stock)} unit.`}
            </p>
          )}

          {/* Spesifikasi */}
          <div className="flex flex-col gap-4">
            <SectionTitle>Spesifikasi</SectionTitle>

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailItem label="Kategori">
                {camera.category?.name ?? camera.category_id}
              </DetailItem>

              <DetailItem label="SKU" mono copyable>
                {camera.sku}
              </DetailItem>

              <DetailItem label="Serial number" mono copyable>
                {camera.serial_number}
              </DetailItem>

              <DetailItem label="Warna">
                <span className="capitalize">{camera.color}</span>
              </DetailItem>

              <DetailItem label="Kondisi">
                {CONDITION_LABEL[camera.condition] ?? camera.condition}
              </DetailItem>

              <DetailItem label="Shutter count">
                {shutterCount !== null ? formatNumber(shutterCount) : null}
              </DetailItem>
            </dl>
          </div>

          {/* Deskripsi & kelengkapan */}
          <div className="flex flex-col gap-2">
            <SectionTitle>Deskripsi</SectionTitle>
            <p className="whitespace-pre-line text-sm leading-relaxed text-second/70">
              {camera.description || "Tidak ada deskripsi."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <SectionTitle>Kelengkapan</SectionTitle>
            <p className="whitespace-pre-line text-sm leading-relaxed text-second/70">
              {camera.inclusions || "Tidak ada informasi kelengkapan."}
            </p>
          </div>

          {/* Informasi keuangan */}
          <div className="flex flex-col gap-2 rounded-2xl bg-second/[0.03] p-4 sm:p-8">
            <div className="flex items-center gap-2">
              <FiDollarSign
                size={16}
                className="text-second/60"
                aria-hidden="true"
              />
              <SectionTitle>Informasi keuangan</SectionTitle>
            </div>

            <dl className="divide-y divide-second/10">
              <FinanceRow
                label="Modal"
                value={capital !== null ? formatPrice(capital) : "—"}
                hint="Harga pokok per unit"
              />
              <FinanceRow label="Harga jual" value={formatPrice(price)} />
              <FinanceRow
                label="Profit per unit"
                value={profit !== null ? formatPrice(profit) : "—"}
                valueClassName={isLoss ? "text-second2" : "text-second3"}
              />
              <FinanceRow
                label="Margin"
                value={margin !== null ? formatPercent(margin) : "—"}
                hint={
                  markup !== null
                    ? `Markup ${formatPercent(markup)} dari modal`
                    : undefined
                }
                valueClassName={isLoss ? "text-second2" : "text-second"}
              />
              {hasDiscount && (
                <FinanceRow
                  label="Harga coret"
                  value={formatPrice(strikethrough)}
                  hint={`Diskon ditampilkan ${discountPercent}%`}
                />
              )}
            </dl>

            <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
              <div className="rounded-xl bg-primary p-4 shadow-xl shadow-second/5">
                <p className="text-xs text-second/60">Modal tertanam</p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-second">
                  {stockCapital !== null ? formatPrice(stockCapital) : "—"}
                </p>
              </div>

              <div className="rounded-xl bg-primary p-4 shadow-xl shadow-second/5">
                <p className="text-xs text-second/60">Nilai stok</p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-second">
                  {formatPrice(stockValue)}
                </p>
              </div>

              <div className="rounded-xl bg-primary p-4 shadow-xl shadow-second/5">
                <p className="flex items-center gap-2 text-xs text-second/60">
                  <FiTrendingUp size={12} aria-hidden="true" />
                  Potensi profit
                </p>
                <p
                  className={`mt-2 text-sm font-semibold tabular-nums ${
                    isLoss ? "text-second2" : "text-second3"
                  }`}
                >
                  {stockProfit !== null ? formatPrice(stockProfit) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Marketplace */}
          <div className="flex flex-col gap-4">
            <SectionTitle>Marketplace</SectionTitle>

            {marketplaces.length > 0 ? (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {marketplaces.map((item, index) => {
                  const name = item.marketplace?.name ?? "Marketplace";

                  return (
                    <li key={item.id ?? item.marketplace_id ?? index}>
                      <a
                        href={item.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buka di ${name} (tab baru)`}
                        className={`flex items-center gap-4 rounded-xl border border-second/30 p-4 text-sm text-second transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
                      >
                        {item.marketplace?.logo_url ? (
                          <Image
                            alt=""
                            src={item.marketplace.logo_url}
                            width={40}
                            height={40}
                            className="size-10 shrink-0 rounded-xl object-contain"
                          />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-second/10">
                            <FiTag size={18} aria-hidden="true" />
                          </span>
                        )}

                        <span className="min-w-0 flex-1 truncate font-medium">
                          {name}
                        </span>

                        <FiExternalLink
                          size={16}
                          className="shrink-0 text-second/40"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-second/30 px-4 py-4 text-sm text-second/50">
                Belum ada tautan marketplace untuk produk ini.
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-col gap-4 border-t border-second/30 pt-4">
            <SectionTitle>Metadata</SectionTitle>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem label="ID produk" mono copyable>
                {camera.id}
              </DetailItem>

              <DetailItem label="Status">
                {camera.is_deleted ? "Dihapus" : "Aktif"}
              </DetailItem>

              <div className="min-w-0 space-y-2">
                <dt className="flex items-center gap-2 text-xs text-second/60">
                  <FiCalendar size={12} aria-hidden="true" />
                  Tanggal ditambahkan
                </dt>
                <dd className="text-sm font-medium tabular-nums text-second">
                  {formatDate(camera.created_at, true)}
                </dd>
              </div>

              <DetailItem label="Kategori dibuat">
                {formatDate(camera.category?.created_at)}
              </DetailItem>
            </dl>
          </div>

          {/* Aksi */}
          <div className="mt-auto flex w-full flex-col gap-2 pt-2 sm:flex-row">
            <PrimaryButton href={`/owner/cameras/${camera.id}/edit`} fullWidth>
              Edit Produk
            </PrimaryButton>

            <CancelButton
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={deleteCam.isPending}
              fullWidth
            >
              <FiTrash2 size={16} aria-hidden="true" />
              Hapus Produk
            </CancelButton>
          </div>
        </section>
      </div>

      <DeleteCameraModal
        isOpen={showDeleteModal}
        cameraName={camera.name}
        isDeleting={deleteCam.isPending}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteCamera}
      />
    </div>
  );
}
