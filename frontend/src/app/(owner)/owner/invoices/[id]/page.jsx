"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiLock,
  FiMapPin,
  FiMoreHorizontal,
  FiPackage,
  FiPrinter,
  FiRotateCcw,
  FiShoppingBag,
  FiTrash2,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";

import {
  useGetInvoice,
  useDeleteInvoice,
} from "../../../../features/invoices/hooks.js";
import { useGetStore } from "../../../../features/store/hooks.js";
import { useGetCurrentUser } from "../../../../features/users/hooks.js";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import ConfirmDeleteModal from "../../../../../components/owner/confirm-delete-modal-invoice.jsx";
import ThermalReceipt from "../../../../../components/owner/thermal-receipt.jsx";
import {
  displayValue,
  formatCurrency,
  formatDate,
} from "../../../../../components/owner/invoice-formatters.js";
import { downloadInvoicePdf } from "../../../../../components/owner/invoice-pdf.js";
import PrimaryButton from "./../../../../../components/primary-button";
import CancelButton from "./../../../../../components/cancel-button";

/* ---------- Konstanta & helper ---------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";
const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";
const FIELD_LINK_CLASS = `inline-flex items-center gap-1 rounded-sm underline decoration-second/40 underline-offset-4 transition-colors hover:decoration-second ${FOCUS_RING}`;

const PAYMENT_STATUS = {
  PAID: { label: "Lunas", tone: "blue", icon: FiCheckCircle },
  UNPAID: { label: "Belum dibayar", tone: "violet", icon: FiClock },
  PENDING: { label: "Menunggu pembayaran", tone: "violet", icon: FiClock },
};

const REFUND_PAYMENT_STATUS = {
  PAID: { label: "Sudah dikembalikan", tone: "blue", icon: FiCheckCircle },
  UNPAID: { label: "Belum dikembalikan", tone: "violet", icon: FiClock },
};

const TYPE_LABEL = {
  SALE: "Penjualan",
  REFUND: "Refund",
};

function money(value) {
  return value === null || value === undefined ? "—" : formatCurrency(value);
}

function discountText(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `− ${formatCurrency(amount)}`
    : "—";
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

/* Ubah nomor WhatsApp berbagai format menjadi link wa.me.
   Contoh yang didukung:
   "+62 812-3456-7890", "62812...", "0812...", "812...",
   "0062 812...", "+62 (0)812...", "08.12/3456"
   Mengembalikan null jika nomor tidak valid. */
function getWhatsappHref(value) {
  if (!value) return null;

  let digits = String(value).replace(/\D/g, "");
  if (!digits) return null;

  // Awalan internasional "00" → buang (0062812... → 62812...)
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("62")) {
    // "+62 (0)812..." atau "620812..." → buang 0 setelah kode negara
    if (digits[2] === "0") digits = `62${digits.slice(3)}`;
  } else if (digits.startsWith("0")) {
    // 0812... → 62812...
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    // 812... (nol di depan hilang) → 62812...
    digits = `62${digits}`;
  }
  // Selain itu dianggap nomor luar negeri yang sudah lengkap dengan kode negara.

  // Standar E.164: maksimal 15 digit.
  if (digits.length < 8 || digits.length > 15) return null;

  return `https://wa.me/${digits}`;
}

/* Ubah username Instagram berbagai format menjadi link profil.
   Contoh yang didukung:
   "itsaliyyul", "@itsaliyyul", " @itsaliyyul ",
   "instagram.com/itsaliyyul", "https://www.instagram.com/itsaliyyul/?igsh=xx"
   Mengembalikan null jika username tidak valid. */
function getInstagramHref(value) {
  if (!value) return null;

  let username = String(value).trim();

  // Jika berupa URL / domain instagram, ambil segmen username-nya.
  const urlMatch = username.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i,
  );
  if (urlMatch) username = urlMatch[1];

  // Buang @ di depan dan spasi/titik-koma yang kebawa.
  username = username.replace(/^@+/, "").trim();

  // Aturan username Instagram: huruf, angka, titik, underscore (maks 30).
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) return null;

  return `https://www.instagram.com/${username}/`;
}

function getMapsHref(address) {
  const value = (address ?? "").trim();
  if (!value) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

/* Pecah syarat & ketentuan bernomor ("1. Judul" + baris isi) menjadi blok
   agar mudah dibaca. Teks tanpa pola nomor tetap tampil sebagai paragraf. */
function parseTerms(text) {
  const blocks = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (heading) {
      blocks.push({ number: heading[1], title: heading[2], lines: [] });
      continue;
    }

    const bullet = line.match(/^[•*-]\s*(.+)$/);
    const entry = bullet
      ? { bullet: true, text: bullet[1] }
      : { bullet: false, text: line };

    const current = blocks[blocks.length - 1];
    if (current) current.lines.push(entry);
    else blocks.push({ number: null, title: null, lines: [entry] });
  }

  return blocks;
}

/* ---------- Komponen kecil ---------- */

function Badge({ tone = "muted", icon: Icon, children }) {
  const tones = {
    muted: "border border-second/30 text-second/65",
    blue: "bg-second3/10 text-second3",
    violet: "bg-second4/10 text-second4",
    red: "bg-second2/10 text-second2",
    grad: "bg-grad text-primary",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {Icon && <Icon size={13} aria-hidden="true" />}
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
      className={`shrink-0 rounded-md p-1 text-second/40 transition-colors hover:bg-second/5 hover:text-second ${FOCUS_RING}`}
    >
      {copied ? (
        <FiCheck size={14} aria-hidden="true" />
      ) : (
        <FiCopy size={14} aria-hidden="true" />
      )}
    </button>
  );
}

/* Jika `href` diisi, nilai tampil sebagai link yang membuka tab baru.
   `copyable` menambah tombol salin; `mono` memakai font monospasi. */
function DetailField({
  label,
  value,
  wide = false,
  href = null,
  mono = false,
  copyable = false,
  action = null,
}) {
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs text-second/55">{label}</dt>
      <dd className="mt-1 flex min-w-0 items-start gap-1.5 text-sm font-medium">
        <span
          className={`min-w-0 break-words ${mono ? "font-mono text-xs leading-5" : ""}`}
        >
          {href && hasValue ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={FIELD_LINK_CLASS}
            >
              {displayValue(value)}
              <FiExternalLink size={12} aria-hidden="true" />
              <span className="sr-only">(tab baru)</span>
            </a>
          ) : (
            displayValue(value)
          )}
        </span>

        {copyable && hasValue && <CopyButton value={value} label={label} />}
      </dd>

      {action}
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
  className = "",
  pelanggan,
  id,
}) {
  return (
    <section
      className={`rounded-2xl border border-second/30 p-5 sm:p-6 ${className}`}
    >
      <h2 className="flex items-center gap-2.5 font-semibold">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
          <Icon size={15} aria-hidden="true" />
        </span>
        {title}
        {pelanggan && (
          <PrimaryButton href={`/owner/customers/${id}`} className="ml-auto">
            Detail Pelanggan
          </PrimaryButton>
        )}
      </h2>

      <div className="mt-4 border-t border-second/30 pt-5">{children}</div>
    </section>
  );
}

function StatCard({ icon: Icon, label, value, hint, featured = false }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-4 rounded-2xl p-5 ${
        featured ? "bg-grad text-primary" : "border border-second/30"
      }`}
    >
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
          featured ? "bg-primary text-second" : "bg-grad text-primary"
        }`}
      >
        <Icon size={20} aria-hidden="true" />
      </div>

      <div className="min-w-0">
        <p
          className={`text-xs ${featured ? "text-primary/80" : "text-second/55"}`}
        >
          {label}
        </p>
        <p className="mt-1 truncate text-lg font-bold tabular-nums sm:text-xl">
          {value}
        </p>
        {hint && (
          <p
            className={`mt-0.5 truncate text-xs ${
              featured ? "text-primary/80" : "text-second/50"
            }`}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, valueClassName = "" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-second/60">{label}</dt>
      <dd className={`text-right font-medium tabular-nums ${valueClassName}`}>
        {value}
      </dd>
    </div>
  );
}

function TermsContent({ text }) {
  const blocks = parseTerms(text);

  return (
    <ol className="space-y-5">
      {blocks.map((block, index) => (
        <li key={`${block.number}-${index}`} className="flex gap-3">
          {block.number && (
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-second/5 text-xs font-semibold tabular-nums text-second/70"
            >
              {block.number}
            </span>
          )}

          <div className="min-w-0 flex-1 space-y-1.5">
            {block.title && (
              <h3 className="text-sm font-semibold">{block.title}</h3>
            )}

            {block.lines.map((line, lineIndex) => (
              <p
                key={lineIndex}
                className={`break-words text-sm leading-relaxed text-second/75 ${
                  line.bullet ? "flex gap-2" : ""
                }`}
              >
                {line.bullet && (
                  <span aria-hidden="true" className="text-second/40">
                    •
                  </span>
                )}
                <span>{line.text}</span>
              </p>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Halaman ---------- */

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const {
    data: invoice,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useGetInvoice(id);
  const { data: store } = useGetStore();
  const { data: currentUser } = useGetCurrentUser();
  const deleteMutation = useDeleteInvoice();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paperWidth, setPaperWidth] = useState("80");
  // Sesuaikan nama field dengan response store / current user kamu.
  const storeLogoUrl = store?.logo_url ?? store?.logo ?? "";
  const ownerName = currentUser?.name ?? "";

  useEffect(() => {
    if (isError) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }, [isError, error]);

  async function handleDownloadPDF() {
    if (!invoice) return;

    try {
      await downloadInvoicePdf(invoice, {
        logoUrl: storeLogoUrl,
        ownerName,
      });
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message || "Gagal mengunduh invoice.");
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  async function handleDelete() {
    if (!invoice?.is_final) return;

    try {
      await deleteMutation.mutateAsync(invoice.id);
      setDeleteOpen(false);

      notify.success("Invoice berhasil dihapus.");
      router.replace("/owner/invoices");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="animate-pulse space-y-5">
        <span className="sr-only">Memuat invoice…</span>
        <div className="h-16 rounded-2xl bg-second/10" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 rounded-2xl bg-second/10" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-second/10" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="space-y-5 text-second">
        <Link
          href="/owner/invoices"
          className={`inline-flex items-center gap-2 rounded-md text-sm text-second/65 transition-colors hover:text-second ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke invoice
        </Link>

        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-2xl border border-second2/20 px-5 py-12 text-center"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-second2/10 text-second2">
            <FiAlertCircle size={28} aria-hidden="true" />
          </div>

          <h2 className="mt-4 font-semibold">Gagal memuat invoice</h2>

          <p className="mt-2 max-w-md text-sm text-second/65">
            Invoice mungkin tidak ditemukan atau sesi Anda telah berakhir.
          </p>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`mt-5 rounded-full bg-second px-5 py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-80 disabled:opacity-50 ${FOCUS_RING}`}
          >
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      </div>
    );
  }

  /* ----- Turunan data ----- */
  const items = invoice.items ?? [];
  const isFinal = invoice.is_final === true;
  const terms = (invoice.terms_and_condition ?? "").trim();

  const customerWhatsappHref = getWhatsappHref(invoice.customer_whatsapp);
  const customerInstagramHref = getInstagramHref(invoice.customer_instagram);
  const storeWhatsappHref = getWhatsappHref(invoice.whatsapp_store);
  const storeInstagramHref = getInstagramHref(invoice.instagram_store);
  const storeMapsHref = getMapsHref(invoice.store_address);

  const isRefund = invoice.type === "REFUND";
  const payment = (isRefund ? REFUND_PAYMENT_STATUS : PAYMENT_STATUS)[
    invoice.payment_status
  ] ?? {
    label: invoice.payment_status ?? "—",
    tone: "muted",
    icon: FiCreditCard,
  };
  const isPaid = invoice.payment_status === "PAID";

  const totalQuantity = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );

  const totalAmount = Number(invoice.total_amount) || 0;
  const refundDiscount = Math.max(
    0,
    (Number(invoice.subtotal) || 0) - totalAmount,
  );
  const capitalTotal =
    invoice.capital_total !== null && invoice.capital_total !== undefined
      ? Number(invoice.capital_total)
      : null;
  const profit =
    invoice.profit !== null && invoice.profit !== undefined
      ? Number(invoice.profit)
      : capitalTotal !== null
        ? totalAmount - capitalTotal
        : null;
  const margin =
    profit !== null && totalAmount > 0 ? (profit / totalAmount) * 100 : null;
  const isLoss = profit !== null && profit < 0;

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 pb-10 text-second">
      {/* ============ Header ============ */}
      {/* ============ Header ============ */}
      <header className="no-print flex flex-col gap-8">
        {/* Baris 1: breadcrumb + judul + meta */}
        <div className="flex flex-col gap-4">
          <Link
            href="/owner/invoices"
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke invoice
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-second/60">Detail invoice</p>

              <h1 className="mt-2 break-all text-xl font-bold tracking-tight text-second sm:text-xl">
                {invoice.no_invoice}
              </h1>

              <p className="mt-2 text-sm tabular-nums text-second/60">
                Dibuat {formatDate(invoice.created_at)}
                {isPaid && invoice.paid_at && (
                  <>
                    {" "}
                    <br />
                    {isRefund ? "Dikembalikan" : "Dibayar"}{" "}
                    {formatDate(invoice.paid_at)}
                  </>
                )}
              </p>
            </div>

            {/* Badge dikelompokkan dalam satu baris terpisah */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={isFinal ? "grad" : "muted"}
                icon={isFinal ? FiLock : FiEdit2}
              >
                {isFinal ? "Final" : "Belum final"}
              </Badge>

              <Badge tone={payment.tone} icon={payment.icon}>
                {payment.label}
              </Badge>

              {invoice.type && (
                <Badge tone="violet">
                  {TYPE_LABEL[invoice.type] ?? invoice.type}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Baris 2: toolbar aksi */}

        {/* Toolbar aksi invoice */}
        <div className="rounded-2xl border border-second/30 bg-primary p-3 shadow-xl shadow-second/5 sm:p-4">
          <div className="flex flex-col gap-3">
            {/* Aksi utama: Download PDF */}
            <PrimaryButton
              type="button"
              onClick={handleDownloadPDF}
              disabled={!isFinal}
              className={`${BTN_BASE} w-full justify-center bg-grad text-primary shadow-lg shadow-second4/20 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {isFinal ? (
                <FiDownload size={16} aria-hidden="true" />
              ) : (
                <FiLock size={16} aria-hidden="true" />
              )}
              Download PDF
            </PrimaryButton>

            {/* Cetak struk */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-second/30">
                <label htmlFor="paper-width" className="sr-only">
                  Lebar kertas struk thermal
                </label>

                <select
                  id="paper-width"
                  value={paperWidth}
                  onChange={(event) => setPaperWidth(event.target.value)}
                  disabled={!isFinal}
                  className={`min-w-0 flex-1 cursor-pointer border-r border-second/30 bg-primary px-3 py-3 text-sm font-medium text-second outline-none transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                >
                  <option value="58">58 mm</option>
                  <option value="80">80 mm</option>
                </select>

                <span className="flex shrink-0 items-center px-3 text-xs text-second/50">
                  Lebar kertas
                </span>
              </div>

              <button
                type="button"
                onClick={handlePrintReceipt}
                disabled={!isFinal}
                className={`${BTN_BASE} w-full justify-center border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${FOCUS_RING}`}
              >
                {isFinal ? (
                  <FiPrinter size={16} aria-hidden="true" />
                ) : (
                  <FiLock size={16} aria-hidden="true" />
                )}
                Cetak struk
              </button>
            </div>

            {/* Aksi tambahan */}
            <details className="group border-t border-second/10 pt-3">
              <summary
                className={`flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-second/70 transition-colors hover:bg-second/5 hover:text-second [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
              >
                <span className="flex items-center gap-2">
                  <FiMoreHorizontal size={18} aria-hidden="true" />
                  Aksi lainnya
                </span>

                <span className="transition-transform duration-200 group-open:rotate-180">
                  <FiChevronDown size={16} aria-hidden="true" />
                </span>
              </summary>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* Edit */}
                {!isFinal ? (
                  <PrimaryButton
                    href={`/owner/invoices/${invoice.id}/edit`}
                    className="w-full justify-center"
                  >
                    <FiEdit2 size={16} aria-hidden="true" />
                    Edit invoice
                  </PrimaryButton>
                ) : (
                  <PrimaryButton
                    type="button"
                    disabled
                    title="Invoice final tidak dapat diedit."
                    className={`${BTN_BASE} w-full justify-center border border-second/30 text-second`}
                  >
                    <FiLock size={16} aria-hidden="true" />
                    Edit invoice
                  </PrimaryButton>
                )}

                {/* Hapus */}
                <CancelButton
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  disabled={!isFinal}
                  title={
                    !isFinal
                      ? "Invoice yang belum final tidak dapat dihapus."
                      : "Hapus invoice final."
                  }
                  className={`${BTN_BASE} w-full justify-center border border-red-500/30 text-red-500 hover:border-red-500 hover:bg-red-500/5 disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {isFinal ? (
                    <FiTrash2 size={16} aria-hidden="true" />
                  ) : (
                    <FiLock size={16} aria-hidden="true" />
                  )}
                  Hapus invoice
                </CancelButton>
              </div>
            </details>

            {/* Informasi status */}
            {!isFinal && (
              <p className="flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-3 py-3 text-xs leading-relaxed text-second4 sm:text-sm">
                <FiLock
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                Invoice ini belum final. Download PDF, cetak struk, dan hapus
                baru tersedia setelah invoice difinalkan.
              </p>
            )}
          </div>
        </div>
      </header>
      {/* ============ Ringkasan angka ============ */}
      <section
        aria-label="Ringkasan invoice"
        className="no-print grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          featured
          icon={FiFileText}
          label={isRefund ? "Total dikembalikan" : "Total invoice"}
          value={formatCurrency(invoice.total_amount)}
          hint={`${items.length} jenis · ${totalQuantity} unit`}
        />

        <StatCard
          icon={isPaid ? FiCheckCircle : FiClock}
          label={isRefund ? "Status pengembalian" : "Status pembayaran"}
          value={payment.label}
          hint={
            isPaid && invoice.paid_at
              ? `${isRefund ? "Dikembalikan" : "Dibayar"} ${formatDate(invoice.paid_at)}`
              : isRefund
                ? "Belum ada pengembalian dana"
                : "Belum ada pembayaran"
          }
        />

        <StatCard
          icon={FiShoppingBag}
          label="Modal"
          value={capitalTotal !== null ? formatCurrency(capitalTotal) : "—"}
          hint="Total harga pokok item"
        />

        <StatCard
          icon={FiTrendingUp}
          label="Laba"
          value={profit !== null ? formatCurrency(profit) : "—"}
          hint={margin !== null ? `Margin ${formatPercent(margin)}` : undefined}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* ============ Kolom utama ============ */}
        <div className="min-w-0 space-y-6">
          {/* Item */}
          <section className="no-print space-y-4" aria-labelledby="items-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="items-title" className="font-semibold">
                Item invoice
              </h2>
              <Badge>
                {items.length} item · {totalQuantity} unit
              </Badge>
            </div>

            {/* Tabel (tablet ke atas) */}
            <div className="hidden overflow-hidden rounded-2xl border border-second/30 sm:block">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-grad text-sm text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Item
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 text-right font-semibold"
                      >
                        Harga
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 text-right font-semibold"
                      >
                        Jumlah
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 text-right font-semibold"
                      >
                        Subtotal
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-second/10">
                    {items.map((item, i) => (
                      <tr
                        key={item.id}
                        className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "bg-second3/20" : ""}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
                              <FiCamera size={16} aria-hidden="true" />
                            </div>

                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold">
                                {item.camera_name}
                              </p>

                              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-second/50">
                                {item.sku && (
                                  <span className="font-mono">
                                    SKU {item.sku}
                                  </span>
                                )}
                                {item.camera_modal !== null &&
                                  item.camera_modal !== undefined && (
                                    <span className="tabular-nums">
                                      Modal {formatCurrency(item.camera_modal)}
                                    </span>
                                  )}
                              </p>

                              {item.restocked && (
                                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-second4/10 px-2 py-0.5 text-[11px] font-semibold text-second4">
                                  <FiRotateCcw size={11} aria-hidden="true" />
                                  Stok dikembalikan
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                          {formatCurrency(item.camera_price)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                          × {item.quantity}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums">
                          {formatCurrency(item.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="border-t border-second/30 bg-second/[0.04]">
                      <th
                        scope="row"
                        colSpan={3}
                        className="px-4 py-3 text-right text-sm font-semibold"
                      >
                        Subtotal
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums">
                        {money(invoice.subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Kartu (mobile) */}
            <ul className="space-y-3 sm:hidden">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-second/30 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
                      <FiCamera size={16} aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">
                        {item.camera_name}
                      </p>
                      {item.sku && (
                        <p className="mt-0.5 font-mono text-xs text-second/50">
                          SKU {item.sku}
                        </p>
                      )}
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-second/30 pt-3 text-sm">
                    <dt className="text-second/55">Harga</dt>
                    <dd className="text-right tabular-nums">
                      {formatCurrency(item.camera_price)}
                    </dd>

                    <dt className="text-second/55">Jumlah</dt>
                    <dd className="text-right tabular-nums">
                      × {item.quantity}
                    </dd>

                    {item.camera_modal !== null &&
                      item.camera_modal !== undefined && (
                        <>
                          <dt className="text-second/55">Modal</dt>
                          <dd className="text-right tabular-nums">
                            {formatCurrency(item.camera_modal)}
                          </dd>
                        </>
                      )}

                    <dt className="font-semibold">Subtotal</dt>
                    <dd className="text-right font-semibold tabular-nums">
                      {formatCurrency(item.line_total)}
                    </dd>
                  </dl>

                  {item.restocked && (
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-second4/10 px-2 py-0.5 text-[11px] font-semibold text-second4">
                      <FiRotateCcw size={11} aria-hidden="true" />
                      Stok dikembalikan
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Ringkasan pembayaran */}
          <DetailSection
            icon={FiCreditCard}
            title="Ringkasan pembayaran"
            className="no-print"
          >
            <dl className="divide-y divide-second/10">
              <SummaryRow
                label={isRefund ? "Nilai barang" : "Subtotal"}
                value={money(invoice.subtotal)}
              />
              {isRefund ? (
                <SummaryRow
                  label="Diskon pembelian awal"
                  value={discountText(refundDiscount)}
                />
              ) : (
                <>
                  <SummaryRow
                    label="Diskon toko"
                    value={discountText(invoice.store_discount)}
                  />
                  <SummaryRow
                    label="Diskon pelanggan"
                    value={discountText(invoice.customer_discount)}
                  />
                </>
              )}
              <div className="flex items-center justify-between gap-4 pt-4">
                <dt className="font-semibold">
                  {isRefund ? "Total dikembalikan" : "Total invoice"}
                </dt>
                <dd className="text-2xl font-bold tabular-nums">
                  {formatCurrency(invoice.total_amount)}
                </dd>
              </div>
            </dl>
          </DetailSection>

          {/* Syarat & ketentuan */}
          <DetailSection
            icon={FiFileText}
            title="Syarat dan ketentuan"
            className="no-print"
          >
            {terms ? (
              <TermsContent text={terms} />
            ) : (
              <p className="text-sm text-second/60">
                Invoice ini dibuat tanpa syarat dan ketentuan.
              </p>
            )}
          </DetailSection>
        </div>

        {/* ============ Kolom samping ============ */}
        <aside className="no-print min-w-0 space-y-6 xl:sticky xl:top-6">
          <DetailSection
            icon={FiUser}
            title="Pelanggan"
            pelanggan
            id={invoice.customer_id}
          >
            <dl className="grid grid-cols-1 gap-5">
              <DetailField
                label="Nama pelanggan"
                value={invoice.customer_name}
              />
              <DetailField
                label="WhatsApp"
                value={invoice.customer_whatsapp}
                href={customerWhatsappHref}
              />
              <DetailField
                label="Instagram"
                value={invoice.customer_instagram}
                href={customerInstagramHref}
              />
              <DetailField label="Alamat" value={invoice.customer_address} />
              <DetailField
                label="ID pelanggan"
                value={invoice.customer_id}
                mono
                copyable
              />
            </dl>
          </DetailSection>

          <DetailSection icon={FiMapPin} title="Snapshot toko">
            <dl className="grid grid-cols-1 gap-5">
              <DetailField label="Nama toko" value={invoice.store_name} />
              <DetailField
                label="WhatsApp toko"
                value={invoice.whatsapp_store}
                href={storeWhatsappHref}
              />
              <DetailField
                label="Instagram toko"
                value={invoice.instagram_store}
                href={storeInstagramHref}
              />
              <DetailField
                label="Alamat toko"
                value={invoice.store_address}
                href={storeMapsHref}
              />
            </dl>
          </DetailSection>

          <DetailSection icon={FiPackage} title="Informasi invoice">
            <dl className="grid grid-cols-1 gap-5">
              <DetailField
                label="Nomor invoice"
                value={invoice.no_invoice}
                mono
                copyable
              />
              <DetailField
                label="Tanggal dibuat"
                value={formatDate(invoice.created_at)}
              />
              <DetailField
                label={isRefund ? "Tanggal dikembalikan" : "Tanggal dibayar"}
                value={invoice.paid_at ? formatDate(invoice.paid_at) : null}
              />
              <DetailField
                label="Tipe"
                value={TYPE_LABEL[invoice.type] ?? invoice.type}
              />
              <DetailField
                label="Metode pembayaran"
                value={invoice.payment_method}
              />
              <DetailField label="Pengiriman" value={invoice.ship} />
              <DetailField
                label="Status invoice"
                value={isFinal ? "Final" : "Belum final"}
              />
            </dl>
          </DetailSection>
        </aside>
      </div>

      <ThermalReceipt invoice={invoice} paperWidth={paperWidth} />

      {deleteOpen && (
        <ConfirmDeleteModal
          invoice={invoice}
          isDeleting={deleteMutation.isPending}
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
