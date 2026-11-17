"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBox,
  FiLoader,
  FiRotateCcw,
  FiRotateCw,
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
/*                                                                            */
/*  Galeri: satu array `gallery`. Item pertama = gambar utama. Urutan array   */
/*  = urutan tampil. Drag-and-drop menukar posisi dua item di array.          */
/*                                                                            */
/*  Upload: file yang dipilih masuk antrean crop (1:1), dipotong dan diputar  */
/*  satu per satu, lalu hasilnya baru masuk ke galeri.                        */
/* -------------------------------------------------------------------------- */

const MAX_IMAGES = 12;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CROP_ASPECT = 1;
const CROP_MAX_OUTPUT = 1600;
const CROP_MAX_ZOOM = 3;
const CROP_QUALITY = 0.92;
const CROP_MIN_ROTATION = -180;
const CROP_MAX_ROTATION = 180;

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

const emptyForm = {
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

/* True kalau yang diseret adalah file dari komputer (bukan tile galeri). */
function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/* ------------------------------- Crop utils ------------------------------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    // window.Image: `Image` di file ini adalah komponen next/image.
    const img = new window.Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = src;
  });
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/* Jaga rotasi tetap di rentang -180..180. */
function normalizeRotation(degrees) {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/* Ukuran kotak pembatas gambar setelah diputar. `area` dari react-easy-crop
   dihitung terhadap kotak ini, bukan terhadap gambar aslinya. */
function getRotatedSize(width, height, rotation) {
  const radians = toRadians(rotation);
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  return {
    width: cos * width + sin * height,
    height: sin * width + cos * height,
  };
}

/* Potong gambar (setelah diputar) sesuai area piksel dari react-easy-crop
   -> File baru. */
async function getCroppedFile(src, area, originalFile, rotation = 0) {
  const image = await loadImage(src);

  const outputSize = Math.max(
    1,
    Math.min(Math.round(area.width), CROP_MAX_OUTPUT),
  );

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = Math.max(1, Math.round(outputSize / CROP_ASPECT));

  const context = canvas.getContext("2d");

  if (!context) throw new Error("CANVAS_UNSUPPORTED");

  // JPEG tidak punya transparansi: sudut kosong akibat rotasi miring
  // akan jadi hitam kalau tidak diisi dulu dengan putih.
  if (originalFile.type === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const rotated = getRotatedSize(
    image.naturalWidth,
    image.naturalHeight,
    rotation,
  );
  const scale = canvas.width / area.width;

  context.imageSmoothingQuality = "high";

  // Urutan transformasi penting: skala -> geser ke area crop ->
  // pindah ke pusat kotak -> putar -> pusatkan gambar.
  context.scale(scale, scale);
  context.translate(-area.x, -area.y);
  context.translate(rotated.width / 2, rotated.height / 2);
  context.rotate(toRadians(rotation));
  context.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
  context.drawImage(image, 0, 0);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, originalFile.type, CROP_QUALITY);
  });

  if (!blob) throw new Error("CROP_FAILED");

  if (blob.size > MAX_FILE_SIZE) throw new Error("CROP_TOO_LARGE");

  return new File([blob], originalFile.name, {
    type: originalFile.type,
    lastModified: Date.now(),
  });
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

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="h-full w-full object-cover"
    />
  );
}

/* ------------------------------- Crop dialog ------------------------------ */

function CropDialog({ item, remaining, onDone, onSkip, onCancelAll }) {
  const [src, setSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(item.file);
    setSrc(url);

    return () => URL.revokeObjectURL(url);
  }, [item.file]);

  // Kunci scroll halaman selama dialog terbuka.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function rotateBy(degrees) {
    setRotation((previous) => normalizeRotation(previous + degrees));
  }

  function handleReset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  async function handleApply() {
    if (!area || !src || processing) return;

    setProcessing(true);

    try {
      const cropped = await getCroppedFile(src, area, item.file, rotation);
      onDone(cropped);
    } catch (error) {
      notify.error(
        error?.message === "CROP_TOO_LARGE"
          ? "Hasil crop melebihi 5 MB. Coba gambar lain."
          : "Gagal memotong gambar. Coba lagi.",
      );
      setProcessing(false);
    }
  }

  const isDefault = zoom === 1 && rotation === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-second/60 p-4"
    >
      <div className="flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="crop-title" className="text-lg font-bold text-second">
              Atur potongan gambar
            </h2>
            <p className="mt-2 truncate text-sm text-second/60">
              {item.file.name}
            </p>
          </div>

          {remaining > 0 && <Tag tone="soft">+{remaining} lagi</Tag>}
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-second">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={CROP_ASPECT}
              maxZoom={CROP_MAX_ZOOM}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>

        <div className="flex items-center gap-4">
          <label
            htmlFor="crop-zoom"
            className="w-16 shrink-0 text-sm font-semibold text-second"
          >
            Zoom
          </label>

          <input
            id="crop-zoom"
            type="range"
            min={1}
            max={CROP_MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={processing}
            onChange={(event) => setZoom(Number(event.target.value))}
            className={`min-w-0 flex-1 accent-second4 ${FOCUS_RING}`}
          />

          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-second/60">
            {zoom.toFixed(1)}x
          </span>
        </div>

        <div className="flex items-center gap-4">
          <label
            htmlFor="crop-rotation"
            className="w-16 shrink-0 text-sm font-semibold text-second"
          >
            Putar
          </label>

          <input
            id="crop-rotation"
            type="range"
            min={CROP_MIN_ROTATION}
            max={CROP_MAX_ROTATION}
            step={1}
            value={rotation}
            disabled={processing}
            onChange={(event) => setRotation(Number(event.target.value))}
            className={`min-w-0 flex-1 accent-second4 ${FOCUS_RING}`}
          />

          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-second/60">
            {rotation}°
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => rotateBy(-90)}
            disabled={processing}
            className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRotateCcw size={16} aria-hidden="true" />
            Kiri 90°
          </button>

          <button
            type="button"
            onClick={() => rotateBy(90)}
            disabled={processing}
            className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRotateCw size={16} aria-hidden="true" />
            Kanan 90°
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={processing || isDefault}
            className={`${BTN_BASE} text-second/60 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            Atur ulang
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancelAll}
            disabled={processing}
            className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            Batal
          </button>

          {remaining > 0 && (
            <button
              type="button"
              onClick={onSkip}
              disabled={processing}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              Lewati
            </button>
          )}

          <button
            type="button"
            onClick={handleApply}
            disabled={processing || !area}
            className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {processing ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Memproses…
              </>
            ) : (
              "Terapkan"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Gallery -------------------------------- */

function GalleryTile({
  preview,
  label,
  isPrimary,
  disabled,
  isDragging,
  isOver,
  onPrimary,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative aspect-square select-none overflow-hidden rounded-xl border bg-second/5 ${
        disabled ? "" : "cursor-grab active:cursor-grabbing"
      } ${
        isPrimary ? "col-span-2 row-span-2 border-second4" : "border-second/30"
      } ${isDragging ? "opacity-50" : ""} ${isOver ? "ring-2 ring-second4" : ""}`}
    >
      {/* pointer-events-none: supaya yang terseret adalah tile, bukan <img> */}
      <div className="pointer-events-none absolute inset-0">{preview}</div>

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
            MB. Gambar dipotong persegi (1:1) sebelum ditambahkan.
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
  const hasStrike = strike > price && price > 0;
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

  // [{ key, kind: "existing" | "new", image?, file? }] — item pertama = utama.
  const [gallery, setGallery] = useState([]);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [marketplaceUrls, setMarketplaceUrls] = useState({});
  const [dragging, setDragging] = useState(false); // drop file dari komputer
  const [dragKey, setDragKey] = useState(null); // tile yang sedang digeser
  const [overKey, setOverKey] = useState(null); // tile tujuan
  // Antrean file yang menunggu di-crop: [{ key, file }]. Item pertama = aktif.
  const [cropQueue, setCropQueue] = useState([]);

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

    // Gambar utama dipindah ke depan, sisanya tetap urutan dari server.
    const images = [...(camera.images ?? [])].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
    );

    setGallery(
      images.map((image) => ({
        key: `existing-${image.id}`,
        kind: "existing",
        image,
      })),
    );
    setGalleryDirty(false);

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

    // Hitung juga file yang masih mengantre di dialog crop.
    if (gallery.length + cropQueue.length + selectedFiles.length > MAX_IMAGES) {
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

    // Belum masuk galeri: antre dulu untuk di-crop, sesuai urutan dipilih.
    setCropQueue((previous) => [
      ...previous,
      ...selectedFiles.map((file) => ({
        key: `crop-${crypto.randomUUID()}`,
        file,
      })),
    ]);
  }

  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files ?? []);

    // Reset input agar file yang sama bisa dipilih kembali.
    event.target.value = "";

    addFiles(selectedFiles);
  }

  function handleDrop(event) {
    // Abaikan drag internal (geser urutan), hanya proses drop file.
    if (!isFileDrag(event)) return;

    event.preventDefault();
    setDragging(false);

    if (isSaving || gallery.length + cropQueue.length >= MAX_IMAGES) return;

    addFiles(Array.from(event.dataTransfer.files ?? []));
  }

  // Hasil crop masuk di akhir galeri, lalu lanjut ke file berikutnya.
  function handleCropDone(croppedFile) {
    setGallery((previous) => [
      ...previous,
      {
        key: `new-${crypto.randomUUID()}`,
        kind: "new",
        file: croppedFile,
      },
    ]);
    setGalleryDirty(true);
    clearError("images");
    setCropQueue((previous) => previous.slice(1));
  }

  function handleCropSkip() {
    setCropQueue((previous) => previous.slice(1));
  }

  function handleCropCancelAll() {
    setCropQueue([]);
  }

  function removeImage(key) {
    setGallery((previous) => previous.filter((item) => item.key !== key));
    setGalleryDirty(true);
  }

  // Pindahkan item `fromKey` ke posisi item `toKey` (dipakai "Jadikan utama").
  function moveImage(fromKey, toKey) {
    if (!fromKey || !toKey || fromKey === toKey) return;

    setGallery((previous) => {
      const from = previous.findIndex((item) => item.key === fromKey);
      const to = previous.findIndex((item) => item.key === toKey);

      if (from < 0 || to < 0) return previous;

      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      return next;
    });

    setGalleryDirty(true);
  }

  // Tukar posisi dua item (dipakai drag-and-drop).
  function swapImages(aKey, bKey) {
    if (!aKey || !bKey || aKey === bKey) return;

    setGallery((previous) => {
      const a = previous.findIndex((item) => item.key === aKey);
      const b = previous.findIndex((item) => item.key === bKey);

      if (a < 0 || b < 0) return previous;

      const next = [...previous];
      [next[a], next[b]] = [next[b], next[a]];

      return next;
    });

    setGalleryDirty(true);
  }

  function endDrag() {
    setDragKey(null);
    setOverKey(null);
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

    // Harga coret wajib bila promo dicentang. Tanpa promo tetap opsional.
    // Jika diisi, harus lebih tinggi dari harga jual.
    if (form.promo && form.strikethrough_price === "") {
      found.strikethrough_price = "Isi harga coret untuk produk promosi.";
    } else if (form.strikethrough_price !== "" && strikeNumber <= priceNumber) {
      found.strikethrough_price =
        "Harga coret harus lebih tinggi dari harga jual.";
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

    if (galleryDirty && gallery.length === 0) {
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

    if (gallery.length > MAX_IMAGES) {
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

    // Harga coret dikirim bila berubah, dengan atau tanpa promo.
    // Dikosongkan -> null (menghapus harga coret).
    const originalStrike =
      camera.strikethrough_price == null
        ? null
        : Number(camera.strikethrough_price);
    const nextStrike =
      form.strikethrough_price === "" ? null : Number(form.strikethrough_price);

    if (nextStrike !== originalStrike) {
      data.strikethrough_price = nextStrike;
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
        const keptItems = gallery.filter((item) => item.kind === "existing");
        const newItems = gallery.filter((item) => item.kind === "new");

        // Existing -> id gambar, baru -> "new:<index di daftar file yang diupload>"
        const tokenOf = (item) =>
          item.kind === "existing"
            ? item.image.id
            : `new:${newItems.indexOf(item)}`;

        const formData = new FormData();

        formData.append(
          "keep_image_ids",
          JSON.stringify(keptItems.map((item) => item.image.id)),
        );
        formData.append("primary", tokenOf(gallery[0])); // item pertama = utama
        formData.append("image_order", JSON.stringify(gallery.map(tokenOf)));

        newItems.forEach(({ file }) => {
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

  const totalImages = gallery.length;

  // Item pertama = gambar utama. Urutan array = urutan tampil.
  const primaryItem = gallery[0];

  const summaryPreview = primaryItem ? (
    primaryItem.kind === "existing" ? (
      primaryItem.image.image_url ? (
        <img
          src={primaryItem.image.image_url}
          alt="Gambar utama produk"
          draggable={false}
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

  const cropItem = cropQueue[0] ?? null;

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

              <FormField
                label="Harga coret"
                htmlFor="strikethrough_price"
                required={form.promo}
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
            </FieldGrid>

            <ToggleCard
              name="promo"
              checked={form.promo}
              onChange={updateField}
              disabled={isSaving}
              title="Produk promosi"
              description="Tandai produk sebagai promosi. Jika dicentang, harga coret wajib diisi."
            />

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
            description="Seret gambar untuk menukar posisinya. Gambar paling kiri atas adalah gambar utama dan tampil pertama di katalog."
            aside={
              <Tag tone="soft">
                {totalImages}/{MAX_IMAGES} gambar
              </Tag>
            }
          >
            <div
              onDragOver={(event) => {
                if (!isFileDrag(event)) return;
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
                  {gallery.map((item, index) => (
                    <GalleryTile
                      key={item.key}
                      label={
                        item.kind === "existing"
                          ? "gambar produk"
                          : item.file.name
                      }
                      isPrimary={index === 0}
                      disabled={isSaving}
                      isDragging={dragKey === item.key}
                      isOver={overKey === item.key && dragKey !== item.key}
                      onPrimary={() => moveImage(item.key, gallery[0].key)}
                      onRemove={() => removeImage(item.key)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", item.key); // wajib untuk Firefox
                        setDragKey(item.key);
                      }}
                      onDragOver={(event) => {
                        if (!dragKey) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setOverKey(item.key);
                      }}
                      onDrop={(event) => {
                        if (!dragKey) return;
                        event.preventDefault();
                        swapImages(dragKey, item.key);
                        endDrag();
                      }}
                      onDragEnd={endDrag}
                      preview={
                        item.kind === "existing" ? (
                          item.image.image_url ? (
                            <img
                              src={item.image.image_url}
                              alt="Gambar produk"
                              draggable={false}
                              className="h-full w-full object-cover"
                            />
                          ) : null
                        ) : (
                          <ImagePreview file={item.file} alt={item.file.name} />
                        )
                      }
                    />
                  ))}

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

      {cropItem && (
        <CropDialog
          key={cropItem.key}
          item={cropItem}
          remaining={cropQueue.length - 1}
          onDone={handleCropDone}
          onSkip={handleCropSkip}
          onCancelAll={handleCropCancelAll}
        />
      )}
    </div>
  );
}
