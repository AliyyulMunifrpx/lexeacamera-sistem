import { FiTrash2, FiX } from "react-icons/fi";
import CancelButton from "./../cancel-button";
import PrimaryButton from "./../primary-button";

export default function ConfirmDeleteModal({
  invoice,
  isDeleting,
  onClose,
  onConfirm,
}) {
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
          <CancelButton
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-second/25 px-4 py-2 text-sm font-medium hover:bg-second/10 disabled:opacity-50"
          >
            Batal
          </CancelButton>

          <PrimaryButton
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {isDeleting ? "Menghapus..." : "Ya, Hapus Invoice"}
          </PrimaryButton>
        </div>
      </section>
    </div>
  );
}
