"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import { FiLoader, FiPlus, FiRefreshCw, FiShoppingBag } from "react-icons/fi";

import {
  useDeleteMarketplace,
  useGetMarketplaces,
} from "../../../features/marketplaces/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import MarketplaceCard from "../../../../components/admin/marketplace-card.jsx";
import DeleteMarketplaceModal from "../../../../components/admin/delete-marketplace-modal.jsx";

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";
function LoadingState() {
  return (
    <div
      className="flex min-h-64 items-center justify-center gap-3 text-sm text-second/60"
      role="status"
      aria-live="polite"
    >
      <FiLoader className="animate-spin" size={22} />
      Memuat data marketplace...
    </div>
  );
}

export default function MarketplacesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [marketplaceToDelete, setMarketplaceToDelete] = useState(null);
  const [usageDetails, setUsageDetails] = useState(null);

  const deleteMarketplace = useDeleteMarketplace();

  const filters = useMemo(() => {
    if (statusFilter === "all") return {};

    return {
      is_active: statusFilter === "active",
    };
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
        setUsageDetails(
          responseData.details ?? {
            total: 0,
            cameras: [],
          },
        );

        notify.error("Marketplace masih digunakan oleh kamera.");
        return;
      }

      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Manajemen Toko Online
          </h1>

          <p className="mt-2 text-sm text-second/60">
            Kelola toko online yang tersedia untuk produk Anda.
          </p>
        </div>

        <LoadingState />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Manajemen Toko Online
          </h1>

          <p className="mt-2 text-sm text-second/60">
            Kelola toko online yang tersedia untuk produk Anda.
          </p>
        </div>

        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-second/30 p-6 text-center">
          <FiShoppingBag size={36} className="text-second/30" />

          <h2 className="mt-4 font-semibold text-second">
            Gagal memuat toko online
          </h2>

          <p className="mt-2 max-w-sm text-sm text-second/60">
            Periksa koneksi atau sesi autentikasi Anda, lalu coba kembali.
          </p>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-second px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiRefreshCw
              size={16}
              className={isFetching ? "animate-spin" : ""}
            />
            Coba lagi
          </button>
        </div>

        <Link
          href="/admin/marketplaces/create"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
        >
          <FiPlus size={18} />
          Tambah Toko Online
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiShoppingBag size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen Toko Online
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            Kelola toko online yang tersedia untuk produk Anda.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor="marketplace-status"
            className="shrink-0 text-sm font-medium text-second/60"
          >
            Status
          </label>

          <select
            id="marketplace-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-w-36 rounded-full border border-second/30 bg-primary px-4 py-3 text-sm text-second outline-none transition-colors focus:border-second"
          >
            <option value="all">Semua</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <div className="flex gap-4 w-full md:w-fit">
            {" "}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Perbarui data dashboard"
              className={`inline-flex px-4 py-3 items-center gap-2 rounded-full border border-second/30 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-60 ${FOCUS_RING}`}
            >
              <FiRefreshCw
                size={16}
                className={isFetching ? "animate-spin" : ""}
              />
              {isFetching ? "Memperbarui..." : "Perbarui"}
            </button>
            <Link
              type="button"
              href={"/admin/marketplaces/create"}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-4 w-full md:w-fit py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <FiLoader className="animate-spin" size={18} />
              ) : (
                <FiPlus size={18} />
              )}
              {isPending ? "Memuat toko online..." : "Tambah Toko Online"}
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar toko online</h2>

          <p className="mt-1 text-sm text-second/60">
            {formatNumber(marketplaces.length)} toko online ditemukan
          </p>
        </div>

        {isFetching && (
          <div
            className="inline-flex items-center gap-2 text-sm text-second/50"
            role="status"
          >
            <FiLoader className="animate-spin" size={16} />
            Memperbarui data...
          </div>
        )}
      </div>

      <div
        className={`transition-opacity duration-200 ${
          isFetching ? "opacity-50" : "opacity-100"
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
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-6 text-center">
            <FiShoppingBag size={40} className="text-second/30" />

            <h3 className="mt-4 font-semibold text-second">
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
                className="mt-4 rounded-full bg-second px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
              >
                Tampilkan semua
              </button>
            )}

            {statusFilter === "all" && (
              <Link
                href="/admin/marketplaces/create"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-second px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
              >
                <FiPlus size={16} />
                Tambah Toko Online
              </Link>
            )}
          </div>
        )}
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
