import crypto from "node:crypto";
import supertest from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

// Test store upload file betulan ke Supabase
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

export const BUCKET = process.env.SUPABASE_STORE_BUCKET;

// Semua toko milik test berawalan ini. Hanya yang berawalan ini yang boleh dihapus
export const NAME_PREFIX = "test_store_";

// PNG 1x1 valid, biar lolos processImage tanpa perlu file fixture
export const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
// GIF 1x1 valid, tapi formatnya bukan webp/jpeg/png
const GIF_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export const logoFile = {
  buffer: PNG_BUFFER,
  filename: "logo.png",
  contentType: "image/png",
};
export const bannerFile = {
  buffer: PNG_BUFFER,
  filename: "banner.png",
  contentType: "image/png",
};
const gifFile = {
  buffer: GIF_BUFFER,
  filename: "gambar.gif",
  contentType: "image/gif",
};
// Content-type bilang PNG, isinya bukan gambar
const brokenFile = {
  buffer: Buffer.from("ini bukan gambar"),
  filename: "rusak.png",
  contentType: "image/png",
};
const tooLargeFile = {
  buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  filename: "besar.png",
  contentType: "image/png",
};

// [label, opsi send(), kemungkinan pesan error]
export const invalidImageCases = [
  ["the logo is a gif", { logo: gifFile }, ["INVALID_IMAGE_FORMAT"]],
  [
    "the logo file is broken",
    { logo: brokenFile },
    ["INVALID_IMAGE_FORMAT", "INVALID_IMAGE"],
  ],
  ["the logo is larger than 5 MB", { logo: tooLargeFile }, ["IMAGE_TOO_LARGE"]],
  [
    "the banner is a gif",
    { logo: logoFile, banner: gifFile },
    ["INVALID_IMAGE_FORMAT"],
  ],
  [
    "the banner file is broken",
    { logo: logoFile, banner: brokenFile },
    ["INVALID_IMAGE_FORMAT", "INVALID_IMAGE"],
  ],
  [
    "the banner is larger than 5 MB",
    { logo: logoFile, banner: tooLargeFile },
    ["IMAGE_TOO_LARGE"],
  ],
  [
    "two logos are sent",
    { logo: logoFile, files: [{ field: "logo", file: logoFile }] },
    ["INVALID_IMAGE_FIELD"],
  ],
  [
    "two banners are sent",
    {
      logo: logoFile,
      banner: bannerFile,
      files: [{ field: "main_banner", file: bannerFile }],
    },
    ["INVALID_IMAGE_FIELD"],
  ],
  [
    "the file uses the wrong field name",
    { logo: logoFile, files: [{ field: "images", file: logoFile }] },
    ["INVALID_IMAGE_FIELD"],
  ],
];

// [label, bikin header Authorization dari access token yang valid]
export const unauthorizedCases = [
  ["authorization header is missing", () => null],
  ["access token is invalid", () => "Bearer salah_access_token"],
  ["auth scheme is wrong", (token) => `token salah ${token}`],
];

const listFolderNames = async (folder) => {
  const { data } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 1000 });
  return (data ?? []).map((item) => item.name).sort();
};

export const storeFiles = (storeId) => listFolderNames(`store/${storeId}`);
export const listStoreFolders = () => listFolderNames("store");

export const fileName = (url) => url.split("/").pop();

// Folder yang sudah ada boleh hilang (dibersihkan test lain), tapi nggak boleh ada yang baru
export const expectNoNewFolders = async (before) => {
  const after = await listStoreFolders();
  expect(after.filter((name) => !before.includes(name))).toEqual([]);
};

const removeStoreFiles = async (storeId) => {
  const names = await storeFiles(storeId);
  if (!names.length) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(names.map((name) => `store/${storeId}/${name}`));

  if (error) console.error("Cleanup remove gagal:", error);
};

// Storage "mati": list dan remove gagal, upload dan getPublicUrl tetap asli
export const mockStorageDown = () => {
  const realStorage = supabase.storage;

  vi.spyOn(supabase, "storage", "get").mockReturnValue({
    from: (bucket) => {
      const real = realStorage.from(bucket);
      return {
        upload: (...args) => real.upload(...args),
        getPublicUrl: (...args) => real.getPublicUrl(...args),
        list: async () => ({ data: null, error: new Error("storage down") }),
        remove: async () => ({ data: null, error: new Error("storage down") }),
      };
    },
  });
};

// Hapus toko milik test (berawalan NAME_PREFIX atau id yang dilacak) beserta file-nya
const cleanTestStores = async (trackedIds = []) => {
  const where = {
    OR: [{ name: { startsWith: NAME_PREFIX } }, { id: { in: trackedIds } }],
  };

  const rows = await prisma.store.findMany({ where, select: { id: true } });
  for (const id of new Set([...trackedIds, ...rows.map((row) => row.id)])) {
    await removeStoreFiles(id);
  }

  await prisma.store.deleteMany({ where });
};

// Panggil sekali di dalam describe(). Data yang berubah tiap test (tag,
// accessToken) dibaca lewat ctx.x di dalam test, jangan di-destructure.
export const setupStoreTest = () => {
  const ctx = { createdIds: [] };

  // fields: field teks multipart. logo / banner: file di field "logo" / "main_banner".
  // files: file tambahan { field, file }. authorization: null = tanpa header.
  ctx.send = (
    method,
    path,
    {
      fields = {},
      logo,
      banner,
      files = [],
      authorization = `Bearer ${ctx.accessToken}`,
    } = {},
  ) => {
    let request = supertest(web)[method](path);
    if (authorization) request = request.set("Authorization", authorization);

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) request = request.field(key, value);
    }

    const attachments = [
      ...(logo ? [{ field: "logo", file: logo }] : []),
      ...(banner ? [{ field: "main_banner", file: banner }] : []),
      ...files,
    ];
    for (const { field, file } of attachments) {
      request = request.attach(field, file.buffer, {
        filename: file.filename,
        contentType: file.contentType,
      });
    }

    return request;
  };

  ctx.validFields = () => ({
    name: `${NAME_PREFIX}${ctx.tag}`,
    terms_and_condition: "Syarat dan ketentuan toko",
    instagram: "@toko_kamera",
    whatsapp: "6281234567890",
    tiktok: "@toko_kamera",
    facebook: "Toko Kamera",
    address: "Jl. Contoh No. 1, Jakarta",
  });

  ctx.post = (fields = ctx.validFields(), options = { logo: logoFile }) =>
    ctx.send("post", "/store", { fields, ...options });
  ctx.patch = (fields = {}, options = {}) =>
    ctx.send("patch", "/store", { fields, ...options });
  ctx.get = (options = {}) => ctx.send("get", "/store", options);

  // Toko lewat endpoint asli: logo (dan banner) benar-benar ada di bucket
  ctx.createViaApi = async ({ fields = {}, banner = true } = {}) => {
    const result = await ctx.post(
      { ...ctx.validFields(), ...fields },
      { logo: logoFile, ...(banner ? { banner: bannerFile } : {}) },
    );
    expect(result.status).toBe(201); // setup harus berhasil

    ctx.createdIds.push(result.body.data.id);
    return result.body.data;
  };

  // Toko lewat prisma: cepat, logo_url palsu (bukan dari bucket)
  ctx.createViaPrisma = async (overrides = {}) => {
    const store = await prisma.store.create({
      data: {
        name: `${NAME_PREFIX}${ctx.tag}`,
        logo_url: "https://example.com/logo.png",
        terms_and_condition: "Syarat dan ketentuan toko",
        ...overrides,
      },
    });

    ctx.createdIds.push(store.id);
    return store;
  };

  ctx.findStore = (id) => prisma.store.findUnique({ where: { id } });
  ctx.countStores = () => prisma.store.count();
  ctx.expectUnchanged = async (store) => {
    expect(await ctx.findStore(store.id)).toEqual(store);
  };

  // User dan login: sekali per file, supaya nggak kena rate limit Supabase Auth
  beforeAll(async () => {
    const stamp = `${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    ctx.email = `store_${stamp}@gmail.com`;
    ctx.password = "alymnfpassword";

    const createUser = await supabase.auth.admin.createUser({
      email: ctx.email,
      password: ctx.password,
      email_confirm: true,
    });
    if (createUser.error) {
      throw new Error(`Gagal membuat user test: ${createUser.error.message}`);
    }
    ctx.supabaseId = createUser.data.user.id;

    const loginResponse = await supertest(web).post("/users/login").send({
      email: ctx.email,
      password: ctx.password,
    });
    if (loginResponse.status !== 200) {
      throw new Error(
        `Login test gagal (${loginResponse.status}): ${JSON.stringify(loginResponse.body)}`,
      );
    }
    ctx.accessToken = loginResponse.body.data.access_token;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { email: ctx.email } }).catch(() => {});
    if (ctx.supabaseId) {
      await supabase.auth.admin.deleteUser(ctx.supabaseId).catch(() => {});
    }
  });

  beforeEach(async () => {
    ctx.tag = `t${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    ctx.createdIds = [];

    // Pengaman: Store itu singleton, jadi test butuh tabel yang bersih.
    // Jangan pernah menghapus toko asli.
    const realStores = await prisma.store.count({
      where: { NOT: { name: { startsWith: NAME_PREFIX } } },
    });
    if (realStores > 0) {
      throw new Error(
        "Tabel Store berisi data bukan milik test. Jalankan test di database test, bukan di database yang berisi toko asli.",
      );
    }

    // Sisa run yang gagal
    await cleanTestStores();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!ctx.tag) return;

    await cleanTestStores(ctx.createdIds);
  });

  return ctx;
};
