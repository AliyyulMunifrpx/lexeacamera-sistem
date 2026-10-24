"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import { jsPDF } from "jspdf";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiLock,
  FiMapPin,
  FiPrinter,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";

import {
  useGetInvoice,
  useDeleteInvoice,
} from "../../../../features/invoices/hooks.js";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "Rp0";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}

function DetailField({ label, value, wide = false }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs text-second/55">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">
        {displayValue(value)}
      </p>
    </div>
  );
}

function DetailSection({ icon: Icon, title, children }) {
  return (
    <section className="space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon size={18} />
        {title}
      </h2>

      <div className="border-t border-second/15 pt-5">{children}</div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-16 rounded-2xl bg-second/10" />
      <div className="h-56 rounded-2xl bg-second/10" />
      <div className="h-64 rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 px-5 py-12 text-center">
      <FiAlertCircle size={32} className="text-red-400" />

      <h2 className="mt-4 font-semibold">Gagal Memuat Invoice</h2>

      <p className="mt-2 max-w-md text-sm text-second/65">
        Invoice mungkin tidak ditemukan atau sesi Anda telah berakhir.
      </p>

      <button
        type="button"
        onClick={onRetry}
        disabled={isFetching}
        className="mt-5 rounded-xl border border-second/25 px-4 py-2 text-sm font-medium transition hover:bg-second/10 disabled:opacity-50"
      >
        {isFetching ? "Memuat..." : "Coba Lagi"}
      </button>
    </div>
  );
}

function ConfirmDeleteModal({ invoice, isDeleting, onClose, onConfirm }) {
  if (!invoice) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-invoice-title"
        className="w-full max-w-md rounded-2xl border border-second/20 bg-primary p-6 text-second shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
            <FiTrash2 size={22} />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup modal"
            className="rounded-lg p-2 transition hover:bg-second/10 disabled:opacity-50"
          >
            <FiX size={19} />
          </button>
        </div>

        <h2 id="delete-invoice-title" className="mt-4 text-lg font-semibold">
          Hapus Invoice Final?
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-second/65">
          Invoice <strong>{invoice.no_invoice}</strong> akan dihapus. Pastikan
          Anda tidak lagi memerlukan data invoice ini. Tindakan ini tidak dapat
          dibatalkan.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-second/25 px-4 py-2 text-sm font-medium hover:bg-second/10 disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {isDeleting ? "Menghapus..." : "Ya, Hapus Invoice"}
          </button>
        </div>
      </section>
    </div>
  );
}

function EditNoticeModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-invoice-notice-title"
        className="w-full max-w-md rounded-2xl border border-second/20 bg-primary p-6 text-second shadow-2xl"
      >
        <FiEdit2 size={28} />

        <h2
          id="edit-invoice-notice-title"
          className="mt-4 text-lg font-semibold"
        >
          Invoice Bisa Diedit
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-second/65">
          Invoice ini belum final. Untuk menyimpan perubahan, endpoint update
          invoice dan kontrak request-nya perlu tersedia terlebih dahulu. Data
          invoice belum diubah.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-second px-5 py-3 text-sm font-semibold text-primary hover:opacity-90"
        >
          Mengerti
        </button>
      </section>
    </div>
  );
}

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

  const deleteMutation = useDeleteInvoice();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editNoticeOpen, setEditNoticeOpen] = useState(false);
  const [paperWidth, setPaperWidth] = useState("80");

  useEffect(() => {
    if (isError) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }, [isError, error]);

  async function handleDownloadPDF() {
    if (!invoice) return;

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const margin = 18;
      const pageWidth = 210;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      function ensureSpace(height = 10) {
        if (y + height > 278) {
          doc.addPage();
          y = 20;
        }
      }

      function addHeading(text, size = 12) {
        ensureSpace(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(size);
        doc.text(text, margin, y);
        y += size * 0.48 + 4;
      }

      function addField(label, value) {
        const line = `${label}: ${displayValue(value)}`;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);

        const lines = doc.splitTextToSize(line, maxWidth);
        ensureSpace(lines.length * 4.5 + 2);

        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 2;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("INVOICE", margin, y);

      doc.setFontSize(10);
      doc.text(
        invoice.is_final ? "FINAL" : "BELUM FINAL",
        pageWidth - margin,
        y,
        { align: "right" },
      );

      y += 9;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(displayValue(invoice.no_invoice), margin, y);

      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Tanggal: ${formatDate(invoice.created_at)}`, margin, y);

      y += 9;
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;

      addHeading("INFORMASI TOKO");
      addField("Nama toko", invoice.store_name);
      addField("Alamat toko", invoice.store_address);
      addField("WhatsApp toko", invoice.whatsapp_store);
      addField("Instagram toko", invoice.instagram_store);

      y += 3;
      addHeading("INFORMASI PELANGGAN");
      addField("Nama pelanggan", invoice.customer_name);
      addField("Alamat pelanggan", invoice.customer_address);
      addField("WhatsApp pelanggan", invoice.customer_whatsapp);
      addField("Instagram pelanggan", invoice.customer_instagram);

      y += 3;
      addHeading("RINCIAN ITEM");

      for (const item of invoice.items ?? []) {
        const nameLines = doc.splitTextToSize(
          displayValue(item.camera_name),
          maxWidth - 35,
        );

        ensureSpace(nameLines.length * 4.5 + 15);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(nameLines, margin, y);

        doc.setFont("helvetica", "normal");
        doc.text(`x${item.quantity}`, pageWidth - margin, y, {
          align: "right",
        });

        y += nameLines.length * 4.5 + 1;

        doc.setFontSize(8);
        doc.text(`${formatCurrency(item.camera_price)} / item`, margin, y);

        doc.text(formatCurrency(item.line_total), pageWidth - margin, y, {
          align: "right",
        });

        y += 5;
        doc.setDrawColor(225);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
      }

      y += 2;
      addHeading("RINGKASAN PEMBAYARAN");

      addField("Subtotal", formatCurrency(invoice.subtotal));
      addField("Diskon toko", formatCurrency(invoice.store_discount));
      addField("Diskon pelanggan", formatCurrency(invoice.customer_discount));
      addField("Metode pembayaran", invoice.payment_method);
      addField("Pengiriman", invoice.ship);

      ensureSpace(18);
      doc.setDrawColor(100);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("TOTAL", margin, y);
      doc.text(formatCurrency(invoice.total_amount), pageWidth - margin, y, {
        align: "right",
      });

      const safeInvoiceNumber = String(
        invoice.no_invoice || invoice.id,
      ).replace(/[^a-zA-Z0-9_-]/g, "-");

      doc.save(`invoice-${safeInvoiceNumber}.pdf`);
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
      router.replace("/admin/invoices");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !invoice) {
    return (
      <div className="space-y-5 text-second">
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-2 text-sm text-second/65 hover:text-second"
        >
          <FiArrowLeft size={16} />
          Kembali ke Invoice
        </Link>

        <ErrorState onRetry={() => refetch()} isFetching={isFetching} />
      </div>
    );
  }

  const items = invoice.items ?? [];
  const isFinal = invoice.is_final === true;
  const receiptWidth = paperWidth === "58" ? "48mm" : "70mm";

  return (
    <div className="space-y-7 pb-10 text-second">
      <style jsx global>{`
        #thermal-receipt {
          display: none;
        }

        @media print {
          @page {
            size: auto;
            margin: 0;
          }

          body * {
            visibility: hidden !important;
          }

          #thermal-receipt,
          #thermal-receipt * {
            visibility: visible !important;
          }

          #thermal-receipt {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: var(--receipt-width) !important;
            max-width: var(--receipt-width) !important;
            height: auto !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 3mm !important;
            overflow: visible !important;
            background: #fff !important;
            color: #111 !important;
            box-shadow: none !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 9pt !important;
            line-height: 1.35 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          #thermal-receipt * {
            color: #111 !important;
            background-color: transparent !important;
            box-shadow: none !important;
          }

          #thermal-receipt .receipt-divider {
            border-color: #888 !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <header className="no-print space-y-4">
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-2 text-sm text-second/65 transition hover:text-second"
        >
          <FiArrowLeft size={17} />
          Kembali ke Invoice
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-all text-2xl font-bold">
                {invoice.no_invoice}
              </h1>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1 text-xs font-semibold ${
                  isFinal
                    ? "bg-second/15 text-second"
                    : "border border-second/25 text-second/65"
                }`}
              >
                {isFinal ? <FiLock size={13} /> : <FiEdit2 size={13} />}
                {isFinal ? "Final" : "Belum Final"}
              </span>
            </div>

            <p className="mt-2 text-sm text-second/60">
              Dibuat {formatDate(invoice.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isFinal ? (
              <Link
                href={`/admin/invoices/${invoice.id}/edit`}
                className="inline-flex items-center gap-2 rounded-xl border border-second/25 px-4 py-2 text-sm font-medium transition hover:bg-second/10"
              >
                <FiEdit2 size={16} />
                Edit
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="Invoice final tidak dapat diedit."
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-second/25 px-4 py-2 text-sm font-medium opacity-35"
              >
                <FiLock size={16} />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={!isFinal}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/25 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FiDownload size={16} />
              Download PDF
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-second/25 px-4 py-2">
              <FiPrinter size={16} />

              <select
                value={paperWidth}
                onChange={(event) => setPaperWidth(event.target.value)}
                aria-label="Lebar kertas struk thermal"
                className="bg-transparent text-sm outline-none"
              >
                <option value="58">58 mm</option>
                <option value="80">80 mm</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handlePrintReceipt}
              disabled={!isFinal}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/25 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FiPrinter size={16} />
              Cetak Struk
            </button>

            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={!isFinal}
              title={
                !isFinal
                  ? "Invoice yang belum final tidak dapat dihapus."
                  : "Hapus invoice final."
              }
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/25 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <FiTrash2 size={16} />
              Hapus
            </button>
          </div>
        </div>
      </header>

      <div className="no-print grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DetailSection icon={FiFileText} title="Informasi Invoice">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailField label="Nomor invoice" value={invoice.no_invoice} />
            <DetailField
              label="Tanggal dibuat"
              value={formatDate(invoice.created_at)}
            />
            <DetailField label="ID invoice" value={invoice.id} />
            <DetailField label="Order ID" value={invoice.order_id} />
            <DetailField
              label="Metode pembayaran"
              value={invoice.payment_method}
            />
            <DetailField label="Pengiriman" value={invoice.ship} />
            <DetailField
              label="Status"
              value={isFinal ? "Final" : "Belum Final"}
            />
          </div>
        </DetailSection>

        <DetailSection icon={FiUser} title="Informasi Pelanggan">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailField label="Nama pelanggan" value={invoice.customer_name} />
            <DetailField label="WhatsApp" value={invoice.customer_whatsapp} />
            <DetailField label="Instagram" value={invoice.customer_instagram} />
            <DetailField label="Alamat" value={invoice.customer_address} wide />
          </div>
        </DetailSection>

        <DetailSection icon={FiMapPin} title="Snapshot Toko">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailField label="Nama toko" value={invoice.store_name} />
            <DetailField label="WhatsApp toko" value={invoice.whatsapp_store} />
            <DetailField
              label="Instagram toko"
              value={invoice.instagram_store}
            />
            <DetailField
              label="Alamat toko"
              value={invoice.store_address}
              wide
            />
          </div>
        </DetailSection>

        <section className="space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
          <h2 className="font-semibold">Ringkasan Pembayaran</h2>

          <div className="space-y-3 border-t border-second/15 pt-5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-second/60">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-second/60">Diskon toko</span>
              <span>− {formatCurrency(invoice.store_discount)}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-second/60">Diskon pelanggan</span>
              <span>− {formatCurrency(invoice.customer_discount)}</span>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-second/15 pt-4">
              <span className="font-semibold">Total invoice</span>
              <span className="text-xl font-bold">
                {formatCurrency(invoice.total_amount)}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="no-print space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Item Invoice</h2>
          <span className="rounded-full bg-second/10 px-4 py-1 text-xs font-semibold">
            {items.length} item
          </span>
        </div>

        <div className="space-y-3 border-t border-second/15 pt-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-second/15 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">
                  {item.camera_name}
                </p>

                <p className="mt-1 text-xs text-second/60">
                  {formatCurrency(item.camera_price)} × {item.quantity}
                </p>

                <p className="mt-1 break-all text-xs text-second/45">
                  Camera ID: {item.camera_id}
                </p>
              </div>

              <div className="sm:text-right">
                <p className="text-xs text-second/55">Subtotal item</p>
                <p className="mt-1 font-semibold">
                  {formatCurrency(item.line_total)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Elemen ini hanya muncul saat mencetak struk thermal. */}
      <section
        id="thermal-receipt"
        aria-hidden="true"
        style={{ "--receipt-width": receiptWidth }}
      >
        <div className="text-center">
          <p className="text-base font-bold">
            {displayValue(invoice.store_name)}
          </p>

          <p className="mt-1 whitespace-pre-wrap break-words text-xs">
            {displayValue(invoice.store_address)}
          </p>

          {invoice.whatsapp_store && (
            <p className="mt-1 text-xs">WA: {invoice.whatsapp_store}</p>
          )}

          {invoice.instagram_store && (
            <p className="mt-1 text-xs">IG: {invoice.instagram_store}</p>
          )}
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div>
          <p className="break-all font-bold">{invoice.no_invoice}</p>
          <p className="mt-1 text-xs">{formatDate(invoice.created_at)}</p>
          <p className="mt-1 text-xs">
            Status: {isFinal ? "FINAL" : "BELUM FINAL"}
          </p>
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div>
          <p className="font-bold">PELANGGAN</p>
          <p className="mt-1 break-words">
            {displayValue(invoice.customer_name)}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs">
            {displayValue(invoice.customer_address)}
          </p>
          <p className="mt-1 break-words text-xs">
            WA: {displayValue(invoice.customer_whatsapp)}
          </p>
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div>
          {items.map((item) => (
            <div key={item.id} className="mb-3">
              <p className="break-words font-semibold">{item.camera_name}</p>

              <div className="mt-1 flex justify-between gap-2 text-xs">
                <span>
                  {item.quantity} × {formatCurrency(item.camera_price)}
                </span>
                <span className="shrink-0">
                  {formatCurrency(item.line_total)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-2">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>

          <div className="flex justify-between gap-2">
            <span>Diskon toko</span>
            <span>{formatCurrency(invoice.store_discount)}</span>
          </div>

          <div className="flex justify-between gap-2">
            <span>Diskon pelanggan</span>
            <span>{formatCurrency(invoice.customer_discount)}</span>
          </div>
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div className="flex items-start justify-between gap-2 font-bold">
          <span>TOTAL</span>
          <span className="text-right">
            {formatCurrency(invoice.total_amount)}
          </span>
        </div>

        <div className="mt-3 space-y-1 text-xs">
          <p>Pembayaran: {displayValue(invoice.payment_method)}</p>
          <p>Pengiriman: {displayValue(invoice.ship)}</p>
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div className="text-center">
          <p className="font-bold">Terima kasih</p>
          <p className="mt-1 text-xs">
            Simpan struk ini sebagai bukti transaksi.
          </p>
        </div>
      </section>

      <div className="no-print flex items-start gap-3 text-sm leading-relaxed text-second/55">
        <FiCheckCircle size={17} className="mt-0.5 shrink-0" />
        <p>
          Data yang ditampilkan berasal dari snapshot invoice. Untuk mencetak
          struk thermal, pilih lebar kertas yang sesuai dengan printer, lalu
          pilih printer tersebut di dialog cetak browser.
        </p>
      </div>

      {deleteOpen && (
        <ConfirmDeleteModal
          invoice={invoice}
          isDeleting={deleteMutation.isPending}
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}

      {editNoticeOpen && (
        <EditNoticeModal onClose={() => setEditNoticeOpen(false)} />
      )}
    </div>
  );
}
