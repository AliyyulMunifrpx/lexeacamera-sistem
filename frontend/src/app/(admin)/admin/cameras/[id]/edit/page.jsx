"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBox,
  FiInfo,
  FiLoader,
  FiShoppingBag,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import {
  useGetAdminCamera,
  useUpdateAdminCameraDetails,
  useUpdateAdminCameraImages,
  useUpdateAdminCameraMarketplace,
} from "../../../../../features/admin-cameras/hooks.js";
import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";
import PrimaryButton from "../../../../../../components/primary-button.jsx";
import CancelButton from "../../../../../../components/cancel-button";
import { useGetAdminMarketplaces } from "../../../../../features/admin-marketplaces/hooks.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMA DENGAN HALAMAN EDIT OWNER)                             */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/*  Admin hanya boleh mengubah deskripsi, kelengkapan, galeri gambar, dan     */
/*  link marketplace.                                                         */
/*                                                                            */
/*  Galeri: satu array `gallery`. Item pertama = gambar utama. Urutan array   */
/*  = urutan tampil. Drag-and-drop memindahkan posisi item di array.          */
/*                                                                            */
/*  Upload: file yang dipilih masuk antrean crop (1:1), dipotong satu per     */
/*  satu, lalu hasilnya baru masuk ke galeri.                                 */
/* -------------------------------------------------------------------------- */

const MAX_IMAGES = 12;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_URL_LENGTH = 2048;
const MAX_TEXT_LENGTH = 1000;

const CROP_ASPECT = 1;
const CROP_MAX_OUTPUT = 1600;
const CROP_MAX_ZOOM = 3;
const CROP_QUALITY = 0.92;

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

function formatThousands(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatMoney(value) {
  const number = Number(value) || 0;

  return `Rp ${formatThousands(Math.abs(Math.round(number)))}`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

/* Potong gambar sesuai area piksel dari react-easy-crop -> File baru. */
async function getCroppedFile(src, area, originalFile) {
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

  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

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

/* Pesan error backend (err.response.data.errors) -> bahasa Indonesia */
const ERROR_MESSAGES = {
  CAMERA_NOT_FOUND: "Produk tidak ditemukan atau sudah dihapus.",
  MARKETPLACE_NOT_FOUND:
    "Ada marketplace yang tidak ditemukan atau sudah nonaktif. Muat ulang halaman lalu coba lagi.",
  CAMERA_UPDATE_CONFLICT:
    "Produk sedang diubah di tempat lain. Coba simpan lagi.",
  INVALID_KEEP_IMAGE_IDS: "Data gambar lama tidak valid. Muat ulang halaman.",
  CAMERA_IMAGES_REQUIRED: "Produk harus memiliki minimal satu gambar.",
  TOO_MANY_CAMERA_IMAGES: `Maksimal ${MAX_IMAGES} gambar secara keseluruhan.`,
  INVALID_PRIMARY_IMAGE: "Gambar utama yang dipilih tidak valid.",
  INVALID_IMAGE_FORMAT: "Ada file yang bukan gambar yang bisa diproses.",
  INVALID_IMAGE: "Ada file yang bukan gambar yang bisa diproses.",
  CAMERA_IMAGE_NOT_FOUND:
    "Ada gambar lama yang tidak ditemukan. Muat ulang halaman lalu coba lagi.",
  CAMERA_IMAGE_UPLOAD_FAILED:
    "Gagal mengunggah gambar ke penyimpanan. Tidak ada perubahan yang tersimpan.",
  CAMERA_BUCKET_NOT_CONFIGURED:
    "Konfigurasi penyimpanan server belum lengkap. Hubungi owner.",
};

function describeError(error) {
  const code = error?.response?.data?.errors;

  if (typeof code === "string" && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  return normalizeApiError(error).message;
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    soft: "bg-second/10 text-second",
    grad: "bg-grad text-primary",
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

function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  placeholder,
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
        <span className="ml-2 text-xs font-normal text-second/50">
          Opsional
        </span>
      </label>

      <textarea
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        rows={5}
        maxLength={MAX_TEXT_LENGTH}
        disabled={disabled}
        placeholder={placeholder}
        className={`${inputClass(Boolean(error))} resize-y`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-desc` : undefined}
      />

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {error && <ErrorText id={`${id}-desc`}>{error}</ErrorText>}
        </div>
        <p className="shrink-0 text-xs tabular-nums text-second/50">
          {value.length}/{MAX_TEXT_LENGTH}
        </p>
      </div>
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

  async function handleApply() {
    if (!area || !src || processing) return;

    setProcessing(true);

    try {
      const cropped = await getCroppedFile(src, area, item.file);
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
            className="text-sm font-semibold text-second"
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
      <dd className="min-w-0 break-words text-right text-sm font-semibold tabular-nums text-second">
        {children}
      </dd>
    </div>
  );
}

function ProductSummary({ camera, preview }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <h2 className="text-lg font-bold text-second">Produk</h2>

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
            {camera.name}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag>{camera.condition === "NEW" ? "Baru" : "Bekas"}</Tag>
            {camera.promo && <Tag tone="grad">Promo</Tag>}
          </div>
        </div>
      </div>

      <dl className="divide-y divide-second/10 border-y border-second/30">
        <SummaryRow label="SKU">{camera.sku ?? "—"}</SummaryRow>
        <SummaryRow label="Harga jual">{formatMoney(camera.price)}</SummaryRow>
        <SummaryRow label="Stok">{Number(camera.stock) || 0} unit</SummaryRow>
      </dl>

      <p className="flex items-start gap-2 text-sm text-second/60">
        <FiInfo size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        Admin dapat mengubah deskripsi, kelengkapan, galeri gambar, dan tautan
        marketplace.
      </p>
    </section>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function AdminEditCameraPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const initializedId = useRef(null);
  const galleryRef = useRef(null);
  const detailsRef = useRef(null);

  const cameraQuery = useGetAdminCamera(id);
  const marketplacesQuery = useGetAdminMarketplaces();
  const marketplaceList = Array.isArray(marketplacesQuery.data)
    ? marketplacesQuery.data
    : (marketplacesQuery.data?.data ?? []);

  const updateDetails = useUpdateAdminCameraDetails();
  const updateMarketplace = useUpdateAdminCameraMarketplace();
  const updateImages = useUpdateAdminCameraImages();

  const camera = cameraQuery.data;

  // Backend hanya menerima marketplace aktif.
  const availableMarketplaces = marketplaceList.filter(
    (item) => item.is_active !== false,
  );
  const [errors, setErrors] = useState({});
  const [urlErrors, setUrlErrors] = useState({});

  const [description, setDescription] = useState("");
  const [inclusions, setInclusions] = useState("");
  // [{ key, kind: "existing" | "new", image?, file? }] — item pertama = utama.
  const [gallery, setGallery] = useState([]);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [marketplaceUrls, setMarketplaceUrls] = useState({});
  const [dragging, setDragging] = useState(false); // drop file dari komputer
  const [dragKey, setDragKey] = useState(null); // tile yang sedang digeser
  const [overKey, setOverKey] = useState(null); // tile tujuan
  // Antrean file yang menunggu di-crop: [{ key, file }]. Item pertama = aktif.
  const [cropQueue, setCropQueue] = useState([]);

  const isSaving =
    updateDetails.isPending ||
    updateMarketplace.isPending ||
    updateImages.isPending;

  useEffect(() => {
    if (!camera || initializedId.current === camera.id) return;

    initializedId.current = camera.id;

    // Gambar utama dipindah ke depan, sisanya tetap urutan dari server.
    const images = [...(camera.images ?? [])].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
    );

    setDescription(camera.description ?? "");
    setInclusions(camera.inclusions ?? "");
    setGallery(
      images.map((image) => ({
        key: `existing-${image.id}`,
        kind: "existing",
        image,
      })),
    );
    setGalleryDirty(false);
    setErrors({});
    setUrlErrors({});

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

    notify.error(describeError(cameraQuery.error));
  }, [cameraQuery.isError, cameraQuery.error]);

  useEffect(() => {
    if (!marketplacesQuery.isError || !marketplacesQuery.error) return;

    notify.error(describeError(marketplacesQuery.error));
  }, [marketplacesQuery.isError, marketplacesQuery.error]);

  function handleTextChange(field, setter) {
    return (event) => {
      setter(event.target.value);
      setErrors((previous) =>
        previous[field] ? { ...previous, [field]: undefined } : previous,
      );
    };
  }

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
    setErrors((previous) => ({ ...previous, images: undefined }));
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

  // Pindahkan item `fromKey` ke posisi item `toKey`.
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

  function endDrag() {
    setDragKey(null);
    setOverKey(null);
  }

  function updateMarketplaceUrl(marketplaceId, value) {
    setMarketplaceUrls((previous) => ({
      ...previous,
      [marketplaceId]: value,
    }));

    setUrlErrors((previous) =>
      previous[marketplaceId]
        ? { ...previous, [marketplaceId]: undefined }
        : previous,
    );
  }
  // Tukar posisi dua item.
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
  function normalizeLinks(items = []) {
    return items
      .filter((item) => item.marketplace_id && item.product_url?.trim())
      .map((item) => ({
        marketplace_id: item.marketplace_id,
        product_url: item.product_url.trim(),
      }))
      .sort((a, b) => a.marketplace_id.localeCompare(b.marketplace_id));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!camera || isSaving) return;

    if (marketplacesQuery.isError || marketplacesQuery.isPending) {
      notify.error("Pastikan daftar marketplace berhasil dimuat.");
      return;
    }

    // Validasi
    const found = {};
    const foundUrls = {};

    const descriptionValue = description.trim();
    const inclusionsValue = inclusions.trim();

    if (descriptionValue.length > MAX_TEXT_LENGTH) {
      found.description = `Deskripsi maksimal ${MAX_TEXT_LENGTH} karakter.`;
    }

    if (inclusionsValue.length > MAX_TEXT_LENGTH) {
      found.inclusions = `Kelengkapan maksimal ${MAX_TEXT_LENGTH} karakter.`;
    }

    if (galleryDirty && gallery.length === 0) {
      found.images = "Produk harus memiliki minimal satu gambar.";
    }

    availableMarketplaces.forEach((marketplace) => {
      const value = (marketplaceUrls[marketplace.id] ?? "").trim();

      if (value === "") return;

      if (value.length > MAX_URL_LENGTH) {
        foundUrls[marketplace.id] = `URL maksimal ${MAX_URL_LENGTH} karakter.`;
      } else if (!isHttpUrl(value)) {
        foundUrls[marketplace.id] = "URL harus diawali http:// atau https://.";
      }
    });

    setErrors(found);
    setUrlErrors(foundUrls);

    if (found.description || found.inclusions) {
      detailsRef.current?.scrollIntoView({ block: "center" });
      return;
    }

    if (found.images) {
      galleryRef.current?.scrollIntoView({ block: "center" });
      return;
    }

    const firstUrlError = Object.keys(foundUrls)[0];

    if (firstUrlError) {
      document.getElementById(`marketplace-url-${firstUrlError}`)?.focus();
      return;
    }

    // Deskripsi dan kelengkapan: hanya kirim field yang berubah.
    const detailsPayload = {};

    if (descriptionValue !== (camera.description ?? "").trim()) {
      detailsPayload.description = descriptionValue;
    }

    if (inclusionsValue !== (camera.inclusions ?? "").trim()) {
      detailsPayload.inclusions = inclusionsValue;
    }

    const detailsChanged = Object.keys(detailsPayload).length > 0;

    // Marketplace: hanya kirim jika berubah.
    const marketplaceLinks = availableMarketplaces
      .map((marketplace) => ({
        marketplace_id: marketplace.id,
        product_url: (marketplaceUrls[marketplace.id] ?? "").trim(),
      }))
      .filter((item) => item.product_url !== "");

    const marketplaceChanged =
      JSON.stringify(normalizeLinks(marketplaceLinks)) !==
      JSON.stringify(normalizeLinks(camera.marketplaceLinks ?? []));

    if (!detailsChanged && !marketplaceChanged && !galleryDirty) {
      notify.error("Tidak ada perubahan untuk disimpan.");
      return;
    }

    const savedParts = [];
    let currentPart = "";

    try {
      if (detailsChanged) {
        currentPart = "deskripsi dan kelengkapan";

        await updateDetails.mutateAsync({ id, data: detailsPayload });
        savedParts.push("Deskripsi dan kelengkapan");
      }

      if (marketplaceChanged) {
        currentPart = "tautan marketplace";

        await updateMarketplace.mutateAsync({
          id,
          marketplace: marketplaceLinks,
        });
        savedParts.push("Tautan marketplace");
      }

      if (galleryDirty) {
        currentPart = "galeri";

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

        await updateImages.mutateAsync({ id, formData });
      }

      notify.success("Perubahan produk berhasil disimpan.");
      router.push(`/admin/cameras/${id}`);
    } catch (error) {
      const message = describeError(error);

      if (savedParts.length > 0) {
        notify.error(
          `${savedParts.join(" dan ")} berhasil disimpan, tetapi ${currentPart} gagal diperbarui. ${message}`,
        );
      } else {
        notify.error(message);
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
    const code = cameraQuery.error?.response?.data?.errors;
    const notFound =
      cameraQuery.error?.response?.status === 404 ||
      code === "CAMERA_NOT_FOUND";

    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-second/30 bg-primary px-4 py-16 text-center shadow-xl shadow-second/5">
        <div
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full bg-second2 text-primary"
        >
          <FiBox size={16} />
        </div>

        <div>
          <h2 className="font-semibold text-second">
            {notFound ? "Produk tidak ditemukan" : "Gagal memuat produk"}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            {notFound
              ? "Produk ini tidak ada atau sudah dihapus."
              : "Periksa koneksi Anda, lalu coba kembali."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/cameras"
            className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
          >
            Kembali
          </Link>

          {!notFound && (
            <button
              type="button"
              onClick={() => cameraQuery.refetch()}
              disabled={cameraQuery.isFetching}
              className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {cameraQuery.isFetching ? "Memuat…" : "Coba lagi"}
            </button>
          )}
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
    isSaving || marketplacesQuery.isPending || marketplacesQuery.isError;

  const cropItem = cropQueue[0] ?? null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={`/admin/cameras/${id}`}
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
              Perbarui deskripsi, kelengkapan, galeri gambar, dan tautan
              marketplace produk.
            </p>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3"
      >
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
          <FormSection
            sectionRef={detailsRef}
            title="Deskripsi dan kelengkapan"
            description="Deskripsi produk dan isi paket yang ikut dijual. Kosongkan kolom untuk menghapus isinya."
          >
            <TextAreaField
              id="description"
              label="Deskripsi"
              value={description}
              onChange={handleTextChange("description", setDescription)}
              error={errors.description}
              disabled={isSaving}
              placeholder="Contoh: Body mulus, shutter count rendah…"
            />

            <TextAreaField
              id="inclusions"
              label="Kelengkapan"
              value={inclusions}
              onChange={handleTextChange("inclusions", setInclusions)}
              error={errors.inclusions}
              disabled={isSaving}
              placeholder="Contoh: Charger, strap, kotak original…"
            />
          </FormSection>

          <FormSection
            sectionRef={galleryRef}
            title="Galeri gambar"
            description="Seret gambar untuk mengatur urutan. Gambar paling kiri atas adalah gambar utama dan tampil pertama di katalog."
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
                Belum ada marketplace aktif. Deskripsi, kelengkapan, dan galeri
                gambar tetap dapat diperbarui.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {availableMarketplaces.map((marketplace) => {
                  const fieldId = `marketplace-url-${marketplace.id}`;
                  const error = urlErrors[marketplace.id];

                  return (
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
                        <label htmlFor={fieldId} className={labelClass}>
                          {marketplace.name}
                          <span className="ml-2 text-xs font-normal text-second/50">
                            Opsional
                          </span>
                        </label>

                        <input
                          id={fieldId}
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
                          className={inputClass(Boolean(error))}
                          placeholder={`URL produk ${marketplace.name}…`}
                          maxLength={MAX_URL_LENGTH}
                          disabled={isSaving}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={
                            error ? `${fieldId}-desc` : undefined
                          }
                        />

                        {error && (
                          <ErrorText id={`${fieldId}-desc`}>{error}</ErrorText>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:-mt-4 xl:pt-4">
          <ProductSummary camera={camera} preview={summaryPreview} />

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

            <CancelButton href={`/admin/cameras/${id}`} disabled={isSaving}>
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
