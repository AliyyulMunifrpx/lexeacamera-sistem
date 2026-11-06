"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCamera,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiInfo,
  FiLoader,
  FiMinus,
  FiPackage,
  FiPlus,
  FiRotateCcw,
  FiTrash2,
  FiX,
} from "react-icons/fi";

// ─── SESUAIKAN PATH INI ────────────────────────────────────────────
import {
  useCreateRefund,
  useDeleteRefund,
  useGetOrderRefunds,
} from "../../../../../features/refunds/hooks.js";

import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";
import { formatCurrency } from "../../../../../../components/owner/invoice-formatters.js";
// ───────────────────────────────────────────────────────────────────

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const ORDER_DETAIL_PATH = (id) => `/owner/orders/${id}`;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

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

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

function toLocalInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Digit murni → "1.500.000" (tanpa "Rp"), string kosong tetap kosong.
// Dibangun di atas formatCurrency supaya satu sumber format.
function formatDigitsInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return formatCurrency(Number(digits)).replace(/^Rp\s?/, "");
}

// Hitung posisi caret setelah digit disisipi pemisah.
// digitIndex = jumlah digit di kiri caret SEBELUM diformat ulang.
function caretFromDigitIndex(formatted, digitIndex) {
  if (digitIndex <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === digitIndex) return i + 1;
    }
  }
  return formatted.length;
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

function FormSection({ icon: Icon, title, description, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-second">{title}</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            {description}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Stepper({ value, max, onChange, label, disabled }) {
  const clamp = (n) => Math.min(max, Math.max(0, n));

  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-second/30">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= 0}
        aria-label={`Kurangi jumlah ${label}`}
        className={`flex size-8 items-center justify-center text-second transition-colors hover:bg-second/10 hover:text-second4 disabled:opacity-30 ${FOCUS_RING}`}
      >
        <FiMinus size={16} aria-hidden="true" />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = parseInt(event.target.value, 10);
          onChange(clamp(Number.isNaN(next) ? 0 : next));
        }}
        aria-label={`Jumlah ${label} yang direfund`}
        className="h-8 w-12 border-x border-second/30 bg-transparent text-center text-sm font-semibold tabular-nums text-second [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-second4/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Tambah jumlah ${label}`}
        className={`flex size-8 items-center justify-center text-second transition-colors hover:bg-second/10 hover:text-second4 disabled:opacity-30 ${FOCUS_RING}`}
      >
        <FiPlus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function ConfirmDeleteDialog({
  refund,
  isDeleting,
  error,
  onClose,
  onConfirm,
}) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={isDeleting ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-refund-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second2 text-primary shadow-lg shadow-second2/25">
            <FiTrash2 size={16} aria-hidden="true" />
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup dialog"
            className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="delete-refund-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Batalkan refund ini?
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-second/60">
          Refund{" "}
          <span className="break-all font-mono text-xs font-semibold text-second">
            {refund.no_invoice ?? refund.id}
          </span>{" "}
          senilai {formatCurrency(refund.total_amount)} akan dihapus beserta
          invoicenya. Jatah barang dan nominal refund kembali ke order.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
          >
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
          >
            Tidak
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
                Ya, batalkan refund
              </>
            )}
          </button>
        </div>
      </div>
    </div>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function RefundPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params.id === "string" ? params.id : "";

  const {
    data: summary,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetOrderRefunds(orderId);
  const createMutation = useCreateRefund();
  const deleteMutation = useDeleteRefund();

  const [quantities, setQuantities] = useState({});
  const [restocked, setRestocked] = useState({});
  const [amountInput, setAmountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [paidAt, setPaidAt] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [refundToDelete, setRefundToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const amountInputRef = useRef(null);

  const code = error?.response?.data?.errors;
  const isNotFound = isError && code === "ORDER_NOT_FOUND";
  const isNotSale = isError && code === "ORDER_NOT_SALE";

  useEffect(() => {
    if (isNotFound) {
      notify.error("Order tidak ditemukan.");
      router.replace("/owner/orders");
    }
  }, [isNotFound, router]);

  useEffect(() => {
    if (isError && !isNotFound && !isNotSale) {
      notify.error(normalizeApiError(error).message);
    }
  }, [isError, isNotFound, isNotSale, error]);

  const order = summary?.order;
  const items = summary?.items ?? [];
  const amount = summary?.amount ?? { total: 0, refunded: 0, refundable: 0 };
  const refunds = summary?.refunds ?? [];

  const isPaidOrder = order?.payment_status === "PAID";
  const canRefund =
    isPaidOrder && amount.refundable > 0 && items.some((i) => i.refundable > 0);

  const selected = useMemo(
    () => items.filter((item) => (quantities[item.camera_id] ?? 0) > 0),
    [items, quantities],
  );

  const selectedUnits = selected.reduce(
    (sum, item) => sum + quantities[item.camera_id],
    0,
  );

  const restockUnits = selected.reduce(
    (sum, item) =>
      sum +
      ((restocked[item.camera_id] ?? true) ? quantities[item.camera_id] : 0),
    0,
  );

  const estimatedAmount = useMemo(() => {
    if (selected.length === 0) return 0;
    const takesAllRemaining = items
      .filter((item) => item.refundable > 0)
      .every((item) => (quantities[item.camera_id] ?? 0) === item.refundable);
    if (takesAllRemaining) return amount.refundable;
    const orderSubtotal = items.reduce(
      (sum, item) => sum + item.camera_price * item.purchased,
      0,
    );
    if (orderSubtotal <= 0) return 0;
    const gross = selected.reduce(
      (sum, item) => sum + item.camera_price * quantities[item.camera_id],
      0,
    );
    return Math.min(
      amount.refundable,
      Math.round((amount.total * gross) / orderSubtotal),
    );
  }, [selected, items, quantities, amount]);

  const customAmount = amountInput === "" ? null : Number(amountInput);
  const finalAmount = customAmount ?? estimatedAmount;

  function setQuantity(cameraId, value) {
    setQuantities((current) => ({ ...current, [cameraId]: value }));
    setFieldErrors((current) => ({ ...current, items: "" }));
    setFormError(null);
  }

  function setAll() {
    const next = {};
    items.forEach((item) => {
      if (item.refundable > 0) next[item.camera_id] = item.refundable;
    });
    setQuantities(next);
    setFieldErrors((current) => ({ ...current, items: "" }));
  }

  function clearAll() {
    setQuantities({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    const errors = {};

    if (selected.length === 0) {
      errors.items = "Pilih minimal satu barang yang akan direfund.";
    }

    if (amountInput !== "") {
      if (!/^\d+$/.test(amountInput) || Number(amountInput) <= 0) {
        errors.amount = "Nominal harus berupa angka rupiah lebih dari 0.";
      } else if (Number(amountInput) > amount.refundable) {
        errors.amount = `Nominal melebihi sisa yang bisa direfund (${formatCurrency(amount.refundable)}).`;
      }
    }

    let paidAtIso;
    if (paymentStatus === "PAID" && paidAt) {
      const date = new Date(paidAt);
      if (Number.isNaN(date.getTime())) {
        errors.paidAt = "Tanggal tidak valid.";
      } else if (date.getTime() > Date.now()) {
        errors.paidAt = "Tanggal tidak boleh di masa depan.";
      } else if (
        order?.paid_at &&
        date.getTime() < new Date(order.paid_at).getTime()
      ) {
        errors.paidAt = "Tanggal tidak boleh sebelum order asli dilunasi.";
      } else {
        paidAtIso = date.toISOString();
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    try {
      await createMutation.mutateAsync({
        orderId,
        data: {
          items: selected.map((item) => ({
            camera_id: item.camera_id,
            quantity: quantities[item.camera_id],
            restocked: restocked[item.camera_id] ?? true,
          })),
          amount: amountInput === "" ? undefined : Number(amountInput),
          payment_method: paymentMethod.trim() || undefined,
          payment_status: paymentStatus,
          paid_at: paidAtIso,
        },
      });

      notify.success(
        paymentStatus === "PAID"
          ? "Refund dibuat dan langsung ditandai lunas."
          : "Refund berhasil dibuat.",
      );
      router.replace(ORDER_DETAIL_PATH(orderId));
    } catch (err) {
      const body = err?.response?.data;
      const errorCode = body?.errors;

      switch (errorCode) {
        case "REFUND_EXCEEDS_PURCHASED":
          setFormError({
            message:
              "Jumlah refund melebihi jumlah yang bisa direfund. Data sudah diperbarui, silakan sesuaikan.",
            cameras: body?.cameras ?? [],
          });
          refetch();
          return;
        case "REFUND_AMOUNT_EXCEEDS":
          setFieldErrors({
            amount: `Nominal melebihi sisa yang bisa direfund (${formatCurrency(body?.max ?? amount.refundable)}).`,
          });
          refetch();
          return;
        case "ORDER_NOT_PAID":
          setFormError({
            message: "Order asli belum lunas, jadi belum bisa direfund.",
          });
          refetch();
          return;
        case "ITEM_NOT_IN_ORDER":
          setFormError({ message: "Ada barang yang tidak ada di order ini." });
          refetch();
          return;
        case "PAID_AT_BEFORE_ORDER":
          setFieldErrors({
            paidAt: "Tanggal tidak boleh sebelum order asli dilunasi.",
          });
          return;
        case "STORE_NOT_READY":
          setFormError({
            message:
              "Data toko belum diisi. Lengkapi profil toko terlebih dahulu.",
          });
          return;
        case "INVOICE_NUMBER_GENERATION_FAILED":
          setFormError({
            message: "Gagal membuat nomor invoice. Silakan coba lagi.",
          });
          return;
        case "ORDER_NOT_FOUND":
          notify.error("Order tidak ditemukan.");
          router.replace("/owner/orders");
          return;
        default:
          setFormError({ message: normalizeApiError(err).message });
      }
    }
  }

  async function handleDeleteRefund() {
    if (!refundToDelete) return;
    setDeleteError("");

    try {
      await deleteMutation.mutateAsync({
        refundId: refundToDelete.id,
        orderId,
      });
      notify.success("Refund dibatalkan.");
      setRefundToDelete(null);
    } catch (err) {
      const errorCode = err?.response?.data?.errors;

      if (errorCode === "REFUND_ALREADY_PAID") {
        setDeleteError(
          "Refund sudah lunas. Ubah dulu ke belum lunas di halaman detail order (khusus owner), lalu hapus.",
        );
        refetch();
        return;
      }
      if (errorCode === "REFUND_NOT_FOUND") {
        notify.error("Refund tidak ditemukan.");
        setRefundToDelete(null);
        refetch();
        return;
      }
      setDeleteError(normalizeApiError(err).message);
    }
  }

  if (isLoading || isNotFound) {
    return <LoadingState />;
  }

  if (isNotSale) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <Link
            href={ORDER_DETAIL_PATH(orderId)}
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke detail order
          </Link>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second4/30 bg-second4/5 px-4 py-16 text-center">
          <FiInfo size={32} className="text-second4" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-second">
            Order refund tidak bisa direfund lagi
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Refund hanya dibuat untuk order penjualan. Buka order penjualan
            aslinya untuk mengajukan refund.
          </p>
        </div>
      </div>
    );
  }

  if (isError || !summary || !order) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <Link
            href={ORDER_DETAIL_PATH(orderId)}
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke detail order
          </Link>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat data refund
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau sesi Anda, lalu coba kembali.
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

  const isSaving = createMutation.isPending;
  const blockedReason = !isPaidOrder
    ? "Order ini belum lunas, jadi belum bisa direfund. Lunasi dulu di halaman detail order."
    : !canRefund
      ? "Semua barang di order ini sudah direfund."
      : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <Link
          href={ORDER_DETAIL_PATH(orderId)}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke detail order
        </Link>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiRotateCcw size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-xl font-bold tracking-tight text-second sm:text-xl">
              Ajukan <span className="text-grad">Refund</span>
            </h1>
            <p className="mt-2 break-all font-mono text-xs text-second/60">
              Order {orderId}
            </p>
            <p className="mt-2 text-pretty text-xs sm:text-sm text-second/60">
              Pilih barang dan jumlah yang dikembalikan. Refund punya invoice
              sendiri dan tidak otomatis lunas.
            </p>
          </div>
        </div>
      </header>

      {/* Stat cards */}
      <section
        aria-label="Ringkasan nominal order"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          featured
          icon={FiCreditCard}
          label="Total order"
          value={formatCurrency(amount.total)}
          hint="Setelah diskon"
        />
        <StatCard
          icon={FiRotateCcw}
          label="Sudah direfund"
          value={formatCurrency(amount.refunded)}
          hint={`${refunds.length} refund`}
        />
        <StatCard
          icon={FiCheckCircle}
          label="Masih bisa direfund"
          value={formatCurrency(amount.refundable)}
        />
      </section>

      {blockedReason && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-sm text-second4"
        >
          <FiInfo size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {blockedReason}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <form
            id="refund-form"
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-8"
          >
            {/* Barang */}
            <FormSection
              icon={FiPackage}
              title="Barang yang direfund"
              description="Jumlah dibatasi sesuai yang dibeli dikurangi refund sebelumnya (termasuk yang belum lunas)."
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className="text-sm tabular-nums text-second/60"
                  aria-live="polite"
                >
                  {selectedUnits} unit dipilih
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={setAll}
                    disabled={!canRefund || isSaving}
                    className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:opacity-40 ${FOCUS_RING}`}
                  >
                    Pilih semua
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={selectedUnits === 0 || isSaving}
                    className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:opacity-40 ${FOCUS_RING}`}
                  >
                    Kosongkan
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-second/10 rounded-xl border border-second/30">
                {items.map((item) => {
                  const qty = quantities[item.camera_id] ?? 0;
                  const exhausted = item.refundable <= 0;
                  const restock = restocked[item.camera_id] ?? true;

                  return (
                    <li
                      key={item.camera_id}
                      className={`p-4 ${exhausted ? "opacity-50" : ""}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
                            <FiCamera size={16} aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-second">
                              {item.camera_name}
                            </p>
                            <p className="mt-2 text-xs tabular-nums text-second/60">
                              {formatCurrency(item.camera_price)} · dibeli{" "}
                              {item.purchased} · sudah direfund {item.refunded}
                            </p>
                            <p className="mt-2">
                              {exhausted ? (
                                <Tag>Sudah habis direfund</Tag>
                              ) : (
                                <Tag tone="blue">
                                  Bisa direfund {item.refundable}
                                </Tag>
                              )}
                            </p>
                          </div>
                        </div>
                        <Stepper
                          value={qty}
                          max={item.refundable}
                          label={item.camera_name}
                          disabled={exhausted || !canRefund || isSaving}
                          onChange={(value) =>
                            setQuantity(item.camera_id, value)
                          }
                        />
                      </div>

                      {qty > 0 && (
                        <label className="mt-4 flex cursor-pointer items-start gap-4 rounded-xl bg-second/[0.03] px-4 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={restock}
                            disabled={isSaving}
                            onChange={(event) =>
                              setRestocked((current) => ({
                                ...current,
                                [item.camera_id]: event.target.checked,
                              }))
                            }
                            className={`mt-0.5 size-4 accent-second4 ${FOCUS_RING}`}
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold text-second">
                              Kembali ke stok
                            </span>
                            <span className="mt-2 block text-xs leading-relaxed text-second/60">
                              Hilangkan centang jika barang rusak atau tidak
                              bisa dijual lagi.
                            </span>
                          </span>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>

              {fieldErrors.items && (
                <p
                  role="alert"
                  className="flex items-start gap-2 text-sm text-second2"
                >
                  <FiAlertCircle
                    size={16}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  {fieldErrors.items}
                </p>
              )}
            </FormSection>

            {/* Nominal & pembayaran */}
            <FormSection
              icon={FiCreditCard}
              title="Nominal dan pembayaran"
              description="Nominal bisa dikosongkan, server menghitungnya secara proporsional dari total order setelah diskon."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="refund-amount" className={labelClass}>
                    Nominal dikembalikan
                    <span className="ml-2 text-xs font-normal text-second/50">
                      (opsional)
                    </span>
                  </label>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-second/60"
                    >
                      Rp
                    </span>
                    <input
                      ref={amountInputRef}
                      id="refund-amount"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9.]*"
                      autoComplete="off"
                      value={formatDigitsInput(amountInput)}
                      disabled={!canRefund || isSaving}
                      onChange={(event) => {
                        const input = event.target;
                        const raw = input.value;

                        const caretPos = input.selectionStart ?? raw.length;
                        const digitsBeforeCaret = raw
                          .slice(0, caretPos)
                          .replace(/\D/g, "").length;

                        const digits = raw.replace(/\D/g, "").slice(0, 12);
                        setAmountInput(digits);
                        setFieldErrors((current) => ({
                          ...current,
                          amount: "",
                        }));

                        const formatted = formatDigitsInput(digits);
                        const nextCaret = caretFromDigitIndex(
                          formatted,
                          digitsBeforeCaret,
                        );
                        requestAnimationFrame(() => {
                          amountInputRef.current?.setSelectionRange(
                            nextCaret,
                            nextCaret,
                          );
                        });
                      }}
                      placeholder={
                        estimatedAmount > 0
                          ? formatDigitsInput(estimatedAmount)
                          : "Otomatis"
                      }
                      aria-invalid={fieldErrors.amount ? "true" : undefined}
                      aria-describedby="refund-amount-hint"
                      className={`${inputClass(Boolean(fieldErrors.amount))} pl-10 text-right tabular-nums`}
                    />
                  </div>
                  <p
                    id="refund-amount-hint"
                    className={`mt-2 text-xs ${fieldErrors.amount ? "text-second2" : "text-second/60"}`}
                    role={fieldErrors.amount ? "alert" : undefined}
                  >
                    {fieldErrors.amount ||
                      `Maksimal ${formatCurrency(amount.refundable)}. Kosongkan untuk dihitung otomatis.`}
                  </p>
                </div>

                <div className="min-w-0">
                  <label htmlFor="refund-method" className={labelClass}>
                    Metode pengembalian
                    <span className="ml-2 text-xs font-normal text-second/50">
                      (opsional)
                    </span>
                  </label>
                  <input
                    id="refund-method"
                    value={paymentMethod}
                    maxLength={100}
                    disabled={!canRefund || isSaving}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    autoComplete="off"
                    placeholder="Contoh: Transfer"
                    className={inputClass(false)}
                  />
                </div>
              </div>

              <fieldset>
                <legend className={labelClass}>Status pembayaran refund</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    {
                      value: "UNPAID",
                      icon: FiClock,
                      title: "Belum lunas",
                      text: "Refund dicatat dulu. Stok dan laporan belum berubah sampai dilunasi owner.",
                    },
                    {
                      value: "PAID",
                      icon: FiCheckCircle,
                      title: "Langsung lunas",
                      text: "Dana sudah dikembalikan. Stok item “kembali ke stok” langsung bertambah.",
                    },
                  ].map((option) => {
                    const active = paymentStatus === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors focus-within:ring-4 focus-within:ring-second4/15 ${
                          active
                            ? "border-second4 bg-second4/5"
                            : "border-second/30 hover:border-second/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment_status"
                          value={option.value}
                          checked={active}
                          disabled={!canRefund || isSaving}
                          onChange={() => {
                            setPaymentStatus(option.value);
                            setFieldErrors((current) => ({
                              ...current,
                              paidAt: "",
                            }));
                          }}
                          className={`mt-0.5 size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold text-second">
                            <option.icon size={14} aria-hidden="true" />
                            {option.title}
                          </span>
                          <span className="mt-2 block text-xs leading-relaxed text-second/60">
                            {option.text}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {paymentStatus === "PAID" && (
                <div className="max-w-sm">
                  <label htmlFor="refund-paid-at" className={labelClass}>
                    Tanggal lunas
                    <span className="ml-2 text-xs font-normal text-second/50">
                      (opsional)
                    </span>
                  </label>
                  <input
                    id="refund-paid-at"
                    type="datetime-local"
                    value={paidAt}
                    min={
                      order.paid_at ? toLocalInput(order.paid_at) : undefined
                    }
                    max={toLocalInput(new Date())}
                    disabled={isSaving}
                    onChange={(event) => {
                      setPaidAt(event.target.value);
                      setFieldErrors((current) => ({ ...current, paidAt: "" }));
                    }}
                    aria-invalid={fieldErrors.paidAt ? "true" : undefined}
                    className={inputClass(Boolean(fieldErrors.paidAt))}
                  />
                  <p
                    className={`mt-2 text-xs ${fieldErrors.paidAt ? "text-second2" : "text-second/60"}`}
                    role={fieldErrors.paidAt ? "alert" : undefined}
                  >
                    {fieldErrors.paidAt ||
                      "Kosongkan untuk memakai waktu sekarang. Tidak boleh sebelum order asli dilunasi."}
                  </p>
                </div>
              )}
            </FormSection>

            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
              >
                <p className="flex items-start gap-2 font-medium">
                  <FiAlertCircle
                    size={16}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  {formError.message}
                </p>
                {formError.cameras?.length > 0 && (
                  <ul className="mt-2 space-y-2 border-t border-second2/20 pt-2 text-xs">
                    {formError.cameras.map((camera) => (
                      <li key={camera.camera_id} className="tabular-nums">
                        {camera.name}: diminta {camera.requested}, bisa direfund{" "}
                        {camera.refundable}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </form>

          {/* Riwayat refund */}
          <section
            className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
            aria-labelledby="refund-history-title"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex items-center gap-4">
                <div
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
                >
                  <FiRotateCcw size={16} />
                </div>
                <h2
                  id="refund-history-title"
                  className="text-lg font-bold text-second"
                >
                  Riwayat refund
                </h2>
              </div>
              <Tag tone="strong">{refunds.length} refund</Tag>
            </div>

            {refunds.length === 0 ? (
              <p className="border-t border-second/30 pt-4 text-sm text-second/60">
                Belum ada refund untuk order ini.
              </p>
            ) : (
              <ul className="divide-y divide-second/30 border-t border-second/30">
                {refunds.map((refund) => {
                  const refundPaid = refund.payment_status === "PAID";

                  return (
                    <li key={refund.id} className="py-2">
                      {/* Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-second/40">
                            Nomor invoice
                          </p>
                          <Link
                            href={ORDER_DETAIL_PATH(refund.id)}
                            className={`break-all font-mono text-sm font-semibold text-second underline-offset-4 hover:text-second4 hover:underline ${FOCUS_RING}`}
                          >
                            {refund.no_invoice ?? refund.id}
                          </Link>
                        </div>

                        <Tag
                          tone={refundPaid ? "blue" : "violet"}
                          icon={refundPaid ? FiCheckCircle : FiClock}
                        >
                          {refundPaid ? "Sudah lunas" : "Belum lunas"}
                        </Tag>
                      </div>

                      {/* Amount */}
                      <div className="mt-4 rounded-lg border border-second/30 bg-second/[0.03] p-3">
                        <p className="text-xs text-second/50">Total refund</p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-second2">
                          − {formatCurrency(refund.total_amount)}
                        </p>
                      </div>

                      {/* Dates */}
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-second/40">
                            Tanggal dibuat
                          </p>
                          <p className="mt-1 text-xs tabular-nums text-second/70">
                            {formatDateTime(refund.created_at)}
                          </p>
                        </div>

                        {refundPaid && refund.paid_at && (
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-second/40">
                              Tanggal pelunasan
                            </p>
                            <p className="mt-1 text-xs tabular-nums text-second/70">
                              {formatDateTime(refund.paid_at)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Items */}
                      {refund.items?.length > 0 && (
                        <div className="mt-5">
                          <p className="mb-2 text-xs font-semibold text-second">
                            Item refund ({refund.items.length})
                          </p>

                          <ul className="divide-y divide-second/10 rounded-lg border border-second/30 px-3">
                            {refund.items.map((item) => (
                              <li
                                key={`${refund.id}-${item.camera_id}`}
                                className="flex flex-wrap items-center justify-between gap-2 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="break-words text-xs font-medium text-second/80">
                                    {item.camera_name}
                                  </p>
                                  <p className="mt-1 text-[11px] text-second/50">
                                    Jumlah: {item.quantity}
                                  </p>
                                </div>

                                <span
                                  className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${
                                    item.restocked
                                      ? "bg-blue-500/10 text-blue-500"
                                      : "bg-second/10 text-second/50"
                                  }`}
                                >
                                  {item.restocked
                                    ? "Dikembalikan ke stok"
                                    : "Tidak masuk stok"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action */}
                      <div className="mt-4 ">
                        {refundPaid ? (
                          <p className="text-xs leading-relaxed text-second/50">
                            Refund sudah lunas dan tidak dapat dibatalkan. Owner
                            dapat mengubah status menjadi belum lunas terlebih
                            dahulu.
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError("");
                              setRefundToDelete(refund);
                            }}
                            className={`${BTN_BASE} border border-red-500/30 text-red-500 hover:border-red-500 hover:bg-red-500/5 ${FOCUS_RING}`}
                          >
                            <FiTrash2 size={16} aria-hidden="true" />
                            Batalkan refund
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-16">
          <section
            className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
            aria-label="Ringkasan refund"
          >
            <h2 className="text-lg font-bold text-second">Ringkasan refund</h2>

            <dl className="divide-y divide-second/10 text-sm">
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-second/60">Barang dipilih</dt>
                <dd className="font-semibold tabular-nums text-second">
                  {selected.length} jenis · {selectedUnits} unit
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-second/60">Kembali ke stok</dt>
                <dd className="font-semibold tabular-nums text-second">
                  {restockUnits} unit
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-second/60">Status</dt>
                <dd>
                  <Tag tone={paymentStatus === "PAID" ? "blue" : "violet"}>
                    {paymentStatus === "PAID"
                      ? "Langsung lunas"
                      : "Belum lunas"}
                  </Tag>
                </dd>
              </div>
            </dl>

            <div className="rounded-xl bg-grad p-4 text-primary shadow-lg shadow-second4/25">
              <p className="text-xs text-primary/90">
                {customAmount !== null
                  ? "Nominal dikembalikan"
                  : "Perkiraan nominal"}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatCurrency(finalAmount)}
              </p>
            </div>

            {customAmount === null && selected.length > 0 && (
              <p className="text-xs leading-relaxed text-second/60">
                Hanya perkiraan. Nominal akhir dihitung server dan dibulatkan ke
                rupiah terdekat.
              </p>
            )}

            {paymentStatus === "PAID" && restockUnits > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-second3/30 bg-second3/10 px-4 py-2 text-xs leading-relaxed text-second3">
                <FiPackage
                  size={13}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                Stok bertambah {restockUnits} unit saat refund dibuat.
              </p>
            )}
          </section>

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              form="refund-form"
              disabled={!canRefund || isSaving}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              {isSaving ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Membuat refund…
                </>
              ) : (
                <>
                  <FiRotateCcw size={16} aria-hidden="true" />
                  Buat refund
                </>
              )}
            </button>

            <Link
              href={ORDER_DETAIL_PATH(orderId)}
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
            >
              Batal
            </Link>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-xs leading-relaxed text-second4">
            <FiInfo size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Mengubah status refund di kemudian hari hanya bisa dilakukan owner
            lewat halaman detail order refund.
          </p>
        </aside>
      </div>

      {refundToDelete && (
        <ConfirmDeleteDialog
          refund={refundToDelete}
          isDeleting={deleteMutation.isPending}
          error={deleteError}
          onClose={() => {
            if (!deleteMutation.isPending) setRefundToDelete(null);
          }}
          onConfirm={handleDeleteRefund}
        />
      )}
    </div>
  );
}
