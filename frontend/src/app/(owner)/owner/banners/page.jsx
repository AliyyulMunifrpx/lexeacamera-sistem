"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image.js";
import {
  FiAlertTriangle,
  FiEdit2,
  FiImage,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiStar,
  FiTag,
  FiTrash2,
} from "react-icons/fi";

import BannerFormModal from "../../../../components/owner/banner-form-modal.jsx";
import DeleteBannerModal from "../../../../components/owner/delete-banner-modal.jsx";
import {
  useCreateBanner,
  useDeleteBanner,
  useGetBanners,
  useUpdateBanner,
} from "../../../features/banners/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import { getErrorMessage } from "../../../../lib/api/error-messages.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const FLAG_LABELS = {
  is_promo: "Promo",
  is_best_seller: "Best Seller",
};

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline", icon: Icon }) {
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
      {Icon && <Icon size={12} aria-hidden="true" />}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-96 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function BannersPage() {
  const query = useGetBanners();

  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();

  const { data, isPending, isError, isFetching, error, refetch } = query;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [bannerToEdit, setBannerToEdit] = useState(null);
  const [bannerToDelete, setBannerToDelete] = useState(null);
  const [flagUpdatingId, setFlagUpdatingId] = useState(null);

  const isSaving = createBanner.isPending || updateBanner.isPending;

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const banners = useMemo(() => {
    return [...(data ?? [])].sort((a, b) => {
      const dateA = new Date(a.created_at ?? 0).getTime();
      const dateB = new Date(b.created_at ?? 0).getTime();
      return dateB - dateA;
    });
  }, [data]);

  function handleAdd() {
    setBannerToEdit(null);
    setIsFormOpen(true);
  }

  function handleEdit(banner) {
    setBannerToEdit(banner);
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;
    setIsFormOpen(false);
    setBannerToEdit(null);
  }

  async function handleSubmit(file, flags = {}) {
    if (flags.is_promo === true && flags.is_best_seller === true) {
      notify.error(getErrorMessage("BANNER_FLAG_CONFLICT"));
      return;
    }

    const formData = new FormData();
    formData.append("banner", file);

    for (const key of Object.keys(FLAG_LABELS)) {
      if (typeof flags[key] === "boolean") {
        formData.append(key, String(flags[key]));
      }
    }

    try {
      if (bannerToEdit) {
        await updateBanner.mutateAsync({ id: bannerToEdit.id, formData });
        notify.success("Gambar banner berhasil diperbarui.");
      } else {
        await createBanner.mutateAsync(formData);
        notify.success("Banner berhasil ditambahkan.");
      }

      setIsFormOpen(false);
      setBannerToEdit(null);
      refetch();
    } catch (error) {
      notify.error(normalizeApiError(error).message);
    }
  }

  async function handleToggleFlag(banner, flag) {
    if (flagUpdatingId) return;

    const otherFlag = flag === "is_promo" ? "is_best_seller" : "is_promo";
    const nextValue = !banner[flag];
    const label = FLAG_LABELS[flag];

    const currentHolder = banners.find(
      (item) => item.id !== banner.id && item[flag],
    );

    const formData = new FormData();
    formData.append(flag, String(nextValue));

    if (nextValue && banner[otherFlag]) {
      formData.append(otherFlag, "false");
    }

    setFlagUpdatingId(banner.id);

    try {
      await updateBanner.mutateAsync({ id: banner.id, formData });

      if (!nextValue) {
        notify.success(`Banner ini tidak lagi menjadi banner ${label}.`);
      } else if (currentHolder) {
        notify.success(
          `Banner ${label} dipindahkan ke banner ini. Banner ${label} sebelumnya otomatis dicabut.`,
        );
      } else {
        notify.success(`Banner ini sekarang menjadi banner ${label}.`);
      }

      refetch();
    } catch (error) {
      notify.error(normalizeApiError(error).message);
    } finally {
      setFlagUpdatingId(null);
    }
  }

  function handleOpenDelete(banner) {
    setBannerToDelete(banner);
  }

  function closeDelete() {
    if (deleteBanner.isPending) return;
    setBannerToDelete(null);
  }

  async function handleConfirmDelete() {
    if (!bannerToDelete) return;

    try {
      await deleteBanner.mutateAsync(bannerToDelete.id);
      notify.success("Banner berhasil dihapus.");
      setBannerToDelete(null);
    } catch (error) {
      notify.error(normalizeApiError(error).message);
    }
  }

  if (isPending) {
    return <LoadingState />;
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
            <FiImage size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen <span className="text-grad">Banner</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kelola gambar banner yang ditampilkan di halaman utama, termasuk
              banner promo dan best seller.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data banner"
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
          </button>

          <button
            type="button"
            onClick={handleAdd}
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
          >
            <FiPlus size={16} aria-hidden="true" />
            Tambah Banner
          </button>
        </div>
      </header>

      {/* List header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar banner</h2>
          <p className="mt-2 text-sm text-second/60">
            {formatNumber(banners.length)} banner ditemukan. Banner terbaru ada
            di paling atas. Hanya satu banner yang bisa menjadi Promo dan satu
            lagi Best Seller.
          </p>
        </div>
        {banners.length > 0 && (
          <Tag tone="strong">{formatNumber(banners.length)} banner</Tag>
        )}
      </div>

      {/* Content */}
      <div className="relative min-h-40">
        {isError && !data ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
            <FiAlertTriangle
              size={32}
              className="text-second2"
              aria-hidden="true"
            />
            <h3 className="mt-4 text-lg font-bold text-second">
              Gagal memuat banner
            </h3>
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
        ) : banners.length > 0 ? (
          <div
            className={`grid grid-cols-1 gap-4 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3 ${
              isFetching ? "opacity-40" : "opacity-100"
            }`}
          >
            {banners.map((banner) => {
              const isFlagUpdating = flagUpdatingId === banner.id;

              return (
                <article
                  key={banner.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-second/30 bg-primary shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5"
                >
                  {/* Gambar banner */}
                  <div className="relative flex aspect-[2/3] items-center justify-center overflow-hidden bg-second/10 p-2">
                    <Image
                      width={1500}
                      height={2250}
                      src={banner.banner_url}
                      alt={`Banner dibuat ${formatDate(banner.created_at)}`}
                      loading="lazy"
                      className="h-full w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {(banner.is_promo || banner.is_best_seller) && (
                      <div className="absolute left-2 top-2 flex flex-wrap gap-2">
                        {banner.is_promo && (
                          <Tag tone="grad" icon={FiTag}>
                            Promo
                          </Tag>
                        )}
                        {banner.is_best_seller && (
                          <Tag tone="grad" icon={FiStar}>
                            Best Seller
                          </Tag>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info + aksi */}
                  <div className="flex flex-1 flex-col gap-4 p-4">
                    <div>
                      <p className="text-xs text-second/60">Tanggal dibuat</p>
                      <p className="mt-2 text-sm font-semibold text-second">
                        {formatDate(banner.created_at)}
                      </p>
                    </div>

                    {/* Toggle flag */}
                    <div className="grid grid-cols-2 gap-2 border-t border-second/30 pt-4">
                      <button
                        type="button"
                        onClick={() => handleToggleFlag(banner, "is_promo")}
                        disabled={Boolean(flagUpdatingId)}
                        aria-pressed={Boolean(banner.is_promo)}
                        className={`${BTN_BASE} w-full ${
                          banner.is_promo
                            ? "bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90"
                            : "border border-second/30 text-second hover:border-second4 hover:text-second4"
                        } disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        {isFlagUpdating ? (
                          <FiLoader
                            size={16}
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <FiTag size={16} aria-hidden="true" />
                        )}
                        Promo
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleFlag(banner, "is_best_seller")
                        }
                        disabled={Boolean(flagUpdatingId)}
                        aria-pressed={Boolean(banner.is_best_seller)}
                        className={`${BTN_BASE} w-full ${
                          banner.is_best_seller
                            ? "bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90"
                            : "border border-second/30 text-second hover:border-second4 hover:text-second4"
                        } disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        {isFlagUpdating ? (
                          <FiLoader
                            size={16}
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <FiStar size={16} aria-hidden="true" />
                        )}
                        Best Seller
                      </button>
                    </div>

                    {/* Aksi utama */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(banner)}
                        aria-label="Ganti gambar banner"
                        className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                      >
                        <FiEdit2 size={16} aria-hidden="true" />
                        Ganti
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDelete(banner)}
                        disabled={
                          deleteBanner.isPending &&
                          bannerToDelete?.id === banner.id
                        }
                        aria-label="Hapus banner"
                        className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        <FiTrash2 size={16} aria-hidden="true" />
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiImage size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              Belum ada banner
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              Tambahkan banner pertama untuk ditampilkan pada halaman utama.
            </p>
            <button
              type="button"
              onClick={handleAdd}
              className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
            >
              <FiPlus size={16} aria-hidden="true" />
              Tambah Banner
            </button>
          </div>
        )}
      </div>

      <BannerFormModal
        isOpen={isFormOpen}
        banner={bannerToEdit}
        isSaving={isSaving}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <DeleteBannerModal
        banner={bannerToDelete}
        isDeleting={deleteBanner.isPending}
        onClose={closeDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
