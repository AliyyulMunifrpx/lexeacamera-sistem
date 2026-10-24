import { FiFilter, FiSearch, FiX } from "react-icons/fi";

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

  const inputClass =
    "w-full rounded-xl border border-second/30 bg-primary px-3 py-3 text-sm text-second outline-none focus:border-second";

  function handleChange(event) {
    const { name, value } = event.target;

    setDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return (
    <section className="rounded-2xl border border-second/30 bg-primary p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FiFilter size={18} />
          <h2 className="font-semibold text-second">Filter invoice</h2>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-second2 hover:underline"
          >
            <FiX size={16} />
            Reset filter
          </button>
        )}
      </div>

      <form onSubmit={onApply}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Pencarian */}
          <div className="sm:col-span-2 xl:col-span-1">
            <label
              htmlFor="invoice-search"
              className="mb-2 block text-sm font-medium text-second"
            >
              Cari invoice
            </label>

            <div className="flex items-center gap-2 rounded-xl border border-second/30 px-3 focus-within:border-second">
              <FiSearch className="shrink-0 text-second/50" size={18} />

              <input
                id="invoice-search"
                type="search"
                name="search"
                value={draft.search}
                onChange={handleChange}
                maxLength={100}
                placeholder="Nama, nomor invoice, kamera..."
                className="w-full bg-transparent py-3 text-sm text-second outline-none placeholder:text-second/40"
              />
            </div>
          </div>

          {/* Tanggal awal */}
          <div>
            <label
              htmlFor="invoice-created-from"
              className="mb-2 block text-sm font-medium text-second"
            >
              Tanggal awal
            </label>

            <input
              id="invoice-created-from"
              type="date"
              name="created_from"
              value={draft.created_from}
              onChange={handleChange}
              max={draft.created_to || undefined}
              className={inputClass}
            />
          </div>

          {/* Tanggal akhir */}
          <div>
            <label
              htmlFor="invoice-created-to"
              className="mb-2 block text-sm font-medium text-second"
            >
              Tanggal akhir
            </label>

            <input
              id="invoice-created-to"
              type="date"
              name="created_to"
              value={draft.created_to}
              onChange={handleChange}
              min={draft.created_from || undefined}
              className={inputClass}
            />
          </div>

          {/* Status */}
          <div>
            <label
              htmlFor="invoice-is-final"
              className="mb-2 block text-sm font-medium text-second"
            >
              Status invoice
            </label>

            <select
              id="invoice-is-final"
              name="is_final"
              value={draft.is_final}
              onChange={handleChange}
              className={inputClass}
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
