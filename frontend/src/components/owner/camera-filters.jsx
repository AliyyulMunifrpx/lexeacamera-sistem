"use client";

import { FiSearch, FiSliders, FiX } from "react-icons/fi";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

/* Filter stok dipetakan ke min_stock / max_stock yang sudah ada di endpoint,
   jadi tidak perlu ubah backend. Nilai berupa string karena state di halaman
   juga string. */
const STOCK_OPTIONS = [
  { value: "all", label: "Semua stok", min: "", max: "" },
  { value: "out", label: "Habis", min: "0", max: "0" },
  { value: "low", label: "Sisa 1–3", min: "1", max: "3" },
  { value: "ok", label: "Di atas 3", min: "4", max: "" },
];

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

function Field({ id, label, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function CameraFilters({
  search,
  setSearch,
  category,
  setCategory,
  minStock,
  setMinStock,
  maxStock,
  setMaxStock,
  categories,
  onReset,
  hasFilters,
}) {
  // Opsi yang terpilih ditentukan dari nilai min/max stok di halaman.
  const stockValue =
    STOCK_OPTIONS.find(
      (option) => option.min === minStock && option.max === maxStock,
    )?.value ?? "all";

  function handleStockChange(event) {
    const option = STOCK_OPTIONS.find(
      (item) => item.value === event.target.value,
    );
    if (!option) return;

    setMinStock(option.min);
    setMaxStock(option.max);
  }

  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiSliders size={16} />
          </span>
          <h2 className="text-lg font-bold text-second">Filter produk</h2>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Search */}
        <Field id="camera-search" label="Cari nama atau SKU produk">
          <div className="relative">
            <FiSearch
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
            />
            <input
              id="camera-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Contoh: NK50…"
              className={`${inputClass(false)} pl-8`}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </Field>

        {/* Kategori */}
        <Field id="camera-category" label="Kategori">
          <select
            id="camera-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={inputClass(false)}
          >
            <option value="">Semua kategori</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        {/* Stok */}
        <Field id="camera-stock" label="Stok">
          <select
            id="camera-stock"
            value={stockValue}
            onChange={handleStockChange}
            className={inputClass(false)}
          >
            {STOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </section>
  );
}
