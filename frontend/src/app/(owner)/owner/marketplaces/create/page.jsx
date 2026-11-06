"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiImage,
  FiLoader,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import { useCreateMarketplace } from "../../../../features/marketplaces/hooks.js";
import PrimaryButton from "./../../../../../components/primary-button";
import CancelButton from "../../../../../components/cancel-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN CUSTOMER CREATE)                             */
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

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
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

export default function CreateMarketplacePage() {
  const router = useRouter();
  const createMarketplace = useCreateMarketplace();
  const uid = useId();
  const formRef = useRef(null);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState({});

  const idOf = (field) => `${uid}-${field}`;
  const isSubmitting = createMarketplace.isPending;

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

  function handleNameChange(event) {
    setName(event.target.value);
    if (errors.name) {
      setErrors((current) => ({ ...current, name: undefined }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const found = {};

    const trimmedName = name.trim();
    if (!trimmedName) found.name = "Nama toko online wajib diisi.";
    else if (trimmedName.length > 100)
      found.name = "Nama toko online maksimal 100 karakter.";

    if (!logo) found.logo = "Logo toko online wajib diunggah.";

    setErrors(found);

    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      if (first === "logo") {
        document.getElementById(idOf("logo"))?.focus();
      } else {
        formRef.current?.elements?.namedItem(first)?.focus();
      }
      return;
    }

    const formData = new FormData();
    formData.append("name", trimmedName);
    formData.append("logo", logo);
    formData.append("is_active", String(isActive));

    try {
      await createMarketplace.mutateAsync(formData);
      notify.success("Marketplace berhasil ditambahkan.");
      router.push("/owner/marketplaces");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

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
                Tambah <span className="text-grad">Toko Online</span>
              </h1>
              <p className="mt-1 text-pretty text-sm text-second/60">
                Tambahkan toko online beserta logo dan statusnya.
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
                    disabled={isSubmitting}
                  />
                  <p className="mt-2 text-right text-xs tabular-nums text-second/50">
                    {name.length}/100
                  </p>
                </>
              )}
            </Field>

            {/* Logo — custom Field karena input file */}
            <div className="min-w-0">
              <p className={labelClass}>
                Logo toko online
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </p>

              <div className="flex items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-second/[0.03] p-3">
                {logoPreview ? (
                  <div className="flex size-32 items-center justify-center overflow-hidden rounded-xl bg-white p-2">
                    <Image
                      src={logoPreview}
                      alt="Pratinjau logo marketplace"
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
                  isSubmitting ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <FiUploadCloud size={16} aria-hidden="true" />
                {logo
                  ? "Pilih logo lain"
                  : logoPreview
                    ? "Ganti logo"
                    : "Pilih logo"}

                <input
                  id={idOf("logo")}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isSubmitting}
                  onChange={handleLogoChange}
                  aria-invalid={errors.logo ? true : undefined}
                  aria-describedby={
                    errors.logo ? `${idOf("logo")}-error` : undefined
                  }
                  className="sr-only"
                />
              </label>

              <p className="mt-2 text-xs leading-relaxed text-second/55">
                JPEG, PNG, atau WebP. Maksimal 5 MB.
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
                    disabled={isSubmitting}
                    aria-label="Hapus logo yang dipilih"
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
                disabled={isSubmitting}
                title="Toko online aktif"
                description="Toko online dapat digunakan selama statusnya aktif. Default: aktif."
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 rounded-b-2xl border-t border-second/30 bg-second/[0.02] px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <CancelButton
              href="/owner/marketplaces"
              aria-disabled={isSubmitting}
              tabIndex={isSubmitting ? -1 : undefined}
            >
              Batal
            </CancelButton>

            <PrimaryButton
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              {isSubmitting ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Menyimpan…
                </>
              ) : (
                "Simpan Toko Online"
              )}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </main>
  );
}
