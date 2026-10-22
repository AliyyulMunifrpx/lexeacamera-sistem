import crypto from "node:crypto";
import supertest from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

// Test marketplace upload file betulan ke Supabase
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

export const BUCKET = process.env.SUPABASE_MARKETPLACE_BUCKET;

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
const gifFile = {
  buffer: GIF_BUFFER,
  filename: "logo.gif",
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
export const invalidLogoCases = [
  ["the logo is a gif", { logo: gifFile }, ["INVALID_IMAGE_FORMAT"]],
  [
    "the logo file is broken",
    { logo: brokenFile },
    ["INVALID_IMAGE_FORMAT", "INVALID_IMAGE"],
  ],
  ["the logo is larger than 5 MB", { logo: tooLargeFile }, ["IMAGE_TOO_LARGE"]],
  [
    "two logos are sent",
    { logo: logoFile, files: [{ field: "logo", file: logoFile }] },
    ["INVALID_IMAGE_FIELD"],
  ],
  [
    "the file uses the wrong field name",
    { files: [{ field: "images", file: logoFile }] },
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

export const logoFiles = (marketplaceId) =>
  listFolderNames(`marketplaces/${marketplaceId}`);
export const listMarketplaceFolders = () => listFolderNames("marketplaces");

export const fileName = (url) => url.split("/").pop();

const removeMarketplaceFiles = async (marketplaceId) => {
  const names = await logoFiles(marketplaceId);
  if (!names.length) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(names.map((name) => `marketplaces/${marketplaceId}/${name}`));

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

// Panggil sekali di dalam describe(). Mengurus beforeEach/afterEach dan
// mengembalikan ctx. Data yang berubah tiap test (tag, target, accessToken,
// category) dibaca lewat ctx.x di dalam test, jangan di-destructure.
export const setupMarketplaceTest = () => {
  const ctx = { createdIds: [] };

  // fields: field teks multipart. logo: file di field "logo".
  // files: file tambahan { field, file }. authorization: null = tanpa header.
  ctx.send = (
    method,
    path,
    {
      fields = {},
      logo,
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
      ...(logo ? [{ field: "logo", file: logo }] : []),
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

  ctx.validFields = () => ({ name: `mp_${ctx.tag}`, is_active: "true" });

  ctx.post = (fields = ctx.validFields(), options = { logo: logoFile }) =>
    ctx.send("post", "/marketplaces", { fields, ...options });
  ctx.patch = (id, fields = {}, options = {}) =>
    ctx.send("patch", `/marketplaces/${id}`, { fields, ...options });
  ctx.remove = (id = ctx.target.id, options = {}) =>
    ctx.send("delete", `/marketplaces/${id}`, options);

  // Marketplace lewat endpoint asli: logo benar-benar ada di bucket
  ctx.createViaApi = async (name, fields = {}) => {
    const result = await ctx.post({
      name: `${name}_${ctx.tag}`,
      is_active: "true",
      ...fields,
    });
    expect(result.status).toBe(201); // setup harus berhasil

    ctx.createdIds.push(result.body.data.id);
    return result.body.data;
  };

  // Marketplace lewat prisma: cepat, logo_url palsu
  ctx.createMarketplace = (name, overrides = {}) =>
    prisma.marketplace.create({
      data: {
        name: `${name}_${ctx.tag}`,
        logo_url: "https://example.com/logo.png",
        is_active: true,
        ...overrides,
      },
    });

  // Kamera lewat prisma (tanpa gambar), opsional dengan link marketplace
  ctx.createCamera = (marketplaces = [], overrides = {}) =>
    prisma.camera.create({
      data: {
        name: `Camera_${ctx.tag}`,
        price: 5500000,
        condition: "NEW",
        stock: 1,
        category_id: ctx.category.id,
        marketplaceLinks: {
          create: marketplaces.map((marketplace) => ({
            marketplace_id: marketplace.id,
            product_url: "https://www.tokopedia.com/toko/canon",
          })),
        },
        ...overrides,
      },
    });

  ctx.findMarketplace = (id) =>
    prisma.marketplace.findUnique({ where: { id } });
  ctx.taggedMarketplaces = () =>
    prisma.marketplace.findMany({
      where: { name: { contains: ctx.tag } },
      orderBy: { id: "asc" },
    });
  ctx.countLinks = (marketplaceId) =>
    prisma.cameraMarketplaceLink.count({
      where: { marketplace_id: marketplaceId },
    });
  ctx.expectUnchanged = async (marketplace) => {
    expect(await ctx.findMarketplace(marketplace.id)).toEqual(marketplace);
  };

  // User dan login: sekali per file, supaya nggak kena rate limit Supabase Auth
  beforeAll(async () => {
    const stamp = `${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    ctx.email = `marketplace_${stamp}@gmail.com`;
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
  beforeEach(async () => {
    ctx.tag = `t${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    ctx.createdIds = [];

    ctx.category = await prisma.category.create({
      data: { name: `cat_${ctx.tag}` },
    });
    ctx.target = await ctx.createMarketplace("mp_target");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!ctx.tag) return;

    // File di bucket: id yang dilacak digabung dengan yang ada di DB
    const rows = await prisma.marketplace.findMany({
      where: { name: { contains: ctx.tag } },
      select: { id: true },
    });
    const ids = new Set(
      [...ctx.createdIds, ...rows.map((row) => row.id)].filter(Boolean),
    );
    for (const id of ids) {
      await removeMarketplaceFiles(id);
    }

    // Kamera dulu (link ikut hilang lewat Cascade), baru kategori dan marketplace
    if (ctx.category?.id) {
      await prisma.camera
        .deleteMany({ where: { category_id: ctx.category.id } })
        .catch(() => {});
    }
    await prisma.category
      .deleteMany({ where: { name: { contains: ctx.tag } } })
      .catch(() => {});
    await prisma.marketplace
      .deleteMany({ where: { name: { contains: ctx.tag } } })
      .catch(() => {});
  });
  return ctx;
};
export const expectNoNewFolders = async (before) => {
  const after = await listMarketplaceFolders();
  expect(after.filter((name) => !before.includes(name))).toEqual([]);
};
