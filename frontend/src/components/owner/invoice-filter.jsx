"use client";

import { FiFilter, FiSearch, FiX } from "react-icons/fi";

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

export default function InvoiceFilters({
  draft,
  setDraft,
  onApply,
  onReset,
  isFetching,
}) {
  const hasFilters = Boolean(
    draft.search ||
    draft.created_from ||
    draft.created_to ||
    draft.is_final !== "",
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiFilter size={16} />
          </span>
          <h2 className="text-lg font-bold text-second">Filter invoice</h2>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className={`${BTN_BASE} w-fit border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
            Reset filter
          </button>
        )}
      </div>

      <form onSubmit={onApply}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Pencarian */}
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <label htmlFor="invoice-search" className={labelClass}>
              Cari invoice
            </label>

            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                id="invoice-search"
                type="search"
                name="search"
                value={draft.search}
                onChange={handleChange}
                maxLength={100}
                placeholder="Nama, nomor invoice, kamera…"
                className={`${inputClass(false)} pl-8`}
                autoComplete="off"
                spellCheck={false}
                disabled={isFetching}
              />
            </div>
          </div>

          {/* Tanggal awal */}
          <div className="min-w-0">
            <label htmlFor="invoice-created-from" className={labelClass}>
              Tanggal awal
            </label>

            <input
              id="invoice-created-from"
              type="date"
              name="created_from"
              value={draft.created_from}
              onChange={handleChange}
              max={draft.created_to || undefined}
              className={inputClass(false)}
              disabled={isFetching}
            />
          </div>

          {/* Tanggal akhir */}
          <div className="min-w-0">
            <label htmlFor="invoice-created-to" className={labelClass}>
              Tanggal akhir
            </label>

            <input
              id="invoice-created-to"
              type="date"
              name="created_to"
              value={draft.created_to}
              onChange={handleChange}
              min={draft.created_from || undefined}
              className={inputClass(false)}
              disabled={isFetching}
            />
          </div>

          {/* Status */}
          <div className="min-w-0">
            <label htmlFor="invoice-is-final" className={labelClass}>
              Status invoice
            </label>

            <select
              id="invoice-is-final"
              name="is_final"
              value={draft.is_final}
              onChange={handleChange}
              className={inputClass(false)}
              disabled={isFetching}
            >
              <option value="">Semua status</option>
              <option value="true">Final</option>
              <option value="false">Belum final</option>
            </select>
          </div>
        </div>
      </form>
    </section>
  );
}
