import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  INVOICE_KEYS,
  INVOICE_NUMBER_PATTERN,
  ITEM_KEYS,
  setupOrderTest,
  unauthorizedCases,
  wibDate,
} from "./helper.js";

describe("post /invoices", () => {
  const ctx = setupOrderTest();
  const { send, validInvoice } = ctx;

  const post = (body = validInvoice(), options = {}) =>
    send("post", "/invoices", { body, ...options });

  // ---------- Sukses ----------

  test("should create a complete invoice with discounts", async () => {
    const result = await post(
      validInvoice({
        payment_method: "Transfer BCA",
        ship: "JNE",
        store_discount: "100000",
        customer_discount: 50000, // angka juga boleh, disimpan sebagai string
      }),
    );

    expect(result.status).toBe(201);

    const data = result.body.data;
    expect(data.no_invoice).toMatch(INVOICE_NUMBER_PATTERN);
    expect(data.no_invoice.startsWith(`WAV-${wibDate()}-`)).toBe(true);
    expect(data).toMatchObject({
      store_name: ctx.store.name,
      store_address: ctx.store.address,
      whatsapp_store: ctx.store.whatsapp,
      instagram_store: ctx.store.instagram,
      payment_method: "Transfer BCA",
      ship: "JNE",
      customer_name: ctx.name("budi"),
      customer_address: "Jl. Contoh No. 1, Jakarta",
      customer_whatsapp: "081234567890",
      customer_instagram: "@budi",
      subtotal: "11000000",
      store_discount: "100000",
      customer_discount: "50000",
      total_amount: "10850000", // 11jt - 100rb - 50rb
      is_final: false,
    });
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      camera_id: ctx.cameraA.id,
      camera_name: ctx.cameraA.name,
      camera_price: "5500000",
      quantity: 2,
      line_total: "11000000",
    });
  });

  test("should return the invoice fields, subtotal and items", async () => {
    const result = await post();

    expect(Object.keys(result.body.data).sort()).toEqual(
      [...INVOICE_KEYS].sort(),
    );
    expect(Object.keys(result.body.data.items[0]).sort()).toEqual(
      [...ITEM_KEYS].sort(),
    );
  });

  test("should create the order, the items and the invoice in the database", async () => {
    const result = await post(
      validInvoice({
        items: [
          { camera_id: ctx.cameraA.id, quantity: 1 },
          { camera_id: ctx.cameraB.id, quantity: 2 },
        ],
        store_discount: "500000",
      }),
    );

    expect(result.status).toBe(201);

    const order = await prisma.order.findUnique({
      where: { id: result.body.data.order_id },
      include: { order_items: true, invoice: true },
    });

    expect(order.customer_name).toBe(ctx.name("budi"));
    expect(order.total_amount).toBe("19500000"); // order menyimpan subtotal, tanpa diskon
    expect(order.invoice.id).toBe(result.body.data.id);
    expect(order.invoice.total_amount).toBe("19000000");
    expect(order.order_items).toHaveLength(2);
  });

  test("should use null for discounts and admin fields when they are omitted", async () => {
    const result = await post();

    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({
      payment_method: null,
      ship: null,
      store_discount: null,
      customer_discount: null,
      is_final: false,
      total_amount: "11000000",
    });
  });

  test("should accept a discount of 0", async () => {
    const result = await post(
      validInvoice({ store_discount: "0", customer_discount: 0 }),
    );

    expect(result.status).toBe(201);
    expect(result.body.data.store_discount).toBe("0");
    expect(result.body.data.total_amount).toBe("11000000");
  });

  test("should accept discounts that make the total exactly 0", async () => {
    const result = await post(
      validInvoice({
        store_discount: "10000000",
        customer_discount: "1000000",
      }),
    );

    expect(result.status).toBe(201);
    expect(result.body.data.total_amount).toBe("0");
  });

  test("should save empty strings as null", async () => {
    const result = await post(
      validInvoice({ payment_method: "", ship: "", customer_instagram: "" }),
    );

    expect(result.status).toBe(201);
    expect(result.body.data.payment_method).toBeNull();
    expect(result.body.data.ship).toBeNull();
    expect(result.body.data.customer_instagram).toBeNull();
  });

  test("should not check stock and should not change it", async () => {
    const result = await post(
      validInvoice({ items: [{ camera_id: ctx.cameraA.id, quantity: 8 }] }), // stok 5
    );

    expect(result.status).toBe(201);
    expect(result.body.data.total_amount).toBe("44000000");

    const camera = await prisma.camera.findUnique({
      where: { id: ctx.cameraA.id },
    });
    expect(camera.stock).toBe(5);
  });

  // ---------- is_final ----------

  test("should be editable once when is_final is omitted or false", async () => {
    for (const overrides of [{}, { is_final: false }]) {
      const result = await post(validInvoice(overrides));

      expect(result.status).toBe(201);
      expect(result.body.data.is_final).toBe(false);
    }
  });

  test("should be final right away when is_final is true", async () => {
    const result = await post(validInvoice({ is_final: true }));

    expect(result.status).toBe(201);
    expect(result.body.data.is_final).toBe(true);

    const edit = await send("patch", `/invoices/${result.body.data.id}`, {
      body: { ship: "JNE" },
    });
    expect(edit.status).toBe(409);
    expect(edit.body.errors).toBe("INVOICE_ALREADY_FINAL");
  });

  // ---------- Harga dan total tidak bisa dari request ----------

  test.each([
    ["total_amount", () => ({ total_amount: "1" })],
    ["subtotal", () => ({ subtotal: "1" })],
    ["no_invoice", () => ({ no_invoice: "WAV-20260101-AAAAAA" })],
    ["order_id", () => ({ order_id: crypto.randomUUID() })],
    ["created_at", () => ({ created_at: "2020-01-01" })],
    ["store_name", () => ({ store_name: "Toko Palsu" })],
    ["an unknown field", () => ({ foo: "bar" })],
    [
      "camera_price in an item",
      () => ({
        items: [{ camera_id: ctx.cameraA.id, quantity: 1, camera_price: "1" }],
      }),
    ],
    [
      "price in an item",
      () => ({ items: [{ camera_id: ctx.cameraA.id, quantity: 1, price: 1 }] }),
    ],
  ])("should reject %s sent by the client", async (_label, build) => {
    const result = await post(validInvoice(build()));

    expect(result.status).toBe(400);
    await ctx.expectNothingCreated();
  });

  // ---------- Diskon ----------

  test("should return discount exceeds total and create nothing", async () => {
    const result = await post(
      validInvoice({ store_discount: "11000000", customer_discount: "1" }),
    );

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("DISCOUNT_EXCEEDS_TOTAL");
    await ctx.expectNothingCreated();
  });

  test.each([
    ["store_discount is negative", () => ({ store_discount: "-1" })],
    ["store_discount is a negative number", () => ({ store_discount: -1 })],
    ["store_discount is a decimal string", () => ({ store_discount: "1.5" })],
    ["store_discount is a decimal number", () => ({ store_discount: 1.5 })],
    ["store_discount has letters", () => ({ store_discount: "abc" })],
    ["store_discount has leading zeros", () => ({ store_discount: "007" })],
    ["store_discount uses an exponent", () => ({ store_discount: "1e3" })],
    ["store_discount is empty", () => ({ store_discount: "" })],
    [
      "store_discount has 13 digits",
      () => ({ store_discount: "1000000000000" }),
    ],
    ["customer_discount is negative", () => ({ customer_discount: "-1" })],
    ["customer_discount has letters", () => ({ customer_discount: "abc" })],
    ["customer_discount is a decimal", () => ({ customer_discount: 1.5 })],
  ])("should return 400 when %s", async (_label, build) => {
    const result = await post(validInvoice(build()));

    expect(result.status).toBe(400);
    await ctx.expectNothingCreated();
  });

  // ---------- Validasi ----------

  test.each([
    ["customer_name is missing", () => ({ customer_name: undefined })],
    ["customer_name is blank", () => ({ customer_name: "   " })],
    [
      "customer_name is longer than 100 chars",
      () => ({ customer_name: "a".repeat(101) }),
    ],
    ["customer_address is missing", () => ({ customer_address: undefined })],
    [
      "customer_address is longer than 500 chars",
      () => ({ customer_address: "a".repeat(501) }),
    ],
    ["customer_whatsapp is missing", () => ({ customer_whatsapp: undefined })],
    ["customer_whatsapp is invalid", () => ({ customer_whatsapp: "abc" })],
    [
      "customer_instagram is longer than 100 chars",
      () => ({ customer_instagram: "a".repeat(101) }),
    ],
    [
      "payment_method is longer than 100 chars",
      () => ({ payment_method: "a".repeat(101) }),
    ],
    ["ship is longer than 100 chars", () => ({ ship: "a".repeat(101) })],
    ["is_final is not a boolean", () => ({ is_final: "ya" })],
    ["items is missing", () => ({ items: undefined })],
    ["items is empty", () => ({ items: [] })],
    [
      "items has more than 10 cameras",
      () => ({
        items: Array.from({ length: 11 }, () => ({
          camera_id: crypto.randomUUID(),
          quantity: 1,
        })),
      }),
    ],
    [
      "camera_id is not a uuid",
      () => ({ items: [{ camera_id: "bukan-uuid", quantity: 1 }] }),
    ],
    [
      "quantity is 0",
      () => ({ items: [{ camera_id: ctx.cameraA.id, quantity: 0 }] }),
    ],
    [
      "quantity is 11",
      () => ({ items: [{ camera_id: ctx.cameraA.id, quantity: 11 }] }),
    ],
    [
      "the same camera appears twice",
      () => ({
        items: [
          { camera_id: ctx.cameraA.id, quantity: 1 },
          { camera_id: ctx.cameraA.id, quantity: 2 },
        ],
      }),
    ],
  ])("should return 400 when %s", async (_label, build) => {
    const result = await post(validInvoice(build()));

    expect(result.status).toBe(400);
    await ctx.expectNothingCreated();
  });

  test("should return 400 when there is no body", async () => {
    const result = await post({});

    expect(result.status).toBe(400);
    await ctx.expectNothingCreated();
  });

  // ---------- Kamera dan toko ----------

  test("should return camera not found with the missing ids", async () => {
    const missing = crypto.randomUUID();

    const result = await post(
      validInvoice({
        items: [
          { camera_id: ctx.cameraA.id, quantity: 1 },
          { camera_id: missing, quantity: 1 },
        ],
      }),
    );
    console.log(result.body);
    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    expect(result.body.details).toEqual({ camera_ids: [missing] });
    await ctx.expectNothingCreated();
  });

  test("should return camera not found for a deleted camera", async () => {
    await prisma.camera.update({
      where: { id: ctx.cameraA.id },
      data: { is_deleted: true },
    });

    const result = await post();

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    await ctx.expectNothingCreated();
  });

  test("should return store not ready when there is no store", async () => {
    vi.spyOn(prisma.store, "findFirst").mockResolvedValueOnce(null);

    const result = await post();
    vi.restoreAllMocks();

    expect(result.status).toBe(503);
    expect(result.body.errors).toBe("STORE_NOT_READY");
    await ctx.expectNothingCreated();
  });

  test("should create nothing when saving fails", async () => {
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await post();
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await ctx.expectNothingCreated();
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and create nothing when %s",
    async (_label, buildAuthorization) => {
      const result = await post(validInvoice(), {
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      await ctx.expectNothingCreated();
    },
  );
});
