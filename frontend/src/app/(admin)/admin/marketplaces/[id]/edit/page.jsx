"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiImage,
  FiLoader,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";

import {
  useGetMarketplaces,
  useUpdateMarketplace,
} from "../../../../../features/marketplaces/hooks.js";
import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const inputClass =
  "w-full rounded-xl border border-second/30 bg-primary px-4 py-3 text-sm text-second outline-none transition-colors placeholder:text-second/35 focus:border-second";

const labelClass = "mb-2 block text-sm font-medium text-second";

export default function EditMarketplacePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const initializedId = useRef(null);

  const query = useGetMarketplaces();
  const updateMarketplace = useUpdateMarketplace();

  const marketplaces = query.data ?? [];
  const marketplace = marketplaces.find((item) => item.id === id);

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");

  const isSaving = updateMarketplace.isPending;

  useEffect(() => {
    if (!marketplace || initializedId.current === marketplace.id) {
      return;
    }

    initializedId.current = marketplace.id;
    setName(marketplace.name ?? "");
    setIsActive(Boolean(marketplace.is_active));
    setLogo(null);
  }, [marketplace]);

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
    if (!query.isError || !query.error) return;

    const apiError = normalizeApiError(query.error);
    notify.error(apiError.message);
  }, [query.isError, query.error]);

  useEffect(() => {
    if (!updateMarketplace.isError || !updateMarketplace.error) {
      return;
    }

    const apiError = normalizeApiError(updateMarketplace.error);
    notify.error(apiError.message);
  }, [updateMarketplace.isError, updateMarketplace.error]);

  function handleLogoChange(event) {
    const file = event.target.files?.[0];
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

    if (!marketplace) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      notify.error("Nama marketplace wajib diisi.");
      return;
    }

    if (trimmedName.length > 100) {
      notify.error("Nama marketplace maksimal 100 karakter.");
      return;
    }

    const formData = new FormData();
    let hasChanges = false;

    if (trimmedName !== marketplace.name) {
      formData.append("name", trimmedName);
      hasChanges = true;
    }

    if (isActive !== Boolean(marketplace.is_active)) {
      formData.append("is_active", String(isActive));
      hasChanges = true;
    }

    if (logo) {
      formData.append("logo", logo);
      hasChanges = true;
    }

    if (!hasChanges) {
      notify.error("Tidak ada perubahan untuk disimpan.");
      return;
    }

    try {
      await updateMarketplace.mutateAsync({
        id,
        formData,
      });

      notify.success("Marketplace berhasil diperbarui.");
      router.push("/admin/marketplaces");
    } catch {
      // Pesan error ditampilkan oleh useEffect di atas.
    }
  }

  if (query.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-second/60">
        <FiLoader className="animate-spin" size={22} />
        Memuat data marketplace...
      </div>
    );
  }

  if (query.isError && !query.data) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-second/30 p-6 text-center">
        <FiImage size={36} className="text-second/30" />

        <h2 className="font-semibold text-second">Gagal memuat marketplace</h2>

        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="rounded-full bg-second px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!marketplace) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-second/30 p-6 text-center">
        <FiImage size={36} className="text-second/30" />

        <h2 className="font-semibold text-second">
          Marketplace tidak ditemukan
        </h2>

        <p className="text-sm text-second/60">
          Marketplace mungkin sudah dihapus atau ID tidak valid.
        </p>

        <Link
          href="/admin/marketplaces"
          className="rounded-full bg-second px-5 py-2.5 text-sm font-semibold text-primary"
        >
          Kembali ke marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-6 pb-10">
      <Link
        href="/admin/marketplaces"
        className="inline-flex items-center gap-2 text-sm text-second/60 transition-colors hover:text-second"
      >
        <FiArrowLeft size={18} />
        Kembali ke marketplace
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-second text-primary">
          <FiImage size={23} />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Edit Marketplace
          </h1>

          <p className="mt-1 text-sm text-second/60">
            Perbarui nama, logo, atau status marketplace.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Informasi marketplace</h2>

            <p className="mt-1 text-sm text-second/50">
              ID marketplace tidak dapat diubah.
            </p>
          </div>

          <div>
            <label htmlFor="marketplace-name" className={labelClass}>
              Nama marketplace
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
              disabled={isSaving}
            />

            <p className="mt-1.5 text-right text-xs text-second/40">
              {name.length}/100
            </p>
          </div>

          <div>
            <label className={labelClass}>Logo marketplace</label>

            <div className="flex flex-col gap-5 rounded-xl border border-second/30 p-4 sm:flex-row sm:items-center">
              <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-white p-3">
                {logoPreview || marketplace.logo_url ? (
                  <Image
                    src={logoPreview || marketplace.logo_url}
                    alt={`Logo ${name || marketplace.name}`}
                    width={160}
                    height={160}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <FiImage size={36} className="text-second/30" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-second">
                  {logo?.name ?? "Logo saat ini"}
                </p>

                <p className="mt-1 text-xs leading-5 text-second/50">
                  JPEG, PNG, atau WebP. Maksimal 5 MB. Logo lama akan diganti
                  setelah perubahan berhasil disimpan.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <label
                    htmlFor="marketplace-logo"
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-second/15 px-4 py-2.5 text-sm font-semibold text-second transition-colors hover:bg-second/5 ${
                      isSaving ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <FiUploadCloud size={16} />
                    Ganti logo
                    <input
                      id="marketplace-logo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleLogoChange}
                      disabled={isSaving}
                      className="sr-only"
                    />
                  </label>

                  {logo && (
                    <button
                      type="button"
                      onClick={() => setLogo(null)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-second/60 transition-colors hover:bg-second/5 hover:text-second disabled:opacity-50"
                    >
                      <FiX size={16} />
                      Batal ganti
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <h2 className="font-semibold text-second">Status marketplace</h2>

            <p className="mt-1 text-sm text-second/50">
              Menonaktifkan marketplace tidak menghapus tautan produk yang sudah
              terpasang pada kamera.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-second/30 p-4">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isSaving}
              className="mt-1 size-4 accent-current"
            />

            <span>
              <span className="block text-sm font-medium text-second">
                Marketplace aktif
              </span>

              <span className="mt-1 block text-xs text-second/50">
                {isActive
                  ? "Marketplace berstatus aktif."
                  : "Marketplace berstatus nonaktif."}
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
            disabled={isSaving}
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
