"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image.js";
import {
  FiEdit2,
  FiImage,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiStar,
  FiTag,
  FiTrash2,
} from "react-icons/fi";

import BannerFormModal from "../../../../components/admin/banner-form-modal.jsx";
import DeleteBannerModal from "../../../../components/admin/delete-banner-modal.jsx";
import {
  useCreateBanner,
  useDeleteBanner,
  useGetBanners,
  useUpdateBanner,
} from "../../../features/banners/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import { getErrorMessage } from "../../../../lib/api/error-messages.js";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

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

  /**
   * file  : berkas gambar dari modal.
   * flags : opsional, { is_promo?: boolean, is_best_seller?: boolean }.
   *         Flag yang tidak diisi tidak dikirim (backend memakai default
   *         false saat membuat, dan tidak mengubah apa pun saat mengedit).
   */
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
        await updateBanner.mutateAsync({
          id: bannerToEdit.id,
          formData,
        });

        notify.success("Gambar banner berhasil diperbarui.");
      } else {
        await createBanner.mutateAsync(formData);

        notify.success("Banner berhasil ditambahkan.");
      }

      setIsFormOpen(false);
      setBannerToEdit(null);

      // Flag banner lain bisa ikut tercabut, jadi pastikan daftar segar.
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

    // Satu banner tidak boleh memegang dua flag: pindahkan perannya.
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
    return (
      <div
        className="flex min-h-64 items-center justify-center gap-3"
        role="status"
        aria-live="polite"
      >
        <FiLoader className="animate-spin text-second" size={22} />
        <span className="text-sm text-second/60">Memuat data banner...</span>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="space-y-4 rounded-2xl border border-second/30 p-6">
        <h2 className="font-semibold text-second">Gagal memuat banner</h2>

        <p className="text-sm text-second/60">
          Periksa koneksi atau sesi autentikasi Anda, lalu coba kembali.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="">
          <div className="flex items-center gap-2">
            <FiImage size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen Banner
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            Kelola gambar banner yang ditampilkan di halaman utama, termasuk
            banner promo dan best seller.
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-fit">
          {" "}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data dashboard"
            className={`inline-flex px-4 py-2 items-center gap-2 rounded-full border border-second/30 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={isFetching ? "animate-spin" : ""}
            />
            {isFetching ? "Memperbarui..." : "Perbarui"}
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-4 w-full md:w-fit py-2 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
          >
            <FiPlus size={18} />
            Tambah Banner
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-second">Daftar banner</h2>

        <p className="mt-1 text-sm text-second/60">
          {formatNumber(banners.length)} banner ditemukan. Banner terbaru ada di
          paling atas. Hanya satu banner yang bisa menjadi Promo dan satu lagi
          Best Seller.
        </p>
      </div>

      <div
        className={`transition-opacity duration-200 ${
          isFetching ? "opacity-50" : "opacity-100"
        }`}
      >
        {banners.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {banners.map((banner) => {
              const isFlagUpdating = flagUpdatingId === banner.id;

              return (
                <article
                  key={banner.id}
                  className="overflow-hidden rounded-2xl border border-second/15 bg-primary/5 transition-colors hover:border-second/30"
                >
                  <div className="relative flex aspect-[2/3] rounded-2xl items-center justify-center overflow-hidden bg-second/5 p-2">
                    <Image
                      width={1500}
                      height={2250}
                      src={banner.banner_url}
                      alt={`Banner dibuat ${formatDate(banner.created_at)}`}
                      loading="lazy"
                      className="h-full w-full rounded-xl"
                    />

                    {(banner.is_promo || banner.is_best_seller) && (
                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        {banner.is_promo && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-grad px-3 py-1 text-xs font-semibold text-primary shadow">
                            <FiTag size={13} />
                            Promo
                          </span>
                        )}

                        {banner.is_best_seller && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-grad px-3 py-1 text-xs font-semibold text-primary shadow">
                            <FiStar size={13} />
                            Best Seller
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <p className="text-xs text-second/60">Tanggal dibuat</p>

                      <p className="mt-1 text-sm font-medium text-second">
                        {formatDate(banner.created_at)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-second/15 pt-4">
                      <button
                        type="button"
                        onClick={() => handleToggleFlag(banner, "is_promo")}
                        disabled={Boolean(flagUpdatingId)}
                        aria-pressed={Boolean(banner.is_promo)}
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
                          banner.is_promo
                            ? "bg-grad text-primary"
                            : "border border-second/30 text-second hover:bg-second/5"
                        }`}
                      >
                        {isFlagUpdating ? (
                          <FiLoader size={16} className="animate-spin" />
                        ) : (
                          <FiTag size={16} />
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
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
                          banner.is_best_seller
                            ? "bg-grad text-primary"
                            : "border border-second/30 text-second hover:bg-second/5"
                        }`}
                      >
                        {isFlagUpdating ? (
                          <FiLoader size={16} className="animate-spin" />
                        ) : (
                          <FiStar size={16} />
                        )}
                        Best Seller
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(banner)}
                        aria-label="Ganti gambar banner"
                        className={`inline-flex items-center justify-center gap-2 rounded-full bg-second px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-second/80 ${FOCUS_RING}`}
                      >
                        <FiEdit2 size={16} />
                        Ganti Gambar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDelete(banner)}
                        disabled={
                          deleteBanner.isPending &&
                          bannerToDelete?.id === banner.id
                        }
                        aria-label="Hapus banner"
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary bg-second2 transition-colors hover:bg-second2/80 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        <FiTrash2 size={16} />
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-6 text-center">
            <FiImage size={36} className="text-second/30" />

            <h3 className="mt-4 font-semibold text-second">Belum ada banner</h3>

            <p className="mt-2 max-w-sm text-sm text-second/60">
              Tambahkan banner pertama untuk ditampilkan pada halaman utama.
            </p>

            <button
              type="button"
              onClick={handleAdd}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary hover:bg-second/80"
            >
              <FiPlus size={16} />
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
