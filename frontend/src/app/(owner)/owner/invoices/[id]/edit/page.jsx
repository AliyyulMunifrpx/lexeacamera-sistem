"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiFileText,
  FiLock,
  FiLoader,
  FiSave,
} from "react-icons/fi";

import {
  useGetInvoice,
  useUpdateInvoice,
} from "../../../../../features/invoices/hooks.js";
import { useGetTerms } from "../../../../../features/terms/hooks.js";
import { useGetCustomers } from "../../../../../features/customer/hooks.js";

import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";
import PrimaryButton from "./../../../../../../components/primary-button";
import CancelButton from "./../../../../../../components/cancel-button";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN CREATE)                                      */
/* -------------------------------------------------------------------------- */

const TERMS_MAX_LENGTH = 5000;
const CUSTOMER_LOOKUP_DEBOUNCE = 500;

const TERMS_MODES = {
  TEMPLATE: "template",
  NONE: "none",
  CUSTOM: "custom",
};

const CUSTOMER_CHOICE = {
  EXISTING: "existing",
  NEW: "new",
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

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

/* ------------------------------ Helpers ---------------------------------- */

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  const sign = amount < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))}`;
}

function formatThousands(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function normalizeWhatsapp(input) {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("62")) digits = `62${digits}`;
  return digits;
}

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

/* ------------------------------ Small pieces ----------------------------- */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    failure: "bg-second2 text-primary",
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

function FormSection({ title, description, aside, children, sectionRef }) {
  return (
    <section
      ref={sectionRef}
      className="flex min-w-0 scroll-mt-16 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-bold text-second">{title}</h2>
          {description && (
            <p className="mt-2 text-pretty text-sm text-second/60">
              {description}
            </p>
          )}
        </div>
        {aside}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function FieldGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

function FormField({ label, htmlFor, required, children, description, error }) {
  const descId = `${htmlFor}-desc`;
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className={labelClass}>
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
      {children}
      {error ? (
        <ErrorText id={descId}>{error}</ErrorText>
      ) : (
        description && (
          <p id={descId} className="mt-2 text-sm text-second/60">
            {description}
          </p>
        )
      )}
    </div>
  );
}

function PrefixedInput({ prefix, children }) {
  return (
    <div className="flex">
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center rounded-l-xl border border-r-0 border-second/30 bg-second/5 px-4 text-sm font-medium text-second/60"
      >
        {prefix}
      </span>
      {children}
    </div>
  );
}

function RadioCard({
  name,
  value,
  checked,
  onChange,
  disabled,
  title,
  description,
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
        checked ? "border-second4 bg-second4/5" : "border-second/30"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-second">{title}</span>
        <span className="mt-2 block text-sm text-second/60">{description}</span>
      </span>
    </label>
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

/* --------------------------------- Summary -------------------------------- */

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs text-second/60">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-semibold tabular-nums text-second">
        {children}
      </dd>
    </div>
  );
}

function InvoiceSummary({
  invoiceNumber,
  customerName,
  matchedCustomerName,
  customerChoice,
  isFinal,
  subtotal,
  storeDiscount,
  customerDiscount,
  totalAmount,
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <h2 className="text-lg font-bold text-second">Ringkasan</h2>

      <div className="flex min-w-0 items-center gap-4">
        <div
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-second/5 text-second/40"
        >
          <FiFileText size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-sm font-semibold text-second">
            {customerName.trim() || "Nama pelanggan"}
          </p>
          <p className="mt-1 break-all text-xs text-second/60">
            {invoiceNumber}
          </p>

          {matchedCustomerName && (
            <p className="mt-2 line-clamp-1 break-words text-xs text-second/60">
              {customerChoice === CUSTOMER_CHOICE.EXISTING ? (
                <>
                  Tertaut ke pelanggan lama:{" "}
                  <span className="font-semibold text-second4">
                    {matchedCustomerName}
                  </span>
                </>
              ) : (
                <>
                  Tertaut ke pelanggan lama{" "}
                  <span className="font-semibold text-second4">
                    {matchedCustomerName}
                  </span>{" "}
                  (data baru)
                </>
              )}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isFinal ? <Tag tone="grad">Final</Tag> : <Tag>Draft</Tag>}
          </div>
        </div>
      </div>

      <dl className="divide-y divide-second/10 border-y border-second/30">
        <SummaryRow label="Subtotal">{formatCurrency(subtotal)}</SummaryRow>
        <SummaryRow label="Diskon toko">
          {storeDiscount > 0 ? `- ${formatCurrency(storeDiscount)}` : "—"}
        </SummaryRow>
        <SummaryRow label="Diskon pelanggan">
          {customerDiscount > 0 ? `- ${formatCurrency(customerDiscount)}` : "—"}
        </SummaryRow>
        <SummaryRow label="Estimasi total">
          <span className="flex flex-col items-end gap-2">
            <span>{formatCurrency(totalAmount)}</span>
            {totalAmount < 0 && <Tag tone="failure">Melebihi subtotal</Tag>}
          </span>
        </SummaryRow>
      </dl>

      <p className="text-xs text-second/50">
        Preview saja. Sistem tetap menghitung total akhir.
      </p>
    </section>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const formRef = useRef(null);

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

  // ── Deteksi pelanggan via nomor WhatsApp ──
  const { data: customersResponse } = useGetCustomers();
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [customerChoice, setCustomerChoice] = useState(
    CUSTOMER_CHOICE.EXISTING,
  );
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const lookupTimerRef = useRef(null);

  const storeDiscountRef = useRef(null);
  const customerDiscountRef = useRef(null);
  const pendingDiscountCaret = useRef(null);
  const isSaving = updateMutation.isPending;

  const customersList = useMemo(() => {
    if (Array.isArray(customersResponse)) return customersResponse;
    return customersResponse?.data ?? customersResponse?.items ?? [];
  }, [customersResponse]);

  const templateTerms = (
    termsResponse?.data?.value ??
    termsResponse?.value ??
    ""
  ).trim();

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

  // Lookup pelanggan dari nomor WA (debounce). Hanya jalankan setelah
  // form terisi dari invoice agar tidak auto-isi saat load awal.
  useEffect(() => {
    if (!initialForm) return;

    if (lookupTimerRef.current) {
      clearTimeout(lookupTimerRef.current);
      lookupTimerRef.current = null;
    }

    const raw = form.customer_whatsapp.trim();
    const digits = raw.replace(/\D/g, "");

    if (digits.length < 8) {
      setMatchedCustomer(null);
      setCustomerChoice(CUSTOMER_CHOICE.EXISTING);
      setIsLookingUpCustomer(false);
      return;
    }

    setIsLookingUpCustomer(true);

    lookupTimerRef.current = setTimeout(() => {
      const normalizedQuery = normalizeWhatsapp(digits);
      const found =
        customersList.find(
          (customer) =>
            normalizeWhatsapp(customer.whatsapp) === normalizedQuery,
        ) ?? null;

      setMatchedCustomer(found);
      setIsLookingUpCustomer(false);

      if (found) {
        setCustomerChoice(CUSTOMER_CHOICE.EXISTING);
        setForm((current) => ({
          ...current,
          customer_instagram:
            current.customer_instagram.trim() === ""
              ? (found.instagram ?? "")
              : current.customer_instagram,
          customer_address:
            current.customer_address.trim() === ""
              ? (found.address ?? "")
              : current.customer_address,
        }));
      }
    }, CUSTOMER_LOOKUP_DEBOUNCE);

    return () => {
      if (lookupTimerRef.current) {
        clearTimeout(lookupTimerRef.current);
        lookupTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customer_whatsapp, customersList, initialForm]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleDiscountChange(event) {
    const { name, value } = event.target;
    const cursorPosition = event.target.selectionStart ?? value.length;
    const digitsBeforeCursor = value
      .slice(0, cursorPosition)
      .replace(/\D/g, "").length;
    const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (digits.length > 12) return;
    pendingDiscountCaret.current = {
      name,
      digitCount: Math.min(digitsBeforeCursor, digits.length),
    };
    setForm((current) => ({ ...current, [name]: digits }));
  }

  function handleTermsModeChange(nextMode) {
    setTermsMode(nextMode);
    if (nextMode === TERMS_MODES.CUSTOM && customTerms === "") {
      setCustomTerms(originalTerms || templateTerms);
    }
  }

  function handleCustomerChoiceChange(nextChoice) {
    setCustomerChoice(nextChoice);

    if (!matchedCustomer) return;

    if (nextChoice === CUSTOMER_CHOICE.EXISTING) {
      setForm((current) => ({
        ...current,
        customer_instagram:
          current.customer_instagram.trim() === ""
            ? (matchedCustomer.instagram ?? "")
            : current.customer_instagram,
        customer_address:
          current.customer_address.trim() === ""
            ? (matchedCustomer.address ?? "")
            : current.customer_address,
      }));
    } else {
      setForm((current) => ({
        ...current,
        customer_instagram: "",
        customer_address: "",
      }));
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
      if (/\d/.test(formattedValue[position])) digitsFound++;
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
      await updateMutation.mutateAsync({ id, payload });
      notify.success(
        "Invoice berhasil diperbarui dan sekarang berstatus final.",
      );
      router.replace(`/owner/invoices/${id}`);
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  /* ------------------------------ Loading ------------------------------ */

  if (isLoading || (!invoice && !isError)) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header className="flex flex-col gap-4">
          <div className="h-8 w-40 animate-pulse rounded-full bg-second/10" />
          <div className="flex items-center gap-4">
            <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
            <div className="min-w-0 space-y-2">
              <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
              <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
            </div>
          </div>
        </header>
        <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
            <div className="h-48 animate-pulse rounded-2xl bg-second/10" />
            <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
            <div className="h-48 animate-pulse rounded-2xl bg-second/10" />
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <Link
            href="/owner/invoices"
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke invoice
          </Link>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertCircle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat invoice
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau sesi Anda, lalu coba kembali.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isFetching ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Memuat…
              </>
            ) : (
              "Coba lagi"
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ Final lock ------------------------------ */

  if (invoice.is_final) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <Link
            href={`/owner/invoices/${id}`}
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke detail invoice
          </Link>
        </header>
        <section className="flex flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-second/5 text-second/40"
          >
            <FiLock size={24} />
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-second">
            Invoice sudah <span className="text-grad">final</span>
          </h1>
          <p className="text-pretty text-sm text-second/60">
            Invoice {invoice.no_invoice} sudah dikunci dan tidak dapat diedit
            lagi.
          </p>
          <Link
            href={`/owner/invoices/${id}`}
            className={`${BTN_BASE} w-fit bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
          >
            Lihat invoice
          </Link>
        </section>
      </div>
    );
  }

  /* ------------------------------ Form ------------------------------ */

  const isTemplateUnavailable =
    isLoadingTerms || isTermsError || !templateTerms;
  const storeDiscount =
    form.store_discount === "" ? 0 : Number(form.store_discount);
  const customerDiscount =
    form.customer_discount === "" ? 0 : Number(form.customer_discount);
  const totalAmount =
    Number(invoice.subtotal) - storeDiscount - customerDiscount;
  const discountLiveError =
    Number.isFinite(totalAmount) && totalAmount < 0
      ? "Total diskon tidak boleh melebihi subtotal."
      : "";

  const whatsappDigits = form.customer_whatsapp.replace(/\D/g, "");
  const whatsappLongEnough = whatsappDigits.length >= 8;
  const nameDiffersFromMatch =
    matchedCustomer?.name &&
    form.customer_name.trim() &&
    form.customer_name.trim().toLowerCase() !==
      matchedCustomer.name.trim().toLowerCase();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={`/owner/invoices/${id}`}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke detail invoice
        </Link>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiFileText size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Edit <span className="text-grad">invoice</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Invoice {invoice.no_invoice} hanya dapat diedit satu kali. Setelah
              disimpan, invoice otomatis final dan terkunci.
            </p>
          </div>
        </div>
      </header>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3"
      >
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
          {/* Informasi Toko */}
          <FormSection
            title="Informasi toko"
            description="Perubahan di bagian ini hanya mengubah snapshot toko pada invoice ini, bukan profil toko."
          >
            <FieldGrid>
              <FormField label="Nama toko" htmlFor="store_name" required>
                <input
                  id="store_name"
                  name="store_name"
                  value={form.store_name}
                  onChange={handleChange}
                  className={inputClass(false)}
                  maxLength={100}
                  disabled={isSaving}
                />
              </FormField>
              <FormField label="WhatsApp toko" htmlFor="whatsapp_store">
                <input
                  id="whatsapp_store"
                  name="whatsapp_store"
                  value={form.whatsapp_store}
                  onChange={handleChange}
                  className={inputClass(false)}
                  maxLength={100}
                  disabled={isSaving}
                />
              </FormField>
              <FormField label="Instagram toko" htmlFor="instagram_store">
                <input
                  id="instagram_store"
                  name="instagram_store"
                  value={form.instagram_store}
                  onChange={handleChange}
                  className={inputClass(false)}
                  maxLength={100}
                  disabled={isSaving}
                  placeholder="@username"
                />
              </FormField>
            </FieldGrid>

            <FormField label="Alamat toko" htmlFor="store_address">
              <textarea
                id="store_address"
                name="store_address"
                value={form.store_address}
                onChange={handleChange}
                className={`${inputClass(false)} resize-y`}
                rows={3}
                maxLength={500}
                disabled={isSaving}
                placeholder="Alamat toko pada invoice"
              />
            </FormField>
          </FormSection>

          {/* Informasi Pelanggan */}
          <FormSection
            title="Informasi pelanggan"
            description="Informasi ini akan disimpan sebagai bagian dari invoice."
          >
            <FieldGrid>
              <FormField
                label="Nama pelanggan"
                htmlFor="customer_name"
                required
              >
                <input
                  id="customer_name"
                  name="customer_name"
                  value={form.customer_name}
                  onChange={handleChange}
                  className={inputClass(false)}
                  maxLength={100}
                  disabled={isSaving}
                  placeholder="Nama lengkap pelanggan…"
                />
              </FormField>

              <FormField
                label="WhatsApp pelanggan"
                htmlFor="customer_whatsapp"
                required
              >
                <input
                  id="customer_whatsapp"
                  name="customer_whatsapp"
                  type="tel"
                  inputMode="tel"
                  value={form.customer_whatsapp}
                  onChange={handleChange}
                  className={`${inputClass(false)} tabular-nums`}
                  maxLength={15}
                  disabled={isSaving}
                  placeholder="081234567890"
                />

                {isLookingUpCustomer && (
                  <p
                    className="mt-2 flex items-center gap-2 text-xs text-second/60"
                    role="status"
                  >
                    <FiLoader
                      className="animate-spin motion-reduce:animate-none"
                      size={12}
                      aria-hidden="true"
                    />
                    Mencari pelanggan…
                  </p>
                )}

                {!isLookingUpCustomer && matchedCustomer && (
                  <div className="mt-2 flex flex-col gap-2 rounded-xl border border-second4/30 bg-second4/5 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <FiCheck
                        size={14}
                        className="shrink-0 text-second4"
                        aria-hidden="true"
                      />
                      <span className="text-second/80">
                        Nomor ini terdaftar atas nama{" "}
                        <span className="font-semibold text-second">
                          {matchedCustomer.name || "(tanpa nama)"}
                        </span>
                        .
                      </span>
                      {nameDiffersFromMatch && (
                        <Tag tone="strong">Nama berbeda</Tag>
                      )}
                    </div>

                    <p className="text-xs text-second/70">
                      Mau pakai data pelanggan ini, atau pakai data berbeda
                      dengan nomor WA yang sama?
                    </p>

                    <div className="flex flex-col gap-2">
                      <label
                        className={`flex flex-1 cursor-pointer items-start gap-2 rounded-xl border p-4 transition-colors ${
                          customerChoice === CUSTOMER_CHOICE.EXISTING
                            ? "border-second4 bg-second4/10"
                            : "border-second/30 hover:border-second/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="customer_choice"
                          value={CUSTOMER_CHOICE.EXISTING}
                          checked={customerChoice === CUSTOMER_CHOICE.EXISTING}
                          onChange={() =>
                            handleCustomerChoiceChange(CUSTOMER_CHOICE.EXISTING)
                          }
                          disabled={isSaving}
                          className={`mt-0.5 size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-second">
                            Pakai data pelanggan ini
                          </span>
                          <span className="mt-2 block text-xs text-second/60">
                            Instagram dan alamat diisi otomatis dari data
                            pelanggan. Nama tetap bisa diedit.
                          </span>
                        </span>
                      </label>

                      <label
                        className={`flex flex-1 cursor-pointer items-start gap-2 rounded-xl border p-4 transition-colors ${
                          customerChoice === CUSTOMER_CHOICE.NEW
                            ? "border-second4 bg-second4/10"
                            : "border-second/30 hover:border-second/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="customer_choice"
                          value={CUSTOMER_CHOICE.NEW}
                          checked={customerChoice === CUSTOMER_CHOICE.NEW}
                          onChange={() =>
                            handleCustomerChoiceChange(CUSTOMER_CHOICE.NEW)
                          }
                          disabled={isSaving}
                          className={`mt-0.5 size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-second">
                            Pakai data berbeda
                          </span>
                          <span className="mt-2 block text-xs text-second/60">
                            Instagram dan alamat dikosongkan. Invoice tetap
                            tertaut ke pelanggan lama.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {!isLookingUpCustomer &&
                  !matchedCustomer &&
                  whatsappLongEnough && (
                    <p className="mt-2 text-xs text-second/60">
                      Nomor belum terdaftar. Pelanggan baru akan dibuat otomatis
                      saat invoice disimpan.
                    </p>
                  )}
              </FormField>
            </FieldGrid>

            <FormField
              label="Alamat pelanggan"
              htmlFor="customer_address"
              required
            >
              <textarea
                id="customer_address"
                name="customer_address"
                value={form.customer_address}
                onChange={handleChange}
                className={`${inputClass(false)} resize-y`}
                rows={3}
                maxLength={500}
                disabled={isSaving}
              />
            </FormField>

            <FormField label="Instagram pelanggan" htmlFor="customer_instagram">
              <input
                id="customer_instagram"
                name="customer_instagram"
                value={form.customer_instagram}
                onChange={handleChange}
                className={inputClass(false)}
                maxLength={100}
                disabled={isSaving}
                placeholder="@username"
              />
            </FormField>
          </FormSection>

          {/* Pembayaran & Pengiriman */}
          <FormSection
            title="Pembayaran dan pengiriman"
            description="Metode pembayaran dan ekspedisi yang dipakai untuk invoice ini."
          >
            <FieldGrid>
              <FormField label="Metode pembayaran" htmlFor="payment_method">
                <input
                  id="payment_method"
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleChange}
                  className={inputClass(false)}
                  maxLength={100}
                  disabled={isSaving}
                  placeholder="Contoh: Transfer BCA…"
                />
              </FormField>
              <FormField label="Pengiriman" htmlFor="ship">
                <input
                  id="ship"
                  name="ship"
                  value={form.ship}
                  onChange={handleChange}
                  className={inputClass(false)}
                  maxLength={100}
                  disabled={isSaving}
                  placeholder="Contoh: JNE…"
                />
              </FormField>
            </FieldGrid>
          </FormSection>

          {/* S&K */}
          <FormSection
            title="Syarat dan ketentuan"
            description="Pilihan di sini menggantikan S&K yang tersimpan di invoice ini. Template pembayaran di pengaturan tidak ikut berubah."
          >
            {!termsInitialized ? (
              <p
                className="flex items-center gap-2 text-sm text-second/60"
                role="status"
              >
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Memuat S&K…
              </p>
            ) : (
              <>
                <fieldset className="flex flex-col gap-4">
                  <legend className="sr-only">
                    Pilihan syarat dan ketentuan
                  </legend>
                  {TERMS_OPTIONS.map((option) => {
                    const isDisabled =
                      option.value === TERMS_MODES.TEMPLATE &&
                      isTemplateUnavailable &&
                      termsMode !== option.value;
                    return (
                      <RadioCard
                        key={option.value}
                        name="terms_mode"
                        value={option.value}
                        checked={termsMode === option.value}
                        onChange={() => handleTermsModeChange(option.value)}
                        disabled={isSaving || isDisabled}
                        title={option.title}
                        description={option.description}
                      />
                    );
                  })}
                </fieldset>

                {isTemplateUnavailable && (
                  <p className="text-sm text-second/60">
                    {isTermsError
                      ? "Template S&K gagal dimuat, jadi opsi template dinonaktifkan."
                      : "Template S&K belum diisi, jadi opsi template dinonaktifkan."}{" "}
                    <Link
                      href="/owner/invoices/terms"
                      className={`rounded font-semibold text-second4 underline ${FOCUS_RING}`}
                    >
                      Kelola template
                    </Link>
                  </p>
                )}

                {termsMode === TERMS_MODES.TEMPLATE && (
                  <div className="rounded-xl bg-second/5 p-4">
                    <p className="text-xs font-semibold text-second/60">
                      Preview template saat ini
                    </p>
                    <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-line break-words text-sm text-second">
                      {templateTerms}
                    </p>
                  </div>
                )}

                {termsMode === TERMS_MODES.CUSTOM && (
                  <FormField
                    label="S&K khusus invoice ini"
                    htmlFor="custom_terms"
                    required
                    error={
                      isCustomTooLong
                        ? `S&K maksimum ${TERMS_MAX_LENGTH} karakter.`
                        : ""
                    }
                  >
                    <textarea
                      id="custom_terms"
                      name="custom_terms"
                      value={customTerms}
                      onChange={(event) => setCustomTerms(event.target.value)}
                      className={`${inputClass(isCustomTooLong)} resize-y`}
                      rows={8}
                      placeholder="Tulis syarat dan ketentuan pembayaran…"
                      disabled={isSaving}
                    />
                    <p
                      className={`mt-2 text-right text-xs tabular-nums ${
                        isCustomTooLong
                          ? "font-semibold text-second2"
                          : "text-second/50"
                      }`}
                    >
                      {customTerms.length}/{TERMS_MAX_LENGTH}
                    </p>
                  </FormField>
                )}
              </>
            )}
          </FormSection>

          {/* Diskon */}
          <FormSection
            title="Diskon"
            description={`Subtotal item terkunci: ${formatCurrency(invoice.subtotal)}. Total akan dihitung ulang oleh sistem.`}
          >
            <FieldGrid>
              <FormField label="Diskon toko" htmlFor="store_discount">
                <PrefixedInput prefix="Rp">
                  <input
                    ref={storeDiscountRef}
                    id="store_discount"
                    name="store_discount"
                    type="text"
                    inputMode="numeric"
                    value={formatThousands(form.store_discount)}
                    onChange={handleDiscountChange}
                    className={`${inputClass(Boolean(discountLiveError))} rounded-l-none tabular-nums`}
                    placeholder="0"
                    maxLength={16}
                    disabled={isSaving}
                    aria-invalid={discountLiveError ? true : undefined}
                    aria-describedby={
                      discountLiveError ? "discount-desc" : undefined
                    }
                  />
                </PrefixedInput>
              </FormField>

              <FormField label="Diskon pelanggan" htmlFor="customer_discount">
                <PrefixedInput prefix="Rp">
                  <input
                    ref={customerDiscountRef}
                    id="customer_discount"
                    name="customer_discount"
                    type="text"
                    inputMode="numeric"
                    value={formatThousands(form.customer_discount)}
                    onChange={handleDiscountChange}
                    className={`${inputClass(Boolean(discountLiveError))} rounded-l-none tabular-nums`}
                    placeholder="0"
                    maxLength={16}
                    disabled={isSaving}
                    aria-invalid={discountLiveError ? true : undefined}
                    aria-describedby={
                      discountLiveError ? "discount-desc" : undefined
                    }
                  />
                </PrefixedInput>
              </FormField>
            </FieldGrid>

            {discountLiveError && (
              <ErrorText id="discount-desc">{discountLiveError}</ErrorText>
            )}
          </FormSection>

          {/* Konfirmasi final */}
          <FormSection
            title="Konfirmasi finalisasi"
            description="Invoice hanya dapat diedit satu kali. Setelah disimpan, invoice otomatis final dan terkunci."
          >
            <ToggleCard
              name="confirmed_finalization"
              checked={confirmedFinalization}
              onChange={(event) =>
                setConfirmedFinalization(event.target.checked)
              }
              disabled={isSaving}
              title="Saya memahami invoice akan langsung terkunci"
              description="Setelah disimpan, jatah edit habis dan status invoice otomatis menjadi final. Pastikan seluruh data sudah benar."
            />
          </FormSection>
        </div>

        {/* Sidebar sticky */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:-mt-4 xl:pt-4">
          <InvoiceSummary
            invoiceNumber={invoice.no_invoice}
            customerName={form.customer_name}
            matchedCustomerName={matchedCustomer?.name ?? null}
            customerChoice={customerChoice}
            isFinal={invoice.is_final}
            subtotal={Number(invoice.subtotal)}
            storeDiscount={storeDiscount}
            customerDiscount={customerDiscount}
            totalAmount={totalAmount}
          />

          <div className="flex flex-col gap-2">
            <PrimaryButton
              type="submit"
              disabled={
                isSaving ||
                !confirmedFinalization ||
                !initialForm ||
                !termsInitialized ||
                isCustomTooLong
              }
              aria-busy={isSaving}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
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
                <>
                  <FiSave size={16} aria-hidden="true" />
                  Simpan dan finalkan invoice
                </>
              )}
            </PrimaryButton>

            <CancelButton
              href={`/owner/invoices/${id}`}
              aria-disabled={isSaving}
              tabIndex={isSaving ? -1 : undefined}
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING} ${
                isSaving ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Batal
            </CancelButton>
          </div>
        </aside>
      </form>
    </div>
  );
}
