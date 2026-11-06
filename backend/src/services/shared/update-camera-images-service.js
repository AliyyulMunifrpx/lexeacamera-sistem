import { supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { processImage } from "../../utils/process-image.js";
import { updateCameraImagesValidation } from "../../validation/shared/update-camera-images-validation.js";
import { validate } from "../../validation/validation.js";
import crypto from "node:crypto";
const BUCKET = process.env.SUPABASE_CAMERA_BUCKET;
const MAX_IMAGES = 12;

const planImageChanges = (existingImages, keepIds) => {
  const existingIds = new Set(existingImages.map((image) => image.id));

  if (keepIds.some((id) => !existingIds.has(id))) {
    throw new ResponseError(404, "CAMERA_IMAGE_NOT_FOUND");
  }

  const keepSet = new Set(keepIds);
  return {
    kept: existingImages.filter((image) => keepSet.has(image.id)),
    removed: existingImages.filter((image) => !keepSet.has(image.id)),
  };
};

const pickPrimaryId = ({ primary, kept, newImages }) => {
  if (primary?.startsWith("new:"))
    return newImages[Number(primary.slice(4))].id;
  if (primary) return primary;

  const currentPrimary = kept.find((image) => image.is_primary);
  if (currentPrimary) return currentPrimary.id;

  return (kept[0] ?? newImages[0]).id;
};

const processCameraImage = async (file) => {
  try {
    return await processImage(file.buffer, {
      width: 1600,
      height: 1600,
      quality: 90,
      fit: "inside",
    });
  } catch (error) {
    if (error.statusCode === 400) {
      throw new ResponseError(400, "INVALID_IMAGE_FORMAT");
    }
    throw new ResponseError(400, "INVALID_IMAGE");
  }
};

// Public URL jadi path di bucket. Hanya path di folder kamera ini yang
// dikembalikan, jadi URL aneh di DB nggak bisa dipakai menghapus file lain.
const getStoragePath = (cameraId, imageUrl) => {
  const marker = `/object/public/${BUCKET}/`;
  const index = imageUrl.indexOf(marker);
  if (index === -1) return null;

  let path;
  try {
    path = decodeURIComponent(
      imageUrl.slice(index + marker.length).split("?")[0],
    );
  } catch {
    return null;
  }

  return path.startsWith(`cameras/${cameraId}/`) && !path.includes("..")
    ? path
    : null;
};

const removeUploadedImages = async (paths) => {
  if (!paths.length || !BUCKET) return;

  const { error } = await supabase.storage.from(BUCKET).remove(paths);

  if (error) {
    console.error("Failed to clean up camera images:", error);
  }
};
const updateCameraImages = async (request) => {
  const { id, body = {}, files = [] } = request;
  if (!BUCKET) {
    throw new ResponseError(500, "CAMERA_BUCKET_NOT_CONFIGURED");
  }

  let keepImageIds = body.keep_image_ids;
  if (typeof keepImageIds === "string") {
    try {
      keepImageIds = JSON.parse(keepImageIds);
    } catch {
      throw new ResponseError(400, "INVALID_KEEP_IMAGE_IDS");
    }
  }

  const req = validate(updateCameraImagesValidation, {
    id,
    keep_image_ids: keepImageIds,
    primary: body.primary,
  });

  // Cek jumlah dulu sebelum menyentuh DB atau bucket
  const finalCount = req.keep_image_ids.length + files.length;

  if (finalCount === 0) {
    throw new ResponseError(400, "CAMERA_IMAGES_REQUIRED");
  }
  if (finalCount > MAX_IMAGES) {
    throw new ResponseError(400, "TOO_MANY_CAMERA_IMAGES");
  }

  if (req.primary) {
    const valid = req.primary.startsWith("new:")
      ? Number(req.primary.slice(4)) < files.length
      : req.keep_image_ids.includes(req.primary);

    if (!valid) {
      throw new ResponseError(400, "INVALID_PRIMARY_IMAGE");
    }
  }

  const loadImages = (client) =>
    client.camera.findUnique({
      where: { id: req.id, is_deleted: false },
      select: {
        images: {
          select: { id: true, image_url: true, is_primary: true },
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
        },
      },
    });

  // Cek awal supaya request yang pasti gagal nggak sempat upload apa-apa
  const snapshot = await loadImages(prisma);
  if (!snapshot) {
    throw new ResponseError(404, "CAMERA_NOT_FOUND");
  }
  planImageChanges(snapshot.images, req.keep_image_ids);

  // Semua gambar baru diproses dulu di memory, belum ada yang ter-upload
  const buffers = [];
  for (const file of files) {
    buffers.push(await processCameraImage(file));
  }

  const uploadedPaths = [];
  const newImages = [];
  let outcome;

  try {
    for (const buffer of buffers) {
      const path = `cameras/${req.id}/${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Camera image upload failed:", uploadError);
        throw new ResponseError(500, "CAMERA_IMAGE_UPLOAD_FAILED");
      }

      uploadedPaths.push(path);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      newImages.push({ id: crypto.randomUUID(), image_url: data.publicUrl });
    }

    outcome = await prisma.$transaction(
      async (tx) => {
        // Satu edit gambar per kamera dalam satu waktu (khusus PostgreSQL)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.id}::text))`;

        // Baca ulang di dalam lock: ini yang jadi acuan, bukan snapshot tadi
        const current = await loadImages(tx);
        if (!current) {
          throw new ResponseError(404, "CAMERA_NOT_FOUND");
        }

        const { kept, removed } = planImageChanges(
          current.images,
          req.keep_image_ids,
        );
        const primaryId = pickPrimaryId({
          primary: req.primary,
          kept,
          newImages,
        });

        if (removed.length) {
          await tx.cameraImage.deleteMany({
            where: {
              camera_id: req.id,
              id: { in: removed.map((image) => image.id) },
            },
          });
        }

        if (newImages.length) {
          await tx.cameraImage.createMany({
            data: newImages.map((image) => ({
              id: image.id,
              camera_id: req.id,
              image_url: image.image_url,
              is_primary: false,
            })),
          });
        }

        await tx.cameraImage.updateMany({
          where: {
            camera_id: req.id,
            id: { not: primaryId },
            is_primary: true,
          },
          data: { is_primary: false },
        });
        await tx.cameraImage.updateMany({
          where: { camera_id: req.id, id: primaryId },
          data: { is_primary: true },
        });

        const images = await tx.cameraImage.findMany({
          where: { camera_id: req.id },
          orderBy: [
            { is_primary: "desc" },
            { created_at: "asc" },
            { id: "asc" },
          ],
        });

        return { images, removed };
      },
      { timeout: 15000 },
    );
  } catch (error) {
    // Transaksi gagal: file yang baru ter-upload nggak boleh tersisa
    await removeUploadedImages(uploadedPaths).catch(() => {});

    // Kamera terhapus tepat saat insert (FK camera_id)
    if (error.code === "P2003") {
      throw new ResponseError(404, "CAMERA_NOT_FOUND");
    }

    throw error;
  }

  // --- Sudah commit. Jangan pindahkan ke dalam try di atas: error di sini
  // --- akan memicu penghapusan file baru yang sekarang sudah dipakai DB.
  const removedPaths = [];
  for (const image of outcome.removed) {
    const path = getStoragePath(req.id, image.image_url);
    if (path) {
      removedPaths.push(path);
    } else {
      console.error("Camera image url not recognised, file not removed:", {
        cameraId: req.id,
        imageId: image.id,
      });
    }
  }

  try {
    await removeUploadedImages(removedPaths);
  } catch (error) {
    console.error("Failed to remove old camera images:", {
      cameraId: req.id,
      removedPaths,
      error,
    });
  }

  return outcome.images;
};
export default { updateCameraImages };
