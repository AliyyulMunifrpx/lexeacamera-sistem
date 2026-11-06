"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBox,
  FiLoader,
  FiShoppingBag,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import {
  useGetCamera,
  useUpdateCamera,
  useUpdateCameraImages,
} from "../../../../../features/cameras/hooks.js";
import { useGetCategories } from "../../../../../features/categories/hooks.js";
import { useGetMarketplaces } from "../../../../../features/marketplaces/hooks.js";
import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";
import PrimaryButton from "../../../../../../components/primary-button.jsx";
import CancelButton from "./../../../../../../components/cancel-button";

/* -------------------------------------------------------------------------- */
/*  Design rules                                                              */
/*  Spacing : only 2, 4, 8, 16 (padding, margin, gap, size, height)           */
/*  Color   : primary (putih) + second (opacity steps)                        */
/*            second2 (merah) = gagal / error / rugi                          */
/*            second3 (biru)  = berhasil                                      */
/*            second4 (ungu)  = fokus / aksen, bg-grad = aksen utama          */
/* -------------------------------------------------------------------------- */

const MAX_IMAGES = 12;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Admin hanya mengisi 4 karakter di belakang prefix. Dikirim ke backend sebagai "WAV-XXXX".
const SKU_PREFIX = "WAV-";
const SKU_LENGTH = 4;

// Urutan field untuk fokus otomatis ke error pertama.
const FIELD_ORDER = [
  "name",
  "category_id",
  "price",
  "capital",
  "stock",
  "strikethrough_price",
  "sku",
  "serial_number",
  "color",
  "shutter_count",
  "images",
];

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

const emptyForm = {
  name: "",
  price: "", // hanya digit, contoh "1000000". Tampilannya diformat di input.
  capital: "", // modal, hanya digit
  strikethrough_price: "", // harga coret, hanya digit. Dikirim hanya jika promo aktif.
  condition: "NEW",
  stock: "",
  description: "",
  inclusions: "",
  category_id: "",
  sku: "",
  serial_number: "",
  color: "",
  shutter_count: "",
  promo: false,
  best_selling: false,
};

// "1000000" -> "1.000.000"
function formatThousands(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// 1000000 -> "Rp 1.000.000", -500 -> "-Rp 500"
function formatMoney(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "";

  return `${sign}Rp ${formatThousands(Math.abs(Math.round(number)))}`;
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    failure: "bg-second2 text-primary",
  };

  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
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

function FormSection({ title, description, aside, children, sectionRef }) {
  return (
    <section
      ref={sectionRef}
      className="flex min-w-0 scroll-mt-16 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-bold text-second">{title}</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            {description}
          </p>
        </div>

        {aside}
      </div>

      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function FieldGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

/* id pesan = `${htmlFor}-desc`, dipakai aria-describedby pada input */
function FormField({ label, htmlFor, required, children, description, error }) {
  const descId = `${htmlFor}-desc`;

  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required ? (
          <span className="ml-2 text-second2" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal text-second/50">
            Opsional
          </span>
        )}
      </label>

      {children}

      {error ? (
        <ErrorText id={descId}>{error}</ErrorText>
      ) : (
        description && (
          <p id={descId} className="mt-2 text-sm text-second/60">
            {description}
          </p>
        )
      )}
    </div>
  );
}

/* Input dengan awalan tetap di kiri (Rp, WAV-) */
function PrefixedInput({ prefix, children }) {
  return (
    <div className="flex">
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center rounded-l-xl border border-r-0 border-second/30 bg-second/5 px-4 text-sm font-medium text-second/60"
      >
        {prefix}
      </span>
      {children}
    </div>
  );
}

function ToggleCard({
  name,
  checked,
  onChange,
  disabled,
  title,
  description,
  children,
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        checked ? "border-second4 bg-second4/5" : "border-second/30"
      }`}
    >
      <label className="flex cursor-pointer items-center gap-4">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className={`size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
        />

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-second">
            {title}
          </span>
          <span className="mt-2 block text-sm text-second/60">
            {description}
          </span>
        </span>
      </label>

      {checked && children && <div className="mt-4">{children}</div>}
    </div>
  );
}

function ImagePreview({ file, alt }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!src) return null;

  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

/* --------------------------------- Gallery -------------------------------- */

function GalleryTile({
  preview,
  label,
  isPrimary,
  disabled,
  onPrimary,
  onRemove,
}) {
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-xl border bg-second/5 ${
        isPrimary ? "col-span-2 row-span-2 border-second4" : "border-second/30"
      }`}
    >
      <div className="absolute inset-0">{preview}</div>

      {isPrimary ? (
        <span className="absolute left-2 top-2">
          <Tag tone="grad">Gambar utama</Tag>
        </span>
      ) : (
        <button
          type="button"
          onClick={onPrimary}
          disabled={disabled}
          className={`absolute bottom-2 left-2 inline-flex h-8 items-center rounded-full bg-primary px-4 text-xs font-semibold text-second shadow transition-colors hover:bg-second4 hover:text-primary disabled:opacity-50 touch-manipulation ${FOCUS_RING}`}
        >
          Jadikan utama
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Hapus ${label}`}
        className={`absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-primary text-second2 shadow transition-colors hover:bg-second2 hover:text-primary disabled:opacity-50 touch-manipulation ${FOCUS_RING}`}
      >
        <FiTrash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function AddImageTile({ empty, disabled, dragging, hasError, onChange }) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-sm font-semibold text-second transition-colors focus-within:ring-2 focus-within:ring-second4/40 ${
        dragging
          ? "border-second4 bg-second4/10"
          : hasError
            ? "border-second2 hover:bg-second2/5"
            : "border-second/30 hover:border-second4 hover:bg-second4/5"
      } ${empty ? "gap-4 px-4 py-16" : "aspect-square"} ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-full ${
          empty ? "size-8 bg-grad text-primary" : "text-second4"
        }`}
      >
        <FiUploadCloud size={16} />
      </span>

      {empty ? (
        <span className="flex flex-col gap-2">
          <span>Tarik gambar ke sini atau pilih dari perangkat</span>
          <span className="text-xs font-normal text-second/60">
            JPEG, PNG, atau WebP. Maksimal {MAX_IMAGES} gambar, masing-masing 5
            MB.
          </span>
        </span>
      ) : (
        <span>Tambah gambar</span>
      )}

      <input
        type="file"
        name="images"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}

/* --------------------------------- Summary -------------------------------- */

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs text-second/60">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-semibold tabular-nums text-second">
        {children}
      </dd>
    </div>
  );
}

function PriceSummary({ form, preview }) {
  const price = Number(form.price) || 0;
  const capital = Number(form.capital) || 0;
  const strike = Number(form.strikethrough_price) || 0;

  const hasPrice = form.price !== "";
  const hasCapital = form.capital !== "";
  const margin = price - capital;
  const marginPercent = price > 0 ? Math.round((margin / price) * 100) : 0;
  const hasStrike = form.promo && strike > price && price > 0;
  const discountPercent = hasStrike
    ? Math.round(((strike - price) / strike) * 100)
    : 0;

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <h2 className="text-lg font-bold text-second">Ringkasan</h2>

      <div className="flex min-w-0 items-center gap-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-second/5 text-second/40">
          {preview ? (
            <div className="absolute inset-0">{preview}</div>
          ) : (
            <FiBox size={16} aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-sm font-semibold text-second">
            {form.name.trim() || "Nama produk"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag>{form.condition === "NEW" ? "Baru" : "Bekas"}</Tag>
            {form.promo && <Tag tone="strong">Promo</Tag>}
            {form.best_selling && <Tag tone="grad">Best seller</Tag>}
          </div>
        </div>
      </div>

      <dl className="divide-y divide-second/10 border-y border-second/30">
        <SummaryRow label="Harga jual">
          {hasPrice ? formatMoney(price) : "—"}
        </SummaryRow>

        {form.promo && (
          <SummaryRow label="Harga coret">
            {strike > 0 ? (
              <span className="text-second/60 line-through">
                {formatMoney(strike)}
              </span>
            ) : (
              "—"
            )}
          </SummaryRow>
        )}

        {hasStrike && (
          <SummaryRow label="Diskon">{discountPercent}%</SummaryRow>
        )}

        <SummaryRow label="Modal">
          {hasCapital ? formatMoney(capital) : "—"}
        </SummaryRow>

        <SummaryRow label="Margin">
          {hasPrice && hasCapital ? (
            <span className="flex flex-col items-end gap-2">
              <span>
                {formatMoney(margin)} ({marginPercent}%)
              </span>
              {margin < 0 && <Tag tone="failure">Di bawah modal</Tag>}
            </span>
          ) : (
            "—"
          )}
        </SummaryRow>
      </dl>
    </section>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function EditCameraPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const initializedId = useRef(null);
  const formRef = useRef(null);
  const galleryRef = useRef(null);

  const cameraQuery = useGetCamera(id);
  const categoriesQuery = useGetCategories();
  const marketplacesQuery = useGetMarketplaces();

  const updateCamera = useUpdateCamera();
  const updateCameraImages = useUpdateCameraImages();

  const camera = cameraQuery.data;
  const categories = categoriesQuery.data ?? [];
  const availableMarketplaces = marketplacesQuery.data ?? [];

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  // Menjaga posisi kursor saat angka diformat ulang (titik ribuan) atau SKU diubah.
  const inputRefs = useRef({});
  const skuInputRef = useRef(null);
  const pendingCaret = useRef(null);
  const pendingSkuCaret = useRef(null);

  const [keptImages, setKeptImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [primarySelection, setPrimarySelection] = useState(null);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [marketplaceUrls, setMarketplaceUrls] = useState({});
  const [dragging, setDragging] = useState(false);

  const isSaving = updateCamera.isPending || updateCameraImages.isPending;

  useEffect(() => {
    if (!camera || initializedId.current === camera.id) return;

    initializedId.current = camera.id;

    const rawSku = camera.sku ?? "";
    const initialSku = rawSku.startsWith(SKU_PREFIX)
      ? rawSku.slice(SKU_PREFIX.length)
      : rawSku;

    setForm({
      name: camera.name ?? "",
      price: String(camera.price ?? ""),
      capital: String(camera.capital ?? ""),
      strikethrough_price: String(camera.strikethrough_price ?? ""),
      condition: camera.condition ?? "NEW",
      stock: String(camera.stock ?? ""),
      description: camera.description ?? "",
      inclusions: camera.inclusions ?? "",
      category_id: camera.category_id ?? camera.category?.id ?? "",
      sku: initialSku,
      serial_number: camera.serial_number ?? "",
      color: camera.color ?? "",
      shutter_count: String(camera.shutter_count ?? ""),
      promo: Boolean(camera.promo),
      best_selling: Boolean(camera.best_selling),
    });

    setErrors({});

    const images = camera.images ?? [];

    setKeptImages(images);
    setNewImages([]);
    setGalleryDirty(false);

    const primaryImage = images.find((image) => image.is_primary) ?? images[0];

    setPrimarySelection(
      primaryImage ? { type: "existing", id: primaryImage.id } : null,
    );

    setMarketplaceUrls(
      Object.fromEntries(
        (camera.marketplaceLinks ?? []).map((item) => [
          item.marketplace_id,
          item.product_url ?? "",
        ]),
      ),
    );
  }, [camera]);

  useEffect(() => {
    if (!cameraQuery.isError || !cameraQuery.error) return;

    const apiError = normalizeApiError(cameraQuery.error);
    notify.error(apiError.message);
  }, [cameraQuery.isError, cameraQuery.error]);

  useEffect(() => {
    if (!categoriesQuery.isError || !categoriesQuery.error) return;

    const apiError = normalizeApiError(categoriesQuery.error);
    notify.error(apiError.message);
  }, [categoriesQuery.isError, categoriesQuery.error]);

  useEffect(() => {
    if (!marketplacesQuery.isError || !marketplacesQuery.error) return;

    const apiError = normalizeApiError(marketplacesQuery.error);
    notify.error(apiError.message);
  }, [marketplacesQuery.isError, marketplacesQuery.error]);

  const priceNumber = Number(form.price) || 0;
  const strikeNumber = Number(form.strikethrough_price) || 0;
  const strikeLiveError =
    form.promo && form.strikethrough_price !== "" && strikeNumber <= priceNumber
      ? "Harga coret harus lebih tinggi dari harga jual."
      : "";

  const errorOf = (name) =>
    name === "strikethrough_price"
      ? errors.strikethrough_price || strikeLiveError
      : errors[name];

  // Atribut aksesibilitas untuk input: aria-invalid dan aria-describedby (id = `${name}-desc`).
  function fieldProps(name, { hasDescription = false, required = true } = {}) {
    const error = errorOf(name);

    return {
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error || hasDescription ? `${name}-desc` : undefined,
      "aria-required": required || undefined,
    };
  }

  function clearError(name) {
    setErrors((previous) =>
      previous[name] ? { ...previous, [name]: undefined } : previous,
    );
  }

  function setInputRef(name) {
    return (node) => {
      inputRefs.current[name] = node;
    };
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => {
      const next = {
        ...previous,
        [name]: type === "checkbox" ? checked : value,
      };

      // Harga coret hanya berlaku saat promo aktif.
      if (name === "promo" && !checked) {
        next.strikethrough_price = "";
      }

      return next;
    });

    clearError(name);
    if (name === "promo") clearError("strikethrough_price");
  }

  // Untuk price, capital, strikethrough_price, stock, dan shutter_count:
  // hanya digit, tanpa nol di depan, kursor tetap di tempatnya.
  function updateDigits(event) {
    const input = event.target;
    const { name } = input;
    const cursorPosition = input.selectionStart ?? input.value.length;

    const digitsBeforeCursor = input.value
      .slice(0, cursorPosition)
      .replace(/\D/g, "").length;

    const digits = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

    // Stok tidak diformat ribuan, jadi tidak perlu restore kursor.
    if (name !== "stock") {
      pendingCaret.current = {
        name,
        count: Math.min(digitsBeforeCursor, digits.length),
      };
    }

    setForm((previous) => ({ ...previous, [name]: digits }));
    clearError(name);
  }

  function updateSku(event) {
    const input = event.target;
    const cursorPosition = input.selectionStart ?? input.value.length;

    const charactersBeforeCursor = input.value
      .slice(0, cursorPosition)
      .replace(/[^a-zA-Z0-9]/g, "").length;

    // Hanya huruf dan angka, otomatis huruf besar, maksimal 4 karakter.
    const value = input.value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, SKU_LENGTH);

    pendingSkuCaret.current = Math.min(charactersBeforeCursor, value.length);

    setForm((previous) => ({ ...previous, sku: value }));
    clearError("sku");
  }

  useLayoutEffect(() => {
    const caret = pendingCaret.current;

    if (caret) {
      const input = inputRefs.current[caret.name];

      if (input) {
        const formattedValue = formatThousands(form[caret.name] ?? "");

        let position = 0;
        let digitsFound = 0;

        while (position < formattedValue.length && digitsFound < caret.count) {
          if (/\d/.test(formattedValue[position])) {
            digitsFound++;
          }

          position++;
        }

        input.setSelectionRange(position, position);
      }

      pendingCaret.current = null;
    }

    if (pendingSkuCaret.current !== null && skuInputRef.current) {
      const input = skuInputRef.current;
      const position = Math.min(pendingSkuCaret.current, input.value.length);

      input.setSelectionRange(position, position);
      pendingSkuCaret.current = null;
    }
  }, [form]);

  function addFiles(selectedFiles) {
    if (selectedFiles.length === 0) return;

    if (
      keptImages.length + newImages.length + selectedFiles.length >
      MAX_IMAGES
    ) {
      notify.error(`Maksimal ${MAX_IMAGES} gambar secara keseluruhan.`);
      return;
    }

    if (selectedFiles.some((file) => !ALLOWED_TYPES.includes(file.type))) {
      notify.error("Format gambar harus JPEG, PNG, atau WebP.");
      return;
    }

    if (selectedFiles.some((file) => file.size > MAX_FILE_SIZE)) {
      notify.error("Ukuran setiap gambar maksimal 5 MB.");
      return;
    }

    const additions = selectedFiles.map((file) => ({
      key: crypto.randomUUID(),
      file,
    }));

    setNewImages((previous) => [...previous, ...additions]);

    if (
      !primarySelection &&
      keptImages.length === 0 &&
      newImages.length === 0 &&
      additions.length > 0
    ) {
      setPrimarySelection({
        type: "new",
        key: additions[0].key,
      });
    }

    if (additions.length > 0) {
      setGalleryDirty(true);
      clearError("images");
    }
  }

  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files ?? []);

    // Reset input agar file yang sama bisa dipilih kembali.
    event.target.value = "";

    addFiles(selectedFiles);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    if (isSaving || keptImages.length + newImages.length >= MAX_IMAGES) return;

    addFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function removeExistingImage(imageId) {
    const remaining = keptImages.filter((image) => image.id !== imageId);

    setKeptImages(remaining);
    setGalleryDirty(true);

    if (
      primarySelection?.type === "existing" &&
      primarySelection.id === imageId
    ) {
      if (remaining.length > 0) {
        setPrimarySelection({
          type: "existing",
          id: remaining[0].id,
        });
      } else if (newImages.length > 0) {
        setPrimarySelection({
          type: "new",
          key: newImages[0].key,
        });
      } else {
        setPrimarySelection(null);
      }
    }
  }

  function removeNewImage(key) {
    const remaining = newImages.filter((image) => image.key !== key);

    setNewImages(remaining);
    setGalleryDirty(true);

    if (primarySelection?.type === "new" && primarySelection.key === key) {
      if (keptImages.length > 0) {
        setPrimarySelection({
          type: "existing",
          id: keptImages[0].id,
        });
      } else if (remaining.length > 0) {
        setPrimarySelection({
          type: "new",
          key: remaining[0].key,
        });
      } else {
        setPrimarySelection(null);
      }
    }
  }

  function setExistingPrimary(imageId) {
    setPrimarySelection({ type: "existing", id: imageId });
    setGalleryDirty(true);
  }

  function setNewPrimary(key) {
    setPrimarySelection({ type: "new", key });
    setGalleryDirty(true);
  }

  function updateMarketplaceUrl(marketplaceId, value) {
    setMarketplaceUrls((previous) => ({
      ...previous,
      [marketplaceId]: value,
    }));
  }

  function normalizeMarketplaceLinks(items = []) {
    return items
      .filter((item) => item.marketplace_id && item.product_url?.trim())
      .map((item) => ({
        marketplace_id: item.marketplace_id,
        product_url: item.product_url.trim(),
      }))
      .sort((a, b) => a.marketplace_id.localeCompare(b.marketplace_id));
  }

  function validate() {
    const found = {};

    if (!form.name.trim()) found.name = "Nama produk wajib diisi.";
    if (!form.category_id) found.category_id = "Pilih kategori produk.";
    if (form.price === "") found.price = "Harga jual wajib diisi.";
    if (form.capital === "") found.capital = "Modal wajib diisi.";
    if (form.stock === "") found.stock = "Stok wajib diisi.";

    if (form.promo) {
      if (form.strikethrough_price === "") {
        found.strikethrough_price = "Isi harga coret untuk produk promosi.";
      } else if (strikeNumber <= priceNumber) {
        found.strikethrough_price =
          "Harga coret harus lebih tinggi dari harga jual.";
      }
    }

    if (form.sku.length !== SKU_LENGTH) {
      found.sku = `SKU harus diisi ${SKU_LENGTH} karakter huruf atau angka.`;
    }
    if (!form.serial_number.trim()) {
      found.serial_number = "Serial number wajib diisi.";
    }
    if (!form.color.trim()) found.color = "Warna wajib diisi.";
    if (!form.shutter_count.trim()) {
      found.shutter_count =
        "Shutter count wajib diisi. Isi 0 jika produk baru.";
    }

    if (galleryDirty && keptImages.length + newImages.length === 0) {
      found.images = "Produk harus memiliki minimal satu gambar.";
    }

    return found;
  }

  function focusFirstError(found) {
    const first = FIELD_ORDER.find((name) => found[name]);

    if (!first) return;

    if (first === "images") {
      galleryRef.current?.scrollIntoView({ block: "center" });
      return;
    }

    formRef.current?.elements?.namedItem(first)?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!camera || isSaving) return;

    if (categories.length === 0) {
      notify.error("Tidak ada kategori yang tersedia.");
      return;
    }

    if (marketplacesQuery.isError || marketplacesQuery.isPending) {
      notify.error("Pastikan daftar marketplace berhasil dimuat.");
      return;
    }

    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }

    const sku = form.sku;
    const serialNumber = form.serial_number.trim();
    const color = form.color.trim();
    const shutterCount = form.shutter_count.trim();

    const imageCount = keptImages.length + newImages.length;

    if (imageCount > MAX_IMAGES) {
      notify.error(`Maksimal ${MAX_IMAGES} gambar secara keseluruhan.`);
      return;
    }

    const marketplaceLinks = availableMarketplaces
      .map((marketplace) => ({
        marketplace_id: marketplace.id,
        product_url: (marketplaceUrls[marketplace.id] ?? "").trim(),
      }))
      .filter((item) => item.product_url !== "");

    const originalMarketplaceLinks = camera.marketplaceLinks ?? [];

    const data = {};

    if (form.name.trim() !== (camera.name ?? "")) {
      data.name = form.name.trim();
    }

    if (Number(form.price) !== Number(camera.price)) {
      data.price = Number(form.price);
    }

    if (Number(form.capital) !== Number(camera.capital)) {
      data.capital = Number(form.capital);
    }

    // Harga coret hanya dikirim saat produk promosi dan nilainya berubah.
    if (
      form.promo &&
      Number(form.strikethrough_price) !== Number(camera.strikethrough_price)
    ) {
      data.strikethrough_price = Number(form.strikethrough_price);
    }

    if (form.condition !== camera.condition) {
      data.condition = form.condition;
    }

    if (Number(form.stock) !== Number(camera.stock)) {
      data.stock = Number(form.stock);
    }

    const fullSku = `${SKU_PREFIX}${sku}`;
    if (fullSku !== (camera.sku ?? "")) {
      data.sku = fullSku;
    }

    if (serialNumber !== (camera.serial_number ?? "")) {
      data.serial_number = serialNumber;
    }

    if (color !== (camera.color ?? "")) {
      data.color = color;
    }

    if (shutterCount !== String(camera.shutter_count ?? "")) {
      data.shutter_count = shutterCount; // Kirim sebagai string murni
    }

    if (form.description.trim() !== (camera.description ?? "")) {
      data.description = form.description.trim();
    }

    if (form.inclusions.trim() !== (camera.inclusions ?? "")) {
      data.inclusions = form.inclusions.trim();
    }

    const originalCategoryId = camera.category_id ?? camera.category?.id ?? "";

    if (form.category_id !== originalCategoryId) {
      data.category_id = form.category_id;
    }

    if (form.promo !== Boolean(camera.promo)) {
      data.promo = form.promo;
    }

    if (form.best_selling !== Boolean(camera.best_selling)) {
      data.best_selling = form.best_selling;
    }

    const normalizedMarketplace = normalizeMarketplaceLinks(marketplaceLinks);
    const normalizedOriginalMarketplace = normalizeMarketplaceLinks(
      originalMarketplaceLinks,
    );

    if (
      JSON.stringify(normalizedMarketplace) !==
      JSON.stringify(normalizedOriginalMarketplace)
    ) {
      data.marketplace = marketplaceLinks;
    }

    const hasDataChanges = Object.keys(data).length > 0;

    if (!hasDataChanges && !galleryDirty) {
      notify.error("Tidak ada perubahan untuk disimpan.");
      return;
    }

    let detailsSaved = false;

    try {
      if (hasDataChanges) {
        await updateCamera.mutateAsync({ id, data });
        detailsSaved = true;
      }

      if (galleryDirty) {
        const formData = new FormData();

        formData.append(
          "keep_image_ids",
          JSON.stringify(keptImages.map((image) => image.id)),
        );

        if (primarySelection?.type === "existing") {
          formData.append("primary", primarySelection.id);
        } else if (primarySelection?.type === "new") {
          const newIndex = newImages.findIndex(
            (image) => image.key === primarySelection.key,
          );

          if (newIndex >= 0) {
            formData.append("primary", `new:${newIndex}`);
          }
        }

        newImages.forEach(({ file }) => {
          formData.append("images", file);
        });

        await updateCameraImages.mutateAsync({ id, formData });
      }

      notify.success("Perubahan produk berhasil disimpan.");
      router.push(`/owner/cameras/${id}`);
    } catch (error) {
      const apiError = normalizeApiError(error);

      if (detailsSaved && galleryDirty) {
        notify.error(
          `Informasi produk berhasil disimpan, tetapi galeri gagal diperbarui. ${apiError.message}`,
        );
      } else {
        notify.error(apiError.message);
      }
    }
  }

  /* ------------------------------- States --------------------------------- */

  if (cameraQuery.isPending) {
    return (
      <div
        className="flex items-center justify-center gap-4 py-16 text-sm text-second/60"
        role="status"
        aria-live="polite"
      >
        <FiLoader
          className="animate-spin motion-reduce:animate-none"
          size={16}
          aria-hidden="true"
        />
        Memuat detail produk…
      </div>
    );
  }

  if (cameraQuery.isError || !camera) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-second/30 bg-primary px-4 py-16 text-center shadow-xl shadow-second/5">
        <div
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full bg-second2 text-primary"
        >
          <FiBox size={16} />
        </div>

        <div>
          <h2 className="font-semibold text-second">Gagal memuat produk</h2>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            Periksa koneksi Anda, lalu coba kembali.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/owner/cameras"
            className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
          >
            Kembali
          </Link>

          <button
            type="button"
            onClick={() => cameraQuery.refetch()}
            disabled={cameraQuery.isFetching}
            className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {cameraQuery.isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ Derived UI ------------------------------ */

  const totalImages = keptImages.length + newImages.length;

  // Gambar utama selalu tampil pertama di galeri.
  const galleryItems = [
    ...keptImages.map((image) => ({
      key: `existing-${image.id}`,
      kind: "existing",
      image,
      isPrimary:
        primarySelection?.type === "existing" &&
        primarySelection.id === image.id,
    })),
    ...newImages.map(({ key, file }) => ({
      key: `new-${key}`,
      kind: "new",
      imageKey: key,
      file,
      isPrimary:
        primarySelection?.type === "new" && primarySelection.key === key,
    })),
  ].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  const primaryItem = galleryItems.find((item) => item.isPrimary);

  const summaryPreview = primaryItem ? (
    primaryItem.kind === "existing" ? (
      primaryItem.image.image_url ? (
        <img
          src={primaryItem.image.image_url}
          alt="Gambar utama produk"
          className="h-full w-full object-cover"
        />
      ) : null
    ) : (
      <ImagePreview file={primaryItem.file} alt="Gambar utama produk" />
    )
  ) : null;

  const submitDisabled =
    isSaving ||
    categoriesQuery.isPending ||
    categoriesQuery.isError ||
    categories.length === 0 ||
    marketplacesQuery.isPending ||
    marketplacesQuery.isError;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={`/owner/cameras/${id}`}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke detail produk
        </Link>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiBox size={16} />
          </div>

          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Edit <span className="text-grad">produk</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Perbarui informasi, harga, galeri gambar, dan marketplace produk.
            </p>
          </div>
        </div>
      </header>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3"
      >
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
          <FormSection
            title="Informasi produk"
            description="Nama, kategori, dan deskripsi yang tampil di katalog."
          >
            <FormField
              label="Nama produk"
              htmlFor="name"
              required
              error={errorOf("name")}
            >
              <input
                id="name"
                name="name"
                autoComplete="off"
                value={form.name}
                onChange={updateField}
                className={inputClass(errorOf("name"))}
                placeholder="Contoh: Canon EOS R50…"
                maxLength={100}
                disabled={isSaving}
                {...fieldProps("name")}
              />
            </FormField>

            <FieldGrid>
              <FormField
                label="Kategori"
                htmlFor="category_id"
                required
                error={errorOf("category_id")}
              >
                <select
                  id="category_id"
                  name="category_id"
                  value={form.category_id}
                  onChange={updateField}
                  className={inputClass(errorOf("category_id"))}
                  disabled={
                    isSaving ||
                    categoriesQuery.isPending ||
                    categoriesQuery.isError ||
                    categories.length === 0
                  }
                  {...fieldProps("category_id")}
                >
                  <option value="">
                    {categoriesQuery.isPending
                      ? "Memuat kategori…"
                      : categories.length === 0
                        ? "Belum ada kategori"
                        : "Pilih kategori"}
                  </option>

                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                {categoriesQuery.isError && (
                  <button
                    type="button"
                    onClick={() => categoriesQuery.refetch()}
                    className={`mt-2 rounded text-sm font-medium text-second2 underline ${FOCUS_RING}`}
                  >
                    Gagal memuat kategori. Coba lagi.
                  </button>
                )}
              </FormField>

              <FormField label="Kondisi" htmlFor="condition" required>
                <select
                  id="condition"
                  name="condition"
                  value={form.condition}
                  onChange={updateField}
                  className={inputClass(false)}
                  disabled={isSaving}
                >
                  <option value="NEW">Baru</option>
                  <option value="SECOND">Bekas</option>
                </select>
              </FormField>
            </FieldGrid>

            <FormField label="Deskripsi" htmlFor="description">
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={updateField}
                className={`${inputClass(false)} resize-y`}
                rows={4}
                placeholder="Jelaskan spesifikasi dan keunggulan produk…"
                maxLength={1000}
                disabled={isSaving}
              />
              <p className="mt-2 text-right text-xs tabular-nums text-second/50">
                {form.description.length}/1000
              </p>
            </FormField>

            <FormField
              label="Kelengkapan"
              htmlFor="inclusions"
              description="Contoh: Body, baterai, charger, strap."
            >
              <textarea
                id="inclusions"
                name="inclusions"
                value={form.inclusions}
                onChange={updateField}
                className={`${inputClass(false)} resize-y`}
                rows={2}
                placeholder="Daftar barang yang disertakan…"
                maxLength={1000}
                disabled={isSaving}
                {...fieldProps("inclusions", {
                  hasDescription: true,
                  required: false,
                })}
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Harga dan stok"
            description="Harga jual, modal, dan jumlah unit yang tersedia."
          >
            <FieldGrid>
              <FormField
                label="Harga jual"
                htmlFor="price"
                required
                error={errorOf("price")}
              >
                <PrefixedInput prefix="Rp">
                  <input
                    ref={setInputRef("price")}
                    id="price"
                    name="price"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatThousands(form.price)}
                    onChange={updateDigits}
                    className={`${inputClass(errorOf("price"))} rounded-l-none tabular-nums`}
                    placeholder="12.000.000"
                    disabled={isSaving}
                    {...fieldProps("price")}
                  />
                </PrefixedInput>
              </FormField>

              <FormField
                label="Modal"
                htmlFor="capital"
                required
                description="Harga beli produk. Hanya terlihat oleh admin."
                error={errorOf("capital")}
              >
                <PrefixedInput prefix="Rp">
                  <input
                    ref={setInputRef("capital")}
                    id="capital"
                    name="capital"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatThousands(form.capital)}
                    onChange={updateDigits}
                    className={`${inputClass(errorOf("capital"))} rounded-l-none tabular-nums`}
                    placeholder="10.000.000"
                    disabled={isSaving}
                    {...fieldProps("capital", { hasDescription: true })}
                  />
                </PrefixedInput>
              </FormField>

              <FormField
                label="Stok"
                htmlFor="stock"
                required
                error={errorOf("stock")}
              >
                <input
                  id="stock"
                  name="stock"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.stock}
                  onChange={updateDigits}
                  className={`${inputClass(errorOf("stock"))} tabular-nums`}
                  placeholder="3"
                  maxLength={6}
                  disabled={isSaving}
                  {...fieldProps("stock")}
                />
              </FormField>
            </FieldGrid>

            <ToggleCard
              name="promo"
              checked={form.promo}
              onChange={updateField}
              disabled={isSaving}
              title="Produk promosi"
              description="Tampilkan harga coret di samping harga jual."
            >
              <FormField
                label="Harga coret"
                htmlFor="strikethrough_price"
                required
                description="Harga sebelum diskon. Harus lebih tinggi dari harga jual."
                error={errorOf("strikethrough_price")}
              >
                <PrefixedInput prefix="Rp">
                  <input
                    ref={setInputRef("strikethrough_price")}
                    id="strikethrough_price"
                    name="strikethrough_price"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatThousands(form.strikethrough_price)}
                    onChange={updateDigits}
                    className={`${inputClass(errorOf("strikethrough_price"))} rounded-l-none tabular-nums`}
                    placeholder="15.000.000"
                    disabled={isSaving}
                    {...fieldProps("strikethrough_price", {
                      hasDescription: true,
                      required: form.promo,
                    })}
                  />
                </PrefixedInput>
              </FormField>
            </ToggleCard>

            <ToggleCard
              name="best_selling"
              checked={form.best_selling}
              onChange={updateField}
              disabled={isSaving}
              title="Produk best seller"
              description="Tandai produk sebagai salah satu produk terlaris."
            />
          </FormSection>

          <FormSection
            title="Detail unit"
            description="Identitas dan kondisi fisik unit yang dijual."
          >
            <FieldGrid>
              <FormField
                label="SKU"
                htmlFor="sku"
                required
                description={`Isi ${SKU_LENGTH} karakter huruf atau angka. Contoh: ${SKU_PREFIX}A1B2`}
                error={errorOf("sku")}
              >
                <PrefixedInput prefix={SKU_PREFIX}>
                  <input
                    ref={skuInputRef}
                    id="sku"
                    name="sku"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={form.sku}
                    onChange={updateSku}
                    className={`${inputClass(errorOf("sku"))} rounded-l-none uppercase`}
                    placeholder="A1B2"
                    maxLength={SKU_LENGTH}
                    disabled={isSaving}
                    {...fieldProps("sku", { hasDescription: true })}
                  />
                </PrefixedInput>
              </FormField>

              <FormField
                label="Serial number"
                htmlFor="serial_number"
                required
                error={errorOf("serial_number")}
              >
                <input
                  id="serial_number"
                  name="serial_number"
                  autoComplete="off"
                  spellCheck={false}
                  value={form.serial_number}
                  onChange={updateField}
                  className={inputClass(errorOf("serial_number"))}
                  placeholder="Nomor seri di body produk…"
                  maxLength={100}
                  disabled={isSaving}
                  {...fieldProps("serial_number")}
                />
              </FormField>

              <FormField
                label="Warna"
                htmlFor="color"
                required
                error={errorOf("color")}
              >
                <input
                  id="color"
                  name="color"
                  autoComplete="off"
                  value={form.color}
                  onChange={updateField}
                  className={inputClass(errorOf("color"))}
                  placeholder="Contoh: Hitam…"
                  maxLength={50}
                  disabled={isSaving}
                  {...fieldProps("color")}
                />
              </FormField>

              <FormField
                label="Shutter count"
                htmlFor="shutter_count"
                required
                description="Isi 0 jika produk baru."
                error={errorOf("shutter_count")}
              >
                <input
                  ref={setInputRef("shutter_count")}
                  id="shutter_count"
                  name="shutter_count"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatThousands(form.shutter_count)}
                  onChange={updateDigits}
                  className={`${inputClass(errorOf("shutter_count"))} tabular-nums`}
                  placeholder="Contoh: 12.500"
                  maxLength={20}
                  disabled={isSaving}
                  {...fieldProps("shutter_count", { hasDescription: true })}
                />
              </FormField>
            </FieldGrid>
          </FormSection>

          <FormSection
            sectionRef={galleryRef}
            title="Galeri gambar"
            description="Gambar utama tampil pertama di katalog. Pilih gambar utama, hapus gambar lama, atau tambahkan gambar baru."
            aside={
              <Tag tone="soft">
                {totalImages}/{MAX_IMAGES} gambar
              </Tag>
            }
          >
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {totalImages === 0 ? (
                <AddImageTile
                  empty
                  disabled={isSaving}
                  dragging={dragging}
                  hasError={Boolean(errors.images)}
                  onChange={handleImageChange}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {galleryItems.map((item) =>
                    item.kind === "existing" ? (
                      <GalleryTile
                        key={item.key}
                        label="gambar produk"
                        isPrimary={item.isPrimary}
                        disabled={isSaving}
                        onPrimary={() => setExistingPrimary(item.image.id)}
                        onRemove={() => removeExistingImage(item.image.id)}
                        preview={
                          item.image.image_url ? (
                            <img
                              src={item.image.image_url}
                              alt="Gambar produk"
                              className="h-full w-full object-cover"
                            />
                          ) : null
                        }
                      />
                    ) : (
                      <GalleryTile
                        key={item.key}
                        label={item.file.name}
                        isPrimary={item.isPrimary}
                        disabled={isSaving}
                        onPrimary={() => setNewPrimary(item.imageKey)}
                        onRemove={() => removeNewImage(item.imageKey)}
                        preview={
                          <ImagePreview file={item.file} alt={item.file.name} />
                        }
                      />
                    ),
                  )}

                  {totalImages < MAX_IMAGES && (
                    <AddImageTile
                      disabled={isSaving}
                      dragging={dragging}
                      onChange={handleImageChange}
                    />
                  )}
                </div>
              )}
            </div>

            {errors.images && (
              <ErrorText id="images-desc">{errors.images}</ErrorText>
            )}
          </FormSection>

          <FormSection
            title="Tautan marketplace"
            description="URL yang sudah tersimpan tampil otomatis. Kosongkan jika produk tidak dijual di marketplace tersebut."
          >
            {marketplacesQuery.isPending ? (
              <div
                className="flex items-center justify-center gap-4 py-16 text-sm text-second/60"
                role="status"
              >
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Memuat marketplace…
              </div>
            ) : marketplacesQuery.isError ? (
              <div
                role="alert"
                className="flex flex-col items-start gap-4 rounded-xl border border-second2/30 bg-second2/5 p-4"
              >
                <p className="text-sm font-medium text-second2">
                  Gagal memuat daftar marketplace.
                </p>
                <button
                  type="button"
                  onClick={() => marketplacesQuery.refetch()}
                  className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
                >
                  Coba lagi
                </button>
              </div>
            ) : availableMarketplaces.length === 0 ? (
              <p className="rounded-xl bg-second/5 p-4 text-sm text-second/60">
                Belum ada marketplace yang tersedia. Produk tetap dapat
                diperbarui tanpa tautan marketplace.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {availableMarketplaces.map((marketplace) => (
                  <div
                    key={marketplace.id}
                    className="flex flex-col gap-4 rounded-xl border border-second/30 p-4 transition-colors focus-within:border-second4/50 sm:flex-row sm:items-center"
                  >
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-primary p-2">
                      {marketplace.logo_url ? (
                        <Image
                          src={marketplace.logo_url}
                          alt={`Logo ${marketplace.name}`}
                          width={96}
                          height={96}
                          unoptimized
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <FiShoppingBag
                          size={16}
                          className="text-second/40"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`marketplace-url-${marketplace.id}`}
                        className={labelClass}
                      >
                        {marketplace.name}
                        <span className="ml-2 text-xs font-normal text-second/50">
                          Opsional
                        </span>
                      </label>

                      <input
                        id={`marketplace-url-${marketplace.id}`}
                        type="url"
                        autoComplete="off"
                        spellCheck={false}
                        value={marketplaceUrls[marketplace.id] ?? ""}
                        onChange={(event) =>
                          updateMarketplaceUrl(
                            marketplace.id,
                            event.target.value,
                          )
                        }
                        className={inputClass(false)}
                        placeholder={`URL produk ${marketplace.name}…`}
                        disabled={isSaving}
                      />
                    </div>

                    {!marketplace.is_active && <Tag tone="soft">Nonaktif</Tag>}
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:-mt-4 xl:pt-4">
          <PriceSummary form={form} preview={summaryPreview} />

          <div className="flex flex-col gap-2">
            <PrimaryButton
              type="submit"
              disabled={submitDisabled}
              ariaBusy={isSaving}
            >
              {isSaving ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Menyimpan perubahan…
                </>
              ) : (
                "Simpan perubahan"
              )}
            </PrimaryButton>

            <CancelButton href={`/owner/cameras/${id}`} disabled={isSaving}>
              Batal
            </CancelButton>
          </div>
        </aside>
      </form>
    </div>
  );
}
