"use client";

import { useEffect, useRef, useState } from "react";
import { BiFilterAlt } from "react-icons/bi";

/* Sesuaikan nilai ini dengan yang diterima backend. */
const CONDITIONS = [
  { label: "Baru", value: "NEW" },
  { label: "Bekas", value: "SECOND" },
];
const SORT_NEWEST = "newest";

export const DEFAULT_FILTERS = {
  condition: "",
  category_id: "",
  min_price: "",
  max_price: "",
  newest: false,
};

/* Ubah nilai filter jadi parameter untuk getCameras. */
export function toApiFilters(filters) {
  const { newest, ...rest } = filters;
  return { ...rest, ...(newest && { sort: SORT_NEWEST }) };
}

const CHIP_BASE =
  "shrink-0 whitespace-nowrap rounded-full border-1 border-grad px-2 transition-colors";
const CHIP_ON = "bg-grad text-primary border-1 border-grad";
const CHIP_OFF = "text-second";

function formatRupiah(digits) {
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

function Chip({ active, open, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`${CHIP_BASE} ${active || open ? CHIP_ON : CHIP_OFF}`}
    >
      {children}
    </button>
  );
}

/* Satu baris pilihan di dalam banner. */
function Option({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full border-b border-second/20 px-4 py-3 text-left text-base transition-colors last:border-b-0 ${
        selected ? CHIP_ON : CHIP_OFF
      }`}
    >
      {children}
    </button>
  );
}

/**
 * value: { condition, category_id, min_price, max_price, newest }
 * onChange(nextValue): dipanggil dengan objek filter baru
 * categories: [{ id, name }]
 */
export default function ProductFilter({
  value = DEFAULT_FILTERS,
  onChange,
  categories = [],
  className = "",
}) {
  const [panel, setPanel] = useState(null); // "condition" | "category" | "price" | null
  const [draft, setDraft] = useState({ min: "", max: "" }); // harga yang sedang diketik
  const rootRef = useRef(null);

  const { condition, category_id, min_price, max_price, newest } = value;

  // Tutup banner kalau klik di luar atau tekan Escape.
  useEffect(() => {
    if (!panel) return undefined;

    function handlePointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setPanel(null);
      }
    }
    function handleKey(event) {
      if (event.key === "Escape") setPanel(null);
    }

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [panel]);

  function update(patch) {
    onChange({ ...value, ...patch });
  }

  const conditionLabel = CONDITIONS.find((c) => c.value === condition)?.label;
  const categoryLabel = categories.find(
    (c) => String(c.id) === String(category_id),
  )?.name;

  let priceLabel = "harga";
  if (min_price && max_price) {
    priceLabel = `Rp ${formatRupiah(min_price)} – ${formatRupiah(max_price)}`;
  } else if (min_price) {
    priceLabel = `≥ Rp ${formatRupiah(min_price)}`;
  } else if (max_price) {
    priceLabel = `≤ Rp ${formatRupiah(max_price)}`;
  }

  const draftInvalid =
    draft.min !== "" &&
    draft.max !== "" &&
    Number(draft.min) > Number(draft.max);

  function togglePanel(name) {
    if (name === "price") setDraft({ min: min_price, max: max_price });
    setPanel((current) => (current === name ? null : name));
  }

  function pickCondition(next) {
    update({ condition: next });
    setPanel(null);
  }

  function pickCategory(next) {
    update({ category_id: next });
    setPanel(null);
  }

  function applyPrice() {
    if (draftInvalid) return;
    update({ min_price: draft.min, max_price: draft.max });
    setPanel(null);
  }

  function resetPrice() {
    setDraft({ min: "", max: "" });
    update({ min_price: "", max_price: "" });
    setPanel(null);
  }

  function setDraftField(name, raw) {
    const digits = raw
      .replace(/\D/g, "")
      .replace(/^0+(?=\d)/, "")
      .slice(0, 10);
    setDraft((current) => ({ ...current, [name]: digits }));
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="flex w-full items-center gap-2">
        <BiFilterAlt
          size={30}
          className="shrink-0 text-black"
          aria-hidden="true"
        />

        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip
            active={Boolean(condition)}
            open={panel === "condition"}
            onClick={() => togglePanel("condition")}
          >
            {conditionLabel ?? "kondisi"}
          </Chip>

          <Chip
            active={Boolean(category_id)}
            open={panel === "category"}
            onClick={() => togglePanel("category")}
          >
            {categoryLabel ?? "kategori"}
          </Chip>

          <Chip
            active={Boolean(min_price || max_price)}
            open={panel === "price"}
            onClick={() => togglePanel("price")}
          >
            {priceLabel}
          </Chip>

          <Chip
            active={newest}
            open={false}
            onClick={() => {
              update({ newest: !newest });
              setPanel(null);
            }}
          >
            terbaru
          </Chip>
        </div>
      </div>

      {/* Banner: kotak yang menggantung ke bawah dari baris filter */}
      {panel && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 rounded-xl overflow-y-auto bg-primary shadow-xl">
          {panel === "condition" && (
            <>
              <Option
                selected={condition === ""}
                onClick={() => pickCondition("")}
              >
                Semua
              </Option>
              {CONDITIONS.map((item) => (
                <Option
                  key={item.value}
                  selected={condition === item.value}
                  onClick={() => pickCondition(item.value)}
                >
                  {item.label}
                </Option>
              ))}
            </>
          )}

          {panel === "category" && (
            <>
              <Option
                selected={category_id === ""}
                onClick={() => pickCategory("")}
              >
                Semua
              </Option>
              {categories.map((item) => (
                <Option
                  key={item.id}
                  selected={String(category_id) === String(item.id)}
                  onClick={() => pickCategory(item.id)}
                >
                  {item.name}
                </Option>
              ))}
            </>
          )}

          {panel === "price" && (
            <div className="flex flex-col gap-3 p-4">
              <label className="block">
                <span className="mb-1 block text-sm text-second/70">
                  Harga termurah
                </span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={formatRupiah(draft.min)}
                  onChange={(event) => setDraftField("min", event.target.value)}
                  className="h-10 w-full border-1 border-grad bg-primary px-3 text-base text-second outline-none rounded-xl"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-second/70">
                  Harga tertinggi
                </span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Tanpa batas"
                  value={formatRupiah(draft.max)}
                  onChange={(event) => setDraftField("max", event.target.value)}
                  className="h-10 w-full border-1 border-grad bg-primary px-3 text-base text-second outline-none rounded-xl"
                />
              </label>

              {draftInvalid && (
                <p role="alert" className="text-sm text-red-600">
                  Harga termurah tidak boleh lebih besar dari harga tertinggi.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyPrice}
                  disabled={draftInvalid}
                  className="h-10 flex-1  bg-grad px-4 text-primary disabled:opacity-50 rounded-full cursor-pointer"
                >
                  Terapkan
                </button>
                <button
                  type="button"
                  onClick={resetPrice}
                  className="h-10 flex-1 border-1 border-grad rounded-full px-4 text-second cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
