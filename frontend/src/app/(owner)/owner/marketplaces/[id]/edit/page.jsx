"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
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
import PrimaryButton from "../../../../../../components/primary-button.jsx";
import CancelButton from "../../../../../../components/cancel-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN CREATE MARKETPLACE / CUSTOMER CREATE)        */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

/* ------------------------------ Small pieces ------------------------------ */

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

function Field({ id, label, required, error, hint, children }) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
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

      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : hint ? hintId : undefined,
        "aria-required": required || undefined,
      })}

      {error ? (
        <ErrorText id={errorId}>{error}</ErrorText>
      ) : hint ? (
        <p id={hintId} className="mt-2 text-sm text-second/60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ToggleCard({ name, checked, onChange, disabled, title, description }) {
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
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function EditMarketplacePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const uid = useId();
  const formRef = useRef(null);
  const initializedId = useRef(null);

  const query = useGetMarketplaces();
  const updateMarketplace = useUpdateMarketplace();

  const marketplaces = useMemo(() => query.data ?? [], [query.data]);
  const marketplace = marketplaces.find((item) => item.id === id);

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [errors, setErrors] = useState({});

  const idOf = (field) => `${uid}-${field}`;
  const isSaving = updateMarketplace.isPending;

  useEffect(() => {
    if (!marketplace || initializedId.current === marketplace.id) {
      return;
    }

    initializedId.current = marketplace.id;
    setName(marketplace.name ?? "");
    setIsActive(Boolean(marketplace.is_active));
    setLogo(null);
    setErrors({});
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
    if (!updateMarketplace.isError || !updateMarketplace.error) return;
    const apiError = normalizeApiError(updateMarketplace.error);
    notify.error(apiError.message);
  }, [updateMarketplace.isError, updateMarketplace.error]);

  function handleNameChange(event) {
    setName(event.target.value);
    if (errors.name) {
      setErrors((current) => ({ ...current, name: undefined }));
    }
  }

  function handleLogoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((current) => ({
        ...current,
        logo: "Format logo harus JPEG, PNG, atau WebP.",
      }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((current) => ({
        ...current,
        logo: "Ukuran logo maksimal 5 MB.",
      }));
      return;
    }

    setLogo(file);
    setErrors((current) => ({ ...current, logo: undefined }));
  }

  function handleRemoveLogo() {
    setLogo(null);
    setErrors((current) => ({ ...current, logo: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!marketplace || isSaving) return;

    const found = {};
    const trimmedName = name.trim();

    if (!trimmedName) found.name = "Nama marketplace wajib diisi.";
    else if (trimmedName.length > 100)
      found.name = "Nama marketplace maksimal 100 karakter.";

    setErrors(found);

    if (Object.keys(found).length > 0) {
      formRef.current?.elements?.namedItem("name")?.focus();
      return;
    }

    const formData = new FormData();
    let hasChanges = false;

    if (trimmedName !== (marketplace.name ?? "")) {
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
      await updateMarketplace.mutateAsync({ id, formData });
      notify.success("Marketplace berhasil diperbarui.");
      router.push("/owner/marketplaces");
    } catch {
      // Error ditangani oleh useEffect updateMarketplace.isError.
    }
  }

  /* ------------------------------ Loading ------------------------------ */

  if (query.isPending) {
    return (
      <main className="min-h-dvh bg-primary px-4 py-8 sm:py-14">
        <div className="mx-auto w-full max-w-xl">
          <header className="mb-8">
            <div className="mb-5 h-8 w-32 animate-pulse rounded-lg bg-second/10" />
            <div className="flex items-center gap-4">
              <div className="size-12 shrink-0 animate-pulse rounded-2xl bg-second/10" />
              <div className="min-w-0 space-y-2">
                <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
                <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
              </div>
            </div>
          </header>
          <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
        </div>
      </main>
    );
  }

  if (query.isError && !query.data) {
    return (
      <main className="min-h-dvh bg-primary px-4 py-8 sm:py-14">
        <div className="mx-auto w-full max-w-xl">
          <header className="mb-8">
            <Link
              href="/owner/marketplaces"
              className={`-ml-2 mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-second/60 transition hover:text-second4 ${FOCUS_RING}`}
            >
              <FiArrowLeft size={16} aria-hidden="true" />
              Kembali
            </Link>
          </header>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
            <FiAlertCircle
              size={32}
              className="text-second2"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-bold text-second">
              Gagal memuat marketplace
            </h2>
            <p className="mt-2 max-w-md text-sm text-second/60">
              Periksa koneksi atau sesi autentikasi Anda, lalu coba kembali.
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              <FiLoader
                className={
                  query.isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : "hidden"
                }
                size={16}
                aria-hidden="true"
              />
              {query.isFetching ? "Memuat…" : "Coba lagi"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!marketplace) {
    return (
      <main className="min-h-dvh bg-primary px-4 py-8 sm:py-14">
        <div className="mx-auto w-full max-w-xl">
          <header className="mb-8">
            <Link
              href="/owner/marketplaces"
              className={`-ml-2 mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-second/60 transition hover:text-second4 ${FOCUS_RING}`}
            >
              <FiArrowLeft size={16} aria-hidden="true" />
              Kembali
            </Link>
          </header>

          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiImage size={24} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-second">
              Marketplace tidak ditemukan
            </h2>
            <p className="mt-2 max-w-md text-sm text-second/60">
              Marketplace mungkin sudah dihapus atau ID tidak valid.
            </p>
            <Link
              href="/owner/marketplaces"
              className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
            >
              Kembali ke marketplace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------------ Form ------------------------------ */

  const currentLogo = marketplace.logo_url ?? "";

  return (
    <main className="min-h-dvh bg-primary px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/owner/marketplaces"
            className={`-ml-2 mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-second/60 transition hover:text-second4 ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali
          </Link>

          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiImage size={24} />
            </span>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Edit <span className="text-grad">Toko Online</span>
              </h1>
              <p className="mt-1 text-pretty text-sm text-second/60">
                Perbarui nama, logo, atau status marketplace.
              </p>
            </div>
          </div>
        </header>

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl border border-second/30 bg-primary shadow-xl shadow-second/5"
        >
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <Field
              id={idOf("name")}
              label="Nama toko online"
              required
              error={errors.name}
              hint="ID marketplace tidak dapat diubah."
            >
              {(a11y) => (
                <>
                  <input
                    {...a11y}
                    name="name"
                    type="text"
                    autoComplete="off"
                    value={name}
                    onChange={handleNameChange}
                    className={inputClass(errors.name)}
                    placeholder="Contoh: Shopee…"
                    maxLength={100}
                    disabled={isSaving}
                  />
                  <p className="mt-2 text-right text-xs tabular-nums text-second/50">
                    {name.length}/100
                  </p>
                </>
              )}
            </Field>

            {/* Logo — custom field karena input file */}
            <div className="min-w-0">
              <p className={labelClass}>
                Logo toko online
                <span className="ml-2 text-xs font-normal text-second/50">
                  Opsional
                </span>
              </p>

              <div className="flex items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-second/[0.03] p-3">
                {logoPreview || currentLogo ? (
                  <div className="flex size-32 items-center justify-center overflow-hidden rounded-xl bg-white p-2">
                    <Image
                      src={logoPreview || currentLogo}
                      alt={`Logo ${name || marketplace.name}`}
                      width={256}
                      height={256}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-center text-second/40">
                    <FiImage size={28} aria-hidden="true" />
                    <span className="text-xs">Logo belum tersedia</span>
                  </div>
                )}
              </div>

              <label
                className={`mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-second/30 px-4 py-2 text-sm font-semibold text-second transition-colors hover:border-second4 hover:text-second4 focus-within:ring-4 focus-within:ring-second4/15 ${
                  isSaving ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <FiUploadCloud size={16} aria-hidden="true" />
                {logo
                  ? "Pilih logo lain"
                  : logoPreview || currentLogo
                    ? "Ganti logo"
                    : "Pilih logo"}

                <input
                  id={idOf("logo")}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isSaving}
                  onChange={handleLogoChange}
                  aria-invalid={errors.logo ? true : undefined}
                  aria-describedby={
                    errors.logo ? `${idOf("logo")}-error` : undefined
                  }
                  className="sr-only"
                />
              </label>

              <p className="mt-2 text-xs leading-relaxed text-second/55">
                JPEG, PNG, atau WebP. Maksimal 5 MB. Logo lama akan diganti
                setelah perubahan disimpan.
              </p>

              {logo && (
                <div className="mt-2 flex items-center gap-4">
                  <p className="flex min-w-0 flex-1 items-center gap-2 break-all text-xs text-second3">
                    <FiCheck
                      size={13}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    <span className="tabular-nums">
                      {logo.name} · {(logo.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={isSaving}
                    aria-label="Batalkan penggantian logo"
                    className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-second/30 text-second/60 transition-colors hover:border-second2 hover:text-second2 disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    <FiX size={16} aria-hidden="true" />
                  </button>
                </div>
              )}

              {errors.logo && (
                <ErrorText id={`${idOf("logo")}-error`}>
                  {errors.logo}
                </ErrorText>
              )}
            </div>

            {/* Status */}
            <div className="min-w-0">
              <p className={labelClass}>Status toko online</p>
              <ToggleCard
                name="is_active"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                disabled={isSaving}
                title="Toko online aktif"
                description={
                  isActive
                    ? "Marketplace berstatus aktif."
                    : "Marketplace berstatus nonaktif."
                }
              />
              <p className="mt-2 text-xs leading-relaxed text-second/55">
                Menonaktifkan marketplace tidak menghapus tautan produk yang
                sudah terpasang pada kamera.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 rounded-b-2xl border-t border-second/30 bg-second/[0.02] px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <CancelButton
              href="/owner/marketplaces"
              aria-disabled={isSaving}
              tabIndex={isSaving ? -1 : undefined}
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 sm:w-auto ${FOCUS_RING} ${
                isSaving ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Batal
            </CancelButton>
            <PrimaryButton
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              {isSaving ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Menyimpan…
                </>
              ) : (
                "Simpan Perubahan"
              )}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </main>
  );
}
