import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import { INVOICE_NUMBER_PATTERN, setupOrderTest, wibDate } from "./helper.js";

describe("post /orders", () => {
  const ctx = setupOrderTest();
  const { sendPublic, validOrder } = ctx;

  const p2002 = () =>
    Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Memulai transaksi admin yang belum commit (baris kamera terkunci).
  // release() = commit, done = promise transaksinya
  const holdCameraUpdate = async (data) => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    let locked;
    const lockAcquired = new Promise((resolve) => (locked = resolve));

    const done = prisma.$transaction(
      async (tx) => {
        await tx.camera.update({ where: { id: ctx.cameraA.id }, data });
        locked();
        await gate;
      },
      { timeout: 15000 },
    );

    await lockAcquired;
    return { release, done };
  };

  // ---------- Sukses ----------

  test("should create the order, its items and the invoice", async () => {
    const result = await sendPublic(validOrder());

    expect(result.status).toBe(201);

    const data = result.body.data;
    expect(data.no_invoice).toMatch(INVOICE_NUMBER_PATTERN);
    expect(data.no_invoice.startsWith(`WAV-${wibDate()}-`)).toBe(true);
    expect(data.customer_name).toBe(ctx.name("budi"));
    expect(data.total_amount).toBe("11000000");
    expect(data.created_at).toBeDefined();
    expect(data.items).toEqual([
      {
        camera_name: ctx.cameraA.name,
        camera_price: "5500000",
        quantity: 2,
        line_total: "11000000",
      },
    ]);

    const invoice = await prisma.invoice.findUnique({
      where: { no_invoice: data.no_invoice },
      include: { order: { include: { order_items: true } } },
    });

    // Snapshot toko, diskon dan field admin kosong, belum final
    expect(invoice).toMatchObject({
      store_name: ctx.store.name,
      store_address: ctx.store.address,
      whatsapp_store: ctx.store.whatsapp,
      instagram_store: ctx.store.instagram,
      payment_method: null,
      ship: null,
      store_discount: null,
      customer_discount: null,
      is_final: false,
      customer_name: ctx.name("budi"),
      customer_address: "Jl. Contoh No. 1, Jakarta",
      customer_whatsapp: "081234567890",
      customer_instagram: "@budi",
      total_amount: "11000000",
    });

    expect(invoice.order_id).toBe(invoice.order.id);
    expect(invoice.order).toMatchObject({
      customer_name: ctx.name("budi"),
      address: "Jl. Contoh No. 1, Jakarta",
      whatsapp: "081234567890",
      instagram: "@budi",
      total_amount: "11000000",
    });
    expect(invoice.order.order_items).toHaveLength(1);
    expect(invoice.order.order_items[0]).toMatchObject({
      camera_id: ctx.cameraA.id,
      camera_name: ctx.cameraA.name,
      camera_price: "5500000",
      quantity: 2,
    });
  });

  test("should only return the public fields", async () => {
    const result = await sendPublic(validOrder());

    expect(Object.keys(result.body.data).sort()).toEqual(
      [
        "created_at",
        "customer_name",
        "items",
        "no_invoice",
        "total_amount",
      ].sort(),
    );
    expect(Object.keys(result.body.data.items[0]).sort()).toEqual(
      ["camera_name", "camera_price", "line_total", "quantity"].sort(),
    );
  });

  test("should calculate the total of several cameras and sort items by name", async () => {
    const result = await sendPublic(
      validOrder({
        items: [
          { camera_id: ctx.cameraB.id, quantity: 2 },
          { camera_id: ctx.cameraA.id, quantity: 1 },
        ],
      }),
    );

    expect(result.status).toBe(201);
    expect(result.body.data.total_amount).toBe("19500000"); // 5.5jt + 2 x 7jt
    expect(result.body.data.items.map((item) => item.camera_name)).toEqual([
      ctx.cameraA.name,
      ctx.cameraB.name,
    ]);
    expect(result.body.data.items.map((item) => item.line_total)).toEqual([
      "5500000",
      "14000000",
    ]);
  });

  test("should default quantity to 1", async () => {
    const result = await sendPublic(
      validOrder({ items: [{ camera_id: ctx.cameraA.id }] }),
    );

    expect(result.status).toBe(201);
    expect(result.body.data.items[0].quantity).toBe(1);
    expect(result.body.data.total_amount).toBe("5500000");
  });

  test("should save instagram as null when it is omitted or empty", async () => {
    for (const instagram of [undefined, "", null]) {
      const { invoice } = await ctx.orderViaApi({ instagram });

      expect(invoice.customer_instagram).toBeNull();
    }
  });

  test.each([["081234567890"], ["6281234567890"], ["+6281234567890"]])(
    "should accept whatsapp %s",
    async (whatsapp) => {
      const result = await sendPublic(validOrder({ whatsapp }));

      expect(result.status).toBe(201);
    },
  );

  test("should trim text fields", async () => {
    const result = await sendPublic(
      validOrder({
        customer_name: `  ${ctx.name("budi")}  `,
        address: "  Jl. Contoh  ",
      }),
    );

    expect(result.status).toBe(201);
    expect(result.body.data.customer_name).toBe(ctx.name("budi"));

    const invoice = await prisma.invoice.findUnique({
      where: { no_invoice: result.body.data.no_invoice },
    });
    expect(invoice.customer_address).toBe("Jl. Contoh");
  });

  test("should create orders at the same time with different invoice numbers", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => sendPublic(validOrder())),
    );

    expect(results.map((result) => result.status)).toEqual([
      201, 201, 201, 201, 201,
    ]);
    expect(
      new Set(results.map((result) => result.body.data.no_invoice)).size,
    ).toBe(5);
    expect(await ctx.countOrders()).toBe(5);
    expect(await ctx.countInvoices()).toBe(5);
  });

  // ---------- Snapshot dan stok ----------

  test("should not change the camera stock", async () => {
    await sendPublic(validOrder());

    const camera = await prisma.camera.findUnique({
      where: { id: ctx.cameraA.id },
    });
    expect(camera.stock).toBe(5);
  });

  test("should keep the invoice unchanged when the camera changes later", async () => {
    const { invoice } = await ctx.orderViaApi();
    const before = await ctx.send("get", `/invoices/${invoice.id}`);

    await prisma.camera.update({
      where: { id: ctx.cameraA.id },
      data: { name: `Nama Baru ${ctx.tag}`, price: 1 },
    });

    const after = await ctx.send("get", `/invoices/${invoice.id}`);

    expect(after.status).toBe(200);
    expect(after.body.data).toEqual(before.body.data);
    expect(after.body.data.items[0].camera_price).toBe("5500000");
    expect(after.body.data.total_amount).toBe("11000000");
  });

  test("should allow ordering exactly the available stock", async () => {
    const result = await sendPublic(
      validOrder({ items: [{ camera_id: ctx.cameraA.id, quantity: 5 }] }),
    );

    expect(result.status).toBe(201);
  });

  test("should return insufficient stock when the quantity is more than the stock", async () => {
    const result = await sendPublic(
      validOrder({ items: [{ camera_id: ctx.cameraA.id, quantity: 6 }] }),
    );

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("INSUFFICIENT_STOCK");
    expect(result.body.details.cameras).toEqual([
      {
        camera_id: ctx.cameraA.id,
        name: ctx.cameraA.name,
        requested: 6,
        stock: 5,
      },
    ]);
    await ctx.expectNothingCreated();
  });

  test("should return insufficient stock when the camera is out of stock", async () => {
    const empty = await ctx.createCamera("Habis", 1000000, { stock: 0 });

    const result = await sendPublic(
      validOrder({ items: [{ camera_id: empty.id, quantity: 1 }] }),
    );

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("INSUFFICIENT_STOCK");
    await ctx.expectNothingCreated();
  });

  test("should create nothing when only one of the cameras is short on stock", async () => {
    const result = await sendPublic(
      validOrder({
        items: [
          { camera_id: ctx.cameraA.id, quantity: 1 },
          { camera_id: ctx.cameraB.id, quantity: 4 }, // stok 3
        ],
      }),
    );

    expect(result.status).toBe(400);
    expect(result.body.details.cameras.map((c) => c.camera_id)).toEqual([
      ctx.cameraB.id,
    ]);
    await ctx.expectNothingCreated();
  });

  // ---------- Kamera tidak valid ----------

  test("should return camera not found with the missing ids", async () => {
    const missing = crypto.randomUUID();

    const result = await sendPublic(
      validOrder({
        items: [
          { camera_id: ctx.cameraA.id, quantity: 1 },
          { camera_id: missing, quantity: 1 },
        ],
      }),
    );

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

    const result = await sendPublic(validOrder());

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    await ctx.expectNothingCreated();
  });

  test("should return an error when the camera price is not a whole rupiah", async () => {
    const odd = await ctx.createCamera("Harga Desimal", 1000.5);

    const result = await sendPublic(
      validOrder({ items: [{ camera_id: odd.id, quantity: 1 }] }),
    );

    expect(result.status).toBe(500);
    expect(result.body.errors).toBe("CAMERA_PRICE_INVALID");
    await ctx.expectNothingCreated();
  });

  // ---------- Admin mengubah atau menghapus kamera saat order masuk ----------

  test("should wait for an uncommitted camera delete and then reject the order", async () => {
    const admin = await holdCameraUpdate({ is_deleted: true });

    let finished = false;
    const order = sendPublic(validOrder()).then((result) => {
      finished = true;
      return result;
    });

    await sleep(500);
    expect(finished).toBe(false); // order menunggu kunci, belum selesai

    admin.release();
    await admin.done;
    const result = await order;

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    await ctx.expectNothingCreated();
  });

  test("should wait for an uncommitted price change and use the new price", async () => {
    const admin = await holdCameraUpdate({ price: 7000000 });

    let finished = false;
    const order = sendPublic(
      validOrder({ items: [{ camera_id: ctx.cameraA.id, quantity: 1 }] }),
    ).then((result) => {
      finished = true;
      return result;
    });

    await sleep(500);
    expect(finished).toBe(false);

    admin.release();
    await admin.done;
    const result = await order;

    expect(result.status).toBe(201);
    expect(result.body.data.items[0].camera_price).toBe("7000000");
    expect(result.body.data.total_amount).toBe("7000000");
  });

  test("should wait for an uncommitted rename and snapshot the new name", async () => {
    const newName = `Nama Baru ${ctx.tag}`;
    const admin = await holdCameraUpdate({ name: newName });

    const order = sendPublic(validOrder());
    await sleep(500);

    admin.release();
    await admin.done;
    const result = await order;

    expect(result.status).toBe(201);
    expect(result.body.data.items[0].camera_name).toBe(newName);
  });

  test("should never return 500 when an order and a camera delete run at the same time", async () => {
    const [order, remove] = await Promise.all([
      sendPublic(validOrder()),
      ctx.send("delete", `/cameras/${ctx.cameraA.id}`),
    ]);

    expect(remove.status).toBe(200);
    expect([201, 404]).toContain(order.status);

    if (order.status === 201) {
      // Order terjadi sebelum hapus: snapshot utuh dan invoice konsisten
      expect(order.body.data.items[0].camera_name).toBe(ctx.cameraA.name);
      expect(await ctx.countInvoices()).toBe(1);
    } else {
      // Hapus terjadi lebih dulu: nggak ada yang tersisa setengah jalan
      expect(order.body.errors).toBe("CAMERA_NOT_FOUND");
      await ctx.expectNothingCreated();
    }
  });

  test("should return camera not found when the camera is deleted permanently before the insert (P2003)", async () => {
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      Object.assign(new Error("Foreign key constraint failed"), {
        code: "P2003",
      }),
    );

    const result = await sendPublic(validOrder());
    vi.restoreAllMocks();

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    await ctx.expectNothingCreated();
  });

  // ---------- Toko ----------

  test("should return store not ready when there is no store", async () => {
    vi.spyOn(prisma.store, "findFirst").mockResolvedValueOnce(null);

    const result = await sendPublic(validOrder());
    vi.restoreAllMocks();

    expect(result.status).toBe(503);
    expect(result.body.errors).toBe("STORE_NOT_READY");
    await ctx.expectNothingCreated();
  });

  // ---------- Nomor invoice ----------
  // Invoice dibuat lewat tx.invoice.create di dalam transaksi, jadi yang di-mock
  // prisma.$transaction (satu panggilan = satu percobaan)

  test("should retry with a new invoice number when it collides", async () => {
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(p2002());

    const result = await sendPublic(validOrder());
    const calls = spy.mock.calls.length;
    vi.restoreAllMocks();

    expect(result.status).toBe(201);
    expect(calls).toBe(2); // percobaan pertama bentrok, kedua berhasil
    expect(await ctx.countInvoices()).toBe(1);
  });

  test("should give up after 5 collisions and create nothing", async () => {
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValue(p2002());

    const result = await sendPublic(validOrder());
    const calls = spy.mock.calls.length;
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    expect(result.body.errors).toBe("INVOICE_NUMBER_GENERATION_FAILED");
    expect(calls).toBe(5);
    await ctx.expectNothingCreated();
  });

  test("should not hide unknown database errors", async () => {
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await sendPublic(validOrder());
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
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
    ["address is missing", () => ({ address: undefined })],
    ["address is blank", () => ({ address: "   " })],
    ["address is longer than 500 chars", () => ({ address: "a".repeat(501) })],
    ["whatsapp is missing", () => ({ whatsapp: undefined })],
    ["whatsapp is empty", () => ({ whatsapp: "" })],
    ["whatsapp has letters", () => ({ whatsapp: "abc12345678" })],
    ["whatsapp is too short", () => ({ whatsapp: "12345" })],
    ["whatsapp is too long", () => ({ whatsapp: "1234567890123456" })],
    ["whatsapp has dashes", () => ({ whatsapp: "0812-3456-7890" })],
    ["whatsapp is only a plus", () => ({ whatsapp: "+" })],
    [
      "instagram is longer than 100 chars",
      () => ({ instagram: "a".repeat(101) }),
    ],
    ["items is missing", () => ({ items: undefined })],
    ["items is empty", () => ({ items: [] })],
    ["items is not an array", () => ({ items: "x" })],
    [
      "items has more than 10 cameras",
      () => ({
        items: Array.from({ length: 11 }, () => ({
          camera_id: crypto.randomUUID(),
          quantity: 1,
        })),
      }),
    ],
    ["an item has no camera_id", () => ({ items: [{ quantity: 1 }] })],
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
      "quantity is a decimal",
      () => ({ items: [{ camera_id: ctx.cameraA.id, quantity: 1.5 }] }),
    ],
    [
      "quantity is not a number",
      () => ({ items: [{ camera_id: ctx.cameraA.id, quantity: "banyak" }] }),
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
    const result = await sendPublic(validOrder(build()));

    expect(result.status).toBe(400);
    await ctx.expectNothingCreated();
  });

  // Harga, total, dan field admin nggak boleh dikirim dari request
  test.each([
    ["total_amount", () => ({ total_amount: "1" })],
    ["price", () => ({ price: 1 })],
    ["store_discount", () => ({ store_discount: "1000" })],
    ["customer_discount", () => ({ customer_discount: "1000" })],
    ["is_final", () => ({ is_final: true })],
    ["no_invoice", () => ({ no_invoice: "WAV-20260101-AAAAAA" })],
    ["payment_method", () => ({ payment_method: "Transfer" })],
    ["ship", () => ({ ship: "JNE" })],
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
    [
      "camera_name in an item",
      () => ({
        items: [
          { camera_id: ctx.cameraA.id, quantity: 1, camera_name: "Murah" },
        ],
      }),
    ],
  ])("should reject %s sent by the client", async (_label, build) => {
    const result = await sendPublic(validOrder(build()));

    expect(result.status).toBe(400);
    await ctx.expectNothingCreated();
  });

  test("should return 400 when there is no body", async () => {
    const result = await sendPublic(undefined);

    expect(result.status).toBe(400);
    await ctx.expectNothingCreated();
  });
});
