"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image.js";
import Cropper from "react-easy-crop";
import {
  FiAlertCircle,
  FiImage,
  FiUploadCloud,
  FiX,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const OUTPUT_SIZE = 1600;

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gagal membaca gambar."));
    image.src = src;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal membuat gambar hasil crop."));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function createCroppedFile(imageSrc, cropArea, originalFile) {
  if (!cropArea) {
    throw new Error("Area crop belum tersedia.");
  }

  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");

  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Browser tidak mendukung pemrosesan gambar.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  let blob = null;

  for (const quality of [0.92, 0.85, 0.78, 0.7, 0.6]) {
    blob = await canvasToBlob(canvas, quality);

    if (blob.type !== "image/webp") {
      throw new Error("Browser tidak mendukung ekspor gambar WebP.");
    }

    if (blob.size <= MAX_FILE_SIZE) {
      break;
    }
  }

  if (!blob || blob.size > MAX_FILE_SIZE) {
    throw new Error(
      "Ukuran gambar hasil crop masih melebihi 5 MB. Coba gunakan gambar lain.",
    );
  }

  const baseName = originalFile.name.replace(/\.[^.]+$/, "") || "banner";

  return new File([blob], `${baseName}-cropped.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export default function BannerFormModal({
  isOpen,
  banner,
  isSaving,
  onClose,
  onSubmit,
}) {
  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [isCropping, setIsCropping] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setImageSrc("");
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setValidationError("");
      setIsCropping(false);
      return;
    }

    setFile(null);
    setImageSrc("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setValidationError("");
    setIsCropping(false);
  }, [isOpen, banner?.id]);

  useEffect(() => {
    if (!imageSrc) return undefined;

    return () => URL.revokeObjectURL(imageSrc);
  }, [imageSrc]);

  const handleCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function handleFileChange(event) {
    const input = event.target;
    const selectedFile = input.files?.[0] ?? null;

    // Agar file yang sama bisa dipilih kembali.
    input.value = "";

    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setFile(null);
      setImageSrc("");
      setCroppedAreaPixels(null);
      setValidationError("Format gambar harus PNG, JPEG, atau WebP.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setImageSrc("");
      setCroppedAreaPixels(null);
      setValidationError("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setFile(selectedFile);
    setImageSrc(URL.createObjectURL(selectedFile));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setValidationError("");
  }

  function handleChooseAnotherImage() {
    setFile(null);
    setImageSrc("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setValidationError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setValidationError("");

    if (!file || !imageSrc) {
      setValidationError(
        banner
          ? "Pilih gambar pengganti terlebih dahulu."
          : "Pilih gambar banner terlebih dahulu.",
      );
      return;
    }

    if (!croppedAreaPixels) {
      setValidationError(
        "Area crop belum siap. Coba geser gambar terlebih dahulu.",
      );
      return;
    }

    setIsCropping(true);

    try {
      const croppedFile = await createCroppedFile(
        imageSrc,
        croppedAreaPixels,
        file,
      );

      // Callback halaman tetap menerima File seperti sebelumnya.
      await onSubmit(croppedFile);
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : "Gagal memproses gambar.",
      );
    } finally {
      setIsCropping(false);
    }
  }

  if (!isOpen) return null;

  const isBusy = isSaving || isCropping;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="banner-modal-title"
        className="my-auto max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-second/20 bg-primary text-second shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-second/30 bg-primary p-5 sm:p-6">
          <div>
            <h2 id="banner-modal-title" className="text-lg font-semibold">
              {banner ? "Ganti Gambar Banner" : "Tambah Banner"}
            </h2>

            <p className="mt-1 text-sm text-second/65">
              Atur posisi dan ukuran gambar sebelum menyimpan.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Tutup modal"
            className={`rounded-lg p-2 transition hover:bg-second/10 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          {imageSrc ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Atur Crop Gambar</p>

                {/* 🎯 Indikator rasio diubah jadi 2:3 */}
                <span className="rounded-lg bg-second/10 px-2.5 py-1 text-xs font-medium">
                  2:3
                </span>
              </div>

              {/* 🎯 Wrapper cropper diubah ke aspect-[2/3] agar berbentuk vertikal poster */}
              <div className="relative mx-auto aspect-[2/3] w-full max-w-[340px] overflow-hidden rounded-xl bg-black">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={2 / 3} // 🎯 Rasio 2:3 (1500 x 2250)
                  objectFit="contain"
                  restrictPosition
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={handleCropComplete}
                />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-second/60">
                Geser gambar untuk mengatur posisinya. Gunakan slider untuk
                memperbesar atau memperkecil gambar. Hasil crop berbentuk poster
                vertikal dengan resolusi 1500 × 2250 piksel.
              </p>

              <div className="mt-4 flex items-center gap-3">
                <FiZoomOut size={18} className="shrink-0 text-second/65" />

                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  aria-label="Zoom gambar"
                  disabled={isBusy}
                  className="w-full accent-second"
                />

                <FiZoomIn size={18} className="shrink-0 text-second/65" />

                <span className="w-12 text-right text-xs tabular-nums text-second/60">
                  {zoom.toFixed(1)}×
                </span>
              </div>

              <button
                type="button"
                onClick={handleChooseAnotherImage}
                disabled={isBusy}
                className={`mt-3 text-sm text-second/70 underline underline-offset-4 transition hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
              >
                Pilih gambar lain
              </button>
            </div>
          ) : (
            <>
              {banner?.banner_url ? (
                <div className="overflow-hidden rounded-xl border border-second/20 bg-second/5">
                  {/* 🎯 Pratinjau banner saat ini juga disesuaikan ke 2:3 */}
                  <div className="relative aspect-[2/3] max-w-[240px] mx-auto">
                    <Image
                      src={banner.banner_url}
                      alt="Gambar banner saat ini"
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 90vw, 240px"
                      className="object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[2/3] max-w-[240px] mx-auto flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-second/30 bg-second/5">
                  <FiImage size={32} className="opacity-60" />
                  <p className="text-xs text-center text-second/60 px-2">
                    Pratinjau gambar akan muncul di sini
                  </p>
                </div>
              )}
            </>
          )}

          {!imageSrc && (
            <label
              className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-second/25 px-4 py-3 text-sm font-medium transition hover:bg-second/10 ${FOCUS_RING}`}
            >
              <FiUploadCloud size={18} />
              {banner ? "Pilih Gambar Pengganti" : "Pilih Gambar"}

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                disabled={isBusy}
                className="sr-only"
              />
            </label>
          )}

          {file && (
            <p className="break-all text-xs text-second/70">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          )}

          <p className="text-xs leading-relaxed text-second/60">
            Format PNG, JPEG, atau WebP. File asli maksimal 5 MB. Hasil crop
            berukuran 1500 × 2250 piksel (rasio 2:3) dikirim sebagai WebP.
          </p>

          {validationError && (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-red-400"
            >
              <FiAlertCircle className="mt-0.5 shrink-0" />
              {validationError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-second/30 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className={`rounded-xl border border-second/25 px-5 py-2.5 text-sm font-medium transition hover:bg-second/10 disabled:opacity-50 ${FOCUS_RING}`}
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isBusy}
              className={`rounded-xl bg-second px-5 py-2.5 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {isCropping
                ? "Memproses Gambar..."
                : isSaving
                  ? "Menyimpan..."
                  : banner
                    ? "Simpan Gambar"
                    : "Tambah Banner"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
