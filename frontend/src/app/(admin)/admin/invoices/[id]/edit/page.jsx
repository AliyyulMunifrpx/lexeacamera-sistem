"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiLock,
  FiSave,
} from "react-icons/fi";

import {
  useGetInvoice,
  useUpdateInvoice,
} from "../../../../../features/invoices/hooks.js";

import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";

const INPUT_CLASS =
  "w-full rounded-xl border border-second/25 bg-primary px-3 py-3 text-sm text-second outline-none transition placeholder:text-second/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

const EDITABLE_FIELDS = [
  "store_name",
  "store_address",
  "whatsapp_store",
  "instagram_store",
  "customer_name",
  "customer_address",
  "customer_whatsapp",
  "customer_instagram",
  "payment_method",
  "ship",
  "store_discount",
  "customer_discount",
];

const REQUIRED_FIELDS = [
  "store_name",
  "customer_name",
  "customer_address",
  "customer_whatsapp",
];

const NULLABLE_FIELDS = [
  "store_address",
  "whatsapp_store",
  "instagram_store",
  "customer_instagram",
  "payment_method",
  "ship",
  "store_discount",
  "customer_discount",
];

const INITIAL_FORM = Object.fromEntries(
  EDITABLE_FIELDS.map((field) => [field, ""]),
);

function formatCurrency(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function FormSection({ title, description, children }) {
  return (
    <section className="space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>

        {description && (
          <p className="mt-1 text-sm leading-relaxed text-second/60">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function TextField({
  name,
  label,
  value,
  onChange,
  maxLength,
  required = false,
  placeholder,
  type = "text",
  inputMode,
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={`edit-invoice-${name}`}
        className="mb-2 block text-sm font-medium"
      >
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>

      <input
        id={`edit-invoice-${name}`}
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />

      {typeof maxLength === "number" && (
        <p className="mt-1 text-right text-xs text-second/45">
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

function TextAreaField({
  name,
  label,
  value,
  onChange,
  maxLength,
  required = false,
  placeholder,
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={`edit-invoice-${name}`}
        className="mb-2 block text-sm font-medium"
      >
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>

      <textarea
        id={`edit-invoice-${name}`}
        name={name}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        required={required}
        rows={3}
        placeholder={placeholder}
        className={`${INPUT_CLASS} resize-y`}
      />

      {typeof maxLength === "number" && (
        <p className="mt-1 text-right text-xs text-second/45">
          {value.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-10 w-64 rounded-lg bg-second/10" />
      <div className="h-48 rounded-2xl bg-second/10" />
      <div className="h-64 rounded-2xl bg-second/10" />
      <div className="h-48 rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 px-5 py-12 text-center">
      <FiAlertCircle size={32} className="text-red-400" />

      <h2 className="mt-4 font-semibold">Gagal Memuat Invoice</h2>

      <p className="mt-2 max-w-md text-sm text-second/65">
        Periksa koneksi atau sesi Anda, lalu coba kembali.
      </p>

      <button
        type="button"
        onClick={onRetry}
        disabled={isFetching}
        className="mt-5 rounded-xl border border-second/25 px-4 py-2.5 text-sm font-medium transition hover:bg-second/10 disabled:opacity-50"
      >
        {isFetching ? "Memuat..." : "Coba Lagi"}
      </button>
    </div>
  );
}

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const {
    data: invoice,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useGetInvoice(id);

  const updateMutation = useUpdateInvoice();

  const [form, setForm] = useState(INITIAL_FORM);
  const [initialForm, setInitialForm] = useState(null);
  const [confirmedFinalization, setConfirmedFinalization] = useState(false);

  const isSaving = updateMutation.isPending;

  useEffect(() => {
    if (isError) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }, [isError, error]);

  useEffect(() => {
    if (!invoice) return;

    const initial = Object.fromEntries(
      EDITABLE_FIELDS.map((field) => [
        field,
        String(invoice[field] ?? "").trim(),
      ]),
    );

    setInitialForm(initial);
    setForm(initial);
  }, [invoice]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleDiscountChange(event) {
    const { name, value } = event.target;

    // Rupiah bulat, maksimal 12 digit.
    if (value !== "" && !/^\d{0,12}$/.test(value)) {
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function buildPayload() {
    if (!initialForm) return null;

    const payload = {};

    for (const field of EDITABLE_FIELDS) {
      const value = form[field].trim();
      const originalValue = initialForm[field];

      if (value === originalValue) continue;

      if (REQUIRED_FIELDS.includes(field) && !value) {
        notify.error(`${field.replaceAll("_", " ")} wajib diisi.`);
        return null;
      }

      if (NULLABLE_FIELDS.includes(field)) {
        payload[field] = value === "" ? null : value;
      } else {
        payload[field] = value;
      }
    }
    if (Object.keys(payload).length === 0) {
      // Finalisasi tanpa mengubah data lain.
      // Jangan kirim is_final karena field itu ditolak API.
      payload.payment_method = invoice.payment_method ?? null;
    }
    const whatsapp = form.customer_whatsapp.trim();

    if (
      !/^\+?\d+$/.test(whatsapp) ||
      whatsapp.length < 8 ||
      whatsapp.length > 15
    ) {
      notify.error(
        "WhatsApp pelanggan harus berisi 8–15 karakter, hanya angka dan boleh diawali +.",
      );
      return null;
    }

    for (const field of ["store_discount", "customer_discount"]) {
      const value = form[field].trim();

      if (value !== "" && !/^(0|[1-9]\d{0,11})$/.test(value)) {
        notify.error(
          "Diskon harus berupa bilangan bulat rupiah 0–12 digit tanpa nol di depan.",
        );
        return null;
      }
    }

    const subtotal = Number(invoice.subtotal);
    const storeDiscount =
      form.store_discount === "" ? 0 : Number(form.store_discount);
    const customerDiscount =
      form.customer_discount === "" ? 0 : Number(form.customer_discount);

    if (
      !Number.isFinite(subtotal) ||
      subtotal - storeDiscount - customerDiscount < 0
    ) {
      notify.error("Total diskon tidak boleh melebihi subtotal.");
      return null;
    }

    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (invoice?.is_final) {
      notify.error("Invoice sudah final dan tidak bisa diedit lagi.");
      return;
    }

    if (!confirmedFinalization) {
      notify.error(
        "Konfirmasi bahwa Anda memahami invoice akan dikunci setelah disimpan.",
      );
      return;
    }

    const payload = buildPayload();

    if (!payload) return;

    try {
      await updateMutation.mutateAsync({
        id,
        payload,
      });

      notify.success(
        "Invoice berhasil diperbarui dan sekarang berstatus final.",
      );

      router.replace(`/admin/invoices/${id}`);
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isLoading || (!invoice && !isError)) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <div className="space-y-5 text-second">
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-2 text-sm text-second/65 hover:text-second"
        >
          <FiArrowLeft size={16} />
          Kembali ke Invoice
        </Link>

        <ErrorState onRetry={() => refetch()} isFetching={isFetching} />
      </div>
    );
  }

  if (invoice.is_final) {
    return (
      <div className="space-y-5 text-second">
        <Link
          href={`/admin/invoices/${id}`}
          className="inline-flex items-center gap-2 text-sm text-second/65 hover:text-second"
        >
          <FiArrowLeft size={16} />
          Kembali ke Detail Invoice
        </Link>

        <section className="rounded-2xl border border-second/15 p-6 sm:p-8">
          <FiLock size={30} />

          <h1 className="mt-4 text-xl font-bold">Invoice Sudah Final</h1>

          <p className="mt-2 text-sm leading-relaxed text-second/65">
            Invoice {invoice.no_invoice} sudah dikunci dan tidak dapat diedit
            lagi.
          </p>

          <Link
            href={`/admin/invoices/${id}`}
            className="mt-5 inline-flex rounded-xl bg-second px-5 py-3 text-sm font-semibold text-primary hover:opacity-90"
          >
            Lihat Invoice
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-8 text-second">
      <header>
        <Link
          href={`/admin/invoices/${id}`}
          className="inline-flex items-center gap-2 text-sm text-second/65 transition hover:text-second"
        >
          <FiArrowLeft size={17} />
          Kembali ke Detail Invoice
        </Link>

        <h1 className="mt-5 text-2xl font-bold">Edit Invoice</h1>

        <p className="mt-1 break-all text-sm text-second/65">
          {invoice.no_invoice}
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-second/20 bg-second/5 p-4">
        <FiAlertCircle size={20} className="mt-0.5 shrink-0" />

        <p className="text-sm leading-relaxed text-second/75">
          Invoice hanya dapat diedit satu kali. Setelah perubahan berhasil
          disimpan, invoice otomatis menjadi final dan terkunci. Item, nomor
          invoice, subtotal, serta Order asli tidak dapat diubah.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <FormSection
          title="Informasi Toko"
          description="Perubahan di bagian ini hanya mengubah snapshot toko pada invoice ini, bukan profil toko."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              name="store_name"
              label="Nama toko"
              value={form.store_name}
              onChange={handleChange}
              maxLength={100}
              required
            />

            <TextField
              name="whatsapp_store"
              label="WhatsApp toko"
              value={form.whatsapp_store}
              onChange={handleChange}
              maxLength={100}
            />

            <TextField
              name="instagram_store"
              label="Instagram toko"
              value={form.instagram_store}
              onChange={handleChange}
              maxLength={100}
            />

            <TextAreaField
              name="store_address"
              label="Alamat toko"
              value={form.store_address}
              onChange={handleChange}
              maxLength={500}
              placeholder="Alamat toko pada invoice"
            />
          </div>
        </FormSection>

        <FormSection title="Informasi Pelanggan">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              name="customer_name"
              label="Nama pelanggan"
              value={form.customer_name}
              onChange={handleChange}
              maxLength={100}
              required
            />

            <TextField
              name="customer_whatsapp"
              label="WhatsApp pelanggan"
              value={form.customer_whatsapp}
              onChange={handleChange}
              maxLength={15}
              required
              placeholder="081234567890"
              type="tel"
            />

            <TextAreaField
              name="customer_address"
              label="Alamat pelanggan"
              value={form.customer_address}
              onChange={handleChange}
              maxLength={500}
              required
            />

            <TextField
              name="customer_instagram"
              label="Instagram pelanggan"
              value={form.customer_instagram}
              onChange={handleChange}
              maxLength={100}
              placeholder="@username"
            />
          </div>
        </FormSection>

        <FormSection title="Pembayaran dan Pengiriman">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              name="payment_method"
              label="Metode pembayaran"
              value={form.payment_method}
              onChange={handleChange}
              maxLength={100}
              placeholder="Transfer BCA"
            />

            <TextField
              name="ship"
              label="Metode pengiriman"
              value={form.ship}
              onChange={handleChange}
              maxLength={100}
              placeholder="JNE"
            />
          </div>
        </FormSection>

        <FormSection
          title="Diskon"
          description={`Subtotal item terkunci: ${formatCurrency(invoice.subtotal)}. Total akan dihitung ulang oleh server.`}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              name="store_discount"
              label="Diskon toko (Rp)"
              value={form.store_discount}
              onChange={handleDiscountChange}
              maxLength={12}
              inputMode="numeric"
              placeholder="0"
            />

            <TextField
              name="customer_discount"
              label="Diskon pelanggan (Rp)"
              value={form.customer_discount}
              onChange={handleDiscountChange}
              maxLength={12}
              inputMode="numeric"
              placeholder="0"
            />
          </div>

          <div className="rounded-xl bg-second/5 p-4">
            <p className="text-sm text-second/60">
              Estimasi total setelah edit
            </p>

            <p className="mt-1 text-xl font-bold">
              {formatCurrency(
                Number(invoice.subtotal) -
                  (form.store_discount === ""
                    ? 0
                    : Number(form.store_discount)) -
                  (form.customer_discount === ""
                    ? 0
                    : Number(form.customer_discount)),
              )}
            </p>

            <p className="mt-2 text-xs leading-relaxed text-second/55">
              Ini hanya preview. Nilai resmi invoice akan dihitung ulang oleh
              backend saat request berhasil.
            </p>
          </div>
        </FormSection>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-second/20 p-4">
          <input
            type="checkbox"
            checked={confirmedFinalization}
            onChange={(event) => setConfirmedFinalization(event.target.checked)}
            className="mt-1 size-4 accent-second"
          />

          <span>
            <span className="block text-sm font-semibold">
              Saya memahami invoice akan langsung terkunci
            </span>

            <span className="mt-1 block text-xs leading-relaxed text-second/60">
              Setelah disimpan, jatah edit habis dan status invoice otomatis
              menjadi final. Pastikan seluruh data sudah benar.
            </span>
          </span>
        </label>

        <div className="flex flex-col-reverse gap-3 border-t border-second/15 pt-5 sm:flex-row sm:justify-end">
          <Link
            href={`/admin/invoices/${id}`}
            className="rounded-xl border border-second/25 px-5 py-3 text-center text-sm font-medium transition hover:bg-second/10"
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={isSaving || !confirmedFinalization || !initialForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-second px-5 py-3 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiSave size={17} />
            {isSaving ? "Menyimpan..." : "Simpan dan Finalkan Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
