"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link.js";
import { useRouter } from "next/navigation.js";
import {
  FiArrowLeft,
  FiAlertCircle,
  FiCheck,
  FiMinus,
  FiPlus,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";

import { useCreateInvoice } from "../../../../features/invoices/hooks.js";
import { useGetCameras } from "../../../../features/cameras/hooks.js";
import { useGetTerms } from "../../../../features/terms/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

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
function Field({ label, htmlFor, children, required = false }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>

      {children}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="space-y-5 rounded-2xl border border-second/15 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-second/60">{description}</p>
        )}
      </div>

      {children}
    </section>
  );
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const createMutation = useCreateInvoice();

  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedItems, setSelectedItems] = useState([]);
  const [cameraSearch, setCameraSearch] = useState("");
  const [discountError, setDiscountError] = useState("");
  const storeDiscountRef = useRef(null);
  const customerDiscountRef = useRef(null);
  const pendingDiscountCaret = useRef(null);
  const [termsMode, setTermsMode] = useState(TERMS_MODES.TEMPLATE);
  const [customTerms, setCustomTerms] = useState("");
  const trimmedSearch = cameraSearch.trim();

  const {
    data: cameraResponse,
    isLoading: isLoadingCameras,
    isError: isCameraError,
    error: cameraError,
    isFetching: isFetchingCameras,
    refetch: refetchCameras,
  } = useGetCameras({
    search: trimmedSearch,
    page: 1,
  });
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

  const cameras = Array.isArray(cameraResponse)
    ? cameraResponse
    : Array.isArray(cameraResponse?.data)
      ? cameraResponse.data
      : [];

  // Isi template S&K dari GET /terms (null kalau belum pernah diisi).
  const templateTerms = (
    termsResponse?.data?.value ??
    termsResponse?.value ??
    ""
  ).trim();

  const subtotal = useMemo(
    () =>
      selectedItems.reduce((total, item) => {
        const price = Number(item.camera.price);

        if (!Number.isFinite(price) || price < 0) {
          return total;
        }

        return total + price * item.quantity;
      }, 0),
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

  function handleFormChange(event) {
    const { name, value, checked, type } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }
  function handleDiscountChange(event) {
    const { name, value } = event.target;
    const cursorPosition = event.target.selectionStart ?? value.length;

    // Hitung jumlah digit sebelum kursor sebelum format diterapkan.
    const digitsBeforeCursor = value
      .slice(0, cursorPosition)
      .replace(/\D/g, "").length;

    // State tetap menyimpan angka mentah tanpa titik.
    const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

    // Maksimal 12 digit, tanpa nol di depan.
    if (digits.length > 12) return;

    pendingDiscountCaret.current = {
      name,
      digitCount: Math.min(digitsBeforeCursor, digits.length),
    };

    setForm((current) => ({
      ...current,
      [name]: digits,
    }));

    setDiscountError("");
  }

  function handleTermsModeChange(nextMode) {
    setTermsMode(nextMode);

    // Pertama kali pilih "Buat sendiri": mulai dari isi template supaya
    // tinggal diedit, bukan mengetik dari nol.
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

    if (selectedItems.length >= 10) {
      notify.error("Maksimal 10 jenis kamera dalam satu invoice.");
      return;
    }

    setSelectedItems((current) => [...current, { camera, quantity: 1 }]);
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
      nextQuantity > 10
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

  function validateForm() {
    if (!form.customer_name.trim()) {
      notify.error("Nama pelanggan wajib diisi.");
      return false;
    }

    if (!form.customer_address.trim()) {
      notify.error("Alamat pelanggan wajib diisi.");
      return false;
    }

    const whatsapp = form.customer_whatsapp.trim();

    if (
      !/^\+?\d+$/.test(whatsapp) ||
      whatsapp.length < 8 ||
      whatsapp.length > 15
    ) {
      notify.error(
        "WhatsApp harus terdiri dari 8–15 karakter, hanya angka, dan boleh diawali tanda +.",
      );
      return false;
    }

    if (selectedItems.length < 1 || selectedItems.length > 10) {
      notify.error("Pilih 1–10 jenis kamera untuk invoice.");
      return false;
    }

    if (
      selectedItems.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 10,
      )
    ) {
      notify.error("Kuantitas setiap kamera harus antara 1–10.");
      return false;
    }

    if (hasInvalidPrice) {
      notify.error("Ada kamera dengan harga yang tidak valid.");
      return false;
    }

    if (totalAmount < 0) {
      setDiscountError("Total diskon tidak boleh melebihi subtotal.");
      notify.error("Total diskon tidak boleh melebihi subtotal.");
      return false;
    }

    if (termsMode === TERMS_MODES.CUSTOM) {
      if (!customTerms.trim()) {
        notify.error(
          "S&K khusus masih kosong. Isi teksnya atau pilih opsi lain.",
        );
        return false;
      }

      if (customTerms.length > TERMS_MAX_LENGTH) {
        notify.error(`S&K maksimum ${TERMS_MAX_LENGTH} karakter.`);
        return false;
      }
    }

    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) return;

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

    // S&K:
    // - template : field tidak dikirim, server menyalin dari GET /terms
    // - none     : null, invoice dibuat tanpa terms
    // - custom   : string apa adanya untuk invoice ini
    if (termsMode === TERMS_MODES.NONE) {
      payload.terms_and_condition = null;
    } else if (termsMode === TERMS_MODES.CUSTOM) {
      payload.terms_and_condition = customTerms.trim();
    }

    try {
      await createMutation.mutateAsync(payload);

      notify.success("Invoice berhasil dibuat.");
      router.push("/admin/invoices");
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
      if (/\d/.test(formattedValue[position])) {
        digitsFound++;
      }

      position++;
    }

    input.setSelectionRange(position, position);
    pendingDiscountCaret.current = null;
  }, [form.store_discount, form.customer_discount]);
  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-8 text-second">
      <header>
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-2 text-sm text-second/65 transition hover:text-second"
        >
          <FiArrowLeft size={17} />
          Kembali ke Invoice
        </Link>

        <h1 className="mt-5 text-2xl font-bold">Buat Invoice</h1>

        <p className="mt-1 text-sm text-second/65">
          Masukkan data pelanggan, pilih kamera, lalu atur diskon, S&K, dan
          status invoice.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section
          title="Informasi Pelanggan"
          description="Informasi ini akan disimpan sebagai bagian dari invoice."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Nama pelanggan" htmlFor="customer-name" required>
              <input
                id="customer-name"
                name="customer_name"
                value={form.customer_name}
                onChange={handleFormChange}
                required
                maxLength={100}
                placeholder="Nama lengkap pelanggan"
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              label="WhatsApp pelanggan"
              htmlFor="customer-whatsapp"
              required
            >
              <input
                id="customer-whatsapp"
                name="customer_whatsapp"
                type="tel"
                value={form.customer_whatsapp}
                onChange={handleFormChange}
                required
                minLength={8}
                maxLength={15}
                pattern="\+?[0-9]+"
                title="8–15 karakter, hanya angka, boleh diawali +"
                placeholder="081234567890"
                className={INPUT_CLASS}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field
                label="Alamat pelanggan"
                htmlFor="customer-address"
                required
              >
                <textarea
                  id="customer-address"
                  name="customer_address"
                  value={form.customer_address}
                  onChange={handleFormChange}
                  required
                  maxLength={500}
                  rows={3}
                  placeholder="Alamat lengkap pelanggan"
                  className={`${INPUT_CLASS} resize-y`}
                />
              </Field>
            </div>

            <Field label="Instagram pelanggan" htmlFor="customer-instagram">
              <input
                id="customer-instagram"
                name="customer_instagram"
                value={form.customer_instagram}
                onChange={handleFormChange}
                maxLength={100}
                placeholder="@username"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Pilih Kamera"
          description="Cari kamera dan tambahkan ke invoice. Harga yang ditampilkan hanya estimasi; server akan memakai harga aktual dari data kamera."
        >
          <div className="relative">
            <FiSearch
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-second/45"
            />

            <input
              type="search"
              value={cameraSearch}
              onChange={(event) => setCameraSearch(event.target.value)}
              placeholder="Cari nama kamera atau 4 digit terakhir SKU..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>
          {isLoadingCameras ? (
            <div className="rounded-xl border border-second/15 p-5 text-sm text-second/60">
              Memuat daftar kamera...
            </div>
          ) : isCameraError ? (
            <div className="rounded-xl border border-red-500/20 p-5">
              <p className="text-sm text-second/70">
                Gagal memuat daftar kamera.
              </p>

              <button
                type="button"
                onClick={() => refetchCameras()}
                disabled={isFetchingCameras}
                className="mt-3 rounded-lg border border-second/25 px-3 py-2 text-sm hover:bg-second/10 disabled:opacity-50"
              >
                Coba lagi
              </button>
            </div>
          ) : cameras.length === 0 ? (
            <div className="rounded-xl border border-dashed border-second/20 p-6 text-center text-sm text-second/60">
              Tidak ada kamera yang cocok dengan pencarian.
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {cameras.map((camera) => {
                const isSelected = selectedIds.has(camera.id);
                const price = Number(camera.price);

                return (
                  <div
                    key={camera.id}
                    className="flex flex-col gap-3 rounded-xl border border-second/15 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {camera.name}
                      </p>

                      <p className="mt-1 text-xs text-second/60">
                        {Number.isFinite(price) && price >= 0
                          ? formatCurrency(price)
                          : "Harga tidak tersedia"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => addCamera(camera)}
                      disabled={
                        isSelected ||
                        selectedItems.length >= 10 ||
                        !Number.isFinite(price) ||
                        price < 0
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-second/25 px-3 py-2 text-sm font-medium transition hover:bg-second/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSelected ? (
                        <>
                          <FiCheck size={16} />
                          Ditambahkan
                        </>
                      ) : (
                        <>
                          <FiPlus size={16} />
                          Tambahkan
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-second/55">
            {selectedItems.length}/10 jenis kamera dipilih. Maksimal 10 jenis
            kamera, masing-masing dengan kuantitas 1–10. Stok tidak dicek dan
            tidak dikurangi untuk invoice admin.
          </p>

          {selectedItems.length > 0 && (
            <div className="space-y-3 border-t border-second/15 pt-5">
              <h3 className="font-semibold">Item Invoice</h3>

              {selectedItems.map(({ camera, quantity }) => (
                <div
                  key={camera.id}
                  className="flex flex-col gap-4 rounded-xl border border-second/15 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">
                      {camera.name}
                    </p>

                    <p className="mt-1 text-xs text-second/60">
                      {formatCurrency(camera.price)} × {quantity}
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {formatCurrency(Number(camera.price) * quantity)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Kurangi kuantitas ${camera.name}`}
                      onClick={() => changeQuantity(camera.id, quantity - 1)}
                      disabled={quantity <= 1}
                      className="rounded-lg border border-second/25 p-2 transition hover:bg-second/10 disabled:opacity-35"
                    >
                      <FiMinus size={15} />
                    </button>

                    <span className="w-8 text-center text-sm font-semibold tabular-nums">
                      {quantity}
                    </span>

                    <button
                      type="button"
                      aria-label={`Tambah kuantitas ${camera.name}`}
                      onClick={() => changeQuantity(camera.id, quantity + 1)}
                      disabled={quantity >= 10}
                      className="rounded-lg border border-second/25 p-2 transition hover:bg-second/10 disabled:opacity-35"
                    >
                      <FiPlus size={15} />
                    </button>

                    <button
                      type="button"
                      aria-label={`Hapus ${camera.name} dari invoice`}
                      onClick={() => removeCamera(camera.id)}
                      className="ml-2 rounded-lg border border-red-500/25 p-2 text-red-400 transition hover:bg-red-500/10"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Pembayaran dan Pengiriman">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Metode pembayaran" htmlFor="payment-method">
              <input
                id="payment-method"
                name="payment_method"
                value={form.payment_method}
                onChange={handleFormChange}
                maxLength={100}
                placeholder="Contoh: Transfer BCA"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Pengiriman" htmlFor="ship">
              <input
                id="ship"
                name="ship"
                value={form.ship}
                onChange={handleFormChange}
                maxLength={100}
                placeholder="Contoh: JNE"
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Syarat dan Ketentuan"
          description="Pilih S&K pembayaran untuk invoice ini. Invoice menyimpan salinannya sendiri, jadi perubahan template di kemudian hari tidak mengubah invoice yang sudah dibuat."
        >
          <fieldset className="space-y-3">
            <legend className="sr-only">Pilihan syarat dan ketentuan</legend>

            {TERMS_OPTIONS.map((option) => {
              const isActive = termsMode === option.value;

              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
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

          {termsMode === TERMS_MODES.TEMPLATE && (
            <div className="rounded-xl bg-second/5 p-4">
              <p className="text-xs font-medium text-second/60">
                Preview template saat ini
              </p>

              {isLoadingTerms ? (
                <p className="mt-2 text-sm text-second/60">
                  Memuat template S&K...
                </p>
              ) : isTermsError ? (
                <p className="mt-2 text-sm text-red-400">
                  Gagal memuat template. Server tetap akan menyalin template
                  saat invoice dibuat.
                </p>
              ) : templateTerms ? (
                <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line break-words text-sm">
                  {templateTerms}
                </p>
              ) : (
                <p className="mt-2 text-sm text-second/60">
                  Template belum diisi, sehingga invoice dibuat tanpa S&K.{" "}
                  <Link
                    href="/admin/invoices/terms"
                    className={`font-semibold text-second underline ${FOCUS_RING}`}
                  >
                    Isi template
                  </Link>
                </p>
              )}
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
        </Section>

        <Section
          title="Diskon dan Total"
          description="Nilai di bawah adalah preview. Backend tetap menghitung subtotal dan total akhir."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Diskon toko (Rp)" htmlFor="store-discount">
              <input
                ref={storeDiscountRef}
                id="store-discount"
                name="store_discount"
                type="text"
                inputMode="numeric"
                value={formatThousands(form.store_discount)}
                onChange={handleDiscountChange}
                maxLength={12}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Diskon pelanggan (Rp)" htmlFor="customer-discount">
              <input
                ref={customerDiscountRef}
                id="customer-discount"
                name="customer_discount"
                type="text"
                inputMode="numeric"
                value={formatThousands(form.customer_discount)}
                onChange={handleDiscountChange}
                maxLength={12}
                placeholder="0"
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <div className="space-y-3 rounded-xl bg-second/5 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-second/60">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-second/60">Diskon toko</span>
              <span>− {formatCurrency(storeDiscount)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-second/60">Diskon pelanggan</span>
              <span>− {formatCurrency(customerDiscount)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-second/15 pt-3">
              <span className="font-semibold">Estimasi Total</span>
              <span className="text-lg font-bold">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {(discountError || totalAmount < 0) && (
            <p className="flex items-start gap-2 text-sm text-red-400">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              {discountError || "Total diskon tidak boleh melebihi subtotal."}
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-second/15 p-4">
            <input
              type="checkbox"
              name="is_final"
              checked={form.is_final}
              onChange={handleFormChange}
              className="mt-1 size-4 accent-second"
            />

            <span>
              <span className="block text-sm font-medium">
                Langsung finalkan invoice
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-second/60">
                Jika dicentang, invoice langsung final dan tidak dapat diedit.
                Jika tidak dicentang, invoice masih dapat diedit satu kali
                sesuai aturan backend.
              </span>
            </span>
          </label>
        </Section>

        <div className="flex flex-col-reverse gap-3 border-t border-second/15 pt-5 sm:flex-row sm:justify-end">
          <Link
            href="/admin/invoices"
            className="rounded-xl border border-second/25 px-5 py-3 text-center text-sm font-medium transition hover:bg-second/10"
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={
              createMutation.isPending ||
              selectedItems.length === 0 ||
              hasInvalidPrice ||
              isCustomTooLong
            }
            className="rounded-xl bg-second px-5 py-3 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? "Membuat Invoice..." : "Buat Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
