"use client";

import { useEffect, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiImage,
  FiShoppingBag,
  FiUploadCloud,
} from "react-icons/fi";

import {
  useGetStore,
  useUpdateStore,
} from "../../../../features/store/hooks.js";

import BannerCropModal from "../../../../../components/admin/banner-crop-modal.jsx";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

const TEXT_FIELDS = [
  "name",
  "terms_and_condition",
  "instagram",
  "whatsapp",
  "tiktok",
  "facebook",
  "address",
  "map_url",
];

const INPUT_CLASS =
  "w-full rounded-xl border border-second/20 bg-primary px-4 py-3 text-sm text-second outline-none transition placeholder:text-second/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";
const INITIAL_VALUES = {
  name: "",
  terms_and_condition: "",
  instagram: "",
  whatsapp: "",
  tiktok: "",
  facebook: "",
  address: "",
  map_url: "",
};
function getStoreValues(store) {
  return {
    name: store.name ?? "",
    terms_and_condition: store.terms_and_condition ?? "",
    instagram: store.instagram ?? "",
    whatsapp: store.whatsapp ?? "",
    tiktok: store.tiktok ?? "",
    facebook: store.facebook ?? "",
    address: store.address ?? "",
    map_url: store.map_url ?? "",
  };
}

function validateImage(file) {
  if (!file) return "";

  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Format gambar harus PNG, JPEG, atau WebP.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "Ukuran gambar maksimal 5 MB.";
  }

  return "";
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-8 w-48 rounded-lg bg-second/10" />
      <div className="h-48 rounded-2xl bg-second/10" />
      <div className="h-64 rounded-2xl bg-second/10" />
      <div className="h-40 rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-second/15 px-5 py-12 text-center">
      <FiAlertCircle size={30} />

      <h2 className="mt-4 font-semibold">Gagal Memuat Profil Toko</h2>

      <p className="mt-2 text-sm text-second/60">
        Periksa koneksi atau sesi Anda, kemudian coba kembali.
      </p>

      <button
        type="button"
        onClick={onRetry}
        disabled={isFetching}
        className="mt-5 rounded-xl border border-second/25 px-4 py-2.5 text-sm transition hover:bg-second/10 disabled:opacity-50"
      >
        {isFetching ? "Memuat..." : "Coba Lagi"}
      </button>

      <Link
        href="/admin/store"
        className="mt-4 text-sm underline underline-offset-4"
      >
        Kembali ke Profil Toko
      </Link>
    </div>
  );
}

function ImageField({
  label,
  currentImage,
  preview,
  file,
  error,
  onChange,
  disabled,
  isLogo = false,
}) {
  const aspectClass = isLogo ? "aspect-square" : "aspect-[3/1]";

  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-medium">{label}</label>

      <div
        className={`flex ${aspectClass} items-center justify-center overflow-hidden rounded-xl border border-second/20 bg-second/5 p-3`}
      >
        {preview ? (
          <Image
            src={preview}
            alt={`Pratinjau ${label.toLowerCase()}`}
            width={isLogo ? 512 : 3000}
            height={isLogo ? 512 : 1080}
            unoptimized
            className="h-full w-full object-contain"
          />
        ) : currentImage ? (
          <Image
            src={currentImage}
            alt={label}
            width={isLogo ? 512 : 3000}
            height={isLogo ? 512 : 1000}
            unoptimized
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-second/50">
            <FiImage size={28} />
            <span className="text-xs">
              {isLogo ? "Logo belum tersedia" : "Banner tidak tersedia"}
            </span>
          </div>
        )}
      </div>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-second/25 px-4 py-3 text-sm font-medium transition hover:bg-second/10">
        <FiUploadCloud size={17} />
        {file ? "Pilih Gambar Lain" : "Ganti Gambar"}

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
        />
      </label>

      <p className="mt-2 text-xs leading-relaxed text-second/55">
        PNG, JPEG, atau WebP. Maksimal 5 MB.
        {isLogo
          ? " Gambar diperkecil oleh server hingga 512 × 512 piksel."
          : " Crop gambar ke rasio 16:9 sebelum diunggah. Server memperkecil banner hingga 1920 × 1080 piksel."}
      </p>

      {file && (
        <p className="mt-2 break-all text-xs text-second/70">
          {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default function EditStorePage() {
  const router = useRouter();

  const {
    data: store,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetStore();

  const updateMutation = useUpdateStore();

  const [values, setValues] = useState(INITIAL_VALUES);
  const [initialValues, setInitialValues] = useState(null);

  const [logo, setLogo] = useState(null);
  const [mainBanner, setMainBanner] = useState(null);

  const [logoPreview, setLogoPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");

  const [logoError, setLogoError] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [formError, setFormError] = useState("");
  const [removeMainBanner, setRemoveMainBanner] = useState(false);

  const [bannerToCrop, setBannerToCrop] = useState(null);

  const isStoreNotFound =
    isError && error?.response?.data?.errors === "STORE_NOT_FOUND";

  useEffect(() => {
    if (!store) return;

    const nextValues = getStoreValues(store);

    setValues(nextValues);
    setInitialValues(nextValues);
    setLogo(null);
    setMainBanner(null);
    setLogoError("");
    setBannerError("");
    setFormError("");
    setRemoveMainBanner(false);
  }, [store]);

  useEffect(() => {
    if (isStoreNotFound) {
      router.replace("/admin/store");
    }
  }, [isStoreNotFound, router]);

  useEffect(() => {
    if (isError && !isStoreNotFound) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }, [isError, error, isStoreNotFound]);

  useEffect(() => {
    if (!logo) {
      setLogoPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(logo);

    setLogoPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [logo]);

  useEffect(() => {
    if (!mainBanner) {
      setBannerPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(mainBanner);

    setBannerPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [mainBanner]);

  // Object URL gambar sumber yang sedang dibuka di cropper.
  useEffect(() => {
    const sourceUrl = bannerToCrop?.src;

    if (!sourceUrl) return;

    return () => URL.revokeObjectURL(sourceUrl);
  }, [bannerToCrop?.src]);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    setFormError("");
  }

  // Logo tidak memerlukan cropper.
  function handleLogoChange(event) {
    const selectedFile = event.target.files?.[0] ?? null;

    // Memungkinkan file yang sama dipilih kembali.
    event.target.value = "";

    if (!selectedFile) return;

    const validationError = validateImage(selectedFile);

    if (validationError) {
      setLogoError(validationError);
      return;
    }

    setLogo(selectedFile);
    setLogoError("");
    setFormError("");
  }

  // Banner harus melewati cropper sebelum bisa di-upload.
  function handleBannerSelect(event) {
    const selectedFile = event.target.files?.[0] ?? null;

    event.target.value = "";

    if (!selectedFile) return;

    const validationError = validateImage(selectedFile);

    if (validationError) {
      setBannerError(validationError);
      return;
    }

    setBannerError("");
    setFormError("");

    setBannerToCrop({
      file: selectedFile,
      src: URL.createObjectURL(selectedFile),
    });
  }

  function handleBannerCrop(croppedFile) {
    const validationError = validateImage(croppedFile);

    if (validationError) {
      setBannerError(validationError);
      return;
    }

    setMainBanner(croppedFile);
    setBannerError("");
    setFormError("");
    setRemoveMainBanner(false);
    setBannerToCrop(null);
  }

  function handleCancelCrop() {
    setBannerToCrop(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!store || !initialValues) return;

    const name = values.name.trim();
    const terms = values.terms_and_condition.trim();

    if (!name || !terms) {
      setFormError("Nama toko dan syarat dan ketentuan tidak boleh kosong.");
      return;
    }

    const invalidLogo = validateImage(logo);

    if (invalidLogo) {
      setLogoError(invalidLogo);
      return;
    }

    const invalidBanner = validateImage(mainBanner);

    if (invalidBanner) {
      setBannerError(invalidBanner);
      return;
    }

    if (removeMainBanner && mainBanner) {
      setFormError(
        "Banner tidak bisa diganti dan dihapus dalam satu permintaan.",
      );
      return;
    }

    const formData = new FormData();
    let changes = 0;

    // Hanya kirim field teks yang berubah.
    for (const field of TEXT_FIELDS) {
      const currentValue = values[field].trim();
      const originalValue = (initialValues[field] ?? "").trim();

      if (currentValue !== originalValue) {
        formData.append(field, currentValue);
        changes += 1;
      }
    }

    if (logo) {
      formData.append("logo", logo);
      changes += 1;
    }

    if (mainBanner) {
      formData.append("main_banner", mainBanner);
      changes += 1;
    } else if (removeMainBanner) {
      formData.append("remove_main_banner", "true");
      changes += 1;
    }

    if (changes === 0) {
      setFormError("Belum ada perubahan yang perlu disimpan.");
      return;
    }

    try {
      await updateMutation.mutateAsync(formData);

      notify.success("Profil toko berhasil diperbarui.");
      router.replace("/admin/store");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isLoading || isStoreNotFound || (store && !initialValues)) {
    return <LoadingState />;
  }

  if (isError && !store) {
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
  }

  if (!store || !initialValues) {
    return <LoadingState />;
  }

  const isSaving = updateMutation.isPending;

  const currentBanner = removeMainBanner ? null : store.main_banner_url;

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-8 text-second">
      <div>
        <Link
          href="/admin/store"
          className="inline-flex items-center gap-2 text-sm text-second/65 transition hover:text-second"
        >
          <FiArrowLeft size={17} />
          Kembali ke Profil Toko
        </Link>

        <div className="mt-5 flex items-start gap-4">
          <div className="rounded-xl bg-second/10 p-3">
            <FiShoppingBag size={24} />
          </div>

          <div>
            <h1 className="text-2xl font-bold">Ubah Profil Toko</h1>

            <p className="mt-1 text-sm leading-relaxed text-second/65">
              Perbarui informasi dan gambar toko. Field yang tidak diubah akan
              tetap menggunakan data sebelumnya.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Gambar toko */}
        <section className="space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Gambar Toko</h2>

            <p className="mt-1 text-sm text-second/60">
              Pilih gambar hanya jika ingin mengganti gambar saat ini.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ImageField
              label="Logo Toko"
              currentImage={store.logo_url}
              preview={logoPreview}
              file={logo}
              error={logoError}
              disabled={isSaving}
              isLogo
              onChange={handleLogoChange}
            />

            <div>
              <ImageField
                label="Banner Utama"
                currentImage={currentBanner}
                preview={bannerPreview}
                file={mainBanner}
                error={bannerError}
                disabled={isSaving}
                onChange={handleBannerSelect}
              />

              {store.main_banner_url && !mainBanner && (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-second/15 p-3 text-sm transition hover:bg-second/5">
                  <input
                    type="checkbox"
                    checked={removeMainBanner}
                    disabled={isSaving}
                    onChange={(event) => {
                      setRemoveMainBanner(event.target.checked);
                      setFormError("");
                    }}
                    className="mt-0.5 accent-current"
                  />

                  <span>
                    <span className="block font-medium">
                      Hapus banner utama
                    </span>

                    <span className="mt-1 block text-xs leading-relaxed text-second/60">
                      Banner akan dihapus saat perubahan disimpan.
                    </span>
                  </span>
                </label>
              )}
            </div>
          </div>
        </section>

        {/* Informasi umum */}
        <section className="space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Informasi Umum</h2>

            <p className="mt-1 text-sm text-second/60">
              Nama toko dan syarat dan ketentuan.
            </p>
          </div>

          <div>
            <label
              htmlFor="store-name"
              className="mb-2 block text-sm font-medium"
            >
              Nama Toko *
            </label>

            <input
              id="store-name"
              name="name"
              value={values.name}
              onChange={handleChange}
              maxLength={100}
              required
              disabled={isSaving}
              className={INPUT_CLASS}
            />

            <p className="mt-1 text-right text-xs text-second/50">
              {values.name.length}/100
            </p>
          </div>

          <div>
            <label
              htmlFor="store-terms"
              className="mb-2 block text-sm font-medium"
            >
              Syarat dan Ketentuan *
            </label>

            <textarea
              id="store-terms"
              name="terms_and_condition"
              value={values.terms_and_condition}
              onChange={handleChange}
              maxLength={3000}
              required
              disabled={isSaving}
              rows={7}
              className={`${INPUT_CLASS} resize-y`}
            />

            <p className="mt-1 text-right text-xs text-second/50">
              {values.terms_and_condition.length}/3000
            </p>
          </div>
        </section>

        {/* Informasi kontak */}
        <section className="space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Informasi Kontak</h2>

            <p className="mt-1 text-sm text-second/60">
              Kosongkan field untuk menghapus informasi kontak yang tersimpan.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[
              {
                name: "instagram",
                label: "Instagram",
                placeholder: "@namatoko",
              },
              {
                name: "whatsapp",
                label: "WhatsApp",
                placeholder: "6281234567890",
              },
              {
                name: "tiktok",
                label: "TikTok",
                placeholder: "@namatoko",
              },
              {
                name: "facebook",
                label: "Facebook",
                placeholder: "Nama atau akun Facebook",
              },
            ].map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={`store-${field.name}`}
                  className="mb-2 block text-sm font-medium"
                >
                  {field.label}
                </label>

                <input
                  id={`store-${field.name}`}
                  name={field.name}
                  value={values[field.name]}
                  onChange={handleChange}
                  maxLength={100}
                  disabled={isSaving}
                  placeholder={field.placeholder}
                  className={INPUT_CLASS}
                />

                <p className="mt-1 text-right text-xs text-second/50">
                  {values[field.name].length}/100
                </p>
              </div>
            ))}
          </div>

          <div>
            <label
              htmlFor="store-address"
              className="mb-2 block text-sm font-medium"
            >
              Alamat Toko
            </label>

            <textarea
              id="store-address"
              name="address"
              value={values.address}
              onChange={handleChange}
              maxLength={255}
              rows={3}
              disabled={isSaving}
              placeholder="Masukkan alamat toko"
              className={`${INPUT_CLASS} resize-y`}
            />

            <p className="mt-1 text-right text-xs text-second/50">
              {values.address.length}/255
            </p>
          </div>

          <div>
            <label
              htmlFor="store-map-url"
              className="mb-2 block text-sm font-medium"
            >
              Link Google Maps
            </label>

            <input
              id="store-map-url"
              name="map_url"
              type="url"
              value={values.map_url}
              onChange={handleChange}
              maxLength={500}
              disabled={isSaving}
              placeholder="https://maps.app.goo.gl/..."
              className={INPUT_CLASS}
            />

            <p className="mt-1 text-right text-xs text-second/50">
              {values.map_url.length}/500
            </p>
          </div>
        </section>

        {formError && (
          <p
            role="alert"
            className="flex items-start gap-2 text-sm text-red-400"
          >
            <FiAlertCircle className="mt-0.5 shrink-0" />
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-second/15 pt-5 sm:flex-row sm:justify-end">
          <Link
            href="/admin/store"
            className="rounded-xl border border-second/25 px-5 py-3 text-center text-sm font-medium transition hover:bg-second/10"
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={isSaving || Boolean(bannerToCrop)}
            className="rounded-xl bg-second px-5 py-3 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>

      {bannerToCrop && (
        <BannerCropModal
          imageSrc={bannerToCrop.src}
          sourceFile={bannerToCrop.file}
          onCancel={handleCancelCrop}
          onConfirm={handleBannerCrop}
        />
      )}
    </div>
  );
}
