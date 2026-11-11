"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link.js";
import { useSearchParams } from "next/navigation.js";
import {
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiDollarSign,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";

import { useGetPayrolls } from "../../../features/payrolls/hooks.js";
import { useGetEmployee } from "../../../features/employees/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import PrimaryButton from "./../../../../components/primary-button";

import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  PAYROLL_PATH,
  STATUS,
  Tag,
  describePayrollError,
  formatCurrency,
  formatDate,
  inputClass,
  labelClass,
} from "../../../../components/owner/payroll-shared.jsx";

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-grad p-4 text-primary shadow-lg shadow-second4/25 sm:p-8">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-second">
        <FiDollarSign size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-primary/80">{label}</p>
        <p className="mt-2 truncate text-2xl font-bold tabular-nums sm:text-3xl">
          {formatCurrency(value)}
        </p>
        {hint && <p className="mt-2 text-xs text-primary/80">{hint}</p>}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <div className="h-16 animate-pulse rounded-2xl bg-second/10" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-second/10" />
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

function PayrollsContent() {
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("employee_id") ?? "";

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Jeda sebentar setelah mengetik supaya tidak memuat ulang di setiap huruf.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const query = useGetPayrolls({
    employee_id: employeeId,
    status,
    search,
    date_from: rangeInvalid ? "" : dateFrom,
    date_to: rangeInvalid ? "" : dateTo,
    page,
  });
  const { data, isPending, isError, isFetching, error, refetch } = query;

  const employeeQuery = useGetEmployee(employeeId || undefined);

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(describePayrollError(error, normalizeApiError));
  }, [isError, error]);

  const rows = data?.data ?? [];
  const summary = data?.summary ?? { paid_amount: 0, pending_amount: 0 };
  const paging = data?.paging;
  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? page;
  const perPage = paging?.per_page ?? rows.length;
  const startItem = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, total);

  const hasFilters =
    searchInput !== "" || status !== "" || dateFrom !== "" || dateTo !== "";

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  if (isPending) return <LoadingState />;

  if (isError && !data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertCircle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat slip gaji
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi Anda, lalu coba kembali.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_PRIMARY} mt-4`}
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiDollarSign size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Gaji <span className="text-grad">karyawan</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kelola slip gaji dan catat gaji yang sudah dicairkan.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data slip gaji"
            className={BTN_OUTLINE}
          >
            <FiRefreshCw
              size={16}
              className={isFetching ? "animate-spin" : ""}
              aria-hidden="true"
            />
            Perbarui
          </button>
          <Link
            href={`${PAYROLL_PATH}/create${employeeId ? `?employee_id=${employeeId}` : ""}`}
            className={BTN_PRIMARY}
          >
            <FiPlus size={16} aria-hidden="true" />
            Buat slip gaji
          </Link>
        </div>
      </header>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Sudah cair"
          value={summary.paid_amount}
          hint="Dihitung sebagai pengeluaran gaji di laporan"
        />
        <SummaryCard
          label="Belum cair"
          value={summary.pending_amount}
          hint="Belum mengurangi laporan"
        />
      </div>
      <p className="-mt-4 text-xs text-second/60">
        Angka di atas dihitung dari semua slip yang sesuai filter, bukan hanya
        halaman ini.
      </p>

      {/* Filter */}
      <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
        {employeeId && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="strong">Karyawan: {employeeQuery.data?.name ?? "…"}</Tag>
            <Link
              href={PAYROLL_PATH}
              className={`inline-flex items-center gap-2 rounded-full text-xs font-semibold text-second/60 hover:text-second2 ${FOCUS_RING}`}
            >
              <FiX size={14} aria-hidden="true" />
              Tampilkan semua karyawan
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <label htmlFor="payroll-search" className={labelClass}>
              Cari
            </label>
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                id="payroll-search"
                type="search"
                autoComplete="off"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nama atau jabatan…"
                className={`${inputClass(false)} pl-8`}
              />
            </div>
          </div>

          <div className="min-w-0">
            <label htmlFor="payroll-status" className={labelClass}>
              Status
            </label>
            <select
              id="payroll-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={inputClass(false)}
            >
              <option value="">Semua</option>
              {Object.entries(STATUS).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="payroll-from" className={labelClass}>
              Tanggal cair dari
            </label>
            <input
              id="payroll-from"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className={`${inputClass(rangeInvalid)} tabular-nums`}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="payroll-to" className={labelClass}>
              Sampai
            </label>
            <input
              id="payroll-to"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              className={`${inputClass(rangeInvalid)} tabular-nums`}
            />
          </div>
        </div>

        {rangeInvalid && (
          <ErrorText id="payroll-range-desc">
            Tanggal awal tidak boleh setelah tanggal akhir.
          </ErrorText>
        )}

        {hasFilters && (
          <div>
            <button
              type="button"
              onClick={resetFilters}
              className={`${BTN_OUTLINE} hover:border-second2 hover:text-second2`}
            >
              Reset filter
            </button>
          </div>
        )}
      </section>

      {/* Daftar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar slip gaji</h2>
          <p className="mt-2 text-sm text-second/60">
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(total)} slip
          </p>
        </div>
        {hasFilters && <Tag tone="strong">Filter aktif</Tag>}
      </div>

      <div className="relative min-h-40">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-8 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-xl border border-second/30 bg-primary px-4 py-2 shadow-xl shadow-second/5">
              <FiLoader
                className="animate-spin text-second4"
                size={16}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-second">
                Memperbarui data…
              </span>
            </div>
          </div>
        )}

        {rows.length > 0 ? (
          <div
            className={`overflow-x-auto rounded-2xl border border-second/30 transition-opacity ${
              isFetching ? "opacity-40" : "opacity-100"
            }`}
          >
            <table className="min-w-full text-left text-sm">
              <thead className="bg-grad text-primary">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Karyawan
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-2 font-semibold"
                  >
                    Tanggal cair
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-2 text-right font-semibold"
                  >
                    Penerimaan
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-2 text-right font-semibold"
                  >
                    Total
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-2 font-semibold"
                  >
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-second/10">
                {rows.map((row, index) => {
                  const state = STATUS[row.status] ?? STATUS.PENDING;
                  return (
                    <tr
                      key={row.id}
                      className={`align-top transition-colors hover:bg-second/20 ${
                        index % 2 === 0 ? "bg-second3/20" : ""
                      }`}
                    >
                      <td className="min-w-48 px-4 py-4">
                        <p className="break-words font-semibold text-second">
                          {row.employee_name}
                        </p>
                        <p className="mt-2 text-xs text-second/60">
                          {row.job_title}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 tabular-nums text-second/70">
                        {formatDate(row.disbursement_date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-second/70">
                        {row.item_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-second">
                        {formatCurrency(row.total_amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <Tag tone={state.tone}>{state.label}</Tag>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        <PrimaryButton href={`${PAYROLL_PATH}/${row.id}`}>
                          Detail
                        </PrimaryButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiDollarSign size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters || employeeId
                ? "Slip gaji tidak ditemukan"
                : "Belum ada slip gaji"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters || employeeId
                ? "Tidak ada slip yang sesuai dengan filter yang dipilih."
                : "Buat slip gaji pertama untuk mulai mencatat gaji karyawan."}
            </p>
          </div>
        )}
      </div>

      {/* Halaman */}
      {total > 0 && (
        <div className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-second/60">
            Halaman {safePage} dari {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className={BTN_OUTLINE}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              className={BTN_PRIMARY}
            >
              Berikutnya
              <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayrollsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PayrollsContent />
    </Suspense>
  );
}
