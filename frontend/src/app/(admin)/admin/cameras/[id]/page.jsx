"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiCamera,
  FiExternalLink,
  FiLoader,
  FiPackage,
  FiTag,
  FiTrash2,
} from "react-icons/fi";

import Image from "next/image.js";
import {
  useDeleteCamera,
  useGetCamera,
} from "../../../../features/cameras/hooks.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";
import DeleteCameraModal from "../../../../../components/admin/delete-camera-modal.jsx";

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

function formatPrice(price = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

function DetailItem({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-second/50">{label}</p>
      <div className="break-words text-sm font-medium text-second">
        {children || "—"}
      </div>
    </div>
  );
}

function StatusBadge({ active, children }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
        active
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-second/5 text-second/60"
      }`}
    >
      {children}
    </span>
  );
}

export default function CameraDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 1. Tambahkan state untuk menyimpan gambar yang sedang terpilih
  const [activeImage, setActiveImage] = useState(null);

  const deleteCam = useDeleteCamera();

  const {
    data: camera,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetCamera(id);

  useEffect(() => {
    if (!isError || !error) return;

    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);

  // 2. Set default activeImage begitu data camera berhasil di-fetch
  useEffect(() => {
    if (camera?.images && camera.images.length > 0) {
      const primary =
        camera.images.find((img) => img.is_primary) ?? camera.images[0];
      setActiveImage(primary);
    }
  }, [camera]);

  async function handleDeleteCamera() {
    try {
      await deleteCam.mutateAsync(id);

      setShowDeleteModal(false);
      notify.success("Produk berhasil dihapus.");
      router.replace("/admin/cameras");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-second/60">
        <FiLoader className="animate-spin" size={22} />
        Memuat detail produk...
      </div>
    );
  }

  if (isError || !camera) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-second/30 p-6 text-center">
        <FiCamera size={36} className="text-second/30" />

        <div>
          <h2 className="font-semibold text-second">
            Gagal memuat detail produk
          </h2>
          <p className="mt-2 text-sm text-second/60">
            Data produk tidak ditemukan atau gagal dimuat.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/cameras")}
            className="rounded-full border border-second/15 px-5 py-2.5 text-sm font-semibold text-second hover:bg-second/5"
          >
            Kembali
          </button>

          {isError && (
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-full bg-second px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              {isFetching ? "Memuat..." : "Coba lagi"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const images = camera.images ?? [];
  const marketplaces = camera.marketplaceLinks ?? [];

  const conditionLabel = {
    NEW: "Baru",
    SECOND: "Bekas",
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 pb-10">
      <button
        type="button"
        onClick={() => router.push("/admin/cameras")}
        className="inline-flex items-center gap-2 text-sm text-second/60 transition-colors hover:text-second"
      >
        <FiArrowLeft size={18} />
        Kembali
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiCamera size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Detail Produk
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            Informasi lengkap produk dalam katalog penjualan.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge active={camera.promo}>
            {camera.promo ? "Promosi aktif" : "Promosi tidak aktif"}
          </StatusBadge>

          <StatusBadge active={camera.best_selling}>
            {camera.best_selling ? "Best seller" : "Bukan best seller"}
          </StatusBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-second/30 p-4 sm:p-6">
          {/* Frame Utama / Gambar Besar */}
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-second/[0.03]">
            {activeImage?.image_url ? (
              <Image
                width={1600}
                height={1600}
                src={activeImage.image_url}
                alt={camera.name}
                className="h-full w-full object-cover transition-all duration-300"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-second/30">
                <FiCamera size={48} />
                <span className="text-sm">Gambar tidak tersedia</span>
              </div>
            )}
          </div>

          {/* List Thumbnail Gambar Kecil */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {images.map((image, index) => {
                // Cek apakah thumbnail ini yang sedang aktif ditampilkan
                const isSelected = activeImage
                  ? (activeImage.id && activeImage.id === image.id) ||
                    activeImage.image_url === image.image_url
                  : image.is_primary;

                return (
                  <button
                    type="button"
                    key={image.id ?? image.image_url ?? index}
                    onClick={() => setActiveImage(image)} // 3. Set gambar aktif ketika diklik
                    className={`flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-second/[0.03] transition-all hover:opacity-80 ${
                      isSelected
                        ? "ring-2 ring-second ring-offset-2 ring-offset-primary"
                        : "border border-second/30 opacity-60"
                    }`}
                  >
                    {image.image_url ? (
                      <div className="relative h-full w-full">
                        {image.is_primary && (
                          <p className="absolute inset-0 z-20 bg-grad h-fit text-primary">
                            Utama
                          </p>
                        )}

                        <Image
                          fill
                          src={image.image_url}
                          alt={`${camera.name} ${index + 1}`}
                          className="z-10 h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <FiCamera className="text-second/30" size={22} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-xs text-second/50">{images.length} gambar</p>
        </section>

        <section className="flex h-full flex-col space-y-6 rounded-2xl border border-second/30 p-5 sm:p-7">
          <div>
            <p className="text-sm text-second/50">Nama produk</p>
            <h2 className="mt-2 text-2xl font-bold text-second">
              {camera.name}
            </h2>
          </div>

          <div>
            <p className="text-sm text-second/50">Harga</p>
            <p className="mt-1 text-3xl font-bold text-second">
              {formatPrice(camera.price)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 border-y border-second/30 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-grad text-primary">
                <FiPackage size={20} />
              </div>

              <div>
                <p className="text-xs text-second/50">Stok</p>
                <p className="mt-1 font-semibold text-second">
                  {formatNumber(camera.stock)} unit
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-grad text-primary">
                <FiTag size={20} />
              </div>

              <div>
                <p className="text-xs text-second/50">Kondisi</p>
                <p className="mt-1 font-semibold text-second">
                  {conditionLabel[camera.condition] ?? camera.condition ?? "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Grid Informasi Spesifikasi produk */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <DetailItem label="Kategori">
              {camera.category?.name ?? camera.category_id}
            </DetailItem>

            <DetailItem label="SKU">{camera.sku}</DetailItem>

            <DetailItem label="Serial Number">
              {camera.serial_number}
            </DetailItem>

            <DetailItem label="Warna">{camera.color}</DetailItem>

            <DetailItem label="Shutter Count">
              {camera.shutter_count !== undefined &&
              camera.shutter_count !== null
                ? formatNumber(Number(camera.shutter_count))
                : "—"}
            </DetailItem>

            <DetailItem label="Tanggal ditambahkan">
              {camera.created_at
                ? new Date(camera.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </DetailItem>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-second">Deskripsi</h3>
            <p className="whitespace-pre-line text-sm leading-6 text-second/70">
              {camera.description || "Tidak ada deskripsi."}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-second">Kelengkapan</h3>
            <p className="whitespace-pre-line text-sm leading-6 text-second/70">
              {camera.inclusions || "Tidak ada informasi kelengkapan."}
            </p>
          </div>

          {marketplaces.length > 0 && (
            <div className="space-y-3 border-t border-second/30 pt-5">
              <h3 className="font-semibold text-second">Marketplace</h3>
              <div className="flex gap-4">
                {marketplaces.map((item, index) => (
                  <Link
                    key={item.id ?? item.marketplace_id ?? index}
                    href={item.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl  p-4 text-sm text-second transition-colors hover:bg-second/[0.03]"
                  >
                    <Image
                      alt={`${item.marketplace.name} logo`}
                      src={item.marketplace.logo_url}
                      width={50}
                      height={50}
                    ></Image>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto flex w-full gap-4 pt-2">
            <Link
              href={`/admin/cameras/${camera.id}/edit`}
              className="flex w-full items-center justify-center rounded-full bg-second px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
            >
              Edit Produk
            </Link>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={deleteCam.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-second2 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiTrash2 size={17} />
              Hapus Produk
            </button>
          </div>
        </section>
      </div>

      <DeleteCameraModal
        isOpen={showDeleteModal}
        cameraName={camera.name}
        isDeleting={deleteCam.isPending}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteCamera}
      />
    </div>
  );
}
