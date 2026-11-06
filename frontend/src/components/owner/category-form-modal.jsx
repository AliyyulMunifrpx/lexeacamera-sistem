"use client";

import { useEffect, useState } from "react";
import { FiAlertCircle, FiFolder, FiLoader, FiX } from "react-icons/fi";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

function inputClass(hasError) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

function ErrorText({ id, children }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

export default function CategoryFormModal({
  isOpen,
  category,
  isSaving,
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const isEditing = Boolean(category);

  useEffect(() => {
    if (!isOpen) return;
    setName(category?.name ?? "");
    setError("");
  }, [isOpen, category?.id, category?.name]);

  // Tutup dengan Escape.
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(event) {
      if (event.key === "Escape" && !isSaving) onClose();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Nama kategori wajib diisi.");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Nama kategori maksimal 100 karakter.");
      return;
    }

    setError("");
    onSubmit(trimmedName);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
        className="w-full max-w-md rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiFolder size={16} />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup modal"
            className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="category-modal-title"
          className="mt-4 text-lg font-bold text-second"
        >
          {isEditing ? "Edit Kategori" : "Tambah Kategori"}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-second/60">
          {isEditing
            ? "Ubah nama kategori sesuai kebutuhan."
            : "Tambahkan kategori baru untuk mengelompokkan kamera."}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
          <div className="min-w-0">
            <label htmlFor="category-name" className={labelClass}>
              Nama kategori
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>

            <input
              id="category-name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError("");
              }}
              className={inputClass(Boolean(error))}
              placeholder="Contoh: Mirrorless…"
              maxLength={100}
              autoFocus
              required
              disabled={isSaving}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "category-name-error" : undefined}
              autoComplete="off"
            />

            {error ? (
              <ErrorText id="category-name-error">{error}</ErrorText>
            ) : (
              <p className="mt-2 text-right text-xs tabular-nums text-second/50">
                {name.length}/100
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              aria-busy={isSaving}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              {isSaving ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Menyimpan…
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
