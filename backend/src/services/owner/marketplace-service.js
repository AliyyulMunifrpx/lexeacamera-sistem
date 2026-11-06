import crypto from "node:crypto";

import { supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { processImage } from "../../utils/process-image.js";
import {
  createMarketplaceValidation,
  deleteMarketplaceValidation,
  getAllMarketplaceValidation,
  getMarketplaceValidation,
  updateMarketplaceValidation,
} from "../../validation/owner/marketplace-validation.js";
import { validate } from "../../validation/validation.js";

const BUCKET = process.env.SUPABASE_MARKETPLACE_BUCKET;
const MAX_LISTED_CAMERAS = 10;

const MARKETPLACE_SELECT = {
  id: true,
  name: true,
  logo_url: true,
  is_active: true,
};

const UPDATABLE_FIELDS = ["name", "is_active"];

const processLogo = async (file) => {
  try {
    return await processImage(file.buffer, {
      width: 512,
      height: 512,
      quality: 82,
      fit: "inside",
    });
  } catch (error) {
    if (error.statusCode === 400) {
      throw new ResponseError(400, "INVALID_IMAGE_FORMAT");
    }
    throw new ResponseError(400, "INVALID_IMAGE");
  }
};

const storeLogo = async (marketplaceId, buffer) => {
  const path = `marketplaces/${marketplaceId}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("Marketplace logo upload failed:", error);
    throw new ResponseError(500, "LOGO_UPLOAD_FAILED");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
};

// Nggak pernah melempar error: dipakai setelah DB berubah atau di jalur rollback,
// jadi kegagalan di sini cuma di-log.
const removeFiles = async (paths) => {
  if (!paths.length) return;

  try {
    const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw error;

    // remove() yang ditolak policy tidak error, hanya mengembalikan array kosong
    if ((data?.length ?? 0) !== paths.length) {
      console.error("Marketplace logo not fully removed:", {
        paths,
        removed: data?.length ?? 0,
      });
    }
  } catch (error) {
    console.error("Failed to remove marketplace logo:", { paths, error });
  }
};

const removeMarketplaceFolder = async (marketplaceId) => {
  const folder = `marketplaces/${marketplaceId}`;

  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, { limit: 100 });

    if (error) throw error;

    await removeFiles((files ?? []).map((file) => `${folder}/${file.name}`));
  } catch (error) {
    console.error("Failed to clean up marketplace folder:", {
      marketplaceId,
      error,
    });
  }
};

// Public URL jadi path di bucket. Hanya path di folder marketplace ini yang
// dikembalikan, jadi URL aneh di DB nggak bisa dipakai menghapus file lain.
// URL yang bukan dari bucket kita (misalnya data lama) dilewati.
const getStoragePath = (marketplaceId, logoUrl) => {
  const marker = `/object/public/${BUCKET}/`;
  const index = logoUrl.indexOf(marker);
  if (index === -1) return null;

  let path;
  try {
    path = decodeURIComponent(
      logoUrl.slice(index + marker.length).split("?")[0],
    );
  } catch {
    return null;
  }

  return path.startsWith(`marketplaces/${marketplaceId}/`) &&
    !path.includes("..")
    ? path
    : null;
};

const createMarketplace = async (request) => {
  const { body = {}, file } = request;

  if (!BUCKET) {
    throw new ResponseError(500, "MARKETPLACE_BUCKET_NOT_CONFIGURED");
  }

  if (!file) {
    throw new ResponseError(400, "LOGO_REQUIRED");
  }

  const req = validate(createMarketplaceValidation, { ...body });

  // Cek di awal supaya nama kembar nggak sempat upload
  const taken = await prisma.marketplace.findUnique({
    where: { name: req.name },
    select: { id: true },
  });
  if (taken) {
    throw new ResponseError(409, "MARKETPLACE_ALREADY_EXIST");
  }

  const buffer = await processLogo(file);
  const id = crypto.randomUUID();
  const logo = await storeLogo(id, buffer);

  try {
    return await prisma.marketplace.create({
      data: {
        id,
        name: req.name,
        logo_url: logo.url,
        is_active: req.is_active, // undefined = default database (true)
      },
      select: MARKETPLACE_SELECT,
    });
  } catch (error) {
    await removeFiles([logo.path]);

    // Dua create dengan nama sama bersamaan: yang kalah masuk sini
    if (error.code === "P2002") {
      throw new ResponseError(409, "MARKETPLACE_ALREADY_EXIST");
    }

    throw error;
  }
};

const getAllMarketplace = async (query) => {
  const req = validate(getAllMarketplaceValidation, query);

  const where = {};
  if (req.is_active !== undefined) where.is_active = req.is_active;

  return await prisma.marketplace.findMany({
    where,
    select: MARKETPLACE_SELECT,
    // id sebagai tiebreaker supaya urutan tetap stabil
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
};

const getMarketplace = async (request) => {
  const req = validate(getMarketplaceValidation, request);

  const marketplace = await prisma.marketplace.findUnique({
    where: { id: req.id },
    select: MARKETPLACE_SELECT,
  });

  if (!marketplace) {
    throw new ResponseError(404, "MARKETPLACE_NOT_FOUND");
  }

  return marketplace;
};

const updateMarketplace = async (request) => {
  const { id, body = {}, file } = request;

  if (!BUCKET) {
    throw new ResponseError(500, "MARKETPLACE_BUCKET_NOT_CONFIGURED");
  }

  // id dari path menang atas id di body, has_logo hanya ditentukan oleh file
  const req = validate(updateMarketplaceValidation, { ...body, id });
  if (req.name === undefined && req.is_active === undefined && !file) {
    throw new ResponseError(400, "NOTHING_TO_UPDATE");
  }
  // Cek awal supaya request yang pasti gagal nggak sempat upload
  const [existing, taken] = await Promise.all([
    prisma.marketplace.findUnique({
      where: { id: req.id },
      select: { id: true },
    }),
    req.name !== undefined
      ? prisma.marketplace.findUnique({
          where: { name: req.name },
          select: { id: true },
        })
      : null,
  ]);

  if (!existing) {
    throw new ResponseError(404, "MARKETPLACE_NOT_FOUND");
  }
  if (taken && taken.id !== req.id) {
    throw new ResponseError(409, "MARKETPLACE_ALREADY_EXIST");
  }

  // Hanya field yang dikirim. `!== undefined` supaya false tetap masuk
  const data = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req[field] !== undefined) data[field] = req[field];
  }

  let logo;
  if (file) {
    const buffer = await processLogo(file); // gagal di sini = belum ada yang ter-upload
    logo = await storeLogo(req.id, buffer);
    data.logo_url = logo.url;
  }

  let outcome;
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        // Kunci baris (khusus PostgreSQL). Edit logo bersamaan jadi antre,
        // dan URL lama dibaca setelah kunci, jadi nggak ada file yang terlewat.
        const locked = await tx.$queryRaw`
          SELECT logo_url FROM "Marketplace" WHERE id = ${req.id} FOR NO KEY UPDATE
        `;

        if (locked.length === 0) {
          throw new ResponseError(404, "MARKETPLACE_NOT_FOUND");
        }

        const marketplace = await tx.marketplace.update({
          where: { id: req.id },
          data,
          select: MARKETPLACE_SELECT,
        });

        return { marketplace, oldLogoUrl: locked[0].logo_url };
      },
      { timeout: 15000 },
    );
  } catch (error) {
    // Gagal: file yang baru ter-upload nggak boleh tersisa
    if (logo) await removeFiles([logo.path]);

    // Dua edit nama bersamaan
    if (error.code === "P2002") {
      throw new ResponseError(409, "MARKETPLACE_ALREADY_EXIST");
    }

    throw error;
  }

  // --- Sudah commit. Jangan pindahkan ke dalam try di atas: error di sini
  // --- akan memicu penghapusan file baru yang sekarang sudah dipakai DB.
  if (logo) {
    const oldPath = getStoragePath(req.id, outcome.oldLogoUrl);
    if (oldPath) await removeFiles([oldPath]);
  }

  return outcome.marketplace;
};

const deleteMarketplace = async (request) => {
  const req = validate(deleteMarketplaceValidation, request);

  // Cek di awal: kalau config salah, jangan sampai marketplace terhapus
  // tapi filenya nggak bisa dibersihkan
  if (!BUCKET) {
    throw new ResponseError(500, "MARKETPLACE_BUCKET_NOT_CONFIGURED");
  }

  await prisma.$transaction(
    async (tx) => {
      // Kunci baris marketplace (khusus PostgreSQL). Insert link dari
      // create/edit kamera menunggu sampai transaksi ini selesai.
      const locked = await tx.$queryRaw`
        SELECT id FROM "Marketplace" WHERE id = ${req.id} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new ResponseError(404, "MARKETPLACE_NOT_FOUND");
      }

      // Kamera soft-deleted nggak dihitung: admin nggak melihatnya
      const where = {
        is_deleted: false,
        marketplaceLinks: { some: { marketplace_id: req.id } },
      };

      const total = await tx.camera.count({ where });

      if (total > 0) {
        const cameras = await tx.camera.findMany({
          where,
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: MAX_LISTED_CAMERAS,
        });

        // total bisa lebih besar dari cameras.length: daftar dibatasi
        throw new ResponseError(400, "MARKETPLACE_STILL_IN_USE", {
          total,
          cameras,
        });
      }

      // Link milik kamera terhapus ikut hilang lewat Cascade
      await tx.marketplace.delete({ where: { id: req.id } });
    },
    { timeout: 15000 },
  );

  // Sudah commit. Hapus semua isi folder, bukan cuma logo yang tercatat.
  await removeMarketplaceFolder(req.id);

  return { message: "MARKETPLACE_DELETED" };
};

export default {
  createMarketplace,
  getAllMarketplace,
  getMarketplace,
  updateMarketplace,
  deleteMarketplace,
};
