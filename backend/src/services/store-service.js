import crypto from "node:crypto";

import { supabase } from "../application/supabase.js";
import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
import { processImage } from "../utils/process-image.js";
import {
  createStoreValidation,
  updateStoreValidation,
} from "../validation/store-validation.js";
import { validate } from "../validation/validation.js";

const BUCKET = process.env.SUPABASE_STORE_BUCKET;

const STORE_SELECT = {
  id: true,
  logo_url: true,
  name: true,
  instagram: true,
  whatsapp: true,
  tiktok: true,
  facebook: true,
  map_url: true,
  address: true,
  main_banner_url: true,
  terms_and_condition: true,
};

const IMAGE_OPTIONS = {
  logo: { width: 512, height: 512, quality: 82, fit: "inside" },
  banner: { width: 3000, height: 1000, quality: 82, fit: "inside" },
};

const OPTIONAL_TEXT_FIELDS = [
  "instagram",
  "whatsapp",
  "tiktok",
  "facebook",
  "map_url",
  "address",
];

const emptyToNull = (value) => (value === "" ? null : value);

const processStoreImage = async (file, kind) => {
  try {
    return await processImage(file.buffer, IMAGE_OPTIONS[kind]);
  } catch (error) {
    if (error.statusCode === 400) {
      throw new ResponseError(400, "INVALID_IMAGE_FORMAT");
    }
    throw new ResponseError(400, "INVALID_IMAGE");
  }
};

// Semua gambar diproses di memory dulu: gagal di sini = belum ada yang ter-upload
const processImages = async ({ logoFile, bannerFile }) => ({
  logo: logoFile ? await processStoreImage(logoFile, "logo") : undefined,
  banner: bannerFile
    ? await processStoreImage(bannerFile, "banner")
    : undefined,
});

// Nggak pernah melempar error: dipakai setelah DB berubah atau di jalur rollback,
// jadi kegagalan di sini cuma di-log.
const removeFiles = async (paths) => {
  if (!paths.length) return;

  try {
    const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw error;

    // remove() yang ditolak policy tidak error, hanya mengembalikan array kosong
    if ((data?.length ?? 0) !== paths.length) {
      console.error("Store images not fully removed:", {
        paths,
        removed: data?.length ?? 0,
      });
    }
  } catch (error) {
    console.error("Failed to remove store images:", { paths, error });
  }
};

const uploadStoreImage = async (storeId, kind, buffer) => {
  const path = `store/${storeId}/${kind}-${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error("Store image upload failed:", error);
    throw new ResponseError(500, "STORE_IMAGE_UPLOAD_FAILED");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
};

// Kalau salah satu gagal, yang sudah ter-upload dihapus lagi
const uploadImages = async (storeId, buffers) => {
  const result = { paths: [] };

  try {
    for (const kind of ["logo", "banner"]) {
      if (!buffers[kind]) continue;

      const file = await uploadStoreImage(storeId, kind, buffers[kind]);
      result[kind] = file;
      result.paths.push(file.path);
    }
  } catch (error) {
    await removeFiles(result.paths);
    throw error;
  }

  return result;
};

// Public URL jadi path di bucket. Hanya path di folder store ini yang
// dikembalikan, jadi URL aneh di DB nggak bisa dipakai menghapus file lain.
// URL yang bukan dari bucket kita (misalnya data lama) dilewati.
const getStoragePath = (storeId, url) => {
  if (!url) return null;

  const marker = `/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;

  let path;
  try {
    path = decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  } catch {
    return null;
  }

  return path.startsWith(`store/${storeId}/`) && !path.includes("..")
    ? path
    : null;
};

const createStore = async (request) => {
  const { body = {}, files = {} } = request;
  const logoFile = files.logo?.[0];
  const bannerFile = files.main_banner?.[0];

  if (!BUCKET) {
    throw new ResponseError(500, "STORE_BUCKET_NOT_CONFIGURED");
  }

  if (!logoFile) {
    throw new ResponseError(400, "LOGO_REQUIRED");
  }

  const req = validate(createStoreValidation, { ...body });

  // Cek di awal supaya request yang pasti gagal nggak sempat upload
  const existing = await prisma.store.findFirst({ select: { id: true } });
  if (existing) {
    throw new ResponseError(409, "STORE_ALREADY_EXIST");
  }

  const buffers = await processImages({ logoFile, bannerFile });

  const id = crypto.randomUUID();
  const uploaded = await uploadImages(id, buffers);

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Satu toko saja (khusus PostgreSQL): create bersamaan jadi antre
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('store'))`;

        if ((await tx.store.count()) > 0) {
          throw new ResponseError(409, "STORE_ALREADY_EXIST");
        }

        return await tx.store.create({
          data: {
            id,
            name: req.name,
            terms_and_condition: req.terms_and_condition,
            logo_url: uploaded.logo.url,
            main_banner_url: uploaded.banner?.url,
            instagram: emptyToNull(req.instagram),
            whatsapp: emptyToNull(req.whatsapp),
            tiktok: emptyToNull(req.tiktok),
            facebook: emptyToNull(req.facebook),
            map_url: emptyToNull(req.map_url),
            address: emptyToNull(req.address),
          },
          select: STORE_SELECT,
        });
      },
      { timeout: 15000 },
    );
  } catch (error) {
    // Gagal (termasuk kalah race): file yang baru ter-upload nggak boleh tersisa
    await removeFiles(uploaded.paths);
    throw error;
  }
};

const getStore = async () => {
  const store = await prisma.store.findFirst({
    select: STORE_SELECT,
    orderBy: { id: "asc" },
  });

  if (!store) {
    throw new ResponseError(404, "STORE_NOT_FOUND");
  }

  return store;
};

const updateStore = async (request) => {
  const { body = {}, files = {} } = request;
  const logoFile = files.logo?.[0];
  const bannerFile = files.main_banner?.[0];

  if (!BUCKET) {
    throw new ResponseError(500, "STORE_BUCKET_NOT_CONFIGURED");
  }

  const req = validate(updateStoreValidation, { ...body });
  const removeBanner = req.remove_main_banner === true;

  if (removeBanner && bannerFile) {
    throw new ResponseError(400, "BANNER_CONFLICT");
  }

  // Minimal satu hal berubah. remove_main_banner=false bukan perubahan
  const hasTextChange = [
    "name",
    "terms_and_condition",
    ...OPTIONAL_TEXT_FIELDS,
  ].some((field) => req[field] !== undefined);

  if (!hasTextChange && !logoFile && !bannerFile && !removeBanner) {
    throw new ResponseError(400, "NOTHING_TO_UPDATE");
  }

  // Cek awal supaya request yang pasti gagal nggak sempat upload
  const store = await prisma.store.findFirst({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!store) {
    throw new ResponseError(404, "STORE_NOT_FOUND");
  }

  // Hanya field yang dikirim
  const data = {};
  if (req.name !== undefined) data.name = req.name;
  if (req.terms_and_condition !== undefined) {
    data.terms_and_condition = req.terms_and_condition;
  }
  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (req[field] !== undefined) data[field] = emptyToNull(req[field]);
  }
  if (removeBanner) data.main_banner_url = null;

  const buffers = await processImages({ logoFile, bannerFile });
  const uploaded = await uploadImages(store.id, buffers);

  if (uploaded.logo) data.logo_url = uploaded.logo.url;
  if (uploaded.banner) data.main_banner_url = uploaded.banner.url;

  let outcome;
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        // Kunci baris (khusus PostgreSQL). Edit bersamaan jadi antre, dan URL
        // lama dibaca setelah kunci, jadi nggak ada file yang terlewat.
        const locked = await tx.$queryRaw`
          SELECT logo_url, main_banner_url FROM "Store" WHERE id = ${store.id} FOR NO KEY UPDATE
        `;

        if (locked.length === 0) {
          throw new ResponseError(404, "STORE_NOT_FOUND");
        }

        const updated = await tx.store.update({
          where: { id: store.id },
          data,
          select: STORE_SELECT,
        });

        return { store: updated, old: locked[0] };
      },
      { timeout: 15000 },
    );
  } catch (error) {
    // Gagal: file yang baru ter-upload nggak boleh tersisa
    await removeFiles(uploaded.paths);
    throw error;
  }

  // --- Sudah commit. Jangan pindahkan ke dalam try di atas: error di sini
  // --- akan memicu penghapusan file baru yang sekarang sudah dipakai DB.
  const stalePaths = [];
  if (uploaded.logo) {
    stalePaths.push(getStoragePath(store.id, outcome.old.logo_url));
  }
  if (uploaded.banner || removeBanner) {
    stalePaths.push(getStoragePath(store.id, outcome.old.main_banner_url));
  }
  await removeFiles(stalePaths.filter(Boolean));

  return outcome.store;
};

export default {
  createStore,
  getStore,
  updateStore,
};
