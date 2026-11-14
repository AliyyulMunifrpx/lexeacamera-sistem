"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBox,
  FiLoader,
  FiShoppingBag,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import { useCreateCamera } from "../../../../features/cameras/hooks.js";
import { useGetCategories } from "../../../../features/categories/hooks.js";
import { useGetMarketplaces } from "../../../../features/marketplaces/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import PrimaryButton from "../../../../../components/primary-button.jsx";
import CancelButton from "../../../../../components/cancel-button.jsx";

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
const SKU_PREFIX = "LX-";
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

const initialForm = {
  name: "",
  price: "", // hanya digit, contoh "1000000". Tampilannya diformat di input.
  capital: "", // modal, hanya digit
  strikethrough_price: "", // harga coret, hanya digit. Opsional, tidak bergantung pada promo.
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

function GalleryTile({ file, isPrimary, disabled, onPrimary, onRemove }) {
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-xl border bg-second/5 ${
        isPrimary ? "col-span-2 row-span-2 border-second4" : "border-second/30"
      }`}
    >
      <div className="absolute inset-0">
        <ImagePreview file={file} alt={file.name} />
      </div>

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
        aria-label={`Hapus ${file.name}`}
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
        <FiUploadCloud size={empty ? 16 : 16} />
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

function PriceSummary({ form, primaryFile }) {
  const price = Number(form.price) || 0;
  const capital = Number(form.capital) || 0;
  const strike = Number(form.strikethrough_price) || 0;

  const hasPrice = form.price !== "";
  const hasCapital = form.capital !== "";
  const margin = price - capital;
  const marginPercent = price > 0 ? Math.round((margin / price) * 100) : 0;
  const hasStrike = strike > price && price > 0;
  const discountPercent = hasStrike
    ? Math.round(((strike - price) / strike) * 100)
    : 0;

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <h2 className="text-lg font-bold text-second">Ringkasan</h2>

      <div className="flex min-w-0 items-center gap-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-second/5 text-second/40">
          {primaryFile ? (
            <div className="absolute inset-0">
              <ImagePreview file={primaryFile} alt="Gambar utama produk" />
            </div>
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

        {form.strikethrough_price !== "" && (
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

export default function CreateCameraPage() {
  const router = useRouter();
  const createCamera = useCreateCamera();
  const formRef = useRef(null);
  const galleryRef = useRef(null);

  const {
    data: categories = [],
    isPending: categoriesPending,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useGetCategories();

  const {
    data: availableMarketplaces = [],
    isPending: marketplacesPending,
    isError: marketplacesError,
    refetch: refetchMarketplaces,
  } = useGetMarketplaces();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [images, setImages] = useState([]);
  const [primaryKey, setPrimaryKey] = useState(null);
  const [marketplaceUrls, setMarketplaceUrls] = useState({});
  const [dragging, setDragging] = useState(false);

  const isSubmitting = createCamera.isPending;

  // Jika gambar utama belum dipilih / sudah dihapus, gambar pertama otomatis jadi utama.
  const effectivePrimaryKey = images.some((image) => image.key === primaryKey)
    ? primaryKey
    : (images[0]?.key ?? null);

  const orderedImages = [
    ...images.filter((image) => image.key === effectivePrimaryKey),
    ...images.filter((image) => image.key !== effectivePrimaryKey),
  ];

  const primaryFile = orderedImages[0]?.file ?? null;

  const priceNumber = Number(form.price) || 0;
  const strikeNumber = Number(form.strikethrough_price) || 0;
  const strikeLiveError =
    form.strikethrough_price !== "" && strikeNumber <= priceNumber
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

  function resetForm() {
    setForm(initialForm);
    setErrors({});
    setImages([]);
    setPrimaryKey(null);
    setMarketplaceUrls({});
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => {
      const next = {
        ...previous,
        [name]: type === "checkbox" ? checked : value,
      };

      return next;
    });

    clearError(name);
    if (name === "promo") clearError("strikethrough_price");
  }

  // Untuk price, capital, strikethrough_price, stock, dan shutter_count:
  // buang semua selain digit (termasuk titik pemisah), lalu buang nol di depan.
  function updateDigits(event) {
    const { name, value } = event.target;
    const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

    setForm((previous) => ({ ...previous, [name]: digits }));
    clearError(name);
  }

  function updateSku(event) {
    // Hanya huruf dan angka, otomatis huruf besar, maksimal 4 karakter.
    const value = event.target.value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, SKU_LENGTH);

    setForm((previous) => ({ ...previous, sku: value }));
    clearError("sku");
  }

  function addFiles(selectedFiles) {
    if (selectedFiles.length === 0) return;

    if (images.length + selectedFiles.length > MAX_IMAGES) {
      notify.error(`Maksimal ${MAX_IMAGES} gambar untuk satu produk.`);
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

    setImages((previous) => [...previous, ...additions]);
    clearError("images");
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

    if (isSubmitting || images.length >= MAX_IMAGES) return;

    addFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function removeImage(key) {
    setImages((previous) => previous.filter((image) => image.key !== key));
  }

  function updateMarketplaceUrl(marketplaceId, value) {
    setMarketplaceUrls((previous) => ({
      ...previous,
      [marketplaceId]: value,
    }));
  }

  function validate() {
    const found = {};

    if (!form.name.trim()) found.name = "Nama produk wajib diisi.";
    if (!form.category_id) found.category_id = "Pilih kategori produk.";
    if (form.price === "") found.price = "Harga jual wajib diisi.";
    if (form.capital === "") found.capital = "Modal wajib diisi.";
    if (form.stock === "") found.stock = "Stok wajib diisi.";

    // Harga coret wajib bila promo dicentang. Tanpa promo tetap opsional.
    // Jika diisi, harus lebih tinggi dari harga jual.
    if (form.promo && form.strikethrough_price === "") {
      found.strikethrough_price = "Isi harga coret untuk produk promosi.";
    } else if (form.strikethrough_price !== "" && strikeNumber <= priceNumber) {
      found.strikethrough_price =
        "Harga coret harus lebih tinggi dari harga jual.";
    }

    // Field ini wajib di backend, jadi cegah submit kalau isinya cuma spasi.
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

    if (images.length === 0) {
      found.images = "Tambahkan minimal satu gambar produk.";
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

  function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    if (categories.length === 0) {
      notify.error("Tambahkan kategori terlebih dahulu.");
      return;
    }

    if (marketplacesError) {
      notify.error("Daftar marketplace gagal dimuat. Silakan coba kembali.");
      return;
    }

    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }

    const marketplaceLinks = availableMarketplaces
      .map((marketplace) => ({
        marketplace_id: marketplace.id,
        product_url: (marketplaceUrls[marketplace.id] ?? "").trim(),
      }))
      .filter((item) => item.product_url !== "");

    const formData = new FormData();

    formData.append("name", form.name.trim());
    formData.append("price", String(Number(form.price)));
    formData.append("capital", String(Number(form.capital)));
    formData.append("condition", form.condition);
    formData.append("stock", String(Number(form.stock)));
    formData.append("description", form.description.trim());
    formData.append("inclusions", form.inclusions.trim());
    formData.append("category_id", form.category_id);
    formData.append("sku", `${SKU_PREFIX}${form.sku}`);
    formData.append("serial_number", form.serial_number.trim());
    formData.append("color", form.color.trim());
    formData.append("shutter_count", form.shutter_count.trim());
    formData.append("promo", String(form.promo));
    formData.append("best_selling", String(form.best_selling));

    // Harga coret dikirim bila diisi, dengan atau tanpa promo.
    if (form.strikethrough_price !== "") {
      formData.append("strikethrough_price", String(strikeNumber));
    }

    // Gambar pertama yang dikirim menjadi gambar utama,
    // jadi gambar yang dipilih sebagai utama dipindah ke urutan pertama.
    orderedImages.forEach(({ file }) => {
      formData.append("images", file);
    });

    if (marketplaceLinks.length > 0) {
      formData.append("marketplace", JSON.stringify(marketplaceLinks));
    }

    createCamera.mutate(formData, {
      onSuccess: () => {
        resetForm();
        notify.success("Produk berhasil ditambahkan.");
        router.push("/owner/cameras");
      },
      onError: (error) => {
        const normalizedError = normalizeApiError(error);
        notify.error(normalizedError.message || "Gagal menambahkan produk.");
      },
    });
  }

  const submitDisabled =
    isSubmitting ||
    categoriesPending ||
    categoriesError ||
    categories.length === 0 ||
    marketplacesPending ||
    marketplacesError;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali
        </button>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiBox size={16} />
          </div>

          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Tambah <span className="text-grad">produk</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Tambahkan produk baru ke katalog penjualan.
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
                disabled={isSubmitting}
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
                    isSubmitting ||
                    categoriesPending ||
                    categoriesError ||
                    categories.length === 0
                  }
                  {...fieldProps("category_id")}
                >
                  <option value="">
                    {categoriesPending
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

                {categoriesError && (
                  <button
                    type="button"
                    onClick={() => refetchCategories()}
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
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                    id="price"
                    name="price"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatThousands(form.price)}
                    onChange={updateDigits}
                    className={`${inputClass(errorOf("price"))} rounded-l-none tabular-nums`}
                    placeholder="12.000.000"
                    disabled={isSubmitting}
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
                    id="capital"
                    name="capital"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatThousands(form.capital)}
                    onChange={updateDigits}
                    className={`${inputClass(errorOf("capital"))} rounded-l-none tabular-nums`}
                    placeholder="10.000.000"
                    disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  {...fieldProps("stock")}
                />
              </FormField>

              <FormField
                label="Harga coret"
                htmlFor="strikethrough_price"
                required={form.promo}
                description="Harga sebelum diskon. Harus lebih tinggi dari harga jual."
                error={errorOf("strikethrough_price")}
              >
                <PrefixedInput prefix="Rp">
                  <input
                    id="strikethrough_price"
                    name="strikethrough_price"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatThousands(form.strikethrough_price)}
                    onChange={updateDigits}
                    className={`${inputClass(errorOf("strikethrough_price"))} rounded-l-none tabular-nums`}
                    placeholder="15.000.000"
                    disabled={isSubmitting}
                    {...fieldProps("strikethrough_price", {
                      hasDescription: true,
                      required: form.promo,
                    })}
                  />
                </PrefixedInput>
              </FormField>
            </FieldGrid>

            <ToggleCard
              name="promo"
              checked={form.promo}
              onChange={updateField}
              disabled={isSubmitting}
              title="Produk promosi"
              description="Tandai produk sebagai promosi. Jika dicentang, harga coret wajib diisi."
            />

            <ToggleCard
              name="best_selling"
              checked={form.best_selling}
              onChange={updateField}
              disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  {...fieldProps("shutter_count", { hasDescription: true })}
                />
              </FormField>
            </FieldGrid>
          </FormSection>

          <FormSection
            sectionRef={galleryRef}
            title="Galeri gambar"
            description="Gambar pertama menjadi gambar utama di katalog. Anda bisa menggantinya kapan saja."
            aside={
              <Tag tone="soft">
                {images.length}/{MAX_IMAGES} gambar
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
              {images.length === 0 ? (
                <AddImageTile
                  empty
                  disabled={isSubmitting}
                  dragging={dragging}
                  hasError={Boolean(errors.images)}
                  onChange={handleImageChange}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {orderedImages.map(({ key, file }) => (
                    <GalleryTile
                      key={key}
                      file={file}
                      isPrimary={effectivePrimaryKey === key}
                      disabled={isSubmitting}
                      onPrimary={() => setPrimaryKey(key)}
                      onRemove={() => removeImage(key)}
                    />
                  ))}

                  {images.length < MAX_IMAGES && (
                    <AddImageTile
                      disabled={isSubmitting}
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
            description="Isi URL produk di marketplace yang tersedia. Kosongkan jika produk tidak dijual di sana."
          >
            {marketplacesPending ? (
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
            ) : marketplacesError ? (
              <div
                role="alert"
                className="flex flex-col items-start gap-4 rounded-xl border border-second2/30 bg-second2/5 p-4"
              >
                <p className="text-sm font-medium text-second2">
                  Gagal memuat daftar marketplace.
                </p>
                <button
                  type="button"
                  onClick={() => refetchMarketplaces()}
                  className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
                >
                  Coba lagi
                </button>
              </div>
            ) : availableMarketplaces.length === 0 ? (
              <p className="rounded-xl bg-second/5 p-4 text-sm text-second/60">
                Belum ada marketplace yang tersedia. Produk tetap dapat
                ditambahkan tanpa tautan marketplace.
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
                        disabled={isSubmitting}
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
          <PriceSummary form={form} primaryFile={primaryFile} />

          <div className="flex flex-col gap-2">
            <PrimaryButton
              type="submit"
              disabled={submitDisabled}
              ariaBusy={isSubmitting}
            >
              {" "}
              {isSubmitting ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Menyimpan produk…
                </>
              ) : (
                "Simpan produk"
              )}
            </PrimaryButton>
            <CancelButton
              type="button"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Batal
            </CancelButton>
          </div>
        </aside>
      </form>
    </div>
  );
}
