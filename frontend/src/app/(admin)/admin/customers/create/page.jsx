"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateCustomer } from "../../../../features/customer/hooks.js";
import PrimaryButton from "./../../../../../components/primary-button";
import CancelButton from "./../../../../../components/cancel-button";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

const WA_REGEX = /^\+?\d{8,15}$/;

const FIELD_ORDER = ["name", "whatsapp", "address", "instagram"];

function validate(values) {
  const errors = {};
  const name = values.name.trim();
  const address = values.address.trim();
  const whatsapp = values.whatsapp.trim();
  const instagram = values.instagram.trim();

  if (!name) errors.name = "Nama wajib diisi.";
  else if (name.length > 100) errors.name = "Maksimum 100 karakter.";

  if (!whatsapp) errors.whatsapp = "Nomor WhatsApp wajib diisi.";
  else if (!WA_REGEX.test(whatsapp))
    errors.whatsapp =
      "Gunakan 8–15 digit, boleh diawali +, tanpa spasi atau tanda hubung.";

  if (!address) errors.address = "Alamat wajib diisi.";
  else if (address.length > 500) errors.address = "Maksimum 500 karakter.";

  if (instagram.length > 100) errors.instagram = "Maksimum 100 karakter.";

  return errors;
}

function getApiError(err) {
  const code =
    err?.response?.data?.errors ?? err?.data?.errors ?? err?.errors ?? null;
  if (typeof code === "string") return ERROR_MESSAGES[code] ?? code;
  return err?.message || "Terjadi kesalahan. Silakan coba lagi.";
}

/* ---------- Kecil-kecil ---------- */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

function inputClass(hasError) {
  return [
    "w-full rounded-xl border bg-primary px-4 py-3 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "focus:outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

function Field({ id, label, required, error, hint, children }) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-second">
        {label}
        {required ? (
          <span className="ml-1 text-second2" aria-hidden="true">
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
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm text-second2"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="mt-0.5 size-4 shrink-0 fill-current"
          >
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-.75 4h1.5v5h-1.5V6zm0 6.5h1.5V14h-1.5v-1.5z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-second/55">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 animate-spin motion-reduce:animate-none"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SummaryRow({ label, children, mono }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <dt className="w-28 shrink-0 text-sm text-second/55">{label}</dt>
      <dd
        className={`min-w-0 break-words text-sm text-second ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

/* ---------- Halaman ---------- */

export default function CustomerCreatePage() {
  const router = useRouter();
  const create = useCreateCustomer();
  const uid = useId();
  const formRef = useRef(null);

  const [values, setValues] = useState({
    name: "",
    address: "",
    whatsapp: "",
    instagram: "",
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [created, setCreated] = useState(null);

  const isPending = create.isPending ?? create.isLoading ?? false;
  const idOf = (name) => `${uid}-${name}`;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
    if (apiError) setApiError("");
  };

  const focusFirstError = (found) => {
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) formRef.current?.elements?.namedItem(first)?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPending) return;
    setApiError("");

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }

    const instagram = values.instagram.trim().replace(/^@/, "");
    const payload = {
      name: values.name.trim(),
      address: values.address.trim(),
      whatsapp: values.whatsapp.trim(),
      instagram: instagram === "" ? null : instagram,
    };

    try {
      const res = await create.mutateAsync(payload);
      setCreated(res?.data ?? res ?? payload);
    } catch (err) {
      const apiError = normalizeApiError(err);
      notify.error(apiError.message);
    }
  };

  const handleReset = () => {
    setValues({ name: "", address: "", whatsapp: "", instagram: "" });
    setErrors({});
    setApiError("");
    setCreated(null);
  };

  const btnBase =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition touch-manipulation";

  return (
    <main className="min-h-dvh bg-primary px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-xl">
        {/* Header */}
        <header className="mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className={`-ml-2 mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-second/60 transition hover:text-second4 ${focusRing}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-4 fill-current"
            >
              <path d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z" />
            </svg>
            Kembali
          </button>

          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <svg viewBox="0 0 24 24" className="size-6 fill-current">
                <path d="M15 12a4 4 0 100-8 4 4 0 000 8zm-9 1.5v-2H4v2H2v2h2v2h2v-2h2v-2H6zM15 14c-3 0-8 1.5-8 4.5V20h16v-1.5c0-3-5-4.5-8-4.5z" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Tambah <span className="text-grad">Pelanggan</span>
              </h1>
              <p className="mt-1 text-pretty text-sm text-second/60">
                Daftarkan pelanggan langsung tanpa menunggu mereka mengisi form.
              </p>
            </div>
          </div>
        </header>

        {/* Error dari server */}
        {apiError && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-second2/30 bg-second2/5 px-4 py-3 text-sm text-second2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="mt-0.5 size-4 shrink-0 fill-current"
            >
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-.75 4h1.5v5h-1.5V6zm0 6.5h1.5V14h-1.5v-1.5z" />
            </svg>
            <p>{apiError}</p>
          </div>
        )}

        {created ? (
          /* Sukses */
          <section
            aria-live="polite"
            className="overflow-hidden rounded-2xl border border-second/30 bg-primary shadow-xl shadow-second/5"
          >
            <div className="flex items-center gap-3 border-b border-second/30 bg-second3/5 px-6 py-5">
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full bg-second3 text-primary"
              >
                <svg viewBox="0 0 20 20" className="size-5 fill-current">
                  <path d="M8.2 13.6L4.8 10.2l1.2-1.2 2.2 2.2 5.8-5.8 1.2 1.2-7 7z" />
                </svg>
              </span>
              <div>
                <h2 className="font-semibold text-second">
                  Pelanggan berhasil ditambahkan
                </h2>
                <p className="text-sm text-second/60">
                  Data tersimpan dan siap dipakai untuk pesanan.
                </p>
              </div>
            </div>

            <dl className="divide-y divide-second/10 px-6">
              <SummaryRow label="ID" mono>
                {created.id}
              </SummaryRow>
              <SummaryRow label="Nama">{created.name}</SummaryRow>
              <SummaryRow label="WhatsApp" mono>
                {created.whatsapp}
              </SummaryRow>
              <SummaryRow label="Instagram">
                {created.instagram ? `@${created.instagram}` : "–"}
              </SummaryRow>
              <SummaryRow label="Alamat">{created.address}</SummaryRow>
            </dl>

            <div className="flex flex-col-reverse gap-3 border-t border-second/30 px-6 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => router.back()}
                className={`${btnBase} border border-second/30 text-second hover:border-second4 hover:text-second4 ${focusRing}`}
              >
                Selesai
              </button>
              <button
                type="button"
                onClick={handleReset}
                className={`${btnBase} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${focusRing}`}
              >
                Tambah Pelanggan Lagi
              </button>
            </div>
          </section>
        ) : (
          /* Form */
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            noValidate
            className="rounded-2xl border border-second/30 bg-primary shadow-xl shadow-second/5"
          >
            <div className="flex flex-col gap-6 p-6 sm:p-8">
              <Field
                id={idOf("name")}
                label="Nama"
                required
                error={errors.name}
              >
                {(a11y) => (
                  <input
                    {...a11y}
                    name="name"
                    type="text"
                    autoComplete="off"
                    value={values.name}
                    onChange={handleChange}
                    maxLength={100}
                    placeholder="Contoh: Andi…"
                    className={inputClass(errors.name)}
                    disabled={isPending}
                  />
                )}
              </Field>

              <Field
                id={idOf("whatsapp")}
                label="Nomor WhatsApp"
                required
                error={errors.whatsapp}
                hint="Contoh 08111222333 atau +628111222333. Otomatis disimpan sebagai 628…"
              >
                {(a11y) => (
                  <input
                    {...a11y}
                    name="whatsapp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    spellCheck={false}
                    value={values.whatsapp}
                    onChange={handleChange}
                    placeholder="08111222333…"
                    className={`${inputClass(errors.whatsapp)} tabular-nums`}
                    disabled={isPending}
                  />
                )}
              </Field>

              <Field
                id={idOf("address")}
                label="Alamat"
                required
                error={errors.address}
              >
                {(a11y) => (
                  <>
                    <textarea
                      {...a11y}
                      name="address"
                      rows={3}
                      autoComplete="off"
                      value={values.address}
                      onChange={handleChange}
                      maxLength={500}
                      placeholder="Contoh: Jl. Melati 2, Magelang…"
                      className={`${inputClass(errors.address)} resize-y`}
                      disabled={isPending}
                    />
                    <span className="self-end text-xs tabular-nums text-second/40">
                      {values.address.length}/500
                    </span>
                  </>
                )}
              </Field>

              <Field
                id={idOf("instagram")}
                label="Instagram"
                error={errors.instagram}
              >
                {(a11y) => (
                  <div className="flex">
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center rounded-l-xl border border-r-0 border-second/30 bg-second/5 px-4 text-sm text-second/50"
                    >
                      @
                    </span>
                    <input
                      {...a11y}
                      name="instagram"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={values.instagram}
                      onChange={handleChange}
                      maxLength={100}
                      placeholder="andi.id…"
                      className={`${inputClass(errors.instagram)} rounded-l-none`}
                      disabled={isPending}
                    />
                  </div>
                )}
              </Field>
            </div>

            <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-second/30 bg-second/[0.02] px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
              <CancelButton
                type="button"
                onClick={() => router.back()}
                disabled={isPending}
              >
                Batal
              </CancelButton>
              <PrimaryButton
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending && <Spinner />}
                {isPending ? "Menyimpan…" : "Simpan Pelanggan"}
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
