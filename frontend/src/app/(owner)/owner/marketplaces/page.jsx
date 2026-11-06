"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiShoppingBag,
} from "react-icons/fi";

import {
  useDeleteMarketplace,
  useGetMarketplaces,
} from "../../../features/marketplaces/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import MarketplaceCard from "../../../../components/owner/marketplace-card.jsx";
import DeleteMarketplaceModal from "../../../../components/owner/delete-marketplace-modal.jsx";
import RefreshButton from "./../../../../components/refresh-button";
import PrimaryButton from "./../../../../components/primary-button";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

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

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

/* ------------------------------ Small pieces ------------------------------ */

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
        <div className="h-8 w-40 animate-pulse rounded-xl bg-second/10" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function MarketplacesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [marketplaceToDelete, setMarketplaceToDelete] = useState(null);
  const [usageDetails, setUsageDetails] = useState(null);

  const deleteMarketplace = useDeleteMarketplace();

  const filters = useMemo(() => {
    if (statusFilter === "all") return {};
    return { is_active: statusFilter === "active" };
  }, [statusFilter]);

  const query = useGetMarketplaces(filters);
  const { data, isPending, isError, isFetching, error, refetch } = query;

  const marketplaces = data ?? [];

  useEffect(() => {
    if (!isError || !error) return;
    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);

  function handleOpenDelete(marketplace) {
    setMarketplaceToDelete(marketplace);
    setUsageDetails(null);
  }

  function handleCloseDelete() {
    if (deleteMarketplace.isPending) return;
    setMarketplaceToDelete(null);
    setUsageDetails(null);
  }

  async function handleConfirmDelete() {
    if (!marketplaceToDelete) return;

    try {
      await deleteMarketplace.mutateAsync(marketplaceToDelete.id);
      notify.success("Marketplace berhasil dihapus.");
      setMarketplaceToDelete(null);
      setUsageDetails(null);
    } catch (error) {
      const responseData = error?.response?.data;

      if (responseData?.errors === "MARKETPLACE_STILL_IN_USE") {
        setUsageDetails(responseData.details ?? { total: 0, cameras: [] });
        notify.error("Marketplace masih digunakan oleh kamera.");
        return;
      }

      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiShoppingBag size={16} />
            </div>
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Manajemen <span className="text-grad">Toko Online</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Kelola toko online yang tersedia untuk produk Anda.
              </p>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat toko online
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau sesi autentikasi Anda, lalu coba kembali.
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiShoppingBag size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen <span className="text-grad">Toko Online</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kelola toko online yang tersedia untuk produk Anda.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <RefreshButton
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data toko online"
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </RefreshButton>

          <PrimaryButton
            href="/owner/marketplaces/create"
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
          >
            <FiPlus size={16} aria-hidden="true" />
            Tambah Toko Online
          </PrimaryButton>
        </div>
      </header>

      {/* Filter status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label
            htmlFor="marketplace-status"
            className="mb-2 block text-sm font-semibold text-second"
          >
            Status
          </label>
          <select
            id="marketplace-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={inputClass(false)}
          >
            <option value="all">Semua</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* List header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar toko online</h2>
          <p className="mt-2 text-sm text-second/60">
            {formatNumber(marketplaces.length)} toko online ditemukan
          </p>
        </div>
        {statusFilter !== "all" && <Tag tone="strong">Filter aktif</Tag>}
      </div>

      {/* Content */}
      <div className="relative min-h-40">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px] transition-opacity duration-200">
            <div className="flex items-center gap-2 rounded-xl border border-second/30 bg-primary px-4 py-2 shadow-xl shadow-second/5">
              <FiLoader
                className="animate-spin motion-reduce:animate-none text-second4"
                size={16}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-second">
                Memperbarui data…
              </span>
            </div>
          </div>
        )}

        <div
          className={`transition-opacity duration-200 ${
            isFetching ? "opacity-40" : "opacity-100"
          }`}
        >
          {marketplaces.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {marketplaces.map((marketplace) => (
                <MarketplaceCard
                  key={marketplace.id}
                  marketplace={marketplace}
                  onDelete={handleOpenDelete}
                  isDeleting={
                    deleteMarketplace.isPending &&
                    marketplaceToDelete?.id === marketplace.id
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
                <FiShoppingBag size={24} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-second">
                {statusFilter === "all"
                  ? "Belum ada toko online"
                  : statusFilter === "active"
                    ? "Tidak ada toko online aktif"
                    : "Tidak ada toko online nonaktif"}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-second/60">
                {statusFilter === "all"
                  ? "Toko online yang tersedia akan ditampilkan di sini."
                  : "Coba pilih status lainnya untuk melihat toko online."}
              </p>
              {statusFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`${BTN_BASE} mt-4 border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
                >
                  Tampilkan semua
                </button>
              )}
              {statusFilter === "all" && (
                <Link
                  href="/owner/marketplaces/create"
                  className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
                >
                  <FiPlus size={16} aria-hidden="true" />
                  Tambah Toko Online
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <DeleteMarketplaceModal
        marketplace={marketplaceToDelete}
        isDeleting={deleteMarketplace.isPending}
        usageDetails={usageDetails}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
