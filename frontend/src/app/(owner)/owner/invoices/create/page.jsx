"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link.js";
import { useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiFileText,
  FiLoader,
  FiMinus,
  FiPlus,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";

import { useCreateInvoice } from "../../../../features/invoices/hooks.js";
import { useGetCameras } from "../../../../features/cameras/hooks.js";
import { useGetTerms } from "../../../../features/terms/hooks.js";
import { useGetCustomers } from "../../../../features/customer/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import PrimaryButton from "../../../../../components/primary-button.jsx";
import CancelButton from "./../../../../../components/cancel-button";

/* -------------------------------------------------------------------------- */
/*  Design rules                                                              */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const TERMS_MAX_LENGTH = 5000;
const MAX_ITEMS = 10;
const MAX_QUANTITY = 10;
const CUSTOMER_LOOKUP_DEBOUNCE = 500;

const TERMS_MODES = {
  TEMPLATE: "template",
  NONE: "none",
  CUSTOM: "custom",
};

const TERMS_OPTIONS = [
  {
    value: TERMS_MODES.TEMPLATE,
    title: "Pakai template",
    description: "Salin S&K pembayaran yang tersimpan saat invoice dibuat.",
  },
  {
    value: TERMS_MODES.NONE,
    title: "Tanpa S&K",
    description: "Invoice ini dibuat tanpa syarat dan ketentuan.",
  },
  {
    value: TERMS_MODES.CUSTOM,
    title: "Buat sendiri",
    description: "Tulis S&K khusus hanya untuk invoice ini.",
  },
];

const INITIAL_FORM = {
  customer_name: "",
  customer_address: "",
  customer_whatsapp: "",
  customer_instagram: "",
  payment_method: "",
  ship: "",
  store_discount: "",
  customer_discount: "",
  is_final: false,
};

const FIELD_ORDER = [
  "customer_name",
  "customer_whatsapp",
  "customer_address",
  "items",
  "discount",
  "custom_terms",
];
const CUSTOMER_CHOICE = {
  EXISTING: "existing",
  NEW: "new",
};

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

/* Diskon produk = harga coret - harga jual (per unit). */
function discountPerUnit(strike, price) {
  const s = Number(strike);
  const p = Number(price);
  return Number.isFinite(s) && Number.isFinite(p) && s > p ? s - p : 0;
}

function normalizeWhatsapp(input) {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("62")) digits = `62${digits}`;
  return digits;
}

/* ------------------------------ Small pieces ------------------------------ */

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

function ToggleCard({
  name,
  checked,
  onChange,
  disabled,
  title,
  description,
  children,
}) {
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
      {checked && children && <div className="mt-4">{children}</div>}
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

function QuantityButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-8 items-center justify-center rounded-full border border-second/30 text-second shadow transition-colors hover:border-second4 hover:text-second4 disabled:opacity-50 touch-manipulation ${FOCUS_RING}`}
    >
      {children}
    </button>
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
  customerName,
  matchedCustomerName,
  itemCount,
  isFinal,
  subtotal,
  productDiscount,
  customerChoice,
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
            <Tag>{itemCount} item</Tag>
            {isFinal ? <Tag tone="grad">Final</Tag> : <Tag>Draft</Tag>}
          </div>
        </div>
      </div>

      <dl className="divide-y divide-second/10 border-y border-second/30">
        {productDiscount > 0 && (
          <>
            <SummaryRow label="Harga normal">
              {formatCurrency(subtotal + productDiscount)}
            </SummaryRow>
            <SummaryRow label="Diskon produk">
              - {formatCurrency(productDiscount)}
            </SummaryRow>
          </>
        )}
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
        Preview saja. Sistem tetap menghitung subtotal dan total akhir.
      </p>
    </section>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function CreateInvoicePage() {
  const router = useRouter();
  const createMutation = useCreateInvoice();
  const formRef = useRef(null);
  const itemsRef = useRef(null);

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [cameraSearch, setCameraSearch] = useState("");
  const storeDiscountRef = useRef(null);
  const customerDiscountRef = useRef(null);
  const pendingDiscountCaret = useRef(null);
  const [termsMode, setTermsMode] = useState(TERMS_MODES.TEMPLATE);
  const [customTerms, setCustomTerms] = useState("");
  const trimmedSearch = cameraSearch.trim();

  // ── Deteksi pelanggan via nomor WhatsApp ──
  const { data: customersResponse } = useGetCustomers();
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [customerChoice, setCustomerChoice] = useState(
    CUSTOMER_CHOICE.EXISTING,
  );
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const lookupTimerRef = useRef(null);

  const customersList = useMemo(() => {
    if (Array.isArray(customersResponse)) return customersResponse;
    return customersResponse?.data ?? customersResponse?.items ?? [];
  }, [customersResponse]);

  const isSubmitting = createMutation.isPending;

  const {
    data: cameraResponse,
    isLoading: isLoadingCameras,
    isError: isCameraError,
    error: cameraError,
    isFetching: isFetchingCameras,
    refetch: refetchCameras,
  } = useGetCameras({ search: trimmedSearch, page: 1 });

  const {
    data: termsResponse,
    isPending: isLoadingTerms,
    isError: isTermsError,
  } = useGetTerms();

  useEffect(() => {
    if (isCameraError) {
      const apiError = normalizeApiError(cameraError);
      notify.error(apiError.message);
    }
  }, [isCameraError, cameraError]);

  // Lookup pelanggan dari nomor WA (debounce).
  useEffect(() => {
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
  }, [form.customer_whatsapp, customersList]);
  const cameras = Array.isArray(cameraResponse)
    ? cameraResponse
    : Array.isArray(cameraResponse?.data)
      ? cameraResponse.data
      : [];

  const templateTerms = (
    termsResponse?.data?.value ??
    termsResponse?.value ??
    ""
  ).trim();

  const subtotal = useMemo(
    () =>
      selectedItems.reduce((total, item) => {
        const price = Number(item.camera.price);
        if (!Number.isFinite(price) || price < 0) return total;
        return total + price * item.quantity;
      }, 0),
    [selectedItems],
  );

  const productDiscountTotal = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) =>
          total +
          discountPerUnit(item.camera.strikethrough_price, item.camera.price) *
            item.quantity,
        0,
      ),
    [selectedItems],
  );

  const hasInvalidPrice = selectedItems.some((item) => {
    const price = Number(item.camera.price);
    return !Number.isFinite(price) || price < 0;
  });

  const storeDiscount =
    form.store_discount === "" ? 0 : Number(form.store_discount);
  const customerDiscount =
    form.customer_discount === "" ? 0 : Number(form.customer_discount);
  const totalAmount = subtotal - storeDiscount - customerDiscount;

  const selectedIds = new Set(selectedItems.map((item) => item.camera.id));
  const isCustomTooLong = customTerms.length > TERMS_MAX_LENGTH;

  const discountLiveError =
    totalAmount < 0 ? "Total diskon tidak boleh melebihi subtotal." : "";

  const errorOf = (name) =>
    name === "discount" ? errors.discount || discountLiveError : errors[name];

  function fieldProps(name, { hasDescription = false, required = true } = {}) {
    const error = errorOf(name);
    return {
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error || hasDescription ? `${name}-desc` : undefined,
      "aria-required": required || undefined,
    };
  }

  function clearError(name) {
    setErrors((previous) =>
      previous[name] ? { ...previous, [name]: undefined } : previous,
    );
  }

  function handleFormChange(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    clearError(name);
  }
  function handleCustomerChoiceChange(nextChoice) {
    setCustomerChoice(nextChoice);

    if (!matchedCustomer) return;

    if (nextChoice === CUSTOMER_CHOICE.EXISTING) {
      // Isi ulang IG & alamat dari data lama jika masih kosong.
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
      // "Pakai data berbeda": kosongkan IG & alamat supaya user isi sendiri.
      setForm((current) => ({
        ...current,
        customer_instagram: "",
        customer_address: "",
      }));
    }
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
    clearError("discount");
  }

  function handleTermsModeChange(nextMode) {
    setTermsMode(nextMode);
    clearError("custom_terms");
    if (
      nextMode === TERMS_MODES.CUSTOM &&
      customTerms === "" &&
      templateTerms
    ) {
      setCustomTerms(templateTerms);
    }
  }

  function addCamera(camera) {
    if (selectedIds.has(camera.id)) {
      notify.error("Kamera tersebut sudah ditambahkan.");
      return;
    }
    if (selectedItems.length >= MAX_ITEMS) {
      notify.error(`Maksimal ${MAX_ITEMS} jenis kamera dalam satu invoice.`);
      return;
    }
    setSelectedItems((current) => [...current, { camera, quantity: 1 }]);
    clearError("items");
  }

  function removeCamera(cameraId) {
    setSelectedItems((current) =>
      current.filter((item) => item.camera.id !== cameraId),
    );
  }

  function changeQuantity(cameraId, nextQuantity) {
    if (
      !Number.isInteger(nextQuantity) ||
      nextQuantity < 1 ||
      nextQuantity > MAX_QUANTITY
    ) {
      return;
    }
    setSelectedItems((current) =>
      current.map((item) =>
        item.camera.id === cameraId
          ? { ...item, quantity: nextQuantity }
          : item,
      ),
    );
  }

  function validate() {
    const found = {};

    if (!form.customer_name.trim()) {
      found.customer_name = "Nama pelanggan wajib diisi.";
    }

    const whatsapp = form.customer_whatsapp.trim();
    if (
      !/^\+?\d+$/.test(whatsapp) ||
      whatsapp.length < 8 ||
      whatsapp.length > 15
    ) {
      found.customer_whatsapp =
        "WhatsApp harus 8–15 karakter, hanya angka, dan boleh diawali tanda +.";
    }

    if (!form.customer_address.trim()) {
      found.customer_address = "Alamat pelanggan wajib diisi.";
    }

    if (selectedItems.length < 1 || selectedItems.length > MAX_ITEMS) {
      found.items = `Pilih 1–${MAX_ITEMS} jenis kamera untuk invoice.`;
    } else if (
      selectedItems.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > MAX_QUANTITY,
      )
    ) {
      found.items = `Kuantitas setiap kamera harus antara 1–${MAX_QUANTITY}.`;
    } else if (hasInvalidPrice) {
      found.items = "Ada kamera dengan harga yang tidak valid.";
    }

    if (totalAmount < 0) {
      found.discount = "Total diskon tidak boleh melebihi subtotal.";
    }

    if (termsMode === TERMS_MODES.CUSTOM) {
      if (!customTerms.trim()) {
        found.custom_terms =
          "S&K khusus masih kosong. Isi teksnya atau pilih opsi lain.";
      } else if (customTerms.length > TERMS_MAX_LENGTH) {
        found.custom_terms = `S&K maksimum ${TERMS_MAX_LENGTH} karakter.`;
      }
    }

    return found;
  }

  function focusFirstError(found) {
    const first = FIELD_ORDER.find((name) => found[name]);
    if (!first) return;
    if (first === "items") {
      itemsRef.current?.scrollIntoView({ block: "center" });
      return;
    }
    const target = first === "discount" ? "store_discount" : first;
    formRef.current?.elements?.namedItem(target)?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }

    const payload = {
      customer_name: form.customer_name.trim(),
      customer_address: form.customer_address.trim(),
      customer_whatsapp: form.customer_whatsapp.trim(),
      customer_instagram: form.customer_instagram.trim() || null,
      items: selectedItems.map(({ camera, quantity }) => ({
        camera_id: camera.id,
        quantity,
      })),
      is_final: form.is_final,
    };

    if (form.payment_method.trim()) {
      payload.payment_method = form.payment_method.trim();
    }
    if (form.ship.trim()) {
      payload.ship = form.ship.trim();
    }
    if (form.store_discount !== "") {
      payload.store_discount = Number(form.store_discount);
    }
    if (form.customer_discount !== "") {
      payload.customer_discount = Number(form.customer_discount);
    }

    if (termsMode === TERMS_MODES.NONE) {
      payload.terms_and_condition = null;
    } else if (termsMode === TERMS_MODES.CUSTOM) {
      payload.terms_and_condition = customTerms.trim();
    }

    try {
      await createMutation.mutateAsync(payload);
      notify.success("Invoice berhasil dibuat.");
      router.push("/owner/invoices");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
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

  const discountError = errorOf("discount");

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
          href="/owner/invoices"
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke invoice
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
              Buat <span className="text-grad">invoice</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Masukkan data pelanggan, pilih kamera, lalu atur diskon, S&K, dan
              status invoice.
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
          <FormSection
            title="Informasi pelanggan"
            description="Informasi ini akan disimpan sebagai bagian dari invoice."
          >
            <FieldGrid>
              <FormField
                label="Nama pelanggan"
                htmlFor="customer_name"
                required
                error={errorOf("customer_name")}
              >
                <input
                  id="customer_name"
                  name="customer_name"
                  autoComplete="off"
                  value={form.customer_name}
                  onChange={handleFormChange}
                  className={inputClass(errorOf("customer_name"))}
                  placeholder="Nama lengkap pelanggan…"
                  maxLength={100}
                  disabled={isSubmitting}
                  {...fieldProps("customer_name")}
                />
              </FormField>

              <FormField
                label="WhatsApp pelanggan"
                htmlFor="customer_whatsapp"
                required
                error={errorOf("customer_whatsapp")}
              >
                <input
                  id="customer_whatsapp"
                  name="customer_whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={form.customer_whatsapp}
                  onChange={handleFormChange}
                  className={`${inputClass(errorOf("customer_whatsapp"))} tabular-nums`}
                  placeholder="081234567890"
                  maxLength={15}
                  disabled={isSubmitting}
                  {...fieldProps("customer_whatsapp")}
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
                          disabled={isSubmitting}
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
                          disabled={isSubmitting}
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
              error={errorOf("customer_address")}
            >
              <textarea
                id="customer_address"
                name="customer_address"
                value={form.customer_address}
                onChange={handleFormChange}
                className={`${inputClass(errorOf("customer_address"))} resize-y`}
                rows={3}
                placeholder="Alamat lengkap pelanggan…"
                maxLength={500}
                disabled={isSubmitting}
                {...fieldProps("customer_address")}
              />
            </FormField>

            <FormField label="Instagram pelanggan" htmlFor="customer_instagram">
              <input
                id="customer_instagram"
                name="customer_instagram"
                autoComplete="off"
                spellCheck={false}
                value={form.customer_instagram}
                onChange={handleFormChange}
                className={inputClass(false)}
                placeholder="@username"
                maxLength={100}
                disabled={isSubmitting}
              />
            </FormField>
          </FormSection>

          <FormSection
            sectionRef={itemsRef}
            title="Pilih kamera"
            description="Cari kamera dan tambahkan ke invoice. Harga yang ditampilkan hanya estimasi; sistem akan memakai harga aktual dari data kamera."
            aside={
              <Tag tone="soft">
                {selectedItems.length}/{MAX_ITEMS} jenis
              </Tag>
            }
          >
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                type="search"
                name="camera_search"
                aria-label="Cari kamera"
                autoComplete="off"
                spellCheck={false}
                value={cameraSearch}
                onChange={(event) => setCameraSearch(event.target.value)}
                placeholder="Cari nama kamera atau 4 digit terakhir SKU…"
                className={`${inputClass(false)} pl-8`}
                disabled={isSubmitting}
              />
            </div>

            {isLoadingCameras ? (
              <div
                className="flex items-center justify-center gap-4 py-16 text-sm text-second/60"
                role="status"
              >
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Memuat daftar kamera…
              </div>
            ) : isCameraError ? (
              <div
                role="alert"
                className="flex flex-col items-start gap-4 rounded-xl border border-second2/30 bg-second2/5 p-4"
              >
                <p className="text-sm font-medium text-second2">
                  Gagal memuat daftar kamera.
                </p>
                <button
                  type="button"
                  onClick={() => refetchCameras()}
                  disabled={isFetchingCameras}
                  className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                >
                  Coba lagi
                </button>
              </div>
            ) : cameras.length === 0 ? (
              <p className="rounded-xl bg-second/5 p-4 text-sm text-second/60">
                Tidak ada kamera yang cocok dengan pencarian.
              </p>
            ) : (
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {cameras.map((camera) => {
                  const isSelected = selectedIds.has(camera.id);
                  const price = Number(camera.price);
                  const validPrice = Number.isFinite(price) && price >= 0;
                  return (
                    <div
                      key={camera.id}
                      className={`flex flex-col gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        isSelected
                          ? "border-second4 bg-second4/5"
                          : "border-second/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-second">
                          {camera.name}
                        </p>
                        <p className="mt-2 text-sm tabular-nums text-second/60">
                          {validPrice
                            ? formatCurrency(price)
                            : "Harga tidak tersedia"}
                        </p>
                        {discountPerUnit(camera.strikethrough_price, price) >
                          0 && (
                          <p className="mt-2 text-xs tabular-nums text-second4">
                            <span className="text-second/40 line-through">
                              {formatCurrency(camera.strikethrough_price)}
                            </span>{" "}
                            Diskon produk{" "}
                            {formatCurrency(
                              discountPerUnit(
                                camera.strikethrough_price,
                                price,
                              ),
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => addCamera(camera)}
                        disabled={
                          isSubmitting ||
                          isSelected ||
                          selectedItems.length >= MAX_ITEMS ||
                          !validPrice
                        }
                        className={`${BTN_BASE} shrink-0 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        {isSelected ? (
                          <>
                            <FiCheck size={16} aria-hidden="true" />
                            Ditambahkan
                          </>
                        ) : (
                          <>
                            <FiPlus size={16} aria-hidden="true" />
                            Tambahkan
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-sm text-second/60">
              Maksimal {MAX_ITEMS} jenis kamera, masing-masing dengan kuantitas
              1–{MAX_QUANTITY}. Stok tidak dicek dan tidak dikurangi untuk
              invoice admin.
            </p>

            {selectedItems.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-second/30 pt-4">
                <h3 className="text-sm font-semibold text-second">
                  Item invoice
                </h3>
                {selectedItems.map(({ camera, quantity }) => (
                  <div
                    key={camera.id}
                    className="flex flex-col gap-4 rounded-xl border border-second/30 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-second">
                        {camera.name}
                      </p>
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        {formatCurrency(camera.price)} × {quantity}
                      </p>
                      {discountPerUnit(
                        camera.strikethrough_price,
                        camera.price,
                      ) > 0 && (
                        <p className="mt-2 text-xs tabular-nums text-second4">
                          <span className="text-second/40 line-through">
                            {formatCurrency(camera.strikethrough_price)}
                          </span>{" "}
                          Diskon produk{" "}
                          {formatCurrency(
                            discountPerUnit(
                              camera.strikethrough_price,
                              camera.price,
                            ) * quantity,
                          )}
                        </p>
                      )}
                      <p className="mt-2 text-sm font-semibold tabular-nums text-second">
                        {formatCurrency(Number(camera.price) * quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <QuantityButton
                        label={`Kurangi kuantitas ${camera.name}`}
                        onClick={() => changeQuantity(camera.id, quantity - 1)}
                        disabled={isSubmitting || quantity <= 1}
                      >
                        <FiMinus size={16} aria-hidden="true" />
                      </QuantityButton>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums text-second">
                        {quantity}
                      </span>
                      <QuantityButton
                        label={`Tambah kuantitas ${camera.name}`}
                        onClick={() => changeQuantity(camera.id, quantity + 1)}
                        disabled={isSubmitting || quantity >= MAX_QUANTITY}
                      >
                        <FiPlus size={16} aria-hidden="true" />
                      </QuantityButton>
                      <button
                        type="button"
                        aria-label={`Hapus ${camera.name} dari invoice`}
                        onClick={() => removeCamera(camera.id)}
                        disabled={isSubmitting}
                        className={`ml-2 inline-flex size-8 items-center justify-center rounded-full bg-primary text-second2 shadow transition-colors hover:bg-second2 hover:text-primary disabled:opacity-50 touch-manipulation ${FOCUS_RING}`}
                      >
                        <FiTrash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {errors.items && (
              <ErrorText id="items-desc">{errors.items}</ErrorText>
            )}
          </FormSection>

          <FormSection
            title="Pembayaran dan pengiriman"
            description="Metode pembayaran dan ekspedisi yang dipakai untuk invoice ini."
          >
            <FieldGrid>
              <FormField label="Metode pembayaran" htmlFor="payment_method">
                <input
                  id="payment_method"
                  name="payment_method"
                  autoComplete="off"
                  value={form.payment_method}
                  onChange={handleFormChange}
                  className={inputClass(false)}
                  placeholder="Contoh: Transfer BCA…"
                  maxLength={100}
                  disabled={isSubmitting}
                />
              </FormField>
              <FormField label="Pengiriman" htmlFor="ship">
                <input
                  id="ship"
                  name="ship"
                  autoComplete="off"
                  value={form.ship}
                  onChange={handleFormChange}
                  className={inputClass(false)}
                  placeholder="Contoh: JNE…"
                  maxLength={100}
                  disabled={isSubmitting}
                />
              </FormField>
            </FieldGrid>
          </FormSection>

          <FormSection
            title="Syarat dan ketentuan"
            description="Pilih S&K pembayaran untuk invoice ini. Invoice menyimpan salinannya sendiri, jadi perubahan template di kemudian hari tidak mengubah invoice yang sudah dibuat."
          >
            <fieldset className="flex flex-col gap-4">
              <legend className="sr-only">Pilihan syarat dan ketentuan</legend>
              {TERMS_OPTIONS.map((option) => (
                <RadioCard
                  key={option.value}
                  name="terms_mode"
                  value={option.value}
                  checked={termsMode === option.value}
                  onChange={() => handleTermsModeChange(option.value)}
                  disabled={isSubmitting}
                  title={option.title}
                  description={option.description}
                />
              ))}
            </fieldset>

            {termsMode === TERMS_MODES.TEMPLATE && (
              <div className="rounded-xl bg-second/5 p-4">
                <p className="text-xs font-semibold text-second/60">
                  Preview template saat ini
                </p>
                {isLoadingTerms ? (
                  <p
                    className="mt-2 flex items-center gap-2 text-sm text-second/60"
                    role="status"
                  >
                    <FiLoader
                      className="animate-spin motion-reduce:animate-none"
                      size={16}
                      aria-hidden="true"
                    />
                    Memuat template S&K…
                  </p>
                ) : isTermsError ? (
                  <p role="alert" className="mt-2 text-sm text-second2">
                    Gagal memuat template. Server tetap akan menyalin template
                    saat invoice dibuat.
                  </p>
                ) : templateTerms ? (
                  <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-line break-words text-sm text-second">
                    {templateTerms}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-second/60">
                    Template belum diisi, sehingga invoice dibuat tanpa S&K.{" "}
                    <Link
                      href="/owner/invoices/terms"
                      className={`rounded font-semibold text-second4 underline ${FOCUS_RING}`}
                    >
                      Isi template
                    </Link>
                  </p>
                )}
              </div>
            )}

            {termsMode === TERMS_MODES.CUSTOM && (
              <FormField
                label="S&K khusus invoice ini"
                htmlFor="custom_terms"
                required
                error={errorOf("custom_terms")}
              >
                <textarea
                  id="custom_terms"
                  name="custom_terms"
                  value={customTerms}
                  onChange={(event) => {
                    setCustomTerms(event.target.value);
                    clearError("custom_terms");
                  }}
                  className={`${inputClass(
                    errorOf("custom_terms") || isCustomTooLong,
                  )} resize-y`}
                  rows={8}
                  placeholder="Tulis syarat dan ketentuan pembayaran…"
                  disabled={isSubmitting}
                  {...fieldProps("custom_terms")}
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
          </FormSection>

          <FormSection
            title="Diskon dan status"
            description="Nilai diskon dikurangkan dari subtotal. Sistem tetap menghitung total akhir."
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
                    autoComplete="off"
                    value={formatThousands(form.store_discount)}
                    onChange={handleDiscountChange}
                    className={`${inputClass(Boolean(discountError))} rounded-l-none tabular-nums`}
                    placeholder="0"
                    maxLength={16}
                    disabled={isSubmitting}
                    aria-invalid={discountError ? true : undefined}
                    aria-describedby={
                      discountError ? "discount-desc" : undefined
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
                    autoComplete="off"
                    value={formatThousands(form.customer_discount)}
                    onChange={handleDiscountChange}
                    className={`${inputClass(Boolean(discountError))} rounded-l-none tabular-nums`}
                    placeholder="0"
                    maxLength={16}
                    disabled={isSubmitting}
                    aria-invalid={discountError ? true : undefined}
                    aria-describedby={
                      discountError ? "discount-desc" : undefined
                    }
                  />
                </PrefixedInput>
              </FormField>
            </FieldGrid>

            {discountError && (
              <ErrorText id="discount-desc">{discountError}</ErrorText>
            )}

            <ToggleCard
              name="is_final"
              checked={form.is_final}
              onChange={handleFormChange}
              disabled={isSubmitting}
              title="Langsung finalkan invoice"
              description="Jika dicentang, invoice langsung final dan tidak dapat diedit. Jika tidak, invoice masih dapat diedit satu kali sesuai aturan backend."
            />
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:-mt-4 xl:pt-4">
          <InvoiceSummary
            customerName={form.customer_name}
            matchedCustomerName={matchedCustomer?.name ?? null}
            customerChoice={customerChoice}
            itemCount={selectedItems.length}
            isFinal={form.is_final}
            subtotal={subtotal}
            productDiscount={productDiscountTotal}
            storeDiscount={storeDiscount}
            customerDiscount={customerDiscount}
            totalAmount={totalAmount}
          />
          <div className="flex flex-col gap-2">
            <PrimaryButton
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {isSubmitting ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Membuat invoice…
                </>
              ) : (
                "Buat invoice"
              )}
            </PrimaryButton>

            <CancelButton
              href="/owner/invoices"
              aria-disabled={isSubmitting}
              tabIndex={isSubmitting ? -1 : undefined}
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING} ${
                isSubmitting ? "pointer-events-none opacity-50" : ""
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
