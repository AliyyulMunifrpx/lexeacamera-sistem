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
  FiX,
} from "react-icons/fi";

import {
  useCreateDailyReport,
  useGetDailyReports,
  useGetNextOpening,
} from "../../app/features/daily-reports/hooks.js";
import { ExportReportsButton } from "./export-reports-button.jsx";
import {
  AmountInput,
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  FormSection,
  Tag,
  describeError,
  formatDate,
  formatMoney,
  inputClass,
  labelClass,
  MAX_AMOUNT,
  needsProof,
  todayWib,
  getRemitStatus,
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

// Sisa saldo yang belum disetor. Sebelum dicentang disetor, sama dengan saldo akhir.
const remainingTotal = (report) =>
  report.remaining_balance ?? report.closing_balance;
const remainingCash = (report) => report.remaining_cash ?? report.closing_cash;
const remainingNoncash = (report) =>
  report.remaining_noncash ?? report.closing_noncash;
function hasRemitAmounts(report) {
  return (
    report.remit_cash !== null &&
    report.remit_cash !== undefined &&
    report.remit_transfer !== null &&
    report.remit_transfer !== undefined
  );
}

// belum disetor → sudah setor (ADMIN sudah isi) → approve owner
function RemitStatusTags({ report }) {
  const approved = Boolean(report.remitted);
  // Kalau sudah di-approve owner, pasti sudah setor.
  const setor = approved || hasRemitAmounts(report);
  const bukti = Boolean(report.has_proof);

  return (
    <>
      <Tag tone={setor ? "success" : "outline"}>
        {setor ? "Sudah setor" : "Belum setor"}
      </Tag>
      <Tag tone={approved ? "success" : "outline"}>
        {approved ? "Approve owner" : "Belum approve"}
      </Tag>
      <Tag tone={bukti ? "success" : "outline"}>
        <FiPaperclip size={16} aria-hidden="true" />
        {bukti ? "Ada bukti" : "Belum ada bukti"}
      </Tag>
    </>
  );
}

/* --------------------------------- Create --------------------------------- */

function CreateReportPanel({ onCancel, basePath }) {
  const router = useRouter();
  const createReport = useCreateDailyReport();

  const [date, setDate] = useState(todayWib());
  const [openingCash, setOpeningCash] = useState("");
  const [openingNoncash, setOpeningNoncash] = useState("");
  const [errors, setErrors] = useState({});

  const validDate = date && date <= todayWib() ? date : undefined;
  const next = useGetNextOpening(validDate);

  const pending = next.data?.pending ?? null;
  const autoCash = next.data?.opening_cash ?? null;
  const autoNoncash = next.data?.opening_noncash ?? null;
  const source = next.data?.source ?? null;

  const manual = openingCash !== "" || openingNoncash !== "";

  function clearError(name) {
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (createReport.isPending) return;

    const found = {};

    if (openingCash !== "" && Number(openingCash) > MAX_AMOUNT) {
      found.opening_cash = "Nominal terlalu besar.";
    }
    if (openingNoncash !== "" && Number(openingNoncash) > MAX_AMOUNT) {
      found.opening_noncash = "Nominal terlalu besar.";
    }

    if (!manual && pending) {
      found.opening =
        "Selesaikan laporan sebelumnya dulu, atau isi saldo awal secara manual.";
    }

    if (date && date > todayWib()) {
      found.date = "Tanggal tidak boleh di masa depan.";
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Kalau salah satu dikirim, server menganggap yang lain 0.
    const payload = {
      ...(date && { date }),
      ...(openingCash !== "" && { opening_cash: Number(openingCash) }),
      ...(openingNoncash !== "" && { opening_noncash: Number(openingNoncash) }),
    };

    createReport.mutate(payload, {
      onSuccess: (report) => {
        notify.success("Laporan kasir berhasil dibuat.");
        router.push(`${basePath}/${report.id}`);
      },
      onError: (error) => {
        const body = error?.response?.data;
        const existingId =
          body?.errors === "REPORT_ALREADY_EXISTS"
            ? body?.details?.report_id
            : null;

        if (existingId) {
          notify.error(
            "Laporan untuk tanggal itu sudah ada. Membuka laporan tersebut…",
          );
          router.push(`${basePath}/${existingId}`);
          return;
        }

        notify.error(describeError(error));
      },
    });
  }

  const disabled = createReport.isPending;

  let openingHint = null;

  if (next.isPending) {
    openingHint = "Memeriksa saldo laporan sebelumnya…";
  } else if (next.isError) {
    openingHint = `${describeError(next.error)} Isi saldo awal secara manual.`;
  } else if (manual) {
    openingHint =
      "Saldo awal manual. Kolom yang dikosongkan dianggap Rp 0, tidak diambil dari laporan sebelumnya.";
  } else if (!pending && source) {
    openingHint = `Dikosongkan = saldo setelah disetor dari laporan ${formatShortDate(source.date)} (laporan terakhir sebelum tanggal ini): tunai ${formatMoney(autoCash)}, non tunai ${formatMoney(autoNoncash)}.`;
  } else if (!pending) {
    openingHint =
      "Belum ada laporan sebelumnya. Dikosongkan = Rp 0 untuk keduanya.";
  }

  return (
    <FormSection
      title="Buat laporan baru"
      description="Satu laporan untuk satu hari dan dipakai bersama. Saldo awal otomatis dari saldo setelah disetor laporan terakhir sebelum tanggal itu, dipisah tunai dan non tunai, dan tetap bisa diisi manual."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                Tidak bisa diubah setelah dibuat.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="opening-cash" className={labelClass}>
              Saldo awal tunai
              <span className="ml-2 text-xs font-normal text-second/50">
                Opsional
              </span>
            </label>
            <AmountInput
              id="opening-cash"
              value={openingCash}
              onChange={(value) => {
                setOpeningCash(value);
                clearError("opening_cash");
                clearError("opening");
              }}
              disabled={disabled}
              hasError={Boolean(errors.opening_cash || errors.opening)}
              describedBy="opening-balance-desc"
              placeholder={
                autoCash !== null
                  ? String(autoCash).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                  : "0"
              }
            />
            {errors.opening_cash && (
              <ErrorText>{errors.opening_cash}</ErrorText>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="opening-noncash" className={labelClass}>
              Saldo awal non tunai
              <span className="ml-2 text-xs font-normal text-second/50">
                Opsional
              </span>
            </label>
            <AmountInput
              id="opening-noncash"
              value={openingNoncash}
              onChange={(value) => {
                setOpeningNoncash(value);
                clearError("opening_noncash");
                clearError("opening");
              }}
              disabled={disabled}
              hasError={Boolean(errors.opening_noncash || errors.opening)}
              describedBy="opening-balance-desc"
              placeholder={
                autoNoncash !== null
                  ? String(autoNoncash).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                  : "0"
              }
            />
            {errors.opening_noncash && (
              <ErrorText>{errors.opening_noncash}</ErrorText>
            )}
          </div>
        </div>

        {errors.opening ? (
          <ErrorText id="opening-balance-desc">{errors.opening}</ErrorText>
        ) : (
          openingHint && (
            <p id="opening-balance-desc" className="text-sm text-second/60">
              {openingHint}
            </p>
          )
        )}

        {pending && (
          <p
            role="status"
            className="flex flex-wrap items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 p-4 text-sm text-second2"
          >
            <FiAlertTriangle
              size={16}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0">
              Laporan {formatDate(pending.date)} belum disetor, jadi saldo awal
              tidak bisa dihitung otomatis.{" "}
              <Link
                href={`${basePath}/${pending.id}`}
                className={`rounded font-semibold underline ${FOCUS_RING}`}
              >
                Buka laporan itu
              </Link>{" "}
              atau isi saldo awal secara manual.
            </span>
          </p>
        )}

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
  // ADMIN dan OWNER sama-sama melihat dan mengelola semua laporan.
  const basePath = `/${role}/daily-reports`;

  const [remitted, setRemitted] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const filters = {
    date_from: rangeInvalid ? "" : dateFrom,
    date_to: rangeInvalid ? "" : dateTo,
    remitted,
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
  const hasFilters = Boolean(remitted || dateFrom || dateTo);

  function resetFilters() {
    setRemitted("");
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
              <span className="text-grad">Laporan Kasir</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kas harian toko, dipisah tunai dan non tunai. Satu laporan untuk
              satu hari, bisa diisi dan diubah oleh admin maupun owner. Setoran
              diisi admin, lalu di-approve owner.
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
          {!showCreate && (
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

      {showCreate && (
        <CreateReportPanel
          basePath={basePath}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filter */}
      <section
        aria-label="Filter laporan"
        className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="report-status" className={labelClass}>
              Status approve
            </label>
            <select
              id="report-status"
              value={remitted}
              onChange={(event) => {
                setRemitted(event.target.value);
                setPage(1);
              }}
              className={inputClass(false)}
            >
              <option value="">Semua</option>
              <option value="true">Approve owner</option>
              <option value="false">Belum approve</option>
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
              : "Buat laporan pertama dengan tombol “Buat laporan”."}
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
          <div className="hidden overflow-x-auto rounded-2xl bg-primary shadow-xl shadow-second/5 md:block">
            <table className="min-w-full text-left">
              <thead className="bg-grad text-sm text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Tanggal
                  </th>
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
                    Disetor
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Saldo setelah disetor{" "}
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
                    <td className="whitespace-nowrap px-4 py-4 text-xs tabular-nums text-second/70">
                      {hasRemitAmounts(report) ? (
                        <>
                          <p>Tunai {formatMoney(report.remit_cash)}</p>
                          <p className="mt-2">
                            Transfer {formatMoney(report.remit_transfer)}
                          </p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <p className="text-sm font-semibold tabular-nums text-second">
                        {formatMoney(remainingTotal(report))}
                      </p>
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        Tunai {formatMoney(remainingCash(report))}
                      </p>
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        Non tunai {formatMoney(remainingNoncash(report))}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <RemitStatusTags report={report} />
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
                      {hasRemitAmounts(report) && (
                        <p className="mt-2 text-xs tabular-nums text-second/60">
                          Disetor tunai {formatMoney(report.remit_cash)} ·
                          transfer {formatMoney(report.remit_transfer)}
                        </p>
                      )}
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        Saldo setelah disetor{" "}
                        {formatMoney(remainingTotal(report))} (tunai{" "}
                        {formatMoney(remainingCash(report))}, non tunai{" "}
                        {formatMoney(remainingNoncash(report))})
                      </p>
                    </div>
                    <FiChevronRight
                      size={18}
                      className="mt-0.5 shrink-0 text-second/40"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <RemitStatusTags report={report} />
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
