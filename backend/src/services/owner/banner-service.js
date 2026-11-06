import crypto from "node:crypto";

import { supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { processImage } from "../../utils/process-image.js";
import {
  createBannerValidation,
  deleteBannerValidation,
  getBannerValidation,
  updateBannerValidation,
} from "../../validation/owner/banner-validation.js";
import { validate } from "../../validation/validation.js";

const BUCKET = process.env.SUPABASE_BANNER_BUCKET;

// Batas aman untuk endpoint publik, supaya query nggak pernah tanpa batas
const MAX_PUBLIC_BANNERS = 50;

const BANNER_SELECT = {
  id: true,
  banner_url: true,
  created_at: true,
  is_promo: true,
  is_best_seller: true,
};

// Aturan flag (dijaga juga oleh database: dua partial unique index dan satu CHECK):
// - paling banyak satu banner dengan is_promo = true
// - paling banyak satu banner dengan is_best_seller = true
// - satu banner nggak boleh dua-duanya true
// Menjadikan banner ini promo / best seller otomatis mencabut flag dari banner
// yang sebelumnya memegangnya (take-over), dalam satu transaksi.

const assertBucket = () => {
  if (!BUCKET) {
    throw new ResponseError(500, "BANNER_BUCKET_NOT_CONFIGURED");
  }
};

const processBanner = async (file) => {
  try {
    return await processImage(file.buffer, {
      width: 1500,
      height: 2250,
      quality: 85,
      fit: "inside",
    });
  } catch (error) {
    // Error yang sengaja dilempar processImage (misalnya INVALID_IMAGE_FORMAT)
    // diteruskan apa adanya. instanceof tidak bergantung nama properti status.
    if (error instanceof ResponseError) throw error;

    console.error("Banner image processing failed:", error);
    throw new ResponseError(400, "INVALID_IMAGE");
  }
};

const storeBanner = async (bannerId, buffer) => {
  const path = `banners/${bannerId}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("Banner upload failed:", error);
    throw new ResponseError(500, "BANNER_UPLOAD_FAILED");
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
      console.error("Banner file not fully removed:", {
        paths,
        removed: data?.length ?? 0,
      });
    }
  } catch (error) {
    console.error("Failed to remove banner file:", { paths, error });
  }
};

const removeBannerFolder = async (bannerId) => {
  const folder = `banners/${bannerId}`;

  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, { limit: 100 });

    if (error) throw error;

    await removeFiles((files ?? []).map((file) => `${folder}/${file.name}`));
  } catch (error) {
    console.error("Failed to clean up banner folder:", { bannerId, error });
  }
};

// Public URL jadi path di bucket. Hanya path di folder banner ini yang
// dikembalikan, jadi URL aneh di DB nggak bisa dipakai menghapus file lain.
const getStoragePath = (bannerId, bannerUrl) => {
  const marker = `/object/public/${BUCKET}/`;
  const index = bannerUrl.indexOf(marker);
  if (index === -1) return null;

  let path;
  try {
    path = decodeURIComponent(
      bannerUrl.slice(index + marker.length).split("?")[0],
    );
  } catch {
    return null;
  }

  return path.startsWith(`banners/${bannerId}/`) && !path.includes("..")
    ? path
    : null;
};

const assertFlagsNotBoth = (isPromo, isBestSeller) => {
  if (isPromo === true && isBestSeller === true) {
    throw new ResponseError(400, "BANNER_FLAG_CONFLICT");
  }
};

// Semua perubahan flag diserialisasi lewat satu kunci (khusus PostgreSQL),
// diambil SEBELUM kunci baris. Tanpa ini, dua admin yang menjadikan dua banner
// berbeda sebagai promo bersamaan bisa saling menunggu (deadlock).
const lockFlags = (tx) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('banner_flags'))`;

// Cabut flag dari banner lain. Dipanggil sebelum banner ini diubah, supaya
// unique index nggak pernah terlanggar di tengah transaksi.
const takeOverFlags = async (tx, bannerId, { isPromo, isBestSeller }) => {
  if (isPromo === true) {
    await tx.banner.updateMany({
      where: { is_promo: true, id: { not: bannerId } },
      data: { is_promo: false },
    });
  }
  if (isBestSeller === true) {
    await tx.banner.updateMany({
      where: { is_best_seller: true, id: { not: bannerId } },
      data: { is_best_seller: false },
    });
  }
};

const createBanner = async (request) => {
  const { body = {}, file } = request;

  assertBucket();

  if (!file) {
    throw new ResponseError(400, "BANNER_IMAGE_REQUIRED");
  }

  const req = validate(createBannerValidation, { ...body });
  assertFlagsNotBoth(req.is_promo, req.is_best_seller);

  const buffer = await processBanner(file); // gagal di sini = belum ada yang ter-upload
  const id = crypto.randomUUID();
  const banner = await storeBanner(id, buffer);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const takesFlag = req.is_promo === true || req.is_best_seller === true;

        if (takesFlag) {
          await lockFlags(tx);
          await takeOverFlags(tx, id, {
            isPromo: req.is_promo,
            isBestSeller: req.is_best_seller,
          });
        }

        return await tx.banner.create({
          data: {
            id,
            banner_url: banner.url,
            is_promo: req.is_promo ?? false,
            is_best_seller: req.is_best_seller ?? false,
          },
          select: BANNER_SELECT,
        });
      },
      { timeout: 15000 },
    );
  } catch (error) {
    // Gagal simpan: file yang baru ter-upload nggak boleh tersisa
    await removeFiles([banner.path]);

    // Pengaman terakhir: index database menolak flag ganda
    if (error.code === "P2002") {
      throw new ResponseError(409, "BANNER_FLAG_TAKEN");
    }

    throw error;
  }
};

// Publik: urutan terbaru di atas, id sebagai tiebreaker supaya urutan stabil
const getAllBanner = async () => {
  return await prisma.banner.findMany({
    select: BANNER_SELECT,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: MAX_PUBLIC_BANNERS,
  });
};

const getBanner = async (request) => {
  const req = validate(getBannerValidation, { id: request.id });

  const banner = await prisma.banner.findUnique({
    where: { id: req.id },
    select: BANNER_SELECT,
  });

  if (!banner) {
    throw new ResponseError(404, "BANNER_NOT_FOUND");
  }

  return banner;
};

// Update = ganti gambar dan/atau ubah flag. Minimal salah satu harus dikirim.
// Flag yang nggak dikirim nggak berubah.
const updateBanner = async (request) => {
  const { body = {}, file } = request;

  const req = validate(updateBannerValidation, { ...body, id: request.id });

  assertBucket();

  const hasFlags =
    req.is_promo !== undefined || req.is_best_seller !== undefined;

  if (!file && !hasFlags) {
    throw new ResponseError(400, "NOTHING_TO_UPDATE");
  }

  assertFlagsNotBoth(req.is_promo, req.is_best_seller);

  // Cek awal supaya request yang pasti gagal nggak sempat upload.
  // Ini hanya tebakan awal; keputusan akhir diambil di dalam transaksi.
  const existing = await prisma.banner.findUnique({
    where: { id: req.id },
    select: { id: true, is_promo: true, is_best_seller: true },
  });
  if (!existing) {
    throw new ResponseError(404, "BANNER_NOT_FOUND");
  }

  assertFlagsNotBoth(
    req.is_promo ?? existing.is_promo,
    req.is_best_seller ?? existing.is_best_seller,
  );

  let banner; // hanya ada kalau gambar diganti
  if (file) {
    const buffer = await processBanner(file); // gagal di sini = belum ada yang ter-upload
    banner = await storeBanner(req.id, buffer);
  }

  let outcome;
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        // Kunci flag dulu, baru kunci baris (urutan ini mencegah deadlock)
        if (hasFlags) await lockFlags(tx);

        // Kunci baris (khusus PostgreSQL). Edit bersamaan jadi antre, dan nilai
        // lama dibaca setelah kunci, jadi nggak ada file atau flag yang terlewat.
        const locked = await tx.$queryRaw`
          SELECT banner_url, is_promo, is_best_seller FROM "Banner" WHERE id = ${req.id} FOR NO KEY UPDATE
        `;

        if (locked.length === 0) {
          throw new ResponseError(404, "BANNER_NOT_FOUND");
        }

        const current = locked[0];

        // Keputusan akhir: hasil gabungan nilai baru dan nilai sekarang
        assertFlagsNotBoth(
          req.is_promo ?? current.is_promo,
          req.is_best_seller ?? current.is_best_seller,
        );

        const data = {};
        if (banner) data.banner_url = banner.url;
        if (req.is_promo !== undefined) data.is_promo = req.is_promo;
        if (req.is_best_seller !== undefined) {
          data.is_best_seller = req.is_best_seller;
        }

        await takeOverFlags(tx, req.id, {
          isPromo: req.is_promo,
          isBestSeller: req.is_best_seller,
        });

        const updated = await tx.banner.update({
          where: { id: req.id },
          data,
          select: BANNER_SELECT,
        });

        return { banner: updated, oldBannerUrl: current.banner_url };
      },
      { timeout: 15000 },
    );
  } catch (error) {
    // Gagal: file yang baru ter-upload nggak boleh tersisa
    if (banner) await removeFiles([banner.path]);

    // Pengaman terakhir: index database menolak flag ganda
    if (error.code === "P2002") {
      throw new ResponseError(409, "BANNER_FLAG_TAKEN");
    }

    throw error;
  }

  // --- Sudah commit. Jangan pindahkan ke dalam try di atas: error di sini
  // --- akan memicu penghapusan file baru yang sekarang sudah dipakai DB.
  if (banner) {
    const oldPath = getStoragePath(req.id, outcome.oldBannerUrl);
    if (oldPath) await removeFiles([oldPath]);
  }

  return outcome.banner;
};

const deleteBanner = async (request) => {
  const req = validate(deleteBannerValidation, { id: request.id });

  // Cek di awal: kalau config salah, jangan sampai banner terhapus
  // tapi filenya nggak bisa dibersihkan
  assertBucket();

  try {
    await prisma.banner.delete({ where: { id: req.id } });
  } catch (error) {
    if (error.code === "P2025") {
      throw new ResponseError(404, "BANNER_NOT_FOUND");
    }
    throw error;
  }

  // Sudah commit. Hapus semua isi folder, bukan cuma gambar yang tercatat.
  await removeBannerFolder(req.id);

  return { message: "BANNER_DELETED" };
};

export default {
  createBanner,
  getAllBanner,
  getBanner,
  updateBanner,
  deleteBanner,
};
