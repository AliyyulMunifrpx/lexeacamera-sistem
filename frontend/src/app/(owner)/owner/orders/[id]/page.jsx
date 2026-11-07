"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiLoader,
  FiPackage,
  FiRotateCcw,
  FiShoppingBag,
  FiTrendingUp,
  FiUser,
  FiX,
} from "react-icons/fi";

import {
  useGetOwnerOrder,
  useUpdateOrderPaymentStatus,
} from "../../../../features/orders/hooks.js";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import PrimaryButton from "./../../../../../components/primary-button";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const ORDERS_PATH = "/owner/orders";
const ORDER_DETAIL_PATH = (id) => `/owner/orders/${id}`;
const INVOICE_DETAIL_PATH = (id) => `/owner/invoices/${id}`;
const CUSTOMER_DETAIL_PATH = (id) => `/owner/customers/${id}`;
const REFUND_PATH = (id) => `/owner/orders/${id}/refunds`;
const ITEMS_PATH = (id) => `/owner/orders/${id}/items`;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

const TYPE_LABEL = { SALE: "Penjualan", REFUND: "Refund" };

function inputClass(hasError) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

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

function money(value) {
  return value === null || value === undefined ? "—" : formatPrice(value);
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDateTime(value, withTime = true) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return `${date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime && { hour: "2-digit", minute: "2-digit" }),
    timeZone: "Asia/Jakarta",
  })}${withTime ? " WIB" : ""}`;
}

function discountText(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `− ${formatPrice(amount)}`
    : "—";
}

function toLocalInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getWhatsappHref(value) {
  if (!value) return null;
  let digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("62")) {
    if (digits[2] === "0") digits = `62${digits.slice(3)}`;
  } else if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}

function getInstagramHref(value) {
  if (!value) return null;
  let username = String(value).trim();
  const urlMatch = username.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i,
  );
  if (urlMatch) username = urlMatch[1];
  username = username.replace(/^@+/, "").trim();
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) return null;
  return `https://www.instagram.com/${username}/`;
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline", icon: Icon }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
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
    muted: "border border-second/30 text-second/65",
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

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      notify.success(`${label} disalin.`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Gagal menyalin ke clipboard.");
    }
  }

  return (
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
  );
}

function DetailField({
  label,
  value,
  href = null,
  external = false,
  mono = false,
  copyable = false,
}) {
  const filled = value !== null && value !== undefined && value !== "";

  return (
    <div className="min-w-0 space-y-2">
      <dt className="text-xs text-second/60">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-sm font-semibold text-second">
        <span className={`min-w-0 break-words ${mono ? "font-mono" : ""}`}>
          {href && filled ? (
            external ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 rounded-sm underline decoration-second/40 underline-offset-4 transition-colors hover:decoration-second ${FOCUS_RING}`}
              >
                {value}
                <FiExternalLink size={12} aria-hidden="true" />
                <span className="sr-only">(tab baru)</span>
              </a>
            ) : (
              <Link
                href={href}
                className={`rounded-sm underline decoration-second/40 underline-offset-4 transition-colors hover:decoration-second ${FOCUS_RING}`}
              >
                {value}
              </Link>
            )
          ) : filled ? (
            value
          ) : (
            "—"
          )}
        </span>

        {copyable && filled && <CopyButton value={value} label={label} />}
      </dd>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  action,
  children,
  pelanggan,
  id,
  invoice,
}) {
  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-center gap-4 w-full">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <Icon size={16} />
          </div>
          <h2 className="text-lg font-bold text-second">{title}</h2>

          {pelanggan && (
            <PrimaryButton className="ml-auto" href={`/owner/customers/${id}`}>
              Lihat pelanggan
            </PrimaryButton>
          )}
          {invoice && (
            <PrimaryButton className="ml-auto" href={`/owner/invoices/${id}`}>
              Lihat invoice
            </PrimaryButton>
          )}
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function StatCard({ icon: Icon, label, value, hint, featured = false }) {
  return (
    <article
      className={`flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:p-8 ${
        featured
          ? "bg-grad text-primary shadow-lg shadow-second4/25"
          : "border border-second/30 bg-primary text-second shadow-xl shadow-second/5"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
            featured
              ? "bg-primary text-second"
              : "bg-grad text-primary shadow-lg shadow-second4/25"
          }`}
        >
          <Icon size={16} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>

      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {value}
        </p>
        {hint && (
          <p
            className={`mt-2 text-xs tabular-nums ${featured ? "text-primary/90" : "text-second/60"}`}
          >
            {hint}
          </p>
        )}
      </div>
    </article>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-second/60">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-second">
        {value}
      </dd>
    </div>
  );
}

function ProfitText({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-second/50">—</span>;
  }
  return (
    <span
      className={`font-semibold tabular-nums ${value < 0 ? "text-second2" : "text-second3"}`}
    >
      {formatPrice(value)}
    </span>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
      </div>
    </div>
  );
}

/* -------------------------------- Dialog --------------------------------- */

function stockNote(orderType, mode) {
  if (mode === "correct") {
    return "Hanya tanggal lunas yang berubah. Stok kamera tidak ikut berubah.";
  }
  if (orderType === "REFUND") {
    return mode === "pay"
      ? "Stok kamera pada item refund yang ditandai “kembali ke stok” akan bertambah."
      : "Stok item refund yang tadi ditambahkan akan dikurangi lagi. Ditolak jika stoknya sudah tidak cukup.";
  }
  return mode === "pay"
    ? "Stok setiap kamera di order ini akan berkurang sesuai jumlahnya. Jika ada yang stoknya tidak cukup, seluruh proses dibatalkan."
    : "Stok yang tadi dikurangi akan dikembalikan, dan tanggal lunas dihapus dari laporan penjualan.";
}

function PaymentDialog({ order, mode, isSaving, apiError, onClose, onSubmit }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [paidAt, setPaidAt] = useState(
    mode === "correct" && order.paid_at ? toLocalInput(order.paid_at) : "",
  );
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const isUnpay = mode === "unpay";
  const needsDate = mode === "pay" || mode === "correct";

  const titles = {
    pay: "Tandai order lunas",
    correct: "Koreksi tanggal lunas",
    unpay: "Tandai order belum lunas",
  };

  const submitLabels = {
    pay: "Tandai lunas",
    correct: "Simpan tanggal",
    unpay: "Tandai belum lunas",
  };

  function handleSubmit(event) {
    event.preventDefault();
    setLocalError("");

    let paidAtIso;
    if (needsDate && paidAt) {
      const date = new Date(paidAt);
      if (Number.isNaN(date.getTime())) {
        setLocalError("Tanggal lunas tidak valid.");
        return;
      }
      if (date.getTime() > Date.now()) {
        setLocalError("Tanggal lunas tidak boleh di masa depan.");
        return;
      }
      if (date.getTime() < new Date(order.created_at).getTime()) {
        setLocalError("Tanggal lunas tidak boleh sebelum order dibuat.");
        return;
      }
      paidAtIso = date.toISOString();
    }

    if (mode === "correct" && !paidAtIso) {
      setLocalError("Pilih tanggal lunas yang baru.");
      return;
    }

    onSubmit({
      payment_status: isUnpay ? "UNPAID" : "PAID",
      ...(paidAtIso && { paid_at: paidAtIso }),
    });
  }

  const shownError = localError || apiError?.message;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={isSaving ? undefined : onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
              isUnpay
                ? "bg-second4 text-primary"
                : "bg-grad text-primary shadow-lg shadow-second4/20"
            }`}
          >
            {isUnpay ? (
              <FiClock size={16} aria-hidden="true" />
            ) : (
              <FiCheckCircle size={16} aria-hidden="true" />
            )}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup dialog"
            className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="payment-dialog-title"
          className="mt-4 text-lg font-bold text-second"
        >
          {titles[mode]}
        </h2>

        <p className="mt-2 break-all font-mono text-xs text-second/60">
          {order.invoice?.no_invoice ?? order.id}
        </p>

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-second/5 px-4 py-2 text-sm leading-relaxed text-second/70">
          <FiPackage size={16} className="mt-1 shrink-0" aria-hidden="true" />
          {stockNote(order.type, mode)}
        </p>

        {needsDate && (
          <div className="mt-4">
            <label htmlFor="paid-at" className={labelClass}>
              Tanggal lunas
              {mode === "pay" && (
                <span className="ml-2 text-xs font-normal text-second/50">
                  (opsional)
                </span>
              )}
            </label>

            <input
              id="paid-at"
              type="datetime-local"
              value={paidAt}
              min={toLocalInput(order.created_at)}
              max={toLocalInput(new Date())}
              disabled={isSaving}
              onChange={(event) => {
                setPaidAt(event.target.value);
                setLocalError("");
              }}
              aria-invalid={localError ? "true" : undefined}
              className={inputClass(Boolean(localError))}
            />

            <p className="mt-2 text-xs text-second/60">
              {mode === "pay"
                ? "Kosongkan untuk memakai waktu sekarang. Isi jika pembayaran terjadi lebih awal."
                : "Waktu mengikuti zona waktu perangkat Anda."}
            </p>
          </div>
        )}

        {shownError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
          >
            <p className="flex items-start gap-2 font-medium">
              <FiAlertCircle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              {shownError}
            </p>

            {apiError?.cameras?.length > 0 && (
              <ul className="mt-2 space-y-2 border-t border-second2/20 pt-2 text-xs">
                {apiError.cameras.map((camera) => (
                  <li key={camera.camera_id} className="tabular-nums">
                    {camera.name}: butuh {camera.requested}, stok {camera.stock}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            className={`${BTN_BASE} w-full sm:w-auto ${isUnpay ? "bg-second2 text-primary shadow-lg shadow-second2/25" : "bg-grad text-primary shadow-lg shadow-second4/25"} hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isSaving ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Menyimpan…
              </>
            ) : (
              submitLabels[mode]
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function OwnerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const {
    data: order,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useGetOwnerOrder(id);
  const paymentMutation = useUpdateOrderPaymentStatus();

  const [dialogMode, setDialogMode] = useState(null);
  const [dialogError, setDialogError] = useState(null);

  const isNotFound =
    isError && error?.response?.data?.errors === "ORDER_NOT_FOUND";

  useEffect(() => {
    if (isNotFound) {
      notify.error("Order tidak ditemukan.");
      router.replace(ORDERS_PATH);
    }
  }, [isNotFound, router]);

  useEffect(() => {
    if (isError && !isNotFound) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }, [isError, isNotFound, error]);

  function openDialog(mode) {
    setDialogError(null);
    setDialogMode(mode);
  }

  function closeDialog() {
    if (paymentMutation.isPending) return;
    setDialogMode(null);
    setDialogError(null);
  }

  async function handleSubmitPayment(data) {
    setDialogError(null);

    try {
      await paymentMutation.mutateAsync({ id, data });
      notify.success(
        data.payment_status === "UNPAID"
          ? "Order ditandai belum lunas."
          : dialogMode === "correct"
            ? "Tanggal lunas diperbarui."
            : "Order ditandai lunas.",
      );
      setDialogMode(null);
    } catch (err) {
      const body = err?.response?.data;
      const code = body?.errors;

      if (code === "ORDER_NOT_FOUND") {
        notify.error("Order tidak ditemukan.");
        router.replace(ORDERS_PATH);
        return;
      }
      if (code === "INSUFFICIENT_STOCK") {
        setDialogError({
          message: "Stok tidak cukup, order tidak bisa dilunasi.",
          cameras: body?.cameras ?? [],
        });
        return;
      }
      if (code === "ORDER_HAS_REFUNDS") {
        setDialogError({
          message:
            "Order ini sudah punya refund, jadi tidak bisa dikembalikan ke belum lunas.",
        });
        return;
      }
      if (code === "PAID_AT_BEFORE_ORDER") {
        setDialogError({
          message: "Tanggal lunas tidak boleh sebelum order dibuat.",
        });
        return;
      }
      setDialogError({ message: normalizeApiError(err).message });
    }
  }

  if (isLoading || isNotFound) {
    return <LoadingState />;
  }

  if (isError || !order) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <Link
            href={ORDERS_PATH}
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke daftar order
          </Link>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat detail order
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Order mungkin tidak ditemukan atau sesi Anda telah berakhir.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiLoader
              size={16}
              className={
                isFetching
                  ? "animate-spin motion-reduce:animate-none"
                  : "hidden"
              }
              aria-hidden="true"
            />
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      </div>
    );
  }

  const items = order.items ?? [];
  const refunds = order.refunds ?? [];
  const invoice = order.invoice;
  const customer = order.customer;

  const isPaid = order.payment_status === "PAID";
  const isRefund = order.type === "REFUND";
  const hasRefunds = refunds.length > 0;
  const showCapital = !isRefund;

  const totalQuantity = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const totalAmount = Number(order.total_amount) || 0;
  const margin =
    order.profit !== null && order.profit !== undefined && totalAmount > 0
      ? (order.profit / totalAmount) * 100
      : null;

  const storeDiscount = invoice?.store_discount ?? order.store_discount;
  const customerDiscount =
    invoice?.customer_discount ?? order.customer_discount;

  const customerChanged =
    customer &&
    (customer.name !== order.customer_name ||
      customer.whatsapp !== order.whatsapp ||
      (customer.instagram ?? null) !== (order.instagram ?? null));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <Link
          href={ORDERS_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar order
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiShoppingBag size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-second/60">Detail order</p>
              <h1 className="mt-2 break-all text-xl font-bold tracking-tight text-second sm:text-xl">
                {invoice?.no_invoice ?? "Order tanpa invoice"}
              </h1>
              <p className="mt-2 text-xs sm:text-sm tabular-nums text-second/60">
                Dibuat {formatDateTime(order.created_at)}
                {isPaid && order.paid_at && (
                  <>
                    {" "}
                    <br />
                    Lunas {formatDateTime(order.paid_at)}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Badge group */}
          <div className="flex flex-wrap items-center gap-2">
            <Tag
              tone={isPaid ? "blue" : "violet"}
              icon={isPaid ? FiCheckCircle : FiClock}
            >
              {isPaid ? "Lunas" : "Belum lunas"}
            </Tag>
            <Tag
              tone={isRefund ? "red" : "muted"}
              icon={isRefund ? FiRotateCcw : FiShoppingBag}
            >
              {TYPE_LABEL[order.type] ?? order.type}
            </Tag>
            {invoice?.is_final && <Tag tone="grad">Invoice final</Tag>}
          </div>
        </div>

        {/* Toolbar aksi */}
        <div className="rounded-2xl shadow-lg shadow-second/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Aksi utama */}
            {!isPaid ? (
              <button
                type="button"
                onClick={() => openDialog("pay")}
                className={`${BTN_BASE} w-full justify-center bg-grad text-primary shadow-lg shadow-second4/20 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
              >
                <FiCheckCircle size={16} aria-hidden="true" />
                Tandai lunas
              </button>
            ) : !isRefund ? (
              <Link
                href={REFUND_PATH(order.id)}
                className={`${BTN_BASE} w-full justify-center border border-second/30 text-second hover:border-second4 hover:text-second4 sm:w-auto ${FOCUS_RING}`}
              >
                <FiRotateCcw size={16} aria-hidden="true" />
                {hasRefunds ? "Kelola refund" : "Ajukan refund"}
              </Link>
            ) : invoice?.id ? (
              <Link
                href={INVOICE_DETAIL_PATH(invoice.id)}
                className={`${BTN_BASE} w-full justify-center bg-grad text-primary shadow-lg shadow-second4/20 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
              >
                <FiFileText size={16} aria-hidden="true" />
                Lihat invoice
              </Link>
            ) : null}

            {/* Aksi tambahan */}
            <details className="group min-w-0 flex-1">
              <summary
                className={`flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-second/20 px-4 py-2.5 text-sm font-medium text-second/70 transition-colors hover:border-second/40 hover:text-second [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
              >
                <span className="flex items-center gap-2">
                  <FiEdit2 size={16} aria-hidden="true" />
                  Aksi lainnya
                </span>

                <span className="text-second/50 transition-transform duration-200 group-open:rotate-180">
                  <FiChevronDown size={16} aria-hidden="true" />
                </span>
              </summary>

              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-second/10 pt-3 sm:grid-cols-2">
                {isPaid && (
                  <>
                    <button
                      type="button"
                      onClick={() => openDialog("correct")}
                      className={`${BTN_BASE} justify-center border border-second/20 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                    >
                      <FiClock size={16} aria-hidden="true" />
                      Koreksi tanggal lunas
                    </button>

                    <button
                      type="button"
                      onClick={() => openDialog("unpay")}
                      disabled={hasRefunds}
                      title={
                        hasRefunds
                          ? "Order yang sudah punya refund tidak bisa dikembalikan ke belum lunas."
                          : undefined
                      }
                      className={`${BTN_BASE} justify-center border border-second/20 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
                    >
                      <FiRotateCcw size={16} aria-hidden="true" />
                      Tandai belum lunas
                    </button>
                  </>
                )}

                {!isRefund &&
                  (isPaid ? (
                    <button
                      type="button"
                      disabled
                      title="Order sudah lunas. Tandai belum lunas dulu untuk mengubah item."
                      className={`${BTN_BASE} justify-center border border-second/20 text-second opacity-40 ${FOCUS_RING}`}
                    >
                      <FiEdit2 size={16} aria-hidden="true" />
                      Edit item
                    </button>
                  ) : (
                    <Link
                      href={ITEMS_PATH(order.id)}
                      className={`${BTN_BASE} justify-center border border-second/20 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                    >
                      <FiEdit2 size={16} aria-hidden="true" />
                      Edit item
                    </Link>
                  ))}

                {!isRefund && !isPaid && (
                  <button
                    type="button"
                    disabled
                    title="Order harus lunas sebelum bisa direfund."
                    className={`${BTN_BASE} justify-center border border-second/20 text-second opacity-40 ${FOCUS_RING}`}
                  >
                    <FiRotateCcw size={16} aria-hidden="true" />
                    Ajukan refund
                  </button>
                )}

                {invoice?.id && (
                  <Link
                    href={INVOICE_DETAIL_PATH(invoice.id)}
                    className={`${BTN_BASE} justify-center border border-second/20 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                  >
                    <FiFileText size={16} aria-hidden="true" />
                    Lihat invoice
                  </Link>
                )}
              </div>
            </details>
          </div>

          {/* Informasi status */}
          {!isPaid && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-3 py-3 text-xs leading-relaxed text-second4 sm:text-sm">
              <FiClock
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Order belum lunas, jadi belum masuk laporan penjualan
              {isRefund ? "." : " dan stok kamera belum berkurang."}
            </p>
          )}

          {isPaid && hasRefunds && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-3 py-3 text-xs leading-relaxed text-second4 sm:text-sm">
              <FiRotateCcw
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Order ini sudah punya refund, sehingga status lunasnya dikunci.
            </p>
          )}
        </div>
      </header>

      {/* Stat cards */}
      <section
        aria-label="Ringkasan order"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          featured
          icon={FiCreditCard}
          label="Total order"
          value={formatPrice(order.total_amount)}
          hint={`${items.length} jenis · ${formatNumber(totalQuantity)} unit`}
        />
        <StatCard
          icon={isPaid ? FiCheckCircle : FiClock}
          label="Status pembayaran"
          value={isPaid ? "Lunas" : "Belum lunas"}
          hint={
            isPaid && order.paid_at
              ? formatDateTime(order.paid_at, false)
              : "Belum ada pembayaran"
          }
        />
        <StatCard
          icon={FiShoppingBag}
          label="Modal"
          value={money(order.capital_total)}
          hint={
            isRefund
              ? "Tidak berlaku untuk refund"
              : "Salinan modal saat order dibuat"
          }
        />
        <StatCard
          icon={FiTrendingUp}
          label="Laba"
          value={money(order.profit)}
          hint={margin !== null ? `Margin ${formatPercent(margin)}` : undefined}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Kolom utama */}
        <div className="flex min-w-0 flex-col gap-8">
          {/* Item */}
          <section
            className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
            aria-labelledby="items-title"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <h2 id="items-title" className="text-lg font-bold text-second">
                Item order
              </h2>
              <Tag tone="soft">
                {items.length} item · {formatNumber(totalQuantity)} unit
              </Tag>
            </div>

            {/* Tabel */}
            <div className="hidden overflow-hidden rounded-xl  sm:block">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-grad text-xs text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Item
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Harga
                      </th>
                      {showCapital && (
                        <th
                          scope="col"
                          className="px-4 py-3 text-right font-semibold"
                        >
                          Modal
                        </th>
                      )}
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Qty
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Subtotal
                      </th>
                      {showCapital && (
                        <th
                          scope="col"
                          className="px-4 py-3 text-right font-semibold"
                        >
                          Laba
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-second/10">
                    {items.map((item, i) => (
                      <tr
                        key={item.id}
                        className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-start">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-second">
                                {item.camera_name}
                              </p>
                              {item.sku && (
                                <p className="mt-2 font-mono text-xs text-second/60">
                                  SKU {item.sku}
                                </p>
                              )}
                              {isRefund && (
                                <span
                                  className={`mt-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold ${item.restocked ? "bg-second3/10 text-second3" : "bg-second/10 text-second/60"}`}
                                >
                                  <FiRotateCcw size={11} aria-hidden="true" />
                                  {item.restocked
                                    ? "Kembali ke stok"
                                    : "Tidak masuk stok"}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                          {formatPrice(item.camera_price)}
                        </td>
                        {showCapital && (
                          <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                            {money(item.camera_modal)}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                          × {item.quantity}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums text-second">
                          {formatPrice(item.line_total)}
                        </td>
                        {showCapital && (
                          <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums">
                            <ProfitText
                              value={
                                item.line_capital === null ||
                                item.line_capital === undefined
                                  ? null
                                  : item.line_total - item.line_capital
                              }
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="border-t border-second/30 bg-second/[0.03]">
                      <th
                        scope="row"
                        colSpan={showCapital ? 4 : 2}
                        className="px-4 py-3 text-right text-sm font-semibold text-second"
                      >
                        Subtotal
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-second">
                        {formatPrice(order.subtotal)}
                      </td>
                      {showCapital && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Card mobile */}
            <ul className="flex flex-col gap-4 sm:hidden">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
                      <FiCamera size={16} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-second">
                        {item.camera_name}
                      </p>
                      {item.sku && (
                        <p className="mt-2 font-mono text-xs text-second/60">
                          SKU {item.sku}
                        </p>
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-second/30 pt-4 text-sm">
                    <dt className="text-second/60">Harga</dt>
                    <dd className="text-right tabular-nums text-second">
                      {formatPrice(item.camera_price)}
                    </dd>
                    <dt className="text-second/60">Qty</dt>
                    <dd className="text-right tabular-nums text-second">
                      × {item.quantity}
                    </dd>
                    {showCapital && (
                      <>
                        <dt className="text-second/60">Modal</dt>
                        <dd className="text-right tabular-nums text-second">
                          {money(item.camera_modal)}
                        </dd>
                      </>
                    )}
                    <dt className="font-semibold text-second">Subtotal</dt>
                    <dd className="text-right font-semibold tabular-nums text-second">
                      {formatPrice(item.line_total)}
                    </dd>
                    {showCapital && (
                      <>
                        <dt className="text-second/60">Laba</dt>
                        <dd className="text-right font-semibold tabular-nums">
                          <ProfitText
                            value={
                              item.line_capital === null ||
                              item.line_capital === undefined
                                ? null
                                : item.line_total - item.line_capital
                            }
                          />
                        </dd>
                      </>
                    )}
                  </dl>

                  {isRefund && (
                    <span
                      className={`mt-4 inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold ${item.restocked ? "bg-second3/10 text-second3" : "bg-second/10 text-second/60"}`}
                    >
                      <FiRotateCcw size={11} aria-hidden="true" />
                      {item.restocked ? "Kembali ke stok" : "Tidak masuk stok"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Ringkasan pembayaran */}
          <DetailSection icon={FiCreditCard} title="Ringkasan pembayaran">
            <dl className="divide-y divide-second/10">
              <SummaryRow
                label="Subtotal"
                value={formatPrice(order.subtotal)}
              />
              <SummaryRow
                label="Diskon toko"
                value={discountText(storeDiscount)}
              />
              <SummaryRow
                label="Diskon pelanggan"
                value={discountText(customerDiscount)}
              />
              <div className="flex items-center justify-between gap-4 pt-4">
                <dt className="font-semibold text-second">Total order</dt>
                <dd className="text-2xl font-bold tabular-nums text-second">
                  {formatPrice(order.total_amount)}
                </dd>
              </div>
            </dl>

            {showCapital && (
              <dl className="grid grid-cols-2 gap-4 border-t border-second/30 pt-4">
                <div className="rounded-xl bg-second/[0.03] p-4">
                  <dt className="text-xs text-second/60">Total modal</dt>
                  <dd className="mt-2 text-sm font-semibold tabular-nums text-second">
                    {money(order.capital_total)}
                  </dd>
                </div>
                <div className="rounded-xl bg-second/[0.03] p-4">
                  <dt className="text-xs text-second/60">Laba</dt>
                  <dd className="mt-2 text-sm font-semibold tabular-nums">
                    <ProfitText value={order.profit} />
                  </dd>
                </div>
              </dl>
            )}
          </DetailSection>

          {/* Refund terkait */}
          {(hasRefunds || order.refund_of_id) && (
            <DetailSection icon={FiRotateCcw} title="Refund terkait">
              {order.refund_of_id && (
                <p className="text-sm text-second">
                  <PrimaryButton href={ORDER_DETAIL_PATH(order.refund_of_id)}>
                    Lihat order yang memiliki refund ini{" "}
                  </PrimaryButton>
                </p>
              )}

              {hasRefunds && (
                <ul className="divide-y divide-second/10">
                  {refunds.map((refund) => (
                    <li
                      key={refund.id}
                      className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <PrimaryButton href={ORDER_DETAIL_PATH(refund.id)}>
                          Lihat refund
                        </PrimaryButton>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-second/60">Nominal refund</p>
                        <p className="text-sm font-semibold tabular-nums text-second2">
                          − {formatPrice(refund.total_amount)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:-mt-4 xl:pt-4">
          <DetailSection
            icon={FiUser}
            title="Pelanggan"
            pelanggan
            id={order.customer.id}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-second/50">
              Saat order dibuat
            </p>

            <dl className="flex flex-col gap-4">
              <DetailField label="Nama" value={order.customer_name} />
              <DetailField
                label="WhatsApp"
                value={order.whatsapp}
                href={getWhatsappHref(order.whatsapp)}
                external
              />
              <DetailField
                label="Instagram"
                value={order.instagram}
                href={getInstagramHref(order.instagram)}
                external
              />
              <DetailField label="Alamat" value={order.address} />
            </dl>

            {customer ? (
              <div className="flex flex-col gap-4 border-t border-second/30 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-second/50">
                  Data pelanggan terkini
                </p>

                {customerChanged && (
                  <p className="rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-xs leading-relaxed text-second4">
                    Data pelanggan sudah berubah sejak order dibuat. Order dan
                    invoice tetap memakai data lama.
                  </p>
                )}

                <dl className="flex flex-col gap-4">
                  <DetailField
                    label="Nama"
                    value={customer.name}
                    href={CUSTOMER_DETAIL_PATH(customer.id)}
                  />
                  <DetailField
                    label="WhatsApp"
                    value={customer.whatsapp}
                    href={getWhatsappHref(customer.whatsapp)}
                    external
                  />
                  <DetailField
                    label="Instagram"
                    value={customer.instagram}
                    href={getInstagramHref(customer.instagram)}
                    external
                  />
                  <DetailField
                    label="ID pelanggan"
                    value={customer.id}
                    mono
                    copyable
                  />
                </dl>
              </div>
            ) : (
              <p className="border-t border-second/30 pt-4 text-xs leading-relaxed text-second/60">
                Order ini belum terhubung ke data pelanggan (order lama).
              </p>
            )}
          </DetailSection>

          <DetailSection
            icon={FiFileText}
            title="Invoice"
            invoice
            id={invoice.id}
          >
            {invoice ? (
              <dl className="flex flex-col gap-4">
                <DetailField
                  label="Nomor invoice"
                  value={invoice.no_invoice}
                  href={INVOICE_DETAIL_PATH(invoice.id)}
                  mono
                  copyable
                />
                <DetailField
                  label="Metode pembayaran"
                  value={invoice.payment_method}
                />
                <DetailField label="Pengiriman" value={invoice.ship} />
                <DetailField
                  label="Status invoice"
                  value={invoice.is_final ? "Final" : "Belum final"}
                />
              </dl>
            ) : (
              <p className="text-sm text-second/60">
                Order ini belum memiliki invoice.
              </p>
            )}
          </DetailSection>
        </aside>
      </div>

      {dialogMode && (
        <PaymentDialog
          key={dialogMode}
          order={order}
          mode={dialogMode}
          isSaving={paymentMutation.isPending}
          apiError={dialogError}
          onClose={closeDialog}
          onCancel={closeDialog}
          onSubmit={handleSubmitPayment}
        />
      )}
    </div>
  );
}
