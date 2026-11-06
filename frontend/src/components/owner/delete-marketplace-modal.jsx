"use client";

import Link from "next/link.js";
import { FiAlertTriangle, FiLoader, FiTrash2, FiX } from "react-icons/fi";

export default function DeleteMarketplaceModal({
  marketplace,
  isDeleting,
  usageDetails,
  onClose,
  onConfirm,
}) {
  if (!marketplace) return null;

  const cameras = usageDetails?.cameras ?? [];
  const total = usageDetails?.total ?? cameras.length;
  const isInUse = Boolean(usageDetails);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-marketplace-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border border-second/30 bg-primary p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
              isInUse
                ? "bg-amber-500/10 text-amber-600"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {isInUse ? <FiAlertTriangle size={23} /> : <FiTrash2 size={23} />}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup modal"
            className="flex size-9 items-center justify-center rounded-full text-second/50 transition-colors hover:bg-second/5 hover:text-second disabled:opacity-50"
          >
            <FiX size={20} />
          </button>
        </div>

        <h2
          id="delete-marketplace-title"
          className="mt-5 text-xl font-bold text-second"
        >
          {isInUse ? "Marketplace masih digunakan" : "Hapus marketplace?"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-second/60">
          {isInUse ? (
            <>
              Marketplace{" "}
              <span className="font-semibold text-second">
                {marketplace.name}
              </span>{" "}
              masih digunakan oleh{" "}
              <span className="font-semibold text-second">{total} kamera</span>.
              Marketplace tidak dapat dihapus sebelum tautan terkait ditangani.
            </>
          ) : (
            <>
              Apakah Anda yakin ingin menghapus{" "}
              <span className="font-semibold text-second">
                {marketplace.name}
              </span>
              ? Data marketplace dan file logonya akan dihapus.
            </>
          )}
        </p>

        {isInUse && cameras.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-sm font-semibold text-second">
              Kamera yang menggunakan marketplace ini
            </p>

            <div className="space-y-2">
              {cameras.map((camera) => (
                <Link
                  key={camera.id}
                  href={`/admin/cameras/${camera.id}`}
                  onClick={onClose}
                  className="flex items-center justify-between gap-3 rounded-xl border border border-second/30 p-3 transition-colors hover:bg-second/[0.03]"
                >
                  <span className="min-w-0 break-words text-sm font-medium text-second">
                    {camera.name}
                  </span>

                  <span className="shrink-0 text-xs text-second/40">
                    Lihat kamera →
                  </span>
                </Link>
              ))}
            </div>

            {total > cameras.length && (
              <p className="pt-1 text-xs text-second/50">
                Menampilkan {cameras.length} dari {total} kamera.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {isInUse ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-second px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
            >
              Mengerti
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="rounded-full border border-second/30 px-5 py-3 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-second2 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <FiLoader className="animate-spin" size={17} />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <FiTrash2 size={17} />
                    Ya, hapus marketplace
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
