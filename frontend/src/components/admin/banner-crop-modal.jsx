"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { FiX, FiZoomIn, FiAlertCircle } from "react-icons/fi";
async function cropImageTo3x1(file, cropArea) {
  const bitmap = await createImageBitmap(file);

  try {
    // 💡 Ubah target rasio ke 3:1
    let sourceWidth = cropArea.width;
    let sourceHeight = sourceWidth / 3; // Karena 3:1 (tinggi = lebar / 3)

    if (sourceHeight > cropArea.height) {
      sourceHeight = cropArea.height;
      sourceWidth = sourceHeight * 3;
    }

    const sourceX = cropArea.x + (cropArea.width - sourceWidth) / 2;
    const sourceY = cropArea.y + (cropArea.height - sourceHeight) / 2;

    // Dimensi output diset ke kelipatan 3000 × 1000 (atau proporsi 3:1)
    const scale = Math.floor(Math.min(sourceWidth / 3000, sourceHeight / 1000));

    // Kalau gambarnya kekecilan, minimal scale 1 atau pakai pembagi dasar misal / 3 dan / 1
    const baseScale = Math.max(
      1,
      Math.floor(Math.min(sourceWidth / 3, sourceHeight / 1)),
    );

    const canvas = document.createElement("canvas");
    // Target ukuran final yang rapi untuk 3:1 (misal 3000 x 1000 atau skala proporsionalnya)
    canvas.width = baseScale * 3;
    canvas.height = baseScale * 1;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Gagal memproses gambar.");
    }

    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Gagal menghasilkan gambar crop."));
        },
        "image/webp",
        0.92,
      );
    });

    const extension =
      blob.type === "image/webp"
        ? "webp"
        : blob.type === "image/jpeg"
          ? "jpg"
          : "png";

    const baseName = file.name.replace(/\.[^.]+$/, "");

    return new File([blob], `${baseName}-cropped.${extension}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

export default function BannerCropModal({
  imageSrc,
  sourceFile,
  onCancel,
  onConfirm,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropArea, setCropArea] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState("");

  const handleCropComplete = useCallback((_, pixels) => {
    setCropArea(pixels);
  }, []);

  async function handleConfirm() {
    if (!cropArea || isCropping) return;

    setIsCropping(true);
    setError("");

    try {
      const croppedFile = await cropImageTo3x1(sourceFile, cropArea);

      onConfirm(croppedFile);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Gagal memproses gambar.",
      );
    } finally {
      setIsCropping(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isCropping) {
          onCancel();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="banner-crop-title"
        className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-second/20 bg-primary text-second shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-second/15 p-4 sm:p-5">
          <div>
            <h2 id="banner-crop-title" className="font-semibold">
              Crop Banner Utama
            </h2>

            <p className="mt-1 text-xs text-second/60">
              Geser gambar dan atur zoom. Rasio hasil selalu 3:1.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isCropping}
            aria-label="Tutup cropper"
            className="rounded-lg p-2 transition hover:bg-second/10 disabled:opacity-50"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="relative h-[45vh] min-h-[260px] max-h-[560px] bg-black sm:h-[55vh]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={3 / 1}
            minZoom={1}
            maxZoom={3}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <FiZoomIn size={18} className="shrink-0" />

            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={isCropping}
              aria-label="Zoom gambar"
              className="w-full accent-current"
            />

            <span className="w-10 text-right text-xs text-second/60">
              {zoom.toFixed(1)}×
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-red-400"
            >
              <FiAlertCircle className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-second/15 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isCropping}
              className="rounded-xl border border-second/25 px-5 py-2.5 text-sm font-medium transition hover:bg-second/10 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!cropArea || isCropping}
              className="rounded-xl bg-second px-5 py-2.5 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCropping ? "Memproses..." : "Gunakan Hasil Crop"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
