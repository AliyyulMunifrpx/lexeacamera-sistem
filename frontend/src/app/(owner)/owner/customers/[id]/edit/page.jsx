"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiInfo,
  FiShoppingBag,
  FiUser,
  FiDollarSign,
} from "react-icons/fi";

import {
  useGetCustomer,
  useUpdateCustomer,
} from "../../../../../features/customer/hooks.js";

import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";
import CancelButton from "./../../../../../../components/cancel-button";
import PrimaryButton from "./../../../../../../components/primary-button";

/* Ganti jika halaman pelanggan Anda ada di /admin/customers. */
const CUSTOMERS_PATH = "/owner/customers";

const FIELD_LIMITS = {
  name: 100,
  address: 500,
  whatsapp: 30,
  instagram: 100,
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second focus-visible:ring-offset-2 focus-visible:ring-offset-primary";

const INPUT_CLASS =
  "w-full rounded-xl border border-second/30 bg-primary px-4 py-3 text-sm text-second transition-colors placeholder:text-second/40 hover:border-second/30 focus-visible:border-second focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-second2 aria-[invalid=true]:focus-visible:ring-second2/20";

const INITIAL_VALUES = {
  name: "",
  whatsapp: "",
  instagram: "",
  address: "",
};

/* ---------- Helper ---------- */

function getCustomerValues(customer) {
  return {
    name: customer.name ?? "",
    whatsapp: customer.whatsapp ?? "",
    instagram: customer.instagram ?? "",
    address: customer.address ?? "",
  };
}

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

function formatPrice(price = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ---------- Komponen kecil ---------- */

function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-6xl animate-pulse space-y-5"
    >
      <span className="sr-only">Memuat data pelanggan…</span>
      <div className="h-8 w-56 rounded-lg bg-second/10" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <div className="h-72 rounded-2xl bg-second/10" />
          <div className="h-56 rounded-2xl bg-second/10" />
        </div>
        <div className="h-80 rounded-2xl bg-second/10" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-2xl border border-second/30 px-5 py-12 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-second2/10 text-second2">
        <FiAlertCircle size={28} aria-hidden="true" />
      </div>

      <h2 className="mt-4 font-semibold text-second">
        Gagal memuat data pelanggan
      </h2>

      <p className="mt-2 text-sm text-second/60">
        Periksa koneksi atau sesi Anda, kemudian coba kembali.
      </p>

      <button
        type="button"
        onClick={onRetry}
        disabled={isFetching}
        className={`mt-5 rounded-full bg-second px-5 py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-80 disabled:opacity-50 ${FOCUS_RING}`}
      >
        {isFetching ? "Memuat…" : "Coba lagi"}
      </button>

      <Link
        href={CUSTOMERS_PATH}
        className={`mt-4 rounded-md text-sm text-second/70 underline underline-offset-4 hover:text-second ${FOCUS_RING}`}
      >
        Kembali ke daftar pelanggan
      </Link>
    </div>
  );
}

function FormSection({ icon: Icon, title, description, children }) {
  return (
    <section className="space-y-5 rounded-2xl border border-second/30 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
          <Icon size={16} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <h2 className="font-semibold text-second">{title}</h2>
          <p className="mt-0.5 text-sm text-second/60">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function TextField({
  id,
  name,
  label,
  value,
  onChange,
  maxLength,
  required = false,
  disabled = false,
  placeholder,
  hint,
  error,
  multiline = false,
  rows = 3,
  inputMode,
  type = "text",
}) {
  const Component = multiline ? "textarea" : "input";
  const nearLimit = value.length >= maxLength * 0.9;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-second"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-second2" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <Component
        id={id}
        name={name}
        type={multiline ? undefined : type}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        rows={multiline ? rows : undefined}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={inputMode || name === "instagram" ? false : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={
          [error && errorId, hint && hintId].filter(Boolean).join(" ") ||
          undefined
        }
        className={`${INPUT_CLASS} ${multiline ? "resize-y" : ""}`}
      />

      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0 text-xs">
          {error ? (
            <p id={errorId} role="alert" className="text-second2">
              {error}
            </p>
          ) : (
            hint && (
              <p id={hintId} className="text-second/50">
                {hint}
              </p>
            )
          )}
        </div>

        <p
          className={`shrink-0 text-xs tabular-nums ${
            nearLimit ? "text-second2" : "text-second/50"
          }`}
        >
          {value.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}

function CopyId({ value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify.success("ID pelanggan disalin.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Gagal menyalin ke clipboard.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Salin ID pelanggan"
      className={`shrink-0 rounded-md p-1 text-second/40 transition-colors hover:bg-second/5 hover:text-second ${FOCUS_RING}`}
    >
      {copied ? (
        <FiCheck size={14} aria-hidden="true" />
      ) : (
        <FiCopy size={14} aria-hidden="true" />
      )}
    </button>
  );
}

function StatRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
        <Icon size={16} aria-hidden="true" />
      </span>

      <div className="min-w-0">
        <dt className="text-xs text-second/55">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-second">
          {value}
        </dd>
      </div>
    </div>
  );
}

/* ---------- Halaman ---------- */

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const {
    data: customerResponse,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetCustomer(id);

  // Terima dua bentuk: objek pelanggan langsung, atau pembungkus { data: {...} }.
  const customer =
    customerResponse &&
    typeof customerResponse === "object" &&
    customerResponse.data &&
    typeof customerResponse.data === "object" &&
    !Array.isArray(customerResponse.data)
      ? customerResponse.data
      : customerResponse;

  const updateMutation = useUpdateCustomer();

  const [values, setValues] = useState(INITIAL_VALUES);
  const [initialValues, setInitialValues] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  const isNotFound =
    isError && error?.response?.data?.errors === "CUSTOMER_NOT_FOUND";

  const hasChanges = initialValues
    ? Object.keys(INITIAL_VALUES).some(
        (field) =>
          (values[field] ?? "").trim() !== (initialValues[field] ?? "").trim(),
      )
    : false;

  useEffect(() => {
    if (!customer) return;

    const next = getCustomerValues(customer);

    setValues(next);
    setInitialValues(next);
    setFieldErrors({});
    setFormError("");
  }, [customer]);

  useEffect(() => {
    if (isNotFound) {
      notify.error("Pelanggan tidak ditemukan.");
      router.replace(CUSTOMERS_PATH);
    }
  }, [isNotFound, router]);

  useEffect(() => {
    if (isError && !isNotFound) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }, [isError, error, isNotFound]);

  // Peringatan sebelum meninggalkan halaman dengan perubahan belum tersimpan.
  useEffect(() => {
    if (!hasChanges) return;

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  function handleChange(event) {
    const { name, value } = event.target;

    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!customer || !initialValues) return;

    const nextErrors = {};
    const name = values.name.trim();
    const address = values.address.trim();
    const whatsapp = values.whatsapp.trim();

    if (!name) nextErrors.name = "Nama pelanggan tidak boleh kosong.";
    if (!address) nextErrors.address = "Alamat tidak boleh kosong.";
    if (!whatsapp) nextErrors.whatsapp = "Nomor WhatsApp tidak boleh kosong.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      document
        .getElementById(`customer-${Object.keys(nextErrors)[0]}`)
        ?.focus();
      return;
    }

    // Kirim hanya field yang berubah (PUT bisa sebagian).
    const data = {};

    if (name !== initialValues.name.trim()) data.name = name;
    if (address !== initialValues.address.trim()) data.address = address;
    if (whatsapp !== initialValues.whatsapp.trim()) data.whatsapp = whatsapp;

    const instagram = values.instagram.trim();
    if (instagram !== initialValues.instagram.trim()) {
      // Kosong = hapus Instagram.
      data.instagram = instagram === "" ? null : instagram;
    }

    if (Object.keys(data).length === 0) {
      setFormError("Belum ada perubahan yang perlu disimpan.");
      return;
    }

    try {
      await updateMutation.mutateAsync({ id, data });

      notify.success("Data pelanggan berhasil diperbarui.");
      router.replace(CUSTOMERS_PATH);
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "WHATSAPP_ALREADY_USED") {
        setFieldErrors({
          whatsapp: "Nomor WhatsApp ini sudah dipakai pelanggan lain.",
        });
        document.getElementById("customer-whatsapp")?.focus();
        return;
      }

      if (code === "CUSTOMER_NOT_FOUND") {
        notify.error("Pelanggan tidak ditemukan.");
        router.replace(CUSTOMERS_PATH);
        return;
      }

      const apiError = normalizeApiError(err);
      notify.error(apiError.message);
    }
  }

  if (isLoading || isNotFound || (customer && !initialValues)) {
    return <LoadingState />;
  }

  if (isError && !customer) {
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
  }

  if (!customer || !initialValues) {
    return <LoadingState />;
  }

  const isSaving = updateMutation.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-8 text-second">
      <header>
        <Link
          href={CUSTOMERS_PATH}
          className={`inline-flex items-center gap-2 rounded-md text-sm text-second/65 transition-colors hover:text-second ${FOCUS_RING}`}
        >
          <FiArrowLeft size={17} aria-hidden="true" />
          Kembali ke daftar pelanggan
        </Link>

        <div className="mt-5 flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-grad text-primary">
            <FiUser size={22} aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight">
              Ubah Data Pelanggan
            </h1>

            <p className="mt-1 text-sm leading-relaxed text-second/65">
              Perbarui informasi pelanggan. Field yang tidak diubah akan tetap
              menggunakan data sebelumnya.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form onSubmit={handleSubmit} noValidate className="min-w-0 space-y-6">
          <FormSection
            icon={FiUser}
            title="Identitas"
            description="Nama dan alamat pelanggan."
          >
            <TextField
              id="customer-name"
              name="name"
              label="Nama Pelanggan"
              value={values.name}
              onChange={handleChange}
              maxLength={FIELD_LIMITS.name}
              required
              disabled={isSaving}
              error={fieldErrors.name}
              placeholder="Masukkan nama pelanggan"
            />

            <TextField
              id="customer-address"
              name="address"
              label="Alamat"
              value={values.address}
              onChange={handleChange}
              maxLength={FIELD_LIMITS.address}
              required
              multiline
              rows={4}
              disabled={isSaving}
              error={fieldErrors.address}
              placeholder="Masukkan alamat lengkap…"
            />
          </FormSection>

          <FormSection
            icon={FiShoppingBag}
            title="Kontak"
            description="Dipakai untuk menghubungi pelanggan dan mencari data pelanggan."
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <TextField
                id="customer-whatsapp"
                name="whatsapp"
                label="WhatsApp"
                value={values.whatsapp}
                onChange={handleChange}
                maxLength={FIELD_LIMITS.whatsapp}
                required
                disabled={isSaving}
                error={fieldErrors.whatsapp}
                inputMode="tel"
                placeholder="6281234567890"
                hint="Nomor harus unik per pelanggan."
              />

              <TextField
                id="customer-instagram"
                name="instagram"
                label="Instagram"
                value={values.instagram}
                onChange={handleChange}
                maxLength={FIELD_LIMITS.instagram}
                disabled={isSaving}
                error={fieldErrors.instagram}
                placeholder="@username"
                hint="Kosongkan untuk menghapus."
              />
            </div>
          </FormSection>

          {formError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-second2/10 px-4 py-3 text-sm text-second2"
            >
              <FiAlertCircle className="mt-0.5 shrink-0" aria-hidden="true" />
              {formError}
            </p>
          )}

          {/* Bar aksi */}
          <div className="sticky bottom-0 z-20 -mx-1 flex flex-col gap-3 border-t border-second/30 bg-primary/90 px-1 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p
              aria-live="polite"
              className="flex items-center gap-2 text-sm text-second/60"
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${
                  hasChanges ? "bg-second4" : "bg-second/20"
                }`}
              />
              {hasChanges
                ? "Ada perubahan yang belum disimpan"
                : "Belum ada perubahan"}
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <CancelButton
                href={CUSTOMERS_PATH}
                className={`rounded-full border border-second/30 px-5 py-2.5 text-center text-sm font-medium text-second transition-colors hover:bg-second/5 ${FOCUS_RING}`}
              >
                Batal
              </CancelButton>

              <PrimaryButton
                type="submit"
                disabled={isSaving || !hasChanges}
                className={`rounded-full bg-second px-6 py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
              >
                {isSaving ? "Menyimpan…" : "Simpan Perubahan"}
              </PrimaryButton>
            </div>
          </div>
        </form>

        {/* Ringkasan pelanggan */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6">
          <section
            aria-label="Ringkasan pelanggan"
            className="rounded-2xl border border-second/30 p-5 sm:p-6"
          >
            <h2 className="text-sm font-semibold text-second">
              Ringkasan pelanggan
            </h2>

            <dl className="mt-4 space-y-4">
              <StatRow
                icon={FiShoppingBag}
                label="Jumlah order"
                value={`${formatNumber(customer.order_count ?? 0)} order`}
              />
              <StatRow
                icon={FiDollarSign}
                label="Total belanja"
                value={formatPrice(customer.total_spent ?? 0)}
              />
              <StatRow
                icon={FiCalendar}
                label="Terdaftar sejak"
                value={formatDate(customer.created_at)}
              />
            </dl>

            <div className="mt-5 border-t border-second/30 pt-4">
              <p className="text-xs text-second/55">ID pelanggan</p>
              <p className="mt-1 flex items-center gap-1.5">
                <span className="min-w-0 break-all font-mono text-xs font-medium">
                  {customer.id}
                </span>
                <CopyId value={customer.id} />
              </p>
            </div>
          </section>

          <p className="flex items-start gap-2 rounded-2xl bg-second4/10 px-4 py-3 text-xs leading-relaxed text-second4">
            <FiInfo size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Order dan invoice yang sudah dibuat tidak ikut berubah, karena
            menyimpan salinan data pelanggan saat order dibuat.
          </p>
        </aside>
      </div>
    </div>
  );
}
