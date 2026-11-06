import {
  adminGetAllCameraValidation,
  adminUpdateCameraMarketplaceValidation,
} from "../../validation/admin/camera-validation.js";
import { getCameraValidation } from "../../validation/owner/camera-validation.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";

import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;

// PENTING: pakai `select`, bukan `include`. `include` ikut mengembalikan semua
// kolom kamera, termasuk modal. Admin tidak boleh melihat modal.
const LINK_SELECT = {
  id: true,
  camera_id: true,
  marketplace_id: true,
  product_url: true,
  marketplace: true,
};
const LINK_ORDER = [{ marketplace: { name: "asc" } }, { id: "asc" }];

// Link ke marketplace nonaktif tidak tampil di layar, jadi tidak ikut dikembalikan
const ACTIVE_LINKS = {
  where: { marketplace: { is_active: true } },
  select: LINK_SELECT,
  orderBy: LINK_ORDER,
};

const LIST_SELECT = {
  id: true,
  name: true,
  sku: true,
  price: true,
  strikethrough_price: true,
  stock: true,
  condition: true,
  category: true,
  images: { where: { is_primary: true }, take: 1 },
};

const DETAIL_SELECT = {
  id: true,
  name: true,
  sku: true,
  serial_number: true,
  color: true,
  shutter_count: true,
  price: true,
  strikethrough_price: true,
  condition: true,
  stock: true,
  description: true,
  inclusions: true,
  promo: true,
  best_selling: true,
  created_at: true,
  category: true,
  images: {
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }, { id: "asc" }],
  },
  marketplaceLinks: ACTIVE_LINKS,
};

const getAllCamera = async (request) => {
  const req = validate(adminGetAllCameraValidation, request);

  const where = { is_deleted: false };

  if (req.search) {
    where.OR = [
      { name: { contains: req.search, mode: "insensitive" } },
      { sku: { contains: req.search, mode: "insensitive" } },
    ];
  }
  if (req.category_id) where.category_id = req.category_id;

  const [cameras, total] = await prisma.$transaction([
    prisma.camera.findMany({
      where,
      select: LIST_SELECT,
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

const getCamera = async (request) => {
  const req = validate(getCameraValidation, request);
  const camera = await prisma.camera.findUnique({
    where: { id: req.id, is_deleted: false },
    select: DETAIL_SELECT,
  });
  if (!camera) {
    throw new ResponseError(404, "CAMERA_NOT_FOUND");
  }

  return camera;
};

const updateCameraMarketplace = async (request) => {
  const req = validate(adminUpdateCameraMarketplaceValidation, request);

  const marketplaceIds = req.marketplace.map((item) => item.marketplace_id);

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Lock yang sama dengan edit gambar dan hapus kamera, supaya tidak saling
        // menyalip (khusus PostgreSQL)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.id}::text))`;

        const camera = await tx.camera.findUnique({
          where: { id: req.id, is_deleted: false },
          select: { id: true },
        });
        if (!camera) {
          throw new ResponseError(404, "CAMERA_NOT_FOUND");
        }

        if (marketplaceIds.length) {
          const active = await tx.marketplace.findMany({
            where: { id: { in: marketplaceIds }, is_active: true },
            select: { id: true },
          });
          // Joi sudah menjamin marketplace_id unik, jadi perbandingan jumlah valid
          if (active.length !== marketplaceIds.length) {
            throw new ResponseError(404, "MARKETPLACE_NOT_FOUND");
          }
        }

        // Hanya link ke marketplace AKTIF yang diganti. Link ke marketplace
        // nonaktif tidak terlihat di layar, jadi tidak boleh ikut terhapus.
        await tx.cameraMarketplaceLink.deleteMany({
          where: { camera_id: req.id, marketplace: { is_active: true } },
        });

        if (req.marketplace.length) {
          await tx.cameraMarketplaceLink.createMany({
            data: req.marketplace.map((item) => ({
              camera_id: req.id,
              marketplace_id: item.marketplace_id,
              product_url: item.product_url,
            })),
          });
        }

        return tx.cameraMarketplaceLink.findMany({
          where: { camera_id: req.id, marketplace: { is_active: true } },
          select: LINK_SELECT,
          orderBy: LINK_ORDER,
        });
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error instanceof ResponseError) throw error;

    // Marketplace dinonaktifkan di antara pengecekan dan insert
    if (error.code === "P2002") {
      throw new ResponseError(409, "CAMERA_UPDATE_CONFLICT");
    }

    // Marketplace atau kamera terhapus di tengah proses
    if (error.code === "P2003") {
      const field = String(error.meta?.field_name ?? "").toLowerCase();
      throw new ResponseError(
        404,
        field.includes("camera_id")
          ? "CAMERA_NOT_FOUND"
          : "MARKETPLACE_NOT_FOUND",
      );
    }

    throw error;
  }
};

export default {
  getAllCamera,
  getCamera,
  updateCameraMarketplace,
};
