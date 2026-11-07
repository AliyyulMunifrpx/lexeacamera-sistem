"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiFolder,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiTag,
  FiTrash2,
  FiAlertCircle,
  FiAlertTriangle,
} from "react-icons/fi";

import {
  useGetCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "../../../features/categories/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import CategoryFormModal from "../../../../components/owner/category-form-modal.jsx";
import DeleteCategoryModal from "../../../../components/owner/delete-category-modal.jsx";
import PrimaryButton from "../../../../components/primary-button.jsx";
import RefreshButton from "../../../../components/refresh-button.jsx";
import CancelButton from "./../../../../components/cancel-button";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

/* -------------------------------- Helpers --------------------------------- */

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

function getCategoryErrorMessage(error) {
  const code = error?.response?.data?.errors;

  if (code === "CATEGORY_ALREADY_EXIST") {
    return "Nama kategori sudah digunakan. Gunakan nama lain.";
  }

  if (code === "CATEGORY_NOT_FOUND") {
    return "Kategori tidak ditemukan atau sudah dihapus.";
  }

  if (code === "CATEGORY_STILL_IN_USE") {
    return "Kategori masih digunakan oleh kamera sehingga tidak dapat dihapus.";
  }

  return normalizeApiError(error).message;
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

/* --------------------------------- States --------------------------------- */

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
      <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header>
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiFolder size={16} />
          </div>
          <div>
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen <span className="text-grad">Kategori</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kelola kategori yang digunakan untuk mengelompokkan kamera.
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
          Gagal memuat kategori
        </h2>
        <p className="mt-2 max-w-md text-sm text-second/60">
          Periksa koneksi atau sesi autentikasi Anda, lalu coba kembali.
        </p>
        <button
          type="button"
          onClick={onRetry}
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

/* ---------------------------------- Page ---------------------------------- */

export default function CategoriesPage() {
  const query = useGetCategories();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const { data, isPending, isError, isFetching, error, refetch } = query;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const isSaving = createCategory.isPending || updateCategory.isPending;

  useEffect(() => {
    if (!isError || !error) return;

    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const categories = useMemo(() => {
    return [...(data ?? [])].sort((a, b) => {
      const dateA = new Date(a.created_at ?? 0).getTime();
      const dateB = new Date(b.created_at ?? 0).getTime();

      return dateB - dateA;
    });
  }, [data]);

  function handleAdd() {
    setCategoryToEdit(null);
    setIsFormOpen(true);
  }

  function handleEdit(category) {
    setCategoryToEdit(category);
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;

    setIsFormOpen(false);
    setCategoryToEdit(null);
  }

  async function handleSaveCategory(name) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      notify.error("Nama kategori wajib diisi.");
      return;
    }

    try {
      if (categoryToEdit) {
        if (trimmedName === categoryToEdit.name) {
          notify.error("Tidak ada perubahan nama kategori.");
          return;
        }

        await updateCategory.mutateAsync({
          id: categoryToEdit.id,
          name: trimmedName,
        });

        notify.success("Kategori berhasil diperbarui.");
      } else {
        await createCategory.mutateAsync(trimmedName);

        notify.success("Kategori berhasil ditambahkan.");
      }

      setIsFormOpen(false);
      setCategoryToEdit(null);
    } catch (error) {
      notify.error(getCategoryErrorMessage(error));
    }
  }

  function handleOpenDelete(category) {
    setCategoryToDelete(category);
  }

  function closeDelete() {
    if (deleteCategory.isPending) return;

    setCategoryToDelete(null);
  }

  async function handleConfirmDelete() {
    if (!categoryToDelete) return;

    try {
      await deleteCategory.mutateAsync(categoryToDelete.id);

      notify.success("Kategori berhasil dihapus.");
      setCategoryToDelete(null);
    } catch (error) {
      notify.error(getCategoryErrorMessage(error));
    }
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
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
            <FiFolder size={16} />
          </div>

          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen <span className="text-grad">Kategori</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kelola kategori yang digunakan untuk mengelompokkan kamera.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <RefreshButton
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            ariaLabel="Perbarui data kategori"
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

          <PrimaryButton type="button" onClick={handleAdd}>
            <FiPlus size={16} aria-hidden="true" />
            Tambah Kategori
          </PrimaryButton>
        </div>
      </header>

      {/* List header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar kategori</h2>
          <p className="mt-2 text-sm text-second/60">
            {formatNumber(categories.length)} kategori ditemukan. Kategori
            terbaru ada di paling atas.
          </p>
        </div>
        {categories.length > 0 && (
          <Tag tone="strong" icon={FiTag}>
            {formatNumber(categories.length)} kategori
          </Tag>
        )}
      </div>

      {/* Fetching overlay */}
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
          {categories.length > 0 ? (
            <div className="overflow-hidden rounded-2xl  bg-primary shadow-xl shadow-second/5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-grad text-primary">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-4 text-sm font-semibold text-primary"
                      >
                        Nama kategori
                      </th>

                      <th
                        scope="col"
                        className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-primary"
                      >
                        Dibuat
                      </th>

                      <th
                        scope="col"
                        className="px-4 py-4 text-right text-sm font-semibold text-primary"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-second/10">
                    {categories.map((category, i) => (
                      <tr
                        key={category.id}
                        className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
                              <FiTag size={16} aria-hidden="true" />
                            </div>

                            <span className="break-words text-sm font-semibold text-second">
                              {category.name}
                            </span>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-second/60">
                          {formatDate(category.created_at)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <PrimaryButton
                              type="button"
                              onClick={() => handleEdit(category)}
                              aria-label={`Edit kategori ${category.name}`}
                              className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
                            >
                              <FiEdit2 size={16} aria-hidden="true" />
                              Edit
                            </PrimaryButton>

                            <CancelButton
                              type="button"
                              onClick={() => handleOpenDelete(category)}
                              disabled={
                                deleteCategory.isPending &&
                                categoryToDelete?.id === category.id
                              }
                              ariaLabel={`Hapus kategori ${category.name}`}
                            >
                              <FiTrash2 size={16} aria-hidden="true" />
                              Hapus
                            </CancelButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
                <FiFolder size={24} aria-hidden="true" />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-second">
                Belum ada kategori
              </h3>

              <p className="mt-2 max-w-sm text-sm text-second/60">
                Kategori yang tersedia akan ditampilkan di halaman ini.
              </p>

              <PrimaryButton type="button" onClick={handleAdd}>
                <FiPlus size={16} aria-hidden="true" />
                Tambah Kategori
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>

      <CategoryFormModal
        isOpen={isFormOpen}
        category={categoryToEdit}
        isSaving={isSaving}
        onClose={closeForm}
        onSubmit={handleSaveCategory}
      />

      <DeleteCategoryModal
        category={categoryToDelete}
        isDeleting={deleteCategory.isPending}
        onClose={closeDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
