import crypto from "node:crypto";
import supertest from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

// WAV-20261021-K7M2QX. Karakter I, O, 0, 1 tidak dipakai
export const INVOICE_NUMBER_PATTERN = /^WAV-\d{8}-[A-HJ-NP-Z2-9]{6}$/;

export const INVOICE_KEYS = [
  "id",
  "no_invoice",
  "store_name",
  "store_address",
  "whatsapp_store",
  "instagram_store",
  "created_at",
  "payment_method",
  "ship",
  "customer_name",
  "customer_address",
  "customer_whatsapp",
  "customer_instagram",
  "total_amount",
  "order_id",
  "store_discount",
  "customer_discount",
  "is_final",
  "subtotal",
  "items",
];

export const ITEM_KEYS = [
  "id",
  "camera_id",
  "camera_name",
  "camera_price",
  "quantity",
  "line_total",
];

// [label, bikin header Authorization dari access token yang valid]
export const unauthorizedCases = [
  ["authorization header is missing", () => null],
  ["access token is invalid", () => "Bearer salah_access_token"],
  ["auth scheme is wrong", (token) => `token salah ${token}`],
];

// Tanggal hari ini di WIB sebagai YYYYMMDD
export const wibDate = (date = new Date()) =>
  new Date(date.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

// Panggil sekali di dalam describe(). Data yang berubah tiap test (tag, token,
// kamera) dibaca lewat ctx.x di dalam test, jangan di-destructure.
export const setupOrderTest = () => {
  const ctx = {};

  // authorization: null = tanpa header
  ctx.send = (
    method,
    path,
    { body, query, authorization = `Bearer ${ctx.accessToken}` } = {},
  ) => {
    let request = supertest(web)[method](path);
    if (authorization) request = request.set("Authorization", authorization);
    if (query) request = request.query(query);
    return body === undefined ? request : request.send(body);
  };

  // Endpoint publik: tanpa token
  ctx.sendPublic = (body) => supertest(web).post("/orders").send(body);

  // Semua nama pelanggan WAJIB lewat sini: tag-nya dipakai untuk pembersihan
  ctx.name = (label) => `test_${ctx.tag}_${label}`;

  ctx.validOrder = (overrides = {}) => ({
    customer_name: ctx.name("budi"),
    address: "Jl. Contoh No. 1, Jakarta",
    whatsapp: "081234567890",
    instagram: "@budi",
    items: [{ camera_id: ctx.cameraA.id, quantity: 2 }],
    ...overrides,
  });

  ctx.validInvoice = (overrides = {}) => ({
    customer_name: ctx.name("budi"),
    customer_address: "Jl. Contoh No. 1, Jakarta",
    customer_whatsapp: "081234567890",
    customer_instagram: "@budi",
    items: [{ camera_id: ctx.cameraA.id, quantity: 2 }],
    ...overrides,
  });

  ctx.createCamera = (label, price, overrides = {}) =>
    prisma.camera.create({
      data: {
        name: `${label} ${ctx.tag}`,
        price,
        condition: "NEW",
        stock: 5,
        category_id: ctx.category.id,
        ...overrides,
      },
    });

  // Order publik lewat endpoint asli. Mengembalikan respons publik dan baris invoice-nya
  ctx.orderViaApi = async (overrides = {}) => {
    const result = await ctx.sendPublic(ctx.validOrder(overrides));
    expect(result.status).toBe(201); // setup harus berhasil

    const invoice = await prisma.invoice.findUnique({
      where: { no_invoice: result.body.data.no_invoice },
    });
    return { response: result.body.data, invoice };
  };

  // Invoice admin lewat endpoint asli. Mengembalikan respons lengkapnya
  ctx.invoiceViaApi = async (overrides = {}) => {
    const result = await ctx.send("post", "/invoices", {
      body: ctx.validInvoice(overrides),
    });
    expect(result.status).toBe(201); // setup harus berhasil

    return result.body.data;
  };

  // Invoice lewat prisma dengan waktu dan nama kamera yang bisa diatur (untuk filter dan search)
  ctx.seedInvoice = ({
    customer = "budi",
    cameraNames = [`Canon EOS 1500D ${ctx.tag}`],
    createdAt = new Date(),
    isFinal = false,
    noInvoice = `WAV-SEED-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
  } = {}) => {
    const total = String(1000000 * cameraNames.length);

    return prisma.invoice.create({
      data: {
        no_invoice: noInvoice,
        store_name: ctx.store.name,
        customer_name: ctx.name(customer),
        customer_address: "Jl. Contoh",
        customer_whatsapp: "081234567890",
        total_amount: total,
        is_final: isFinal,
        created_at: createdAt,
        order: {
          create: {
            customer_name: ctx.name(customer),
            address: "Jl. Contoh",
            whatsapp: "081234567890",
            total_amount: total,
            created_at: createdAt,
            order_items: {
              create: cameraNames.map((name) => ({
                camera_id: ctx.cameraA.id,
                camera_name: name,
                camera_price: "1000000",
                quantity: 1,
              })),
            },
          },
        },
      },
    });
  };

  ctx.findInvoice = (id) => prisma.invoice.findUnique({ where: { id } });
  ctx.countOrders = () =>
    prisma.order.count({ where: { customer_name: { contains: ctx.tag } } });
  ctx.countInvoices = () =>
    prisma.invoice.count({ where: { customer_name: { contains: ctx.tag } } });
  ctx.expectNothingCreated = async () => {
    expect(await ctx.countOrders()).toBe(0);
    expect(await ctx.countInvoices()).toBe(0);
  };

  // User dan login: sekali per file, supaya nggak kena rate limit Supabase Auth
  beforeAll(async () => {
    const stamp = `${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    ctx.email = `order_${stamp}@gmail.com`;
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

    // Order butuh toko. Pakai toko yang ada (nggak pernah diubah atau dihapus).
    // Kalau belum ada, bikin toko sementara dan hapus di afterAll.
    ctx.store = await prisma.store.findFirst({ orderBy: { id: "asc" } });
    ctx.createdStore = false;

    if (!ctx.store) {
      ctx.store = await prisma.store.create({
        data: {
          name: `test_store_order_${stamp}`,
          logo_url: "https://example.com/logo.png",
          terms_and_condition: "Syarat dan ketentuan toko",
          address: "Jl. Toko No. 1, Jakarta",
          whatsapp: "6281234567890",
          instagram: "@tokotest",
        },
      });
      ctx.createdStore = true;
    }
  });

  afterAll(async () => {
    if (ctx.createdStore) {
      await prisma.store
        .delete({ where: { id: ctx.store.id } })
        .catch(() => {});
    }
    await prisma.user.delete({ where: { email: ctx.email } }).catch(() => {});
    if (ctx.supabaseId) {
      await supabase.auth.admin.deleteUser(ctx.supabaseId).catch(() => {});
    }
  });

  beforeEach(async () => {
    ctx.tag = `t${Date.now()}${crypto.randomBytes(3).toString("hex")}`;

    ctx.category = await prisma.category.create({
      data: { name: `cat_${ctx.tag}` },
    });
    ctx.cameraA = await ctx.createCamera("Canon EOS 1500D", 5500000, {
      stock: 5,
    });
    ctx.cameraB = await ctx.createCamera("Nikon D3500", 7000000, { stock: 3 });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!ctx.tag) return;

    // Order dulu (invoice dan item ikut lewat Cascade), baru kamera dan kategori.
    // customer_name di Order nggak pernah berubah, jadi tag selalu ketemu
    await prisma.order
      .deleteMany({ where: { customer_name: { contains: ctx.tag } } })
      .catch(() => {});
    await prisma.camera
      .deleteMany({ where: { category_id: ctx.category.id } })
      .catch(() => {});
    await prisma.category
      .deleteMany({ where: { id: ctx.category.id } })
      .catch(() => {});
  });

  return ctx;
};
