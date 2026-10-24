"use client";

import { FiFolder, FiLoader, FiTrash2, FiX } from "react-icons/fi";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

export default function DeleteCategoryModal({
  category,
  isDeleting,
  onClose,
  onConfirm,
}) {
  if (!category) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-second/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-category-title"
        className="w-full max-w-md rounded-2xl border border-second/10 bg-primary p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-second/5 text-second">
            <FiTrash2 size={23} />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Tutup modal"
            className={`flex size-8 items-center justify-center rounded-full text-second/60 transition-colors hover:bg-second/5 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={20} />
          </button>
        </div>

        <h2
          id="delete-category-title"
          className="mt-5 text-xl font-bold text-second"
        >
          Hapus kategori?
        </h2>

        <p className="mt-2 text-sm leading-6 text-second/60">
          Apakah Anda yakin ingin menghapus kategori{" "}
          <span className="font-semibold text-second">{category.name}</span>?
          Kategori yang masih digunakan kamera tidak dapat dihapus.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={`h-10 rounded-full border border-second/20 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-50 ${FOCUS_RING}`}
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-full bg-second px-5 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            {isDeleting ? (
              <>
                <FiLoader className="animate-spin" size={16} />
                Menghapus...
              </>
            ) : (
              <>
                <FiTrash2 size={16} />
                Ya, hapus
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
