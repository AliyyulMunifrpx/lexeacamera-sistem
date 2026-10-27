"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { FiChevronLeft, FiFileText, FiLoader, FiSave } from "react-icons/fi";

import {
  useGetTerms,
  useUpdateTerms,
} from "../../../../features/terms/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

const MAX_LENGTH = 5000;

export default function InvoiceTermsPage() {
  const { data, isPending, isError, error, refetch } = useGetTerms();
  const updateMutation = useUpdateTerms();

  const serverValue = data?.data?.value ?? data?.value ?? "";

  const [value, setValue] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Isi textarea dari GET /terms sekali saja saat data pertama tiba.
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

    // String kosong = mengosongkan terms (server menyimpan null).
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

  if (isPending) {
    return (
      <div
        className="flex min-h-64 items-center justify-center gap-3"
        role="status"
        aria-live="polite"
      >
        <FiLoader className="animate-spin text-second" size={22} />
        <span className="text-sm text-second/60">Memuat template S&K...</span>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="space-y-4 rounded-2xl border border-second/30 p-6">
        <h2 className="font-semibold text-second">Gagal memuat template S&K</h2>

        <p className="text-sm text-second/60">
          Periksa koneksi atau sesi Anda, kemudian coba kembali.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
          className={`rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-second/80 ${FOCUS_RING}`}
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/admin/invoices"
          className={`inline-flex items-center gap-1 text-sm font-medium text-second/60 transition-colors hover:text-second ${FOCUS_RING}`}
        >
          <FiChevronLeft size={16} />
          Kembali ke invoice
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <FiFileText size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Template S&K Pembayaran
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            Syarat dan ketentuan ini disalin ke setiap invoice baru. Mengubahnya
            tidak mengubah invoice yang sudah ada.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-second/30 p-4 sm:p-6"
      >
        <div className="space-y-2">
          <label
            htmlFor="terms-value"
            className="text-sm font-semibold text-second"
          >
            Isi syarat dan ketentuan
          </label>

          <textarea
            id="terms-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={14}
            disabled={isSaving}
            placeholder="Contoh: Pembayaran paling lambat 1x24 jam setelah invoice dibuat."
            className={`w-full resize-y rounded-2xl border bg-primary p-4 text-sm text-second placeholder:text-second/40 disabled:opacity-60 ${
              isTooLong ? "border-red-500" : "border-second/30"
            } ${FOCUS_RING}`}
          />

          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-second/60">
              Kosongkan lalu simpan untuk menghapus template. Invoice berikutnya
              dibuat tanpa S&K.
            </p>

            <p
              className={
                isTooLong ? "font-semibold text-red-500" : "text-second/60"
              }
            >
              {value.length}/{MAX_LENGTH}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => setValue(serverValue)}
            disabled={!isDirty || isSaving}
            className={`inline-flex items-center justify-center rounded-full border border-second/30 px-4 py-2 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS_RING}`}
          >
            Batalkan perubahan
          </button>

          <button
            type="submit"
            disabled={!isDirty || isSaving || isTooLong}
            className={`inline-flex items-center justify-center gap-2 rounded-full bg-second px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS_RING}`}
          >
            {isSaving ? (
              <FiLoader size={16} className="animate-spin" />
            ) : (
              <FiSave size={16} />
            )}
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
