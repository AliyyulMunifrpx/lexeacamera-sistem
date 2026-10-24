"use client";

import { FiAlertTriangle, FiX } from "react-icons/fi";

export default function DeleteBannerModal({
  banner,
  isDeleting,
  onClose,
  onConfirm,
}) {
  if (!banner) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-banner-title"
        className="w-full max-w-md rounded-2xl border border-second/20 bg-primary p-5 text-second shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-500/10 p-3 text-red-400">
              <FiAlertTriangle size={22} />
            </div>

            <div>
              <h2 id="delete-banner-title" className="font-semibold">
                Hapus Banner
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-second/70">
                Apakah Anda yakin ingin menghapus banner ini? Gambar banner juga
                akan dihapus dan tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup modal"
            className="rounded-lg p-2 transition hover:bg-second/10 disabled:opacity-50"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-second/15 bg-second/5">
          <div className="flex aspect-[16/9] items-center justify-center p-2">
            <img
              src={banner.banner_url}
              alt="Banner yang akan dihapus"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-second/25 px-4 py-2.5 text-sm font-medium transition hover:bg-second/10 disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </div>
      </section>
    </div>
  );
}
