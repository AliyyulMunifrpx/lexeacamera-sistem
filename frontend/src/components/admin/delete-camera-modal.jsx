"use client";

import { FiLoader, FiTrash2, FiX } from "react-icons/fi";

export default function DeleteCameraModal({
  cameraName,
  isOpen,
  isDeleting,
  onClose,
  onConfirm,
}) {
  if (!isOpen) return null;

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
        aria-labelledby="delete-camera-title"
        className="w-full max-w-md rounded-2xl border border-second/30 bg-primary p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
            <FiTrash2 size={23} />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup modal"
            className="flex size-9 items-center justify-center rounded-full text-second/50 transition-colors hover:bg-second/5 hover:text-second disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiX size={20} />
          </button>
        </div>

        <h2
          id="delete-camera-title"
          className="mt-5 text-xl font-bold text-second"
        >
          Hapus kamera?
        </h2>

        <p className="mt-2 break-words text-sm leading-6 text-second/60">
          Apakah Anda yakin ingin menghapus kamera{" "}
          <span className="font-semibold text-second">{cameraName}</span>?
          Tindakan ini akan menghapus kamera dari katalog.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-full border border-second/15 px-5 py-3 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-50"
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
                Ya, hapus kamera
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
