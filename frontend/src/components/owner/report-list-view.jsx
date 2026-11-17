"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useRouter } from "next/navigation";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiChevronLeft,
  FiChevronRight,
  FiLoader,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";

import {
  useCreateDailyReport,
  useGetDailyReports,
} from "../../app/features/daily-reports/hooks.js";
import { ExportReportsButton } from "./export-reports-button.jsx";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  FormSection,
  Tag,
  describeError,
  digitsOnly,
  formatDate,
  formatMoney,
  formatThousands,
  inputClass,
  labelClass,
  MAX_AMOUNT,
  todayWib,
} from "./daily-reports-shared.jsx";
import notify from "../../lib/notify.js";
// ASUMSI: komponen yang sama dengan halaman QC (src/components). Sesuaikan path jika beda.
import PrimaryButton from "../primary-button.jsx";
import RefreshButton from "../refresh-button.jsx";

const formatNumber = (value = 0) =>
  new Intl.NumberFormat("id-ID").format(value);

// "2026-11-17" -> "17 Nov 2026"
function formatShortDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

/* --------------------------------- Create --------------------------------- */

function CreateReportPanel({ onCancel }) {
  const router = useRouter();
  const createReport = useCreateDailyReport();

  const [date, setDate] = useState(todayWib());
  const [opening, setOpening] = useState("");
  const [errors, setErrors] = useState({});

  function handleSubmit(event) {
    event.preventDefault();

    if (createReport.isPending) return;

    const found = {};

    if (opening === "") found.opening_balance = "Saldo awal wajib diisi.";
    else if (Number(opening) > MAX_AMOUNT) {
      found.opening_balance = "Nominal terlalu besar.";
    }

    if (date && date > todayWib()) {
      found.date = "Tanggal tidak boleh di masa depan.";
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = { opening_balance: Number(opening) };
    if (date) payload.date = date;

    createReport.mutate(payload, {
      onSuccess: (report) => {
        notify.success("Laporan harian berhasil dibuat.");
        router.push(`/admin/daily-reports/${report.id}`);
      },
      onError: (error) => notify.error(describeError(error)),
    });
  }

  const disabled = createReport.isPending;

  return (
    <FormSection
      title="Buat laporan baru"
      description="Satu laporan untuk satu hari. Isi saldo awal, lalu catat pemasukan dan pengeluaran di halaman detail."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="report-date" className={labelClass}>
              Tanggal
            </label>
            <input
              id="report-date"
              type="date"
              value={date}
              max={todayWib()}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass(Boolean(errors.date))}
              disabled={disabled}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? "report-date-desc" : undefined}
            />
            {errors.date ? (
              <ErrorText id="report-date-desc">{errors.date}</ErrorText>
            ) : (
              <p className="mt-2 text-sm text-second/60">
                Tanggal tidak bisa diubah setelah dibuat.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="opening-balance" className={labelClass}>
              Saldo awal
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <div className="flex">
              <span
                aria-hidden="true"
                className="inline-flex shrink-0 items-center rounded-l-xl border border-r-0 border-second/30 bg-second/5 px-4 text-sm font-medium text-second/60"
              >
                Rp
              </span>
              <input
                id="opening-balance"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatThousands(opening)}
                onChange={(event) => {
                  setOpening(digitsOnly(event.target.value));
                  setErrors((previous) => ({
                    ...previous,
                    opening_balance: undefined,
                  }));
                }}
                placeholder="50.000"
                className={`${inputClass(Boolean(errors.opening_balance))} rounded-l-none tabular-nums`}
                disabled={disabled}
                aria-required="true"
                aria-invalid={errors.opening_balance ? true : undefined}
                aria-describedby={
                  errors.opening_balance ? "opening-balance-desc" : undefined
                }
              />
            </div>
            {errors.opening_balance && (
              <ErrorText id="opening-balance-desc">
                {errors.opening_balance}
              </ErrorText>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={disabled} className={BTN_PRIMARY}>
            {disabled ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Membuat…
              </>
            ) : (
              "Buat laporan"
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className={BTN_OUTLINE}
          >
            Batal
          </button>
        </div>
      </form>
    </FormSection>
  );
}

/* ---------------------------------- View ---------------------------------- */

export default function ReportListView({ role }) {
  const isAdmin = role === "admin";
  const basePath = `/${role}/daily-reports`;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [transferred, setTransferred] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  // Pencarian nama kasir (owner) ditunda 400 ms, sama seperti halaman QC.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const filters = {
    date_from: rangeInvalid ? "" : dateFrom,
    date_to: rangeInvalid ? "" : dateTo,
    transferred,
    cashier: isAdmin ? "" : search,
  };

  const params = {
    page,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== ""),
    ),
  };

  const { data, isPending, isError, isFetching, error, refetch } =
    useGetDailyReports(params);

  useEffect(() => {
    if (isError && error) notify.error(describeError(error));
  }, [isError, error]);

  const list = data?.data ?? [];
  const paging = data?.paging;
  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? page;

  const hasFilters = Boolean(
    (!isAdmin && search) || transferred || dateFrom || dateTo,
  );

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setTransferred("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiBookOpen size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              <span className="text-grad">Laporan harian</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              {isAdmin
                ? "Catatan kas harian milik Anda. Transfer ke owner saat toko tutup."
                : "Laporan kas harian dari semua kasir."}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <RefreshButton
            onClick={() => refetch()}
            isFetching={isFetching}
          ></RefreshButton>
          <ExportReportsButton
            filters={filters}
            disabled={isPending || list.length === 0}
          />
          {isAdmin && !showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className={BTN_PRIMARY}
            >
              <FiPlus size={16} aria-hidden="true" />
              Buat laporan
            </button>
          )}
        </div>
      </header>

      {isAdmin && showCreate && (
        <CreateReportPanel onCancel={() => setShowCreate(false)} />
      )}

      {/* Filter */}
      <section
        aria-label="Filter laporan"
        className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        {!isAdmin && (
          <div className="min-w-0">
            <label htmlFor="report-search" className={labelClass}>
              Cari
            </label>
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                id="report-search"
                type="search"
                autoComplete="off"
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nama kasir…"
                className={`${inputClass(false)} pl-8`}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="report-status" className={labelClass}>
              Status transfer
            </label>
            <select
              id="report-status"
              value={transferred}
              onChange={(event) => {
                setTransferred(event.target.value);
                setPage(1);
              }}
              className={inputClass(false)}
            >
              <option value="">Semua</option>
              <option value="true">Sudah transfer</option>
              <option value="false">Belum transfer</option>
            </select>
          </div>

          <div>
            <label htmlFor="report-from" className={labelClass}>
              Dari tanggal
            </label>
            <input
              id="report-from"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className={`${inputClass(rangeInvalid)} tabular-nums`}
            />
          </div>

          <div>
            <label htmlFor="report-to" className={labelClass}>
              Sampai tanggal
            </label>
            <input
              id="report-to"
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
          <ErrorText>
            Tanggal awal tidak boleh lebih besar dari tanggal akhir.
          </ErrorText>
        )}

        {hasFilters && (
          <div>
            <button
              type="button"
              onClick={resetFilters}
              className={BTN_OUTLINE}
            >
              <FiX size={16} aria-hidden="true" />
              Reset filter
            </button>
          </div>
        )}
      </section>

      {/* Daftar */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-second">Daftar laporan</h2>
        <p className="text-sm tabular-nums text-second/60" aria-live="polite">
          {formatNumber(total)} data
        </p>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-2xl bg-second/10"
            />
          ))}
        </div>
      ) : isError && !data ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h3 className="mt-4 text-lg font-bold text-second">
            Gagal memuat laporan
          </h3>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_PRIMARY} mt-4`}
          >
            <FiRefreshCw size={16} aria-hidden="true" />
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
          <h3 className="text-sm font-semibold text-second">
            {hasFilters ? "Laporan tidak ditemukan" : "Belum ada laporan"}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            {hasFilters
              ? "Tidak ada laporan yang sesuai dengan filter."
              : isAdmin
                ? "Buat laporan pertama Anda dengan mengisi saldo awal."
                : "Laporan akan muncul setelah kasir membuatnya."}
          </p>
        </div>
      ) : (
        <div
          className={`relative transition-opacity duration-200 ${isFetching ? "opacity-60" : "opacity-100"}`}
        >
          {isFetching && (
            <FiLoader
              size={16}
              aria-hidden="true"
              className="absolute right-2 top-2 animate-spin text-second4 motion-reduce:animate-none"
            />
          )}

          {/* Tabel desktop */}
          <div className="hidden overflow-hidden rounded-2xl bg-primary shadow-xl shadow-second/5 md:block">
            <table className="min-w-full text-left">
              <thead className="bg-grad text-sm text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Tanggal
                  </th>
                  {!isAdmin && (
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Kasir
                    </th>
                  )}
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Saldo awal
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Masuk
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Keluar
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Saldo akhir
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-second/10">
                {list.map((report, index) => (
                  <tr
                    key={report.id}
                    className={`align-top transition-colors hover:bg-second/20 ${index % 2 === 0 ? "" : "bg-second3/20"}`}
                  >
                    <td className="px-4 py-4">
                      <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-second">
                        {formatShortDate(report.date)}
                      </p>
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        {formatNumber(report.entry_count)} baris
                      </p>
                    </td>
                    {!isAdmin && (
                      <td className="max-w-48 px-4 py-4">
                        <p className="truncate text-sm text-second/70">
                          {report.cashier_name}
                        </p>
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-second/70">
                      {formatMoney(report.opening_balance)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-second3">
                      {formatMoney(report.total_in)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-second2">
                      {formatMoney(report.total_out)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-second">
                      {formatMoney(report.closing_balance)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <Tag tone={report.transferred ? "success" : "outline"}>
                          {report.transferred
                            ? "Sudah transfer"
                            : "Belum transfer"}
                        </Tag>
                        {report.has_proof ? (
                          <Tag tone="soft">
                            <FiPaperclip size={16} aria-hidden="true" />
                            Ada bukti
                          </Tag>
                        ) : (
                          report.transferred && (
                            <Tag tone="failure">Tanpa bukti</Tag>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <PrimaryButton href={`${basePath}/${report.id}`}>
                        Detail
                        <FiChevronRight size={16} aria-hidden="true" />
                      </PrimaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kartu mobile */}
          <ul className="flex flex-col gap-4 md:hidden">
            {list.map((report) => (
              <li key={report.id}>
                <Link
                  href={`${basePath}/${report.id}`}
                  className={`group block min-w-0 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-second group-hover:text-second4">
                        {formatDate(report.date)}
                      </p>
                      {!isAdmin && (
                        <p className="mt-2 text-xs text-second/60">
                          Kasir {report.cashier_name}
                        </p>
                      )}
                      <p className="mt-2 text-sm font-semibold tabular-nums text-second">
                        {formatMoney(report.closing_balance)}
                      </p>
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        <span className="text-second3">
                          {formatMoney(report.total_in)}
                        </span>{" "}
                        masuk ·{" "}
                        <span className="text-second2">
                          {formatMoney(report.total_out)}
                        </span>{" "}
                        keluar
                      </p>
                    </div>
                    <FiChevronRight
                      size={18}
                      className="mt-0.5 shrink-0 text-second/40"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Tag tone={report.transferred ? "success" : "outline"}>
                      {report.transferred ? "Sudah transfer" : "Belum transfer"}
                    </Tag>
                    {report.has_proof ? (
                      <Tag tone="soft">
                        <FiPaperclip size={16} aria-hidden="true" />
                        Ada bukti
                      </Tag>
                    ) : (
                      report.transferred && (
                        <Tag tone="failure">Tanpa bukti</Tag>
                      )
                    )}
                    <Tag>{formatNumber(report.entry_count)} baris</Tag>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {total > 0 && (
        <nav
          aria-label="Paginasi laporan"
          className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm tabular-nums text-second/60">
            Halaman {formatNumber(safePage)} dari {formatNumber(totalPages)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className={`${BTN_OUTLINE} flex-1 sm:flex-none`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className={`${BTN_PRIMARY} flex-1 sm:flex-none`}
            >
              Berikutnya
              <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
