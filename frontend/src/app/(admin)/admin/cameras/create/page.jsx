"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image.js";
import {
  FiArrowLeft,
  FiCamera,
  FiLoader,
  FiUploadCloud,
  FiX,
  FiShoppingBag,
} from "react-icons/fi";

import { useCreateCamera } from "../../../../features/cameras/hooks.js";
import { useGetCategories } from "../../../../features/categories/hooks.js";
import { useGetMarketplaces } from "../../../../features/marketplaces/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

const MAX_IMAGES = 12;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const inputClass =
  "w-full rounded-xl border border-second/30 bg-primary px-4 py-3 text-sm text-second outline-none transition-colors placeholder:text-second/35 focus:border-second";

const labelClass = "mb-2 block text-sm font-medium text-second";

const initialForm = {
  name: "",
  price: "",
  condition: "NEW",
  stock: "",
  description: "",
  inclusions: "",
  category_id: "",
  promo: false,
  best_selling: false,
};

function FormField({ label, htmlFor, required, children, description }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {description && (
        <p className="mt-1.5 text-xs text-second/50">{description}</p>
      )}
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

export default function CreateCameraPage() {
  const router = useRouter();
  const createCamera = useCreateCamera();

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
  const [images, setImages] = useState([]);
  const [primaryKey, setPrimaryKey] = useState(null);
  const [marketplaceUrls, setMarketplaceUrls] = useState({});

  const isSubmitting = createCamera.isPending;

  // Jika gambar utama belum dipilih / sudah dihapus, gambar pertama otomatis jadi utama.
  const effectivePrimaryKey = images.some((image) => image.key === primaryKey)
    ? primaryKey
    : (images[0]?.key ?? null);

  function resetForm() {
    setForm(initialForm);
    setImages([]);
    setPrimaryKey(null);
    setMarketplaceUrls({});
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleImageChange(event) {
    const selectedFiles = Array.from(event.target.files ?? []);

    // Reset input agar file yang sama bisa dipilih kembali.
    event.target.value = "";

    if (images.length + selectedFiles.length > MAX_IMAGES) {
      notify.error(`Maksimal ${MAX_IMAGES} gambar untuk satu kamera.`);
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

  function handleSubmit(event) {
    event.preventDefault();

    if (images.length === 0) {
      notify.error("Tambahkan minimal satu gambar kamera.");
      return;
    }

    if (images.length > MAX_IMAGES) {
      notify.error(`Maksimal ${MAX_IMAGES} gambar untuk satu kamera.`);
      return;
    }

    if (categories.length === 0) {
      notify.error("Tambahkan kategori terlebih dahulu.");
      return;
    }

    if (marketplacesError) {
      notify.error("Daftar marketplace gagal dimuat. Silakan coba kembali.");
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
    formData.append("condition", form.condition);
    formData.append("stock", String(Number(form.stock)));
    formData.append("description", form.description.trim());
    formData.append("inclusions", form.inclusions.trim());
    formData.append("category_id", form.category_id);
    formData.append("promo", String(form.promo));
    formData.append("best_selling", String(form.best_selling));

    // Gambar pertama yang dikirim menjadi gambar utama,
    // jadi gambar yang dipilih sebagai utama dipindah ke urutan pertama.
    const orderedImages = [
      ...images.filter((image) => image.key === effectivePrimaryKey),
      ...images.filter((image) => image.key !== effectivePrimaryKey),
    ];

    orderedImages.forEach(({ file }) => {
      formData.append("images", file);
    });

    if (marketplaceLinks.length > 0) {
      formData.append("marketplace", JSON.stringify(marketplaceLinks));
    }

    createCamera.mutate(formData, {
      onSuccess: () => {
        resetForm();
        notify.success("Kamera berhasil ditambahkan.");
        router.push("/admin/cameras");
      },
      onError: (error) => {
        const normalizedError = normalizeApiError(error);
        notify.error(normalizedError.message || "Gagal menambahkan kamera.");
      },
    });
  }

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-6 pb-10">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-second/60 transition-colors hover:text-second"
      >
        <FiArrowLeft size={18} />
        Kembali
      </button>

      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-second text-primary">
          <FiCamera size={23} />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Tambah Kamera
          </h1>
          <p className="mt-1 text-sm text-second/60">
            Tambahkan kamera baru ke katalog penjualan.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Informasi produk</h2>
            <p className="mt-1 text-sm text-second/50">
              Informasi dasar kamera yang akan ditambahkan.
            </p>
          </div>

          <FormField label="Nama kamera" htmlFor="name" required>
            <input
              id="name"
              name="name"
              value={form.name}
              onChange={updateField}
              className={inputClass}
              placeholder="Contoh: Canon EOS R50"
              maxLength={100}
              required
              disabled={isSubmitting}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Harga jual" htmlFor="price" required>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-second/50">
                  Rp
                </span>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="any"
                  value={form.price}
                  onChange={updateField}
                  className={`${inputClass} pl-11`}
                  placeholder="12000000"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </FormField>

            <FormField label="Stok" htmlFor="stock" required>
              <input
                id="stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={updateField}
                className={inputClass}
                placeholder="3"
                required
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Kondisi" htmlFor="condition" required>
              <select
                id="condition"
                name="condition"
                value={form.condition}
                onChange={updateField}
                className={inputClass}
                required
                disabled={isSubmitting}
              >
                <option value="NEW">Baru</option>
                <option value="SECOND">Bekas</option>
              </select>
            </FormField>

            <FormField label="Kategori" htmlFor="category_id" required>
              <select
                id="category_id"
                name="category_id"
                value={form.category_id}
                onChange={updateField}
                className={inputClass}
                disabled={
                  isSubmitting ||
                  categoriesPending ||
                  categoriesError ||
                  categories.length === 0
                }
                required
              >
                <option value="">
                  {categoriesPending
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

              {categoriesError && (
                <button
                  type="button"
                  onClick={() => refetchCategories()}
                  className="mt-2 text-sm text-red-500 underline"
                >
                  Gagal memuat kategori. Coba lagi.
                </button>
              )}
            </FormField>
          </div>

          <FormField label="Deskripsi" htmlFor="description">
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={updateField}
              className={`${inputClass} min-h-28 resize-y`}
              placeholder="Jelaskan spesifikasi dan keunggulan kamera..."
              maxLength={1000}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-right text-xs text-second/40">
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
              className={`${inputClass} min-h-24 resize-y`}
              placeholder="Daftar barang yang disertakan..."
              maxLength={1000}
              disabled={isSubmitting}
            />
          </FormField>
        </section>

        <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Galeri gambar</h2>

            <p className="mt-1 text-sm text-second/50">
              JPEG, PNG, atau WebP. Maksimal {MAX_IMAGES} gambar, masing-masing
              5 MB. Pilih gambar utama atau hapus gambar yang tidak diperlukan.
            </p>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {images.map(({ key, file }) => {
                const isPrimary = effectivePrimaryKey === key;

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
                        onClick={() => setPrimaryKey(key)}
                        disabled={isSubmitting}
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
                        onClick={() => removeImage(key)}
                        disabled={isSubmitting}
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
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-second/50">
              {images.length}/{MAX_IMAGES} gambar
            </p>

            <label
              className={`inline-flex cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-second/15 px-4 py-2.5 text-sm font-semibold text-second transition-colors hover:bg-second/5 ${
                images.length >= MAX_IMAGES || isSubmitting
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
                disabled={images.length >= MAX_IMAGES || isSubmitting}
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
              Atur penanda khusus untuk kamera ini.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-second/30 p-4">
            <input
              type="checkbox"
              name="promo"
              checked={form.promo}
              onChange={updateField}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              Isi URL produk pada marketplace yang tersedia. Kosongkan jika
              kamera tidak tersedia di marketplace tersebut.
            </p>
          </div>

          {marketplacesPending ? (
            <div
              className="flex items-center justify-center gap-3 py-8 text-sm text-second/60"
              role="status"
            >
              <FiLoader className="animate-spin" size={20} />
              Memuat marketplace...
            </div>
          ) : marketplacesError ? (
            <div className="space-y-3 rounded-xl border border-red-500/20 p-4">
              <p className="text-sm text-second">
                Gagal memuat daftar marketplace.
              </p>
              <button
                type="button"
                onClick={() => refetchMarketplaces()}
                className="text-sm font-semibold text-second underline"
              >
                Coba lagi
              </button>
            </div>
          ) : availableMarketplaces.length === 0 ? (
            <p className="rounded-xl bg-second/[0.03] p-4 text-sm text-second/50">
              Belum ada marketplace yang tersedia. Kamera tetap dapat
              ditambahkan tanpa tautan marketplace.
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
                      disabled={isSubmitting}
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
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="rounded-full border border-second/15 px-6 py-3 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              categoriesPending ||
              categoriesError ||
              categories.length === 0 ||
              marketplacesPending ||
              marketplacesError
            }
            className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <FiLoader className="animate-spin" size={17} />
                Menyimpan kamera...
              </>
            ) : (
              "Simpan kamera"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
