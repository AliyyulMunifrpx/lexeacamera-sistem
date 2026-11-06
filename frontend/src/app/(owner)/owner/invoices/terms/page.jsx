"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiFileText,
  FiLoader,
  FiRefreshCw,
  FiSave,
} from "react-icons/fi";

import {
  useGetTerms,
  useUpdateTerms,
} from "../../../../features/terms/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import PrimaryButton from "../../../../../components/primary-button.jsx";
import CancelButton from "../../../../../components/cancel-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const MAX_LENGTH = 5000;

function inputClass(hasError) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4 resize-y",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

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

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
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
      <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function InvoiceTermsPage() {
  const { data, isPending, isError, error, isFetching, refetch } =
    useGetTerms();
  const updateMutation = useUpdateTerms();

  const serverValue = data?.data?.value ?? data?.value ?? "";

  const [value, setValue] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || isPending || isError) return;
    setValue(serverValue);
    setInitialized(true);
  }, [initialized, isPending, isError, serverValue]);

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const trimmed = value.trim();
  const isDirty = trimmed !== serverValue.trim();
  const isTooLong = value.length > MAX_LENGTH;
  const isSaving = updateMutation.isPending;

  function handleSubmit(event) {
    event.preventDefault();

    if (isTooLong) {
      notify.error(`Maksimum ${MAX_LENGTH} karakter.`);
      return;
    }

    updateMutation.mutate(trimmed, {
      onSuccess: (response) => {
        const saved = response?.data?.value ?? "";
        setValue(saved);
        notify.success(
          saved
            ? "Template S&K berhasil disimpan."
            : "Template S&K dikosongkan.",
        );
      },
      onError: (err) => {
        notify.error(normalizeApiError(err).message);
      },
    });
  }

  function handleReset() {
    setValue(serverValue);
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
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
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat template S&K
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau sesi Anda, kemudian coba kembali.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
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
              Template <span className="text-grad">S&K Pembayaran</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Syarat dan ketentuan ini disalin ke setiap invoice baru.
              Mengubahnya tidak mengubah invoice yang sudah ada.
            </p>
          </div>
        </div>
      </header>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-lg font-bold text-second">
              Isi syarat dan ketentuan
            </h2>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kosongkan lalu simpan untuk menghapus template. Invoice berikutnya
              dibuat tanpa S&K.
            </p>
          </div>
          {isDirty ? (
            <Tag tone="strong">Ada perubahan</Tag>
          ) : (
            <Tag>Belum ada perubahan</Tag>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor="terms-value" className="sr-only">
            Isi syarat dan ketentuan
          </label>
          <textarea
            id="terms-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={14}
            disabled={isSaving}
            placeholder="Contoh: Pembayaran paling lambat 1x24 jam setelah invoice dibuat."
            className={inputClass(isTooLong)}
            aria-invalid={isTooLong ? true : undefined}
            aria-describedby={
              isTooLong ? "terms-value-error" : "terms-value-hint"
            }
          />

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            {isTooLong ? (
              <p
                id="terms-value-error"
                role="alert"
                className="flex items-start gap-2 text-sm text-second2"
              >
                <FiAlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                Maksimum {MAX_LENGTH} karakter.
              </p>
            ) : (
              <p id="terms-value-hint" className="text-xs text-second/60">
                Template disimpan per baris. Gunakan penomoran atau bullet untuk
                kerapian.
              </p>
            )}

            <p
              className={`shrink-0 text-right text-xs tabular-nums ${
                isTooLong ? "font-semibold text-second2" : "text-second/50"
              }`}
            >
              {value.length}/{MAX_LENGTH}
            </p>
          </div>
        </div>

        {/* Footer aksi */}
        <div className="flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <CancelButton
            type="button"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
          >
            Batalkan perubahan
          </CancelButton>

          <PrimaryButton
            type="submit"
            disabled={!isDirty || isSaving || isTooLong}
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
              <>
                <FiSave size={16} aria-hidden="true" />
                Simpan
              </>
            )}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
