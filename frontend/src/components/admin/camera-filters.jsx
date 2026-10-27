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
          <Field id="camera-search" label="Cari nama kamera">
            <div className="flex items-center gap-2 rounded-xl border border-second/30 px-3 focus-within:border-second">
              <FiSearch className="shrink-0 text-second/50" size={18} />
              <input
                id="camera-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Contoh: Canon EOS R50"
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

        <Field id="camera-condition" label="Kondisi">
          <select
            id="camera-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Semua kondisi</option>
            <option value="NEW">Baru</option>
            <option value="SECOND">Bekas</option>
          </select>
        </Field>

        <Field id="camera-min-price" label="Harga minimum (Rp)">
          <input
            id="camera-min-price"
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0"
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="camera-max-price" label="Harga maksimum (Rp)">
          <input
            id="camera-max-price"
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Tanpa batas"
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="camera-sku" label="Nomor SKU">
          <input
            id="camera-sku"
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Contoh: WAV-0012"
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="camera-serial" label="Nomor seri">
          <input
            id="camera-serial"
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Contoh: 1234567890"
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="camera-min-stock" label="Stok minimum">
          <input
            id="camera-min-stock"
            type="number"
            min="0"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            placeholder="0"
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="camera-max-stock" label="Stok maksimum">
          <input
            id="camera-max-stock"
            type="number"
            min="0"
            value={maxStock}
            onChange={(e) => setMaxStock(e.target.value)}
            placeholder="Tanpa batas"
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="camera-color" label="Warna">
          <input
            id="camera-color"
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Contoh: Hitam"
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    </section>
  );
}
