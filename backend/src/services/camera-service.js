import crypto from "node:crypto";

import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
import { supabase } from "../application/supabase.js";
import { processImage } from "../utils/process-image.js";
import {
  createCameraValidation,
  deleteCameraValidation,
  getAllCameraValidation,
  getCameraValidation,
  updateCameraImagesValidation,
  updateCameraValidation,
} from "../validation/camera-validation.js";
import { validate } from "../validation/validation.js";

const BUCKET = process.env.SUPABASE_CAMERA_BUCKET;

const removeUploadedImages = async (paths) => {
  if (!paths.length || !BUCKET) return;

  const { error } = await supabase.storage.from(BUCKET).remove(paths);

  if (error) {
    console.error("Failed to clean up camera images:", error);
  }
};
const MAX_IMAGES = 12;

const createCamera = async (request) => {
  const { user: authenticatedUser, body, files = [] } = request;

  if (!BUCKET) {
    throw new ResponseError(500, "CAMERA_BUCKET_NOT_CONFIGURED");
  }

  if (!authenticatedUser?.id) {
    throw new ResponseError(401, "UNAUTHORIZED");
  }

  if (files.length === 0) {
    throw new ResponseError(400, "CAMERA_IMAGES_REQUIRED");
  }

  if (files.length > MAX_IMAGES) {
    throw new ResponseError(400, "TOO_MANY_CAMERA_IMAGES");
  }

  let marketplace = body.marketplace;

  if (typeof marketplace === "string") {
    if (marketplace.trim() === "") {
      marketplace = undefined;
    } else {
      try {
        marketplace = JSON.parse(marketplace);
      } catch {
        throw new ResponseError(400, "INVALID_MARKETPLACE_DATA");
      }
    }
  }

  const req = validate(createCameraValidation, {
    ...body,
    marketplace,
  });

  // Joi sudah menjamin marketplace_id unik, jadi perbandingan jumlah di bawah valid
  const marketplaceIds = (req.marketplace ?? []).map(
    (item) => item.marketplace_id,
  );

  const [existingUser, existingCategory, existingMarketplaces] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: authenticatedUser.id },
        select: { id: true },
      }),
      prisma.category.findUnique({
        where: { id: req.category_id },
        select: { id: true },
      }),
      marketplaceIds.length
        ? prisma.marketplace.findMany({
            where: {
              id: { in: marketplaceIds },
              is_active: true, // <-- Pastikan hanya mengambil marketplace yang aktif
            },
            select: { id: true },
          })
        : [],
    ]);

  if (!existingUser) {
    throw new ResponseError(404, "USER_NOT_FOUND");
  }

  if (!existingCategory) {
    throw new ResponseError(404, "CATEGORY_NOT_FOUND");
  }

  if (existingMarketplaces.length !== marketplaceIds.length) {
    throw new ResponseError(404, "MARKETPLACE_NOT_FOUND");
  }

  const cameraId = crypto.randomUUID();
  const uploadedPaths = [];

  try {
    const images = [];

    for (let i = 0; i < files.length; i++) {
      let buffer;

      try {
        buffer = await processImage(files[i].buffer, {
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

      const path = `cameras/${cameraId}/${crypto.randomUUID()}.webp`;

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

      images.push({
        image_url: data.publicUrl,
        is_primary: i === 0,
      });
    }

    return await prisma.camera.create({
      data: {
        id: cameraId,
        name: req.name,
        price: req.price,
        condition: req.condition,
        stock: req.stock,
        description: req.description ?? "",
        inclusions: req.inclusions ?? "",
        category_id: req.category_id,
        promo: req.promo ?? false,
        best_selling: req.best_selling ?? false,
        sku: req.sku,
        serial_number: req.serial_number,
        color: req.color,
        shutter_count: req.shutter_count,

        images: {
          create: images,
        },

        marketplaceLinks: {
          create: (req.marketplace ?? []).map((item) => ({
            marketplace_id: item.marketplace_id,
            product_url: item.product_url,
          })),
        },
      },
      include: {
        images: true,
        marketplaceLinks: true,
        category: true,
      },
    });
  } catch (error) {
    await removeUploadedImages(uploadedPaths);

    // Category/marketplace terhapus di antara pengecekan dan create
    if (error.code === "P2003") {
      const field = String(error.meta?.field_name ?? "");
      throw new ResponseError(
        404,
        field.includes("category")
          ? "CATEGORY_NOT_FOUND"
          : "MARKETPLACE_NOT_FOUND",
      );
    }

    throw error;
  }
};
const PER_PAGE = 20;

const getAllCamera = async (request) => {
  const req = validate(getAllCameraValidation, request);

  if (
    req.min_price !== undefined &&
    req.max_price !== undefined &&
    req.min_price > req.max_price
  ) {
    throw new ResponseError(400, "INVALID_PRICE_RANGE");
  }

  if (
    req.min_stock !== undefined &&
    req.max_stock !== undefined &&
    req.min_stock > req.max_stock
  ) {
    throw new ResponseError(400, "INVALID_STOCK_RANGE");
  }

  const where = { is_deleted: false };

  if (req.search) {
    const search = req.search.trim();

    where.OR = [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        sku: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }
  if (req.category_id) where.category_id = req.category_id;
  if (req.condition) where.condition = req.condition;
  if (req.min_price !== undefined || req.max_price !== undefined) {
    where.price = {};
    if (req.min_price !== undefined) where.price.gte = req.min_price;
    if (req.max_price !== undefined) where.price.lte = req.max_price;
  }

  // Filter admin. String kosong ("") dianggap nggak ada filter
  if (req.sku) {
    where.sku = { contains: req.sku, mode: "insensitive" };
  }
  if (req.serial_number) {
    where.serial_number = { contains: req.serial_number, mode: "insensitive" };
  }
  if (req.color) {
    where.color = { contains: req.color, mode: "insensitive" };
  }
  if (req.min_stock !== undefined || req.max_stock !== undefined) {
    where.stock = {};
    if (req.min_stock !== undefined) where.stock.gte = req.min_stock;
    if (req.max_stock !== undefined) where.stock.lte = req.max_stock;
  }

  const [cameras, total] = await prisma.$transaction([
    prisma.camera.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        images: { where: { is_primary: true }, take: 1 },
        category: true,
      },
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.camera.count({ where }),
  ]);

  return {
    data: cameras,
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};
const getCamera = async function (request) {
  const req = validate(getCameraValidation, request);
  const camera = await prisma.camera.findUnique({
    where: {
      id: req.id,
      is_deleted: false,
    },
    include: {
      category: true,
      images: true,
      marketplaceLinks: {
        where: {
          marketplace: {
            is_active: true, // <-- Filter agar link marketplace yang non-aktif nggak ikut ke-load
          },
        },
        include: {
          marketplace: true, // kalau butuh data detail marketplacenya
        },
      },
    },
  });

  if (!camera) {
    throw new ResponseError(404, "CAMERA_NOT_FOUND");
  }
  return camera;
};
const CAMERA_SCALAR_FIELDS = [
  "name",
  "price",
  "condition",
  "stock",
  "description",
  "inclusions",
  "category_id",
  "promo",
  "best_selling",
  "sku",
  "serial_number",
  "color",
  "shutter_count",
];

const updateCamera = async (request) => {
  const req = validate(updateCameraValidation, request);

  const marketplaceIds = (req.marketplace ?? []).map(
    (item) => item.marketplace_id,
  );

  const [existingCamera, existingCategory, existingMarketplaces] =
    await Promise.all([
      prisma.camera.findUnique({
        where: { id: req.id, is_deleted: false },
        select: { id: true },
      }),
      req.category_id
        ? prisma.category.findUnique({
            where: { id: req.category_id },
            select: { id: true },
          })
        : null,
      marketplaceIds.length
        ? prisma.marketplace.findMany({
            where: {
              id: { in: marketplaceIds },
              is_active: true, // <-- Tambahkan filter ini juga
            },
            select: { id: true },
          })
        : [],
    ]);

  if (!existingCamera) {
    throw new ResponseError(404, "CAMERA_NOT_FOUND");
  }

  if (req.category_id && !existingCategory) {
    throw new ResponseError(404, "CATEGORY_NOT_FOUND");
  }

  // Joi sudah menjamin marketplace_id unik, jadi perbandingan jumlah valid
  if (existingMarketplaces.length !== marketplaceIds.length) {
    throw new ResponseError(404, "MARKETPLACE_NOT_FOUND");
  }

  // Hanya field yang dikirim. `!== undefined` supaya 0, false, "" tetap masuk
  const data = {};
  for (const field of CAMERA_SCALAR_FIELDS) {
    if (req[field] !== undefined) data[field] = req[field];
  }

  if (req.marketplace !== undefined) {
    // Replace semua link. Satu update = satu transaksi, jadi atomic
    data.marketplaceLinks = {
      deleteMany: {},
      create: req.marketplace.map((item) => ({
        marketplace_id: item.marketplace_id,
        product_url: item.product_url,
      })),
    };
  }

  try {
    return await prisma.camera.update({
      where: { id: req.id },
      data,
      include: {
        images: true,
        category: true,
        marketplaceLinks: {
          where: {
            marketplace: {
              is_active: true,
            },
          },
          include: {
            marketplace: true,
          },
        },
      },
    });
  } catch (error) {
    // Kamera terhapus di antara pengecekan dan update
    if (error.code === "P2025") {
      throw new ResponseError(404, "CAMERA_NOT_FOUND");
    }

    // Dua edit marketplace bersamaan: keduanya delete lalu create link yang sama
    if (error.code === "P2002") {
      throw new ResponseError(409, "CAMERA_UPDATE_CONFLICT");
    }

    // Category/marketplace/kamera terhapus di tengah proses
    if (error.code === "P2003") {
      const field = String(error.meta?.field_name ?? "").toLowerCase();

      if (field.includes("category_id")) {
        throw new ResponseError(404, "CATEGORY_NOT_FOUND");
      }
      if (field.includes("marketplace_id")) {
        throw new ResponseError(404, "MARKETPLACE_NOT_FOUND");
      }
      if (field.includes("camera_id")) {
        throw new ResponseError(404, "CAMERA_NOT_FOUND");
      }
    }

    throw error;
  }
};
// Hapus semua file di folder kamera. Nggak pernah melempar error:
// kamera sudah terhapus dari DB, jadi kegagalan di sini cuma di-log.
const removeCameraFolder = async (cameraId) => {
  const folder = `cameras/${cameraId}`;

  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, { limit: 100 });

    if (error) throw error;
    if (!files?.length) return;

    const paths = files.map((file) => `${folder}/${file.name}`);

    const { data: removed, error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (removeError) throw removeError;

    // remove() yang ditolak policy tidak error, hanya mengembalikan array kosong
    if ((removed?.length ?? 0) !== paths.length) {
      console.error("Camera images not fully removed:", {
        cameraId,
        expected: paths.length,
        removed: removed?.length ?? 0,
      });
    }
  } catch (error) {
    console.error("Failed to clean up camera images:", { cameraId, error });
  }
};
const deleteCamera = async (request) => {
  const req = validate(deleteCameraValidation, request);

  // Cek di awal: kalau config salah, jangan sampai kamera terhapus
  // tapi filenya nggak bisa dibersihkan
  if (!BUCKET) {
    throw new ResponseError(500, "CAMERA_BUCKET_NOT_CONFIGURED");
  }

  await prisma.$transaction(
    async (tx) => {
      // Lock yang sama dengan updateCameraImages, supaya delete dan edit gambar
      // nggak saling menyalip (khusus PostgreSQL)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.id}::text))`;

      // updateMany atomic: cuma satu request yang bisa mengubah false jadi true
      const { count } = await tx.camera.updateMany({
        where: { id: req.id, is_deleted: false },
        data: { is_deleted: true },
      });

      // 0 = id nggak ada, atau sudah terhapus (termasuk yang kalah race)
      if (count === 0) {
        throw new ResponseError(404, "CAMERA_NOT_FOUND");
      }

      await tx.cameraImage.deleteMany({ where: { camera_id: req.id } });
    },
    { timeout: 15000 },
  );

  // Sudah commit. Hapus semua isi folder, bukan cuma yang tercatat di DB,
  // jadi file yatim sisa kegagalan sebelumnya ikut bersih.
  await removeCameraFolder(req.id);

  return { message: "CAMERA_DELETED" };
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
export default {
  createCamera,
  updateCameraImages,
  getAllCamera,
  getCamera,
  updateCamera,
  deleteCamera,
};
