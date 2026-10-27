"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiCamera,
  FiLoader,
  FiShoppingBag,
  FiTrash2,
  FiUploadCloud,
  FiX,
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

const MAX_IMAGES = 12;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const inputClass =
  "w-full rounded-xl border border-second/30 bg-primary px-4 py-3 text-sm text-second outline-none transition-colors placeholder:text-second/35 focus:border-second";

const labelClass = "mb-2 block text-sm font-medium text-second";

const SKU_PREFIX = "WAV-";
const SKU_LENGTH = 4;

function formatThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

export default function EditCameraPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const initializedId = useRef(null);

  const cameraQuery = useGetCamera(id);
  const categoriesQuery = useGetCategories();
  const marketplacesQuery = useGetMarketplaces();

  const updateCamera = useUpdateCamera();
  const updateCameraImages = useUpdateCameraImages();

  const camera = cameraQuery.data;
  const categories = categoriesQuery.data ?? [];
  const availableMarketplaces = marketplacesQuery.data ?? [];

  const [form, setForm] = useState({
    name: "",
    price: "",
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
  });
  const priceInputRef = useRef(null);
  const skuInputRef = useRef(null);

  const pendingPriceCaret = useRef(null);
  const pendingSkuCaret = useRef(null);
  const [keptImages, setKeptImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [primarySelection, setPrimarySelection] = useState(null);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [marketplaceUrls, setMarketplaceUrls] = useState({});

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

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }
  function updatePrice(event) {
    const input = event.target;
    const cursorPosition = input.selectionStart ?? input.value.length;

    const digitsBeforeCursor = input.value
      .slice(0, cursorPosition)
      .replace(/\D/g, "").length;

    const digits = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

    pendingPriceCaret.current = Math.min(digitsBeforeCursor, digits.length);

    setForm((previous) => ({
      ...previous,
      price: digits,
    }));
  }

  function updateShutterCount(event) {
    const digits = event.target.value
      .replace(/\D/g, "")
      .replace(/^0+(?=\d)/, "");

    setForm((previous) => ({ ...previous, shutter_count: digits }));
  }

  function updateSku(event) {
    const input = event.target;
    const cursorPosition = input.selectionStart ?? input.value.length;

    const charactersBeforeCursor = input.value
      .slice(0, cursorPosition)
      .replace(/[^a-zA-Z0-9]/g, "").length;

    const value = input.value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, SKU_LENGTH);

    pendingSkuCaret.current = Math.min(charactersBeforeCursor, value.length);

    setForm((previous) => ({
      ...previous,
      sku: value,
    }));
  }
  useLayoutEffect(() => {
    if (pendingPriceCaret.current !== null && priceInputRef.current) {
      const input = priceInputRef.current;
      const digitCount = pendingPriceCaret.current;
      const formattedValue = formatThousands(form.price);

      let position = 0;
      let digitsFound = 0;

      while (position < formattedValue.length && digitsFound < digitCount) {
        if (/\d/.test(formattedValue[position])) {
          digitsFound++;
        }

        position++;
      }

      input.setSelectionRange(position, position);
      pendingPriceCaret.current = null;
    }

    if (pendingSkuCaret.current !== null && skuInputRef.current) {
      const input = skuInputRef.current;
      const position = Math.min(pendingSkuCaret.current, input.value.length);

      input.setSelectionRange(position, position);
      pendingSkuCaret.current = null;
    }
  }, [form.price, form.sku]);
  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

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

    if (additions.length > 0) setGalleryDirty(true);
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

  async function handleSubmit(event) {
    event.preventDefault();

    if (!camera) return;

    if (categories.length === 0) {
      notify.error("Tidak ada kategori yang tersedia.");
      return;
    }

    if (marketplacesQuery.isError || marketplacesQuery.isPending) {
      notify.error("Pastikan daftar marketplace berhasil dimuat.");
      return;
    }

    const sku = form.sku;
    const serialNumber = form.serial_number.trim();
    const color = form.color.trim();
    const shutterCount = form.shutter_count.trim();

    if (sku.length !== SKU_LENGTH) {
      notify.error(`SKU harus diisi ${SKU_LENGTH} karakter huruf atau angka.`);
      return;
    }

    if (!serialNumber || !color || !shutterCount) {
      notify.error("Serial number, warna, dan shutter count wajib diisi.");
      return;
    }

    const imageCount = keptImages.length + newImages.length;

    if (galleryDirty && imageCount === 0) {
      notify.error("Kamera harus memiliki minimal satu gambar.");
      return;
    }

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
      data.shutter_count = shutterCount; // <-- Kirim sebagai string murni
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

      notify.success("Perubahan kamera berhasil disimpan.");
      router.push(`/admin/cameras/${id}`);
    } catch (error) {
      const apiError = normalizeApiError(error);

      if (detailsSaved && galleryDirty) {
        notify.error(
          `Informasi kamera berhasil disimpan, tetapi galeri gagal diperbarui. ${apiError.message}`,
        );
      } else {
        notify.error(apiError.message);
      }
    }
  }

  if (cameraQuery.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-second/60">
        <FiLoader className="animate-spin" size={22} />
        Memuat detail kamera...
      </div>
    );
  }

  if (cameraQuery.isError || !camera) {
    return (
      <div className="space-y-4 rounded-2xl border border-second/30 p-6">
        <h2 className="font-semibold text-second">Gagal memuat kamera</h2>

        <p className="text-sm text-second/60">
          Periksa koneksi Anda, lalu coba kembali.
        </p>

        <div className="flex gap-3">
          <Link
            href="/admin/cameras"
            className="rounded-full border border-second/15 px-5 py-2.5 text-sm font-semibold text-second"
          >
            Kembali
          </Link>

          <button
            type="button"
            onClick={() => cameraQuery.refetch()}
            disabled={cameraQuery.isFetching}
            className="rounded-full bg-second px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {cameraQuery.isFetching ? "Memuat..." : "Coba lagi"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-6 pb-10">
      <Link
        href={`/admin/cameras/${id}`}
        className="inline-flex items-center gap-2 text-sm text-second/60 transition-colors hover:text-second"
      >
        <FiArrowLeft size={18} />
        Kembali ke detail kamera
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-second text-primary">
          <FiCamera size={23} />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Edit Kamera
          </h1>

          <p className="mt-1 text-sm text-second/60">
            Perbarui informasi, galeri gambar, dan marketplace kamera.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Informasi produk</h2>

            <p className="mt-1 text-sm text-second/50">
              Ubah informasi yang ingin diperbarui.
            </p>
          </div>

          <div>
            <label htmlFor="camera-name" className={labelClass}>
              Nama kamera <span className="text-red-500">*</span>
            </label>

            <input
              id="camera-name"
              name="name"
              value={form.name}
              onChange={updateField}
              maxLength={100}
              className={inputClass}
              placeholder="Contoh: Canon EOS R50"
              required
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="camera-price" className={labelClass}>
                Harga jual <span className="text-red-500">*</span>
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-second/50">
                  Rp
                </span>
                <input
                  ref={priceInputRef}
                  id="camera-price"
                  name="price"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatThousands(form.price)}
                  onChange={updatePrice}
                  className={`${inputClass} pl-11`}
                  placeholder="12.000.000"
                  required
                  disabled={isSaving}
                />
              </div>
            </div>

            <div>
              <label htmlFor="camera-stock" className={labelClass}>
                Stok <span className="text-red-500">*</span>
              </label>

              <input
                id="camera-stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={updateField}
                className={inputClass}
                placeholder="3"
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="camera-condition" className={labelClass}>
                Kondisi <span className="text-red-500">*</span>
              </label>

              <select
                id="camera-condition"
                name="condition"
                value={form.condition}
                onChange={updateField}
                className={inputClass}
                required
                disabled={isSaving}
              >
                <option value="NEW">Baru</option>
                <option value="SECOND">Bekas</option>
              </select>
            </div>

            <div>
              <label htmlFor="camera-category" className={labelClass}>
                Kategori <span className="text-red-500">*</span>
              </label>

              <select
                id="camera-category"
                name="category_id"
                value={form.category_id}
                onChange={updateField}
                className={inputClass}
                disabled={
                  isSaving ||
                  categoriesQuery.isPending ||
                  categoriesQuery.isError ||
                  categories.length === 0
                }
                required
              >
                <option value="">
                  {categoriesQuery.isPending
                    ? "Memuat kategori..."
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
                  className="mt-2 text-sm text-red-500 underline"
                >
                  Gagal memuat kategori. Coba lagi.
                </button>
              )}
            </div>

            <div>
              <label htmlFor="sku" className={labelClass}>
                SKU <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-second/50">
                  {SKU_PREFIX}
                </span>
                <input
                  ref={skuInputRef}
                  id="sku"
                  name="sku"
                  autoComplete="off"
                  value={form.sku}
                  onChange={updateSku}
                  className={`${inputClass} pl-14 uppercase`}
                  placeholder="A1B2"
                  maxLength={SKU_LENGTH}
                  minLength={SKU_LENGTH}
                  required
                  disabled={isSaving}
                />
              </div>
              <p className="mt-1.5 text-xs text-second/50">
                Isi {SKU_LENGTH} karakter huruf atau angka. Contoh: {SKU_PREFIX}
                A1B2
              </p>
            </div>

            <div>
              <label htmlFor="serial_number" className={labelClass}>
                Serial number <span className="text-red-500">*</span>
              </label>
              <input
                id="serial_number"
                name="serial_number"
                value={form.serial_number}
                onChange={updateField}
                className={inputClass}
                placeholder="Nomor seri yang tertera di body kamera"
                maxLength={100}
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="color" className={labelClass}>
                Warna <span className="text-red-500">*</span>
              </label>
              <input
                id="color"
                name="color"
                value={form.color}
                onChange={updateField}
                className={inputClass}
                placeholder="Contoh: Hitam"
                maxLength={50}
                required
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="shutter_count" className={labelClass}>
                Shutter count <span className="text-red-500">*</span>
              </label>
              <input
                id="shutter_count"
                name="shutter_count"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatThousands(form.shutter_count)}
                onChange={updateShutterCount}
                className={inputClass}
                placeholder="Contoh: 12.500"
                maxLength={20}
                required
                disabled={isSaving}
              />
              <p className="mt-1.5 text-xs text-second/50">
                Isi 0 jika kamera baru.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="camera-description" className={labelClass}>
              Deskripsi
            </label>

            <textarea
              id="camera-description"
              name="description"
              value={form.description}
              onChange={updateField}
              maxLength={1000}
              className={`${inputClass} min-h-28 resize-y`}
              placeholder="Jelaskan spesifikasi dan keunggulan kamera..."
              disabled={isSaving}
            />

            <p className="mt-1 text-right text-xs text-second/40">
              {form.description.length}/1000
            </p>
          </div>

          <div>
            <label htmlFor="camera-inclusions" className={labelClass}>
              Kelengkapan
            </label>

            <textarea
              id="camera-inclusions"
              name="inclusions"
              value={form.inclusions}
              onChange={updateField}
              maxLength={1000}
              className={`${inputClass} min-h-24 resize-y`}
              placeholder="Body, baterai, charger, strap."
              disabled={isSaving}
            />
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Galeri gambar</h2>

            <p className="mt-1 text-sm text-second/50">
              Maksimal {MAX_IMAGES} gambar gabungan. Pilih gambar utama, hapus
              gambar lama, atau tambahkan gambar baru.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {keptImages.map((image) => {
              const isPrimary =
                primarySelection?.type === "existing" &&
                primarySelection.id === image.id;

              return (
                <div
                  key={image.id}
                  className={`overflow-hidden rounded-xl border ${
                    isPrimary
                      ? "border-second ring-2 ring-second/20"
                      : "border-second/30"
                  }`}
                >
                  <div className="aspect-square bg-second/[0.03]">
                    {image.image_url && (
                      <img
                        src={image.image_url}
                        alt="Gambar kamera"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="space-y-2 p-2">
                    <button
                      type="button"
                      onClick={() => setExistingPrimary(image.id)}
                      disabled={isSaving}
                      className={`w-full rounded-lg px-2 py-2 text-xs font-semibold disabled:opacity-50 ${
                        isPrimary
                          ? "bg-second text-primary"
                          : "bg-second/5 text-second hover:bg-second/10"
                      }`}
                    >
                      {isPrimary ? "Gambar utama" : "Jadikan utama"}
                    </button>

                    <button
                      type="button"
                      onClick={() => removeExistingImage(image.id)}
                      disabled={isSaving}
                      className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-red-500 hover:bg-red-500/5 disabled:opacity-50"
                    >
                      <FiTrash2 size={13} />
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}

            {newImages.map(({ key, file }) => {
              const isPrimary =
                primarySelection?.type === "new" &&
                primarySelection.key === key;

              return (
                <div
                  key={key}
                  className={`overflow-hidden rounded-xl border ${
                    isPrimary
                      ? "border-second ring-2 ring-second/20"
                      : "border-second/30"
                  }`}
                >
                  <div className="aspect-square bg-second/[0.03]">
                    <ImagePreview file={file} alt={file.name} />
                  </div>

                  <div className="space-y-2 p-2">
                    <p className="truncate text-xs text-second/60">
                      {file.name}
                    </p>

                    <button
                      type="button"
                      onClick={() => setNewPrimary(key)}
                      disabled={isSaving}
                      className={`w-full rounded-lg px-2 py-2 text-xs font-semibold disabled:opacity-50 ${
                        isPrimary
                          ? "bg-second text-primary"
                          : "bg-second/5 text-second hover:bg-second/10"
                      }`}
                    >
                      {isPrimary ? "Gambar utama" : "Jadikan utama"}
                    </button>

                    <button
                      type="button"
                      onClick={() => removeNewImage(key)}
                      disabled={isSaving}
                      className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-red-500 hover:bg-red-500/5 disabled:opacity-50"
                    >
                      <FiX size={13} />
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-second/50">
              {keptImages.length + newImages.length}/{MAX_IMAGES} gambar
            </p>

            <label
              className={`inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-second/15 px-4 py-2.5 text-sm font-semibold text-second transition-colors hover:bg-second/5 ${
                keptImages.length + newImages.length >= MAX_IMAGES || isSaving
                  ? "pointer-events-none opacity-40"
                  : ""
              }`}
            >
              <FiUploadCloud size={17} />
              Tambah gambar
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={
                  keptImages.length + newImages.length >= MAX_IMAGES || isSaving
                }
                onChange={handleImageChange}
                className="sr-only"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Status katalog</h2>

            <p className="mt-1 text-sm text-second/50">
              Perbarui penanda promosi dan best seller.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-second/30 p-4">
            <input
              type="checkbox"
              name="promo"
              checked={form.promo}
              onChange={updateField}
              disabled={isSaving}
              className="mt-1 size-4 accent-current"
            />

            <span>
              <span className="block text-sm font-medium text-second">
                Kamera promosi
              </span>
              <span className="mt-1 block text-xs text-second/50">
                Tandai kamera sebagai produk promosi.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-second/30 p-4">
            <input
              type="checkbox"
              name="best_selling"
              checked={form.best_selling}
              onChange={updateField}
              disabled={isSaving}
              className="mt-1 size-4 accent-current"
            />

            <span>
              <span className="block text-sm font-medium text-second">
                Best seller
              </span>
              <span className="mt-1 block text-xs text-second/50">
                Tandai kamera sebagai salah satu produk terlaris.
              </span>
            </span>
          </label>
        </section>

        <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">
              Tautan produk marketplace
            </h2>

            <p className="mt-1 text-sm text-second/50">
              URL yang sudah tersimpan akan ditampilkan otomatis. Kosongkan jika
              kamera tidak tersedia di marketplace tersebut.
            </p>
          </div>

          {marketplacesQuery.isPending ? (
            <div
              className="flex items-center justify-center gap-3 py-8 text-sm text-second/60"
              role="status"
            >
              <FiLoader className="animate-spin" size={20} />
              Memuat marketplace...
            </div>
          ) : marketplacesQuery.isError ? (
            <div className="space-y-3 rounded-xl border border-red-500/20 p-4">
              <p className="text-sm text-second">
                Gagal memuat daftar marketplace.
              </p>

              <button
                type="button"
                onClick={() => marketplacesQuery.refetch()}
                className="text-sm font-semibold text-second underline"
              >
                Coba lagi
              </button>
            </div>
          ) : availableMarketplaces.length === 0 ? (
            <p className="rounded-xl bg-second/[0.03] p-4 text-sm text-second/50">
              Belum ada marketplace yang tersedia.
            </p>
          ) : (
            <div className="space-y-4">
              {availableMarketplaces.map((marketplace) => (
                <div
                  key={marketplace.id}
                  className="flex flex-col gap-4 rounded-xl border border-second/30 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-white p-2">
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
                      <FiShoppingBag size={22} className="text-second/40" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`marketplace-url-${marketplace.id}`}
                      className={labelClass}
                    >
                      {marketplace.name}
                    </label>

                    <input
                      id={`marketplace-url-${marketplace.id}`}
                      type="url"
                      value={marketplaceUrls[marketplace.id] ?? ""}
                      onChange={(event) =>
                        updateMarketplaceUrl(marketplace.id, event.target.value)
                      }
                      className={inputClass}
                      placeholder={`URL produk ${marketplace.name} (opsional)`}
                      disabled={isSaving}
                    />
                  </div>

                  {!marketplace.is_active && (
                    <span className="self-start rounded-full bg-second/5 px-3 py-1.5 text-xs text-second/50 sm:self-center">
                      Nonaktif
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-second/30 pt-5 sm:flex-row sm:justify-end">
          <Link
            href={`/admin/cameras/${id}`}
            aria-disabled={isSaving}
            className={`rounded-full border border-second/15 px-6 py-3 text-center text-sm font-semibold text-second hover:bg-second/5 ${
              isSaving ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={
              isSaving ||
              categoriesQuery.isPending ||
              categoriesQuery.isError ||
              categories.length === 0 ||
              marketplacesQuery.isPending ||
              marketplacesQuery.isError
            }
            className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <FiLoader className="animate-spin" size={17} />
                Menyimpan perubahan...
              </>
            ) : (
              "Simpan perubahan"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
