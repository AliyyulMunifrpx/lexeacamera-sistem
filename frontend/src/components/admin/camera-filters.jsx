"use client";

import { FiSearch, FiSliders, FiX } from "react-icons/fi";

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
  categories,
  conditions,
  onReset,
  hasFilters,
}) {
  return (
    <section className="rounded-2xl border border-second/30 bg-primary p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiSliders size={18} />
          <h2 className="font-semibold text-second">Filter kamera</h2>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="sm:col-span-2 xl:col-span-1">
          <label
            htmlFor="camera-search"
            className="mb-2 block text-sm font-medium text-second"
          >
            Cari nama kamera
          </label>

          <div className="flex items-center gap-2 rounded-xl border border-second/30 px-3 focus-within:border-second">
            <FiSearch className="shrink-0 text-second/50" size={18} />
            <input
              id="camera-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Contoh: Canon EOS R50"
              className="w-full bg-transparent py-3 text-sm text-second outline-none placeholder:text-second/40"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="camera-category"
            className="mb-2 block text-sm font-medium text-second"
          >
            Kategori
          </label>

          <select
            id="camera-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-xl border border-second/30 bg-primary px-3 py-3 text-sm text-second outline-none focus:border-second"
          >
            <option value="">Semua kategori</option>

            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="camera-condition"
            className="mb-2 block text-sm font-medium text-second"
          >
            Kondisi
          </label>

          <select
            id="camera-condition"
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
            className="w-full rounded-xl border border-second/30 bg-primary px-3 py-3 text-sm text-second outline-none focus:border-second"
          >
            <option value="">Semua kondisi</option>
            <option value="NEW">Baru</option>
            <option value="SECOND">Bekas</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="camera-min-price"
            className="mb-2 block text-sm font-medium text-second"
          >
            Harga minimum (Rp)
          </label>

          <input
            id="camera-min-price"
            type="number"
            min="0"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-second/30 bg-primary px-3 py-3 text-sm text-second outline-none placeholder:text-second/40 focus:border-second"
          />
        </div>

        <div>
          <label
            htmlFor="camera-max-price"
            className="mb-2 block text-sm font-medium text-second"
          >
            Harga maksimum (Rp)
          </label>

          <input
            id="camera-max-price"
            type="number"
            min="0"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Tanpa batas"
            className="w-full rounded-xl border border-second/30 bg-primary px-3 py-3 text-sm text-second outline-none placeholder:text-second/40 focus:border-second"
          />
        </div>
      </div>
    </section>
  );
}
