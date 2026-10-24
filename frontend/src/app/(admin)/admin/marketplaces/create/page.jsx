"use client";

import { useEffect, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiImage,
  FiLoader,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import { useCreateMarketplace } from "../../../../features/marketplaces/hooks.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const inputClass =
  "w-full rounded-xl border border-second/30 bg-primary px-4 py-3 text-sm text-second outline-none transition-colors placeholder:text-second/35 focus:border-second";

const labelClass = "mb-2 block text-sm font-medium text-second";

export default function CreateMarketplacePage() {
  const router = useRouter();
  const createMarketplace = useCreateMarketplace();

  const [name, setName] = useState("");
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!logo) {
      setLogoPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(logo);
    setLogoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [logo]);

  function handleLogoChange(event) {
    const file = event.target.files?.[0];

    // Memungkinkan file yang sama dipilih kembali.
    event.target.value = "";

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      notify.error("Format logo harus JPEG, PNG, atau WebP.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      notify.error("Ukuran logo maksimal 5 MB.");
      return;
    }

    setLogo(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      notify.error("Nama marketplace wajib diisi.");
      return;
    }

    if (trimmedName.length > 100) {
      notify.error("Nama marketplace maksimal 100 karakter.");
      return;
    }

    if (!logo) {
      notify.error("Logo marketplace wajib diunggah.");
      return;
    }

    const formData = new FormData();
    formData.append("name", trimmedName);
    formData.append("logo", logo);
    formData.append("is_active", String(isActive));

    try {
      await createMarketplace.mutateAsync(formData);

      notify.success("Marketplace berhasil ditambahkan.");
      router.push("/admin/marketplaces");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  const isSubmitting = createMarketplace.isPending;

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-6 pb-10">
      <Link
        href="/admin/marketplaces"
        className="inline-flex items-center gap-2 text-sm text-second/60 transition-colors hover:text-second"
      >
        <FiArrowLeft size={18} />
        Kembali ke toko online
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-second text-primary">
          <FiImage size={23} />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Tambah Toko Online
          </h1>
          <p className="mt-1 text-sm text-second/60">
            Tambahkan toko online beserta logo dan statusnya.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Informasi toko online</h2>
            <p className="mt-1 text-sm text-second/50">
              Masukkan nama yang unik untuk toko online ini.
            </p>
          </div>

          <div>
            <label htmlFor="marketplace-name" className={labelClass}>
              Nama toko online
              <span className="ml-1 text-red-500">*</span>
            </label>

            <input
              id="marketplace-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Contoh: Shopee"
              maxLength={100}
              required
            />

            <p className="mt-1.5 text-right text-xs text-second/40">
              {name.length}/100
            </p>
          </div>

          <div>
            <label htmlFor="marketplace-logo" className={labelClass}>
              Logo toko online
              <span className="ml-1 text-red-500">*</span>
            </label>

            <label
              htmlFor="marketplace-logo"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-5 py-8 text-center transition-colors hover:border-second/50 hover:bg-second/[0.03]"
            >
              <FiUploadCloud size={32} className="text-second/50" />

              <span className="mt-3 text-sm font-semibold text-second">
                Pilih logo toko online
              </span>

              <span className="mt-1 text-xs text-second/50">
                JPEG, PNG, atau WebP · Maksimal 5 MB
              </span>

              <input
                id="marketplace-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoChange}
                className="sr-only"
              />
            </label>

            {logo && (
              <div className="mt-4 flex items-center gap-4 rounded-xl border border-second/30 p-4">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-white p-2">
                  {logoPreview && (
                    <Image
                      src={logoPreview}
                      alt="Pratinjau logo marketplace"
                      width={128}
                      height={128}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-second">
                    {logo.name}
                  </p>
                  <p className="mt-1 text-xs text-second/50">
                    {(logo.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  disabled={isSubmitting}
                  aria-label="Hapus logo yang dipilih"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-second/50 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                >
                  <FiX size={18} />
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Status toko online</h2>
            <p className="mt-1 text-sm text-second/50">
              Toko online baru secara default berstatus aktif.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-second/30 p-4">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isSubmitting}
              className="mt-1 size-4 accent-current"
            />

            <span>
              <span className="block text-sm font-medium text-second">
                Toko online aktif
              </span>
              <span className="mt-1 block text-xs text-second/50">
                Toko online dapat digunakan selama statusnya aktif.
              </span>
            </span>
          </label>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-second/10 pt-5 sm:flex-row sm:justify-end">
          <Link
            href="/admin/marketplaces"
            className="inline-flex items-center justify-center rounded-full border border-second/15 px-6 py-3 text-sm font-semibold text-second transition-colors hover:bg-second/5"
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <FiLoader className="animate-spin" size={17} />
                Menyimpan toko online...
              </>
            ) : (
              "Simpan toko online"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
