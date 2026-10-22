import crypto from "node:crypto";
import sharp from "sharp";
import supertest from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

// Test banner upload file betulan ke Supabase
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

export const BUCKET = process.env.SUPABASE_BANNER_BUCKET;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_PUBLIC_BANNERS = 50;

const SELECT = { id: true, banner_url: true, created_at: true };

// ---------- Fixture gambar ----------

const solid = (width, height) =>
  sharp({
    create: { width, height, channels: 3, background: "#336699" },
  });

const toFile = (buffer, filename, contentType) => ({
  buffer,
  filename,
  contentType,
});

const pngBuffer = await solid(800, 400).png().toBuffer();

// GIF 1x1 valid, tapi formatnya bukan webp/jpeg/png
const GIF_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);
const SVG_BUFFER = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
);

// 800 x 400: valid, dan lebih kecil dari 1600 (tidak boleh diperbesar)
export const bannerFile = toFile(pngBuffer, "banner.png", "image/png");
export const jpegFile = toFile(
  await solid(800, 400).jpeg().toBuffer(),
  "banner.jpg",
  "image/jpeg",
);
export const webpFile = toFile(
  await solid(800, 400).webp().toBuffer(),
  "banner.webp",
  "image/webp",
);
// 2400 x 1200 -> harus mengecil jadi 1600 x 800
export const largeFile = toFile(
  await solid(2400, 1200).png().toBuffer(),
  "large.png",
  "image/png",
);
// 1000 x 3000 -> harus mengecil jadi sekitar 533 x 1600
export const tallFile = toFile(
  await solid(1000, 3000).png().toBuffer(),
  "tall.png",
  "image/png",
);

const gifFile = toFile(GIF_BUFFER, "banner.gif", "image/gif");
// Content-type bilang PNG, isinya GIF / SVG / teks
const gifAsPngFile = toFile(GIF_BUFFER, "banner.png", "image/png");
const svgAsPngFile = toFile(SVG_BUFFER, "banner.png", "image/png");
const brokenFile = toFile(
  Buffer.from("ini bukan gambar"),
  "rusak.png",
  "image/png",
);
const truncatedFile = toFile(
  pngBuffer.subarray(0, Math.floor(pngBuffer.length / 2)),
  "terpotong.png",
  "image/png",
);
// 4500 x 4500 = 20,25 juta piksel, di atas limitInputPixels (20 juta)
const pixelBombFile = toFile(
  await solid(4500, 4500).png().toBuffer(),
  "bom.png",
  "image/png",
);
const tooLargeFile = toFile(
  Buffer.alloc(MAX_FILE_SIZE + 1),
  "besar.png",
  "image/png",
);

// [label, opsi send(), kemungkinan pesan error]
export const invalidBannerCases = [
  ["the banner is a gif", { banner: gifFile }, ["INVALID_IMAGE_FORMAT"]],
  [
    "the banner is a gif disguised as png",
    { banner: gifAsPngFile },
    ["INVALID_IMAGE_FORMAT"],
  ],
  [
    "the banner is an svg disguised as png",
    { banner: svgAsPngFile },
    ["INVALID_IMAGE_FORMAT"],
  ],
  [
    "the banner file is broken",
    { banner: brokenFile },
    ["INVALID_IMAGE_FORMAT", "INVALID_IMAGE"],
  ],
  [
    "the banner file is truncated",
    { banner: truncatedFile },
    ["INVALID_IMAGE"],
  ],
  [
    "the banner exceeds the pixel limit",
    { banner: pixelBombFile },
    ["INVALID_IMAGE"],
  ],
  [
    "the banner is larger than 5 MB",
    { banner: tooLargeFile },
    ["IMAGE_TOO_LARGE"],
  ],
  [
    "two banners are sent",
    { banner: bannerFile, files: [{ field: "banner", file: bannerFile }] },
    ["INVALID_IMAGE_FIELD"],
  ],
  [
    "the file uses the wrong field name",
    { files: [{ field: "logo", file: bannerFile }] },
    ["INVALID_IMAGE_FIELD"],
  ],
];

export const invalidIds = [
  "abc",
  "123",
  "a".repeat(300),
  `${crypto.randomUUID()}x`,
];

// [label, bikin header Authorization dari access token yang valid]
export const unauthorizedCases = [
  ["authorization header is missing", () => null],
  ["access token is invalid", () => "Bearer salah_access_token"],
  ["auth scheme is wrong", (token) => `token salah ${token}`],
];

// ---------- Storage ----------

const listFolderNames = async (folder) => {
  const { data } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 1000 });
  return (data ?? []).map((item) => item.name).sort();
};

export const bannerFiles = (bannerId) => listFolderNames(`banners/${bannerId}`);
export const listBannerFolders = () => listFolderNames("banners");

export const fileName = (url) => url.split("/").pop();

const removeBannerFiles = async (bannerId) => {
  const names = await bannerFiles(bannerId);
  if (!names.length) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(names.map((name) => `banners/${bannerId}/${name}`));

  if (error) console.error("Cleanup remove gagal:", error);
};

export const downloadBanner = async (bannerId, name) => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`banners/${bannerId}/${name}`);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
};

// Metadata file yang benar-benar tersimpan di bucket (format, lebar, tinggi)
export const storedMetadata = async ({ id, banner_url }) =>
  sharp(await downloadBanner(id, fileName(banner_url))).metadata();

// File nyasar di folder banner, untuk menguji bahwa delete membersihkan semuanya
export const addStrayFile = async (bannerId, name = "stray.webp") => {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`banners/${bannerId}/${name}`, bannerFile.buffer, {
      contentType: "image/webp",
    });
  if (error) throw error;
  return name;
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

// Panggil sekali di dalam describe(). Mengurus beforeEach/afterEach dan
// mengembalikan ctx. Data yang berubah tiap test (tag, accessToken) dibaca
// lewat ctx.x di dalam test, jangan di-destructure.
export const setupBannerTest = () => {
  const ctx = { createdIds: [] };

  // fields: field teks multipart. banner: file di field "banner".
  // files: file tambahan { field, file }. authorization: null = tanpa header.
  ctx.send = (
    method,
    path,
    {
      fields = {},
      banner,
      files = [],
      query,
      authorization = `Bearer ${ctx.accessToken}`,
    } = {},
  ) => {
    let request = supertest(web)[method](path);
    if (authorization) request = request.set("Authorization", authorization);
    if (query) request = request.query(query);

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) request = request.field(key, value);
    }

    const attachments = [
      ...(banner ? [{ field: "banner", file: banner }] : []),
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

  // post({}, {}) = tanpa file
  ctx.post = (fields = {}, options = { banner: bannerFile }) =>
    ctx.send("post", "/banners", { fields, ...options });
  ctx.patch = (id, fields = {}, options = { banner: bannerFile }) =>
    ctx.send("patch", `/banners/${id}`, { fields, ...options });
  ctx.get = (id, options = {}) => ctx.send("get", `/banners/${id}`, options);
  ctx.remove = (id, options = {}) =>
    ctx.send("delete", `/banners/${id}`, options);
  // Route publik: default tanpa Authorization.
  // Pakai { authorization: undefined } kalau mau kirim token valid.
  ctx.getAll = (options = {}) =>
    ctx.send("get", "/banners", { authorization: null, ...options });

  // Banner lewat endpoint asli: gambar benar-benar ada di bucket
  ctx.createBanner = async (fields = {}, options) => {
    const result = await ctx.post(fields, options);
    expect(result.status).toBe(201); // setup harus berhasil

    ctx.createdIds.push(result.body.data.id);
    return result.body.data;
  };

  // Banner lewat prisma: cepat, tanpa file. Tanggal di tahun 2999 supaya
  // selalu paling atas di daftar terbaru dan tidak bercampur dengan data asli.
  ctx.seedBanner = async ({ day = 1, url } = {}) => {
    const id = crypto.randomUUID();
    ctx.createdIds.push(id);

    const row = await prisma.banner.create({
      data: {
        id,
        banner_url: url ?? `https://example.com/seed/${ctx.tag}/${id}.webp`,
        created_at: new Date(Date.UTC(2999, 0, day)),
      },
      select: SELECT,
    });
    return JSON.parse(JSON.stringify(row));
  };

  // Urut naik berdasarkan hari (index terakhir = paling baru)
  ctx.seedMany = async (count) => {
    const rows = Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(),
      banner_url: `https://example.com/seed/${ctx.tag}/${index}.webp`,
      created_at: new Date(Date.UTC(2999, 0, index + 1)),
    }));
    ctx.createdIds.push(...rows.map((row) => row.id));

    await prisma.banner.createMany({ data: rows });
    return rows;
  };

  // Bentuknya sama dengan respons API (created_at jadi string ISO)
  ctx.findBanner = async (id) => {
    const row = await prisma.banner.findUnique({
      where: { id },
      select: SELECT,
    });
    return row && JSON.parse(JSON.stringify(row));
  };
  ctx.countBanners = () => prisma.banner.count();
  ctx.expectUnchanged = async (banner) => {
    expect(await ctx.findBanner(banner.id)).toEqual(banner);
  };

  // User dan login: sekali per file, supaya nggak kena rate limit Supabase Auth
  beforeAll(async () => {
    const stamp = `${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    ctx.email = `banner_${stamp}@gmail.com`;
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
    // Gagal dengan pesan yang jelas, bukan TypeError yang membingungkan
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

  // Data per test
  beforeEach(() => {
    ctx.tag = `t${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    ctx.createdIds = [];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!ctx.tag) return;

    // File di bucket: id yang dilacak digabung dengan seed yang url-nya bertag
    const rows = await prisma.banner.findMany({
      where: { banner_url: { contains: ctx.tag } },
      select: { id: true },
    });
    const ids = new Set(
      [...ctx.createdIds, ...rows.map((row) => row.id)].filter(Boolean),
    );
    for (const id of ids) {
      await removeBannerFiles(id);
    }

    await prisma.banner
      .deleteMany({ where: { id: { in: [...ids] } } })
      .catch(() => {});
  });

  return ctx;
};

export const expectNoNewFolders = async (before) => {
  const after = await listBannerFolders();
  expect(after.filter((name) => !before.includes(name))).toEqual([]);
};
