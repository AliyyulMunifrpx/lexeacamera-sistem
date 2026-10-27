"use client";

import { FiSearch, FiSliders, FiX } from "react-icons/fi";

const INPUT_CLASS =
  "w-full rounded-xl border border-second/30 bg-primary px-3 py-3 text-sm text-second outline-none placeholder:text-second/40 focus:border-second";

function Field({ id, label, children }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-second"
      >
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
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  condition,
  setCondition,
  sku,
  setSku,
  serialNumber,
  setSerialNumber,
  minStock,
  setMinStock,
  maxStock,
  setMaxStock,
  color,
  setColor,
  categories,
  onReset,
  hasFilters,
}) {
  return (
    <section className="rounded-2xl border border-second/30 bg-primary p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiSliders size={18} />
          <h2 className="font-semibold text-second">Filter produk</h2>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm font-medium text-second2 hover:underline"
          >
            <FiX size={16} />
            Reset filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 ">
        <div className="sm:col-span-2 xl:col-span-1">
          <Field id="camera-search" label="Cari nama atau sku produk">
            <div className="flex items-center gap-2 rounded-xl border border-second/30 px-3 focus-within:border-second">
              <FiSearch className="shrink-0 text-second/50" size={18} />
              <input
                id="camera-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Contoh: NK50"
                className="w-full bg-transparent py-3 text-sm text-second outline-none placeholder:text-second/40"
              />
            </div>
          </Field>
        </div>

        <Field id="camera-category" label="Kategori">
          <select
            id="camera-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Semua kategori</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </section>
  );
}
