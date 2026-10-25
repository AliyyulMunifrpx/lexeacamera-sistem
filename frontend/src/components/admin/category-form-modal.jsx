"use client";

import { useEffect, useState } from "react";
import { FiFolder, FiLoader, FiX } from "react-icons/fi";

const inputClass =
  "w-full rounded-xl border border-second/30 bg-primary px-4 py-3 text-sm text-second outline-none transition-colors placeholder:text-second/35 focus:border-second";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

export default function CategoryFormModal({
  isOpen,
  category,
  isSaving,
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState("");

  const isEditing = Boolean(category);

  useEffect(() => {
    if (!isOpen) return;

    setName(category?.name ?? "");
  }, [isOpen, category?.id, category?.name]);

  if (!isOpen) return null;

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) return;

    onSubmit(trimmedName);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-second/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
        className="w-full max-w-md rounded-2xl border border border-second/30 bg-primary p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-second/5 text-second">
            <FiFolder size={23} />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup modal"
            className={`flex size-8 items-center justify-center rounded-full text-second/60 transition-colors hover:bg-second/5 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={20} />
          </button>
        </div>

        <h2
          id="category-modal-title"
          className="mt-5 text-xl font-bold text-second"
        >
          {isEditing ? "Edit Kategori" : "Tambah Kategori"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-second/60">
          {isEditing
            ? "Ubah nama kategori sesuai kebutuhan."
            : "Tambahkan kategori baru untuk mengelompokkan kamera."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="category-name"
              className="mb-2 block text-sm font-medium text-second"
            >
              Nama kategori
            </label>

            <input
              id="category-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Contoh: Mirrorless"
              maxLength={100}
              autoFocus
              required
              disabled={isSaving}
            />

            <p className="mt-1 text-right text-xs text-second/40">
              {name.length}/100
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={`h-10 rounded-full border border-second/20 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-50 ${FOCUS_RING}`}
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-full bg-second px-5 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {isSaving ? (
                <>
                  <FiLoader className="animate-spin" size={16} />
                  Menyimpan...
                </>
              ) : isEditing ? (
                "Simpan perubahan"
              ) : (
                "Tambah kategori"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
