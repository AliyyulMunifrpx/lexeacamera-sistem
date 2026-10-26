"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCamera,
  FiCheckCircle,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiLock,
  FiMapPin,
  FiPrinter,
  FiTrash2,
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
import ConfirmDeleteModal from "../../../../../components/admin/confirm-delete-modal-invoice.jsx";
import ThermalReceipt from "../../../../../components/admin/thermal-receipt.jsx";
import {
  displayValue,
  formatCurrency,
  formatDate,
} from "../../../../../components/admin/invoice-formatters.js";
import { downloadInvoicePdf } from "../../../../../components/admin/invoice-pdf.js";

/* Satu gaya untuk semua tombol aksi di header (Edit, Download PDF,
   pilih ukuran struk, Cetak Struk, Hapus). */
const ACTION_BUTTON_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-second/25 bg-second px-4 py-2 text-sm font-medium cursor-pointer text-primary transition hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-second";

/* Gaya link di dalam DetailField. */
const FIELD_LINK_CLASS =
  "underline decoration-second/40 underline-offset-4 transition hover:decoration-second";

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

/* Dipakai berulang, jadi tetap komponen.
   Jika `href` diisi, nilai tampil sebagai link yang membuka tab baru. */
function DetailField({ label, value, wide = false, href = null }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs text-second/55">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={FIELD_LINK_CLASS}
          >
            {displayValue(value)}
          </a>
        ) : (
          displayValue(value)
        )}
      </p>
    </div>
  );
}

function DetailSection({ icon: Icon, title, children }) {
  return (
    <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon size={18} />
        {title}
      </h2>

      <div className="border-t border-second/30 pt-5">{children}</div>
    </section>
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
      router.replace("/admin/invoices");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-16 rounded-2xl bg-second/10" />
        <div className="h-56 rounded-2xl bg-second/10" />
        <div className="h-64 rounded-2xl bg-second/10" />
      </div>
    );
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

        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 px-5 py-12 text-center">
          <FiAlertCircle size={32} className="text-red-400" />

          <h2 className="mt-4 font-semibold">Gagal Memuat Invoice</h2>

          <p className="mt-2 max-w-md text-sm text-second/65">
            Invoice mungkin tidak ditemukan atau sesi Anda telah berakhir.
          </p>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-5 rounded-xl border border-second/25 px-4 py-2 text-sm font-medium transition hover:bg-second/10 disabled:opacity-50"
          >
            {isFetching ? "Memuat..." : "Coba Lagi"}
          </button>
        </div>
      </div>
    );
  }

  const items = invoice.items ?? [];
  const isFinal = invoice.is_final === true;

  const customerWhatsappHref = getWhatsappHref(invoice.customer_whatsapp);
  const customerInstagramHref = getInstagramHref(invoice.customer_instagram);

  return (
    <div className="space-y-7 pb-10 text-second">
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
                    ? "bg-grad text-primary"
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
                className={ACTION_BUTTON_CLASS}
              >
                <FiEdit2 size={16} />
                Edit
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="Invoice final tidak dapat diedit."
                className={ACTION_BUTTON_CLASS}
              >
                <FiLock size={16} />
                Edit
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={!isFinal}
              className={`${ACTION_BUTTON_CLASS} bg-grad`}
            >
              {isFinal ? <FiDownload size={16} /> : <FiLock size={16} />}
              Download PDF
            </button>

            <div className={ACTION_BUTTON_CLASS}>
              <FiPrinter size={16} />

              <select
                value={paperWidth}
                onChange={(event) => setPaperWidth(event.target.value)}
                aria-label="Lebar kertas struk thermal"
                className="cursor-pointer bg-transparent text-sm font-medium text-primary outline-none"
              >
                <option value="58" className="bg-second text-primary">
                  58 mm
                </option>
                <option value="80" className="bg-second text-primary">
                  80 mm
                </option>
              </select>
            </div>

            <button
              type="button"
              onClick={handlePrintReceipt}
              disabled={!isFinal}
              className={`${ACTION_BUTTON_CLASS} bg-second3`}
            >
              {isFinal ? <FiPrinter size={16} /> : <FiLock size={16} />}
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
              className={`${ACTION_BUTTON_CLASS} bg-second2`}
            >
              {isFinal ? <FiTrash2 size={16} /> : <FiLock size={16} />}
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

        <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-6">
          <h2 className="font-semibold">Ringkasan Pembayaran</h2>

          <div className="space-y-3 border-t border-second/30 pt-5 text-sm">
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

            <div className="flex items-center justify-between gap-4 border-t border-second/30 pt-4">
              <span className="font-semibold">Total invoice</span>
              <span className="text-xl font-bold">
                {formatCurrency(invoice.total_amount)}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="no-print space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Item Invoice</h2>
          <span className="rounded-full bg-second/10 px-4 py-1 text-xs font-semibold">
            {items.length} item
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-second/30">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-grad">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-4 text-sm font-semibold text-primary"
                  >
                    Nama item
                  </th>

                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-primary"
                  >
                    Harga
                  </th>

                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-primary"
                  >
                    Jumlah
                  </th>

                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-primary"
                  >
                    Subtotal item
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-second/10">
                {items.map((item, i) => (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-second/25 ${i % 2 === 0 ? "bg-second/15" : ""}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
                          <FiCamera size={16} />
                        </div>

                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-second">
                            {item.camera_name}
                          </p>

                          <p className="mt-1 break-all text-xs text-second/45">
                            Camera ID: {item.camera_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-second/60">
                      {formatCurrency(item.camera_price)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-second/60">
                      × {item.quantity}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-second">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
