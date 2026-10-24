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
} from "react-icons/fi";

import {
  useGetCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "../../../features/categories/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import CategoryFormModal from "../../../../components/admin/category-form-modal.jsx";
import DeleteCategoryModal from "../../../../components/admin/delete-category-modal.jsx";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

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
    return (
      <div
        className="flex min-h-64 items-center justify-center gap-3"
        role="status"
        aria-live="polite"
      >
        <FiLoader className="animate-spin text-second" size={22} />
        <span className="text-sm text-second/60">Memuat data kategori...</span>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="space-y-4 rounded-2xl border border-second/30 p-6">
        <h2 className="font-semibold text-second">Gagal memuat kategori</h2>

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
            <FiFolder size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Manajemen Kategori
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            Kelola kategori yang digunakan untuk mengelompokkan kamera.
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
            Tambah Kategori
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-second">Daftar kategori</h2>

        <p className="mt-1 text-sm text-second/60">
          {formatNumber(categories.length)} kategori ditemukan. Kategori terbaru
          ada di paling atas.
        </p>
      </div>

      <div
        className={`transition-opacity duration-200 ${
          isFetching ? "opacity-50" : "opacity-100"
        }`}
      >
        {categories.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-second/10">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-second/5">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-4 text-sm font-semibold text-second/60"
                    >
                      Nama kategori
                    </th>

                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-second/60"
                    >
                      Dibuat
                    </th>

                    <th
                      scope="col"
                      className="px-4 py-4 text-right text-sm font-semibold text-second/60"
                    >
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-second/10">
                  {categories.map((category) => (
                    <tr
                      key={category.id}
                      className="transition-colors hover:bg-second/5"
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second/5 text-second">
                            <FiTag size={16} />
                          </div>

                          <span className="break-words text-sm font-semibold text-second">
                            {category.name}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm text-second/60">
                        {formatDate(category.created_at)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(category)}
                            aria-label={`Edit kategori ${category.name}`}
                            className={`inline-flex h-10 items-center justify-center gap-2 rounded-full bg-second px-4 text-xs font-semibold text-primary transition-colors hover:bg-second/80 ${FOCUS_RING}`}
                          >
                            <FiEdit2 size={16} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDelete(category)}
                            disabled={
                              deleteCategory.isPending &&
                              categoryToDelete?.id === category.id
                            }
                            aria-label={`Hapus kategori ${category.name}`}
                            className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border border-second/30 px-4 text-xs font-semibold text-second transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                          >
                            <FiTrash2 size={16} />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-6 text-center">
            <FiFolder size={36} className="text-second/30" />

            <h3 className="mt-4 font-semibold text-second">
              Belum ada kategori
            </h3>

            <p className="mt-2 max-w-sm text-sm text-second/60">
              Kategori yang tersedia akan ditampilkan di halaman ini.
            </p>

            <button
              type="button"
              onClick={handleAdd}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-second px-4 py-2.5 text-sm font-semibold text-primary hover:bg-second/80"
            >
              <FiPlus size={16} />
              Tambah Kategori
            </button>
          </div>
        )}
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
