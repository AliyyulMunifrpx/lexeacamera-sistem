"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCalendar,
  FiCreditCard,
  FiEdit2,
  FiInstagram,
  FiLoader,
  FiMapPin,
  FiMessageCircle,
  FiRefreshCw,
  FiShoppingBag,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";

import {
  useDeleteCustomer,
  useGetCustomer,
} from "../../../../features/customer/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import PrimaryButton from "./../../../../../components/primary-button";
import CancelButton from "./../../../../../components/cancel-button";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const PAYMENT_LABEL = {
  PAID: "Lunas",
  UNPAID: "Belum dibayar",
};

const TYPE_LABEL = {
  SALE: "Penjualan",
  REFUND: "Refund",
};

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

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime && { hour: "2-digit", minute: "2-digit" }),
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function toWaNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function toInstagramHandle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "");
}

function getInitials(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
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

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-second/50">
      {children}
    </h3>
  );
}

function DetailItem({ label, children, mono = false }) {
  const hasValue =
    children !== undefined && children !== null && children !== "";
  return (
    <div className="min-w-0 space-y-2">
      <dt className="text-xs text-second/60">{label}</dt>
      <dd
        className={`break-words text-sm font-medium text-second ${mono ? "font-mono" : ""}`}
      >
        {hasValue ? children : "—"}
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

/* -------------------------------- States --------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-48 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-40 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
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
          Kembali ke daftar pelanggan
        </button>
      </header>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
        <FiAlertTriangle
          size={32}
          className="text-second2"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-lg font-bold text-second">
          Gagal memuat detail pelanggan
        </h2>
        <p className="mt-2 max-w-md text-sm text-second/60">
          Data pelanggan tidak ditemukan atau gagal dimuat.
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
              <FiRefreshCw
                size={16}
                className={
                  isFetching ? "animate-spin motion-reduce:animate-none" : ""
                }
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

/* ----------------------------- Delete Modal ------------------------------ */

function DeleteCustomerModal({ open, name, isDeleting, onClose, onConfirm }) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event) {
      if (event.key === "Escape" && !isDeleting) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, isDeleting, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-customer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => !isDeleting && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second2 text-primary shadow-lg shadow-second2/25">
            <FiTrash2 size={16} aria-hidden="true" />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup modal"
            className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="delete-customer-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Hapus pelanggan?
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-second/60">
          Pelanggan <span className="font-semibold text-second">{name}</span>{" "}
          akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
        </p>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className={`${BTN_BASE} w-full bg-second2 text-primary shadow-lg shadow-second2/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            {isDeleting ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Menghapus…
              </>
            ) : (
              <>
                <FiTrash2 size={16} aria-hidden="true" />
                Hapus
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const {
    data: response,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetCustomer(id);
  const deleteMutation = useDeleteCustomer();

  const [showDelete, setShowDelete] = useState(false);

  // Hook bisa return { data: {...} } atau langsung objek customer.
  const customer = useMemo(
    () => response?.data ?? response ?? null,
    [response],
  );

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  async function handleConfirmDelete() {
    if (!customer) return;
    try {
      await deleteMutation.mutateAsync(customer.id);
      notify.success("Pelanggan berhasil dihapus.");
      setShowDelete(false);
      router.replace("/owner/customers");
    } catch (error) {
      notify.error(normalizeApiError(error).message);
    }
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError || !customer) {
    return (
      <ErrorState
        onRetry={isError ? () => refetch() : undefined}
        isFetching={isFetching}
        onBack={() => router.push("/owner/customers")}
      />
    );
  }

  const orders = customer.orders ?? [];
  const whatsapp = toWaNumber(customer.whatsapp);
  const instagram = toInstagramHandle(customer.instagram);
  const name = customer.name || "Tanpa nama";
  const orderCount = Number(customer.order_count) || 0;
  const totalSpent = Number(customer.total_spent) || 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Navigasi */}
      <nav aria-label="Navigasi halaman">
        <Link
          href="/owner/customers"
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar pelanggan
        </Link>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-grad text-lg font-bold text-primary shadow-lg shadow-second4/20"
          >
            {getInitials(name)}
          </div>

          <div className="min-w-0">
            <p className="text-sm text-second/60">Detail Pelanggan</p>
            <h1
              className="mt-2 break-words text-2xl font-bold tracking-tight text-second sm:text-3xl"
              title={name}
            >
              {name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Tag tone={orderCount > 0 ? "success" : "outline"}>
                {orderCount > 0
                  ? `${formatNumber(orderCount)} pesanan`
                  : "Belum ada pesanan"}
              </Tag>
              <Tag tone="strong">{formatPrice(totalSpent)}</Tag>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <PrimaryButton href={`/owner/customers/${customer.id}/edit`}>
            <FiEdit2 size={16} aria-hidden="true" />
            Edit
          </PrimaryButton>

          <CancelButton type="button" onClick={() => setShowDelete(true)}>
            <FiTrash2 size={16} aria-hidden="true" />
            Hapus
          </CancelButton>
        </div>
      </header>

      {/* Konten */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        {/* Kolom kiri: kontak & metadata */}
        <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          <div className="flex flex-col gap-4">
            <SectionTitle>Kontak</SectionTitle>

            <ul className="flex flex-col gap-4">
              <li className="flex min-w-0 items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
                >
                  <FiMessageCircle size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-second/60">WhatsApp</p>
                  <div className="mt-2 break-words text-sm font-semibold text-second">
                    {whatsapp ? (
                      <a
                        href={`https://wa.me/${whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`break-all underline underline-offset-2 hover:text-second4 ${FOCUS_RING}`}
                      >
                        <span className="tabular-nums">+{whatsapp}</span>
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </li>

              <li className="flex min-w-0 items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
                >
                  <FiInstagram size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-second/60">Instagram</p>
                  <div className="mt-2 break-words text-sm font-semibold text-second">
                    {instagram ? (
                      <a
                        href={`https://instagram.com/${instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`break-all underline underline-offset-2 hover:text-second4 ${FOCUS_RING}`}
                      >
                        @{instagram}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </li>

              <li className="flex min-w-0 items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
                >
                  <FiMapPin size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-second/60">Alamat</p>
                  <div className="mt-2 break-words text-sm font-semibold text-second">
                    {customer.address?.trim() || "—"}
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-4 border-t border-second/30 pt-4">
            <SectionTitle>Metadata</SectionTitle>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem label="ID pelanggan" mono>
                {customer.id}
              </DetailItem>

              <div className="min-w-0 space-y-2">
                <dt className="flex items-center gap-2 text-xs text-second/60">
                  <FiCalendar size={12} aria-hidden="true" />
                  Bergabung
                </dt>
                <dd className="text-sm font-medium tabular-nums text-second">
                  {formatDate(customer.created_at, true)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Ringkasan angka */}
          <div className="grid grid-cols-1 gap-4 border-t border-second/30 pt-4 sm:grid-cols-2">
            <StatTile
              icon={FiShoppingBag}
              label="Total pesanan"
              value={formatNumber(orderCount)}
            />
            <StatTile
              icon={FiCreditCard}
              label="Total belanja"
              value={formatPrice(totalSpent)}
            />
          </div>
        </section>

        {/* Kolom kanan: daftar pesanan */}
        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-second">Riwayat pesanan</h2>
              <p className="mt-2 text-sm text-second/60">
                Daftar pesanan yang dibuat oleh pelanggan ini.
              </p>
            </div>
            <Tag tone="strong">{formatNumber(orders.length)} pesanan</Tag>
          </div>
          {orders.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {orders.map((order) => {
                const isPaid = order.payment_status === "PAID";
                const isRefund = order.type === "REFUND";
                const paymentLabel =
                  PAYMENT_LABEL[order.payment_status] ??
                  order.payment_status ??
                  "—";
                const typeLabel = TYPE_LABEL[order.type] ?? order.type;
                const invoiceNo = order.invoice?.no_invoice;

                return (
                  <li
                    key={order.id}
                    className="min-w-0 rounded-2xl border border-second/30 transition-colors hover:border-second4"
                  >
                    {/* Atas: judul + status */}
                    <div className="flex items-start justify-between gap-3 p-4 pb-3">
                      <div className="min-w-0">
                        <p className="break-all font-mono text-sm font-semibold text-second">
                          {invoiceNo ?? order.id}
                        </p>
                        <p className="mt-1 text-xs text-second/60">
                          {typeLabel} · {formatDate(order.created_at)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <Tag tone={isPaid ? "success" : "failure"}>
                          <FiCreditCard size={12} aria-hidden="true" />
                          {paymentLabel}
                        </Tag>
                        {isRefund && <Tag tone="pending">Refund</Tag>}
                      </div>
                    </div>

                    {/* Tengah: total + info bayar */}
                    <div className="flex items-end justify-between gap-3 px-4 pb-4">
                      <div className="min-w-0 text-xs text-second/60">
                        {order.paid_at && (
                          <p>Dibayar {formatDate(order.paid_at, true)}</p>
                        )}
                        {order.refund_of_id && (
                          <p className="mt-1 break-all">
                            Refund dari{" "}
                            <span className="font-mono">
                              {order.refund_of_id}
                            </span>
                          </p>
                        )}
                      </div>

                      <p className="shrink-0 text-lg font-bold tabular-nums text-second">
                        {formatPrice(order.total_amount)}
                      </p>
                    </div>

                    {/* Bawah: aksi */}
                    <div className="border-t border-second/30 p-3">
                      <PrimaryButton
                        href={`/owner/orders/${order.id}`}
                        fullWidth
                      >
                        Lihat pesanan
                      </PrimaryButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-second/20 px-4 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
                <FiShoppingBag size={24} aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-second">
                Belum ada pesanan
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Modal hapus */}
      <DeleteCustomerModal
        open={showDelete}
        name={name}
        isDeleting={deleteMutation.isPending}
        onClose={() => setShowDelete(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
