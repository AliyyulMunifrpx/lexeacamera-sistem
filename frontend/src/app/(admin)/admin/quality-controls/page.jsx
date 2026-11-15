"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiChevronLeft,
  FiChevronRight,
  FiClipboard,
  FiList,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";

import { useGetQualityControls } from "../../../features/qc/hooks.js";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  STATUS_LABEL_ADMIN,
  Tag,
  TYPE_LABEL,
  formatDate,
  formatRupiah,
  inputClass,
  labelClass,
} from "../../../../components/owner/qc-shared.jsx";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import PrimaryButton from "./../../../../components/primary-button";
import RefreshButton from "../../../../components/refresh-button.jsx";

const formatNumber = (value = 0) =>
  new Intl.NumberFormat("id-ID").format(value);

const priceText = (price) => (price == null ? "—" : formatRupiah(price));
const QC_PATH = "/admin/quality-controls";
export default function QualityControlsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const { data, isPending, isError, isFetching, error, refetch } =
    useGetQualityControls({
      search,
      type,
      status,
      date_from: rangeInvalid ? "" : dateFrom,
      date_to: rangeInvalid ? "" : dateTo,
      page,
    });

  useEffect(() => {
    if (isError && error) notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const list = data?.data ?? [];
  const paging = data?.paging;
  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? page;

  const hasFilters = Boolean(search || type || status || dateFrom || dateTo);

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setType("");
    setStatus("");
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
            <FiClipboard size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              <span className="text-grad">Quality control</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Checklist kamera saat membeli atau menjual.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <RefreshButton
            onClick={() => refetch()}
            isFetching={isFetching}
          ></RefreshButton>

          <Link href={`${QC_PATH}/create`} className={BTN_PRIMARY}>
            <FiPlus size={16} aria-hidden="true" />
            Buat QC
          </Link>
        </div>
      </header>

      {/* Filter */}
      <section
        aria-label="Filter QC"
        className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div className="min-w-0">
          <label htmlFor="qc-search" className={labelClass}>
            Cari
          </label>
          <div className="relative">
            <FiSearch
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
            />
            <input
              id="qc-search"
              type="search"
              autoComplete="off"
              maxLength={100}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Produk, serial number, PIC, pengirim, atau resi…"
              className={`${inputClass(false)} pl-8`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="qc-type" className={labelClass}>
              Jenis
            </label>
            <select
              id="qc-type"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
              className={inputClass(false)}
            >
              <option value="">Semua</option>
              <option value="BUY">Beli</option>
              <option value="SELL">Jual</option>
            </select>
          </div>

          <div>
            <label htmlFor="qc-status" className={labelClass}>
              Status
            </label>
            <select
              id="qc-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className={inputClass(false)}
            >
              <option value="">Semua</option>
              <option value="DEAL">Deal</option>
              <option value="CANCEL">Batal</option>
            </select>
          </div>

          <div>
            <label htmlFor="qc-from" className={labelClass}>
              Dari tanggal
            </label>
            <input
              id="qc-from"
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
            <label htmlFor="qc-to" className={labelClass}>
              Sampai tanggal
            </label>
            <input
              id="qc-to"
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
        <h2 className="text-lg font-bold text-second">Daftar QC</h2>
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
            Gagal memuat QC
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
            {hasFilters ? "QC tidak ditemukan" : "Belum ada QC"}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            {hasFilters
              ? "Tidak ada QC yang sesuai dengan filter."
              : "Buat QC pertama saat kamu membeli atau menjual kamera."}
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
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Produk
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Jenis
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Harga
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Catatan QC
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
                {list.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`align-top transition-colors hover:bg-second/20 ${index % 2 === 0 ? "" : "bg-second3/20"}`}
                  >
                    <td className="px-4 py-4 text-sm tabular-nums text-second/70">
                      {formatDate(item.date)}
                    </td>
                    <td className="max-w-72 px-4 py-4">
                      <p className="truncate text-sm font-semibold text-second">
                        {item.product_name}
                      </p>
                      <p className="mt-2 truncate text-xs text-second/60">
                        {[item.serial_number, item.pic && `PIC ${item.pic}`]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Tag tone="strong">{TYPE_LABEL[item.type]}</Tag>
                    </td>
                    <td className="px-4 py-4">
                      <Tag tone={STATUS_LABEL_ADMIN[item.status]?.tone}>
                        {STATUS_LABEL_ADMIN[item.status]?.label ?? item.status}
                      </Tag>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-second">
                      {priceText(item.price)}
                    </td>
                    <td className="px-4 py-4 text-xs tabular-nums text-second/70">
                      <p>
                        {item.defect_count} rusak · {item.minor_count} minor
                      </p>
                      <p className="mt-2">
                        {item.photo_count} foto · {item.video_count} video
                      </p>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <PrimaryButton href={`${QC_PATH}/${item.id}`}>
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
            {list.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${QC_PATH}/${item.id}`}
                  className={`group block min-w-0 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-second group-hover:text-second4">
                        {item.product_name}
                      </p>
                      <p className="mt-2 text-xs tabular-nums text-second/60">
                        {formatDate(item.date)}
                        {item.pic ? ` · PIC ${item.pic}` : ""}
                      </p>
                      <p className="mt-2 text-sm font-semibold tabular-nums text-second">
                        {priceText(item.price)}
                      </p>
                    </div>
                    <FiChevronRight
                      size={18}
                      className="mt-0.5 shrink-0 text-second/40"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Tag tone="strong">{TYPE_LABEL[item.type]}</Tag>
                    <Tag tone={STATUS_LABEL_ADMIN[item.status]?.tone}>
                      {STATUS_LABEL_ADMIN[item.status]?.label ?? item.status}
                    </Tag>
                    <Tag>{item.defect_count} rusak</Tag>
                    <Tag>{item.minor_count} minor</Tag>
                    <Tag>
                      {item.photo_count} foto · {item.video_count} video
                    </Tag>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {total > 0 && (
        <nav
          aria-label="Paginasi QC"
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
