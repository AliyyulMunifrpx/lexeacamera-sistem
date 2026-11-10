"use client";

import { useEffect, useState } from "react";
import { FiAlertTriangle, FiTrash2, FiX } from "react-icons/fi";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

/* Teks penjelasan tiap mode, menyesuaikan tipe & status bayar invoice. */
function getModeOptions({ isRefund, isPaid }) {
  const voidStock = isRefund
    ? isPaid
      ? "Stok yang tadinya dikembalikan oleh refund akan dikurangi lagi (bisa gagal kalau stok tidak cukup)."
      : "Stok tidak berubah karena refund belum dikembalikan."
    : isPaid
      ? "Stok kamera dikembalikan karena order ini sudah lunas."
      : "Stok tidak berubah karena order belum lunas.";

  return [
    {
      value: "CLEAN",
      title: "Hapus invoice saja",
      badge: "Bersih-bersih",
      points: [
        "Order dan item tetap tersimpan.",
        "Stok dan laporan tidak berubah.",
        "Invoice yang dihapus tidak bisa dibuat ulang untuk order ini.",
      ],
    },
    {
      value: "VOID",
      title: "Batalkan (invoice + order)",
      badge: "Salah input",
      points: [
        "Invoice dan order beserta itemnya ikut dihapus.",
        voidStock,
        "Order hilang dari laporan.",
        "Ditolak kalau order sudah punya refund.",
      ],
    },
  ];
}

export default function ConfirmDeleteModal({
  invoice,
  isDeleting = false,
  onClose,
  onConfirm,
}) {
  const [mode, setMode] = useState("CLEAN");

  const isRefund = invoice?.type === "REFUND";
  const isPaid = invoice?.payment_status === "PAID";
  const options = getModeOptions({ isRefund, isPaid });

  // Tutup dengan tombol Escape (kecuali sedang menghapus).
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isDeleting) onClose?.();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={() => {
        if (!isDeleting) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-invoice-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-second/30 bg-primary p-5 text-second shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <FiAlertTriangle size={20} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <h2 id="delete-invoice-title" className="font-semibold">
              Hapus invoice
            </h2>
            <p className="mt-1 break-all font-mono text-xs text-second/60">
              {invoice?.no_invoice}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup"
            className={`shrink-0 rounded-md p-1 text-second/50 transition-colors hover:bg-second/5 hover:text-second disabled:opacity-40 ${FOCUS_RING}`}
          >
            <FiX size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-sm text-second/70">
          Pilih cara menghapus. Tindakan ini tidak dapat dibatalkan.
        </p>

        {/* Pilihan mode */}
        <fieldset className="mt-4 space-y-3" disabled={isDeleting}>
          <legend className="sr-only">Mode hapus</legend>

          {options.map((option) => {
            const active = mode === option.value;

            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  active
                    ? "border-red-500/60 bg-red-500/5"
                    : "border-second/30 hover:bg-second/5"
                }`}
              >
                <input
                  type="radio"
                  name="delete-mode"
                  value={option.value}
                  checked={active}
                  onChange={() => setMode(option.value)}
                  className="mt-1 size-4 shrink-0 accent-red-500"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {option.title}
                    </span>
                    <span className="rounded-full border border-second/30 px-2 py-0.5 text-[11px] font-semibold text-second/60">
                      {option.badge}
                    </span>
                  </span>

                  <ul className="mt-2 space-y-1 text-xs leading-relaxed text-second/65">
                    {option.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span aria-hidden="true" className="text-second/40">
                          •
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </span>
              </label>
            );
          })}
        </fieldset>

        {isRefund && (
          <p className="mt-3 text-xs text-second/55">
            Untuk membatalkan refund, gunakan menu refund, bukan hapus invoice.
          </p>
        )}

        {/* Aksi */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={`inline-flex items-center justify-center rounded-xl border border-second/30 px-4 py-2 text-sm font-semibold transition hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            Batal
          </button>

          <button
            type="button"
            onClick={() => onConfirm?.(mode)}
            disabled={isDeleting}
            className={`inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiTrash2 size={16} aria-hidden="true" />
            {isDeleting
              ? "Menghapus…"
              : mode === "VOID"
                ? "Batalkan invoice & order"
                : "Hapus invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
