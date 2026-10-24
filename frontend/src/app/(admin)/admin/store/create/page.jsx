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
  useCreateStore,
  useGetStore,
} from "../../../../features/store/hooks.js";

import BannerCropModal from "../../../../../components/admin/banner-crop-modal.jsx";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

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

const INPUT_CLASS =
  "w-full rounded-xl border border-second/20 bg-primary px-4 py-3 text-sm text-second outline-none transition placeholder:text-second/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

function validateImage(file) {
  if (!file) return "Pilih gambar terlebih dahulu.";

  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Format gambar harus PNG, JPEG, atau WebP.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "Ukuran gambar maksimal 5 MB.";
  }

  return "";
}

function ImageField({
  label,
  required = false,
  file,
  preview,
  error,
  onChange,
  description,
  disabled,
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-medium">
        {label}
        {required && <span className="ml-1">*</span>}
      </label>

      <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl border border-second/20 bg-second/5 p-3">
        {preview ? (
          <Image
            src={preview}
            alt={`Pratinjau ${label.toLowerCase()}`}
            width={1920}
            height={1080}
            unoptimized
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-second/50">
            <FiImage size={28} />
            <span className="text-xs">Belum ada gambar</span>
          </div>
        )}
      </div>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-second/25 px-4 py-3 text-sm font-medium transition hover:bg-second/10">
        <FiUploadCloud size={17} />
        {file ? "Pilih Gambar Lain" : "Pilih Gambar"}

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required={required}
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
        />
      </label>

      <p className="mt-2 text-xs leading-relaxed text-second/55">
        {description}
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

function LoadingState() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-8 w-48 rounded-lg bg-second/10" />
      <div className="h-48 rounded-2xl bg-second/10" />
      <div className="h-64 rounded-2xl bg-second/10" />
    </div>
  );
}

export default function CreateStorePage() {
  const router = useRouter();

  const {
    data: store,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetStore();

  const createMutation = useCreateStore();

  const [values, setValues] = useState(INITIAL_VALUES);

  const [logo, setLogo] = useState(null);
  const [mainBanner, setMainBanner] = useState(null);

  const [logoError, setLogoError] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [formError, setFormError] = useState("");

  const [logoPreview, setLogoPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");

  const [bannerToCrop, setBannerToCrop] = useState(null);

  const isStoreNotFound =
    isError && error?.response?.data?.errors === "STORE_NOT_FOUND";

  useEffect(() => {
    if (store) {
      router.replace("/admin/store");
    }
  }, [store, router]);

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

  // Bersihkan object URL sumber cropper setelah modal ditutup.
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

  // Logo tidak perlu melewati cropper.
  function handleLogoChange(event) {
    const selectedFile = event.target.files?.[0] ?? null;

    // Memungkinkan pengguna memilih ulang file yang sama.
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

  // Banner harus di-crop dahulu sebelum menjadi file yang akan di-upload.
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
    setBannerToCrop(null);
  }

  function handleCancelCrop() {
    setBannerToCrop(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const name = values.name.trim();
    const terms = values.terms_and_condition.trim();

    if (!name || !terms || !logo) {
      setFormError("Nama toko, syarat dan ketentuan, serta logo wajib diisi.");
      return;
    }

    const invalidLogo = validateImage(logo);

    if (invalidLogo) {
      setLogoError(invalidLogo);
      return;
    }

    if (mainBanner) {
      const invalidBanner = validateImage(mainBanner);

      if (invalidBanner) {
        setBannerError(invalidBanner);
        return;
      }
    }

    const formData = new FormData();

    formData.append("name", name);
    formData.append("terms_and_condition", terms);
    formData.append("logo", logo);

    if (mainBanner) {
      formData.append("main_banner", mainBanner);
    }

    for (const field of [
      "instagram",
      "whatsapp",
      "tiktok",
      "facebook",
      "address",
      "map_url",
    ]) {
      const value = values[field].trim();

      if (value) {
        formData.append(field, value);
      }
    }

    try {
      await createMutation.mutateAsync(formData);

      notify.success("Profil toko berhasil dibuat.");
      router.replace("/admin/store");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isLoading || store) {
    return <LoadingState />;
  }

  if (isError && !isStoreNotFound) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-second/15 px-5 py-12 text-center text-second">
        <FiAlertCircle size={30} />

        <h2 className="mt-4 font-semibold">Gagal Memuat Profil Toko</h2>

        <p className="mt-2 text-sm text-second/60">
          Profil toko tidak dapat diperiksa. Silakan coba kembali.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
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
            <h1 className="text-2xl font-bold">Buat Profil Toko</h1>

            <p className="mt-1 text-sm leading-relaxed text-second/65">
              Lengkapi identitas, informasi kontak, dan gambar toko. Toko hanya
              dapat dibuat satu kali.
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
              Logo wajib diisi, sedangkan banner utama bersifat opsional.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ImageField
              label="Logo Toko"
              required
              file={logo}
              preview={logoPreview}
              error={logoError}
              disabled={createMutation.isPending}
              onChange={handleLogoChange}
              description="PNG, JPEG, atau WebP. Maksimal 5 MB. Server memperkecil logo hingga 512 × 512 piksel tanpa memperbesar gambar kecil."
            />

            <ImageField
              label="Banner Utama"
              file={mainBanner}
              preview={bannerPreview}
              error={bannerError}
              disabled={createMutation.isPending}
              onChange={handleBannerSelect}
              description="Opsional. PNG, JPEG, atau WebP. Maksimal 5 MB. Crop gambar ke rasio 16:9 sebelum diunggah."
            />
          </div>
        </section>

        {/* Informasi umum */}
        <section className="space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Informasi Umum</h2>

            <p className="mt-1 text-sm text-second/60">
              Informasi utama yang menjadi identitas toko.
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
              disabled={createMutation.isPending}
              placeholder="Masukkan nama toko"
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
              disabled={createMutation.isPending}
              rows={7}
              placeholder="Tuliskan syarat dan ketentuan toko..."
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
              Semua informasi di bagian ini bersifat opsional.
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
                  disabled={createMutation.isPending}
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
              disabled={createMutation.isPending}
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
              disabled={createMutation.isPending}
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
            disabled={createMutation.isPending || Boolean(bannerToCrop)}
            className="rounded-xl bg-second px-5 py-3 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending
              ? "Membuat Profil..."
              : "Buat Profil Toko"}
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
