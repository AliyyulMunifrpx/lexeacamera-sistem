"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import { FiAlertCircle, FiArrowLeft, FiLock, FiSave } from "react-icons/fi";

import {
  useGetInvoice,
  useUpdateInvoice,
} from "../../../../../features/invoices/hooks.js";
import { useGetTerms } from "../../../../../features/terms/hooks.js";

import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";

const INPUT_CLASS =
  "w-full rounded-xl border border-second/25 bg-primary px-3 py-3 text-sm text-second outline-none transition placeholder:text-second/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

const TERMS_MAX_LENGTH = 5000;

const TERMS_MODES = {
  TEMPLATE: "template",
  NONE: "none",
  CUSTOM: "custom",
};

const TERMS_OPTIONS = [
  {
    value: TERMS_MODES.TEMPLATE,
    title: "Pakai template",
    description:
      "Ganti S&K invoice ini dengan template pembayaran yang tersimpan saat ini.",
  },
  {
    value: TERMS_MODES.NONE,
    title: "Tanpa S&K",
    description: "Hapus S&K dari invoice ini.",
  },
  {
    value: TERMS_MODES.CUSTOM,
    title: "Buat sendiri",
    description: "Tulis S&K khusus hanya untuk invoice ini.",
  },
];

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
function formatThousands(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

  const {
    data: termsResponse,
    isPending: isLoadingTerms,
    isError: isTermsError,
  } = useGetTerms();

  const updateMutation = useUpdateInvoice();

  const [form, setForm] = useState(INITIAL_FORM);
  const [initialForm, setInitialForm] = useState(null);
  const [confirmedFinalization, setConfirmedFinalization] = useState(false);

  const [termsMode, setTermsMode] = useState(TERMS_MODES.NONE);
  const [customTerms, setCustomTerms] = useState("");
  const [termsInitialized, setTermsInitialized] = useState(false);
  const storeDiscountRef = useRef(null);
  const customerDiscountRef = useRef(null);
  const pendingDiscountCaret = useRef(null);
  const isSaving = updateMutation.isPending;

  // Template S&K saat ini dari GET /terms (null kalau belum diisi).
  const templateTerms = (
    termsResponse?.data?.value ??
    termsResponse?.value ??
    ""
  ).trim();

  // Isi S&K yang tersimpan di invoice saat ini.
  const originalTerms = (invoice?.terms_and_condition ?? "").trim();

  const isCustomTooLong = customTerms.length > TERMS_MAX_LENGTH;

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

  // Tentukan pilihan S&K awal dari isi invoice, sekali saja setelah
  // invoice dan template sama-sama selesai dimuat.
  useEffect(() => {
    if (termsInitialized || !invoice || isLoadingTerms) return;

    if (originalTerms === "") {
      setTermsMode(TERMS_MODES.NONE);
    } else if (templateTerms && originalTerms === templateTerms) {
      setTermsMode(TERMS_MODES.TEMPLATE);
    } else {
      setTermsMode(TERMS_MODES.CUSTOM);
      setCustomTerms(originalTerms);
    }

    setTermsInitialized(true);
  }, [termsInitialized, invoice, isLoadingTerms, originalTerms, templateTerms]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleDiscountChange(event) {
    const { name, value } = event.target;
    const cursorPosition = event.target.selectionStart ?? value.length;

    const digitsBeforeCursor = value
      .slice(0, cursorPosition)
      .replace(/\D/g, "").length;

    const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

    // Maksimal 12 digit rupiah.
    if (digits.length > 12) return;

    pendingDiscountCaret.current = {
      name,
      digitCount: Math.min(digitsBeforeCursor, digits.length),
    };

    setForm((current) => ({
      ...current,
      [name]: digits,
    }));
  }
  function handleTermsModeChange(nextMode) {
    setTermsMode(nextMode);

    // Pertama kali pilih "Buat sendiri": mulai dari S&K yang sekarang ada
    // (atau template) supaya tinggal diedit.
    if (nextMode === TERMS_MODES.CUSTOM && customTerms === "") {
      setCustomTerms(originalTerms || templateTerms);
    }
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

    // S&K: hanya dikirim kalau berubah dari isi invoice saat ini.
    // - template : isi template saat ini
    // - none     : null
    // - custom   : string apa adanya
    let desiredTerms = "";

    if (termsMode === TERMS_MODES.TEMPLATE) {
      desiredTerms = templateTerms;
    } else if (termsMode === TERMS_MODES.CUSTOM) {
      desiredTerms = customTerms.trim();

      if (!desiredTerms) {
        notify.error(
          "S&K khusus masih kosong. Isi teksnya atau pilih opsi lain.",
        );
        return null;
      }

      if (customTerms.length > TERMS_MAX_LENGTH) {
        notify.error(`S&K maksimum ${TERMS_MAX_LENGTH} karakter.`);
        return null;
      }
    }

    if (desiredTerms !== originalTerms) {
      payload.terms_and_condition = desiredTerms === "" ? null : desiredTerms;
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
  useLayoutEffect(() => {
    const pending = pendingDiscountCaret.current;

    if (!pending) return;

    const input =
      pending.name === "store_discount"
        ? storeDiscountRef.current
        : pending.name === "customer_discount"
          ? customerDiscountRef.current
          : null;

    if (!input) return;

    const formattedValue = formatThousands(form[pending.name]);
    const targetDigitCount = pending.digitCount;

    let position = 0;
    let digitsFound = 0;

    while (position < formattedValue.length && digitsFound < targetDigitCount) {
      if (/\d/.test(formattedValue[position])) {
        digitsFound++;
      }

      position++;
    }

    input.setSelectionRange(position, position);
    pendingDiscountCaret.current = null;
  }, [form.store_discount, form.customer_discount]);
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

  const isTemplateUnavailable =
    isLoadingTerms || isTermsError || !templateTerms;

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
          title="Syarat dan Ketentuan"
          description="Pilihan di sini menggantikan S&K yang tersimpan di invoice ini. Template pembayaran di pengaturan tidak ikut berubah."
        >
          {!termsInitialized ? (
            <div className="rounded-xl border border-second/15 p-5 text-sm text-second/60">
              Memuat S&K...
            </div>
          ) : (
            <>
              <fieldset className="space-y-3">
                <legend className="sr-only">
                  Pilihan syarat dan ketentuan
                </legend>

                {TERMS_OPTIONS.map((option) => {
                  const isActive = termsMode === option.value;
                  const isDisabled =
                    option.value === TERMS_MODES.TEMPLATE &&
                    isTemplateUnavailable &&
                    !isActive;

                  return (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                        isDisabled
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer"
                      } ${
                        isActive
                          ? "border-second/60 bg-second/5"
                          : "border-second/15 hover:border-second/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="terms_mode"
                        value={option.value}
                        checked={isActive}
                        disabled={isDisabled}
                        onChange={() => handleTermsModeChange(option.value)}
                        className="mt-1 size-4 accent-second"
                      />

                      <span>
                        <span className="block text-sm font-medium">
                          {option.title}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-second/60">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              {isTemplateUnavailable && (
                <p className="text-xs text-second/60">
                  {isTermsError
                    ? "Template S&K gagal dimuat, jadi opsi template dinonaktifkan."
                    : "Template S&K belum diisi, jadi opsi template dinonaktifkan."}{" "}
                  <Link
                    href="/admin/invoices/terms"
                    className={`font-semibold text-second underline ${FOCUS_RING}`}
                  >
                    Kelola template
                  </Link>
                </p>
              )}

              {termsMode === TERMS_MODES.TEMPLATE && (
                <div className="rounded-xl bg-second/5 p-4">
                  <p className="text-xs font-medium text-second/60">
                    Preview template saat ini
                  </p>

                  <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line break-words text-sm">
                    {templateTerms}
                  </p>
                </div>
              )}

              {termsMode === TERMS_MODES.CUSTOM && (
                <div className="space-y-2">
                  <label
                    htmlFor="custom-terms"
                    className="block text-sm font-medium"
                  >
                    S&K khusus invoice ini
                  </label>

                  <textarea
                    id="custom-terms"
                    value={customTerms}
                    onChange={(event) => setCustomTerms(event.target.value)}
                    rows={8}
                    placeholder="Tulis syarat dan ketentuan pembayaran..."
                    className={`${INPUT_CLASS} resize-y ${
                      isCustomTooLong ? "border-red-500" : ""
                    }`}
                  />

                  <p
                    className={`text-right text-xs ${
                      isCustomTooLong
                        ? "font-semibold text-red-400"
                        : "text-second/55"
                    }`}
                  >
                    {customTerms.length}/{TERMS_MAX_LENGTH}
                  </p>
                </div>
              )}
            </>
          )}
        </FormSection>

        <FormSection
          title="Diskon"
          description={`Subtotal item terkunci: ${formatCurrency(invoice.subtotal)}. Total akan dihitung ulang oleh server.`}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor="edit-invoice-store_discount"
                className="mb-2 block text-sm font-medium"
              >
                Diskon toko (Rp)
              </label>

              <input
                ref={storeDiscountRef}
                id="edit-invoice-store_discount"
                name="store_discount"
                type="text"
                inputMode="numeric"
                value={formatThousands(form.store_discount)}
                onChange={handleDiscountChange}
                maxLength={15}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="edit-invoice-customer_discount"
                className="mb-2 block text-sm font-medium"
              >
                Diskon pelanggan (Rp)
              </label>

              <input
                ref={customerDiscountRef}
                id="edit-invoice-customer_discount"
                name="customer_discount"
                type="text"
                inputMode="numeric"
                value={formatThousands(form.customer_discount)}
                onChange={handleDiscountChange}
                maxLength={15}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </div>
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
            disabled={
              isSaving ||
              !confirmedFinalization ||
              !initialForm ||
              !termsInitialized ||
              isCustomTooLong
            }
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
