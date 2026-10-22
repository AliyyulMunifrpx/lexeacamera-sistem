import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  INVOICE_KEYS,
  setupOrderTest,
  unauthorizedCases,
} from "./helper.js";

describe("patch /invoices/:id", () => {
  const ctx = setupOrderTest();

  const patch = (id, body, options = {}) =>
    ctx.send("patch", `/invoices/${id}`, { body, ...options });

  // Invoice baru (belum final) dengan diskon awal supaya hitung ulang total ketahuan.
  // Subtotal 11.000.000, total 10.970.000.
  const createInvoice = async (overrides = {}) => {
    const created = await ctx.invoiceViaApi({
      payment_method: "Cash",
      ship: "Ambil di toko",
      store_discount: "10000",
      customer_discount: "20000",
      ...overrides,
    });
    expect(created.is_final).toBe(false);

    return { created, before: await ctx.findInvoice(created.id) };
  };

  // Request yang gagal nggak boleh mengubah apa pun atau menghabiskan jatah edit
  const expectUntouched = async (before) => {
    expect(await ctx.findInvoice(before.id)).toEqual(before);
  };

  // ---------- Sukses: edit sekali ----------

  test("should edit one field and make the invoice final", async () => {
    const { created, before } = await createInvoice();

    const result = await patch(created.id, { payment_method: "Transfer BCA" });

    expect(result.status).toBe(200);
    expect(result.body.data.payment_method).toBe("Transfer BCA");
    expect(result.body.data.is_final).toBe(true);
    expect(Object.keys(result.body.data).sort()).toEqual(
      [...INVOICE_KEYS].sort(),
    );

    // Field lain dan total nggak berubah
    expect(await ctx.findInvoice(created.id)).toEqual({
      ...before,
      payment_method: "Transfer BCA",
      is_final: true,
    });
    expect(result.body.data.total_amount).toBe("10970000");
  });

  test("should edit many fields in one request", async () => {
    const { created } = await createInvoice();

    const body = {
      store_name: "Toko Baru",
      store_address: "Jl. Toko Baru No. 2",
      whatsapp_store: "6289999999999",
      instagram_store: "@tokobaru",
      payment_method: "Transfer BCA",
      ship: "JNE",
      customer_name: ctx.name("diedit"),
      customer_address: "Jl. Baru No. 3",
      customer_whatsapp: "+6281111111111",
      customer_instagram: "@baru",
      store_discount: "100000",
      customer_discount: 50000,
    };

    const result = await patch(created.id, body);

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({
      ...body,
      store_discount: "100000",
      customer_discount: "50000",
      total_amount: "10850000", // 11jt - 100rb - 50rb
      subtotal: "11000000",
      is_final: true,
    });
  });

  test("should trim text fields", async () => {
    const { created } = await createInvoice();

    const result = await patch(created.id, {
      customer_name: `  ${ctx.name("trim")}  `,
      ship: "  JNE  ",
    });

    expect(result.status).toBe(200);
    expect(result.body.data.customer_name).toBe(ctx.name("trim"));
    expect(result.body.data.ship).toBe("JNE");
  });

  test("should clear optional fields when an empty string or null is sent", async () => {
    const { created } = await createInvoice({ customer_instagram: "@lama" });

    const result = await patch(created.id, {
      payment_method: "",
      ship: null,
      customer_instagram: "",
      store_address: "",
    });

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({
      payment_method: null,
      ship: null,
      customer_instagram: null,
      store_address: null,
    });
  });

  test("should edit an invoice that was created from a public order", async () => {
    const { invoice } = await ctx.orderViaApi();

    const result = await patch(invoice.id, {
      payment_method: "Transfer",
      store_discount: "500000",
    });

    expect(result.status).toBe(200);
    expect(result.body.data.is_final).toBe(true);
    expect(result.body.data.total_amount).toBe("10500000");
  });

  // ---------- Total dihitung ulang ----------

  test("should recalculate the total from the subtotal when a discount changes", async () => {
    const { created } = await createInvoice();

    const result = await patch(created.id, { store_discount: "100000" });

    // customer_discount lama (20.000) tetap dipakai
    expect(result.body.data.store_discount).toBe("100000");
    expect(result.body.data.customer_discount).toBe("20000");
    expect(result.body.data.total_amount).toBe("10880000");
  });

  test("should remove a discount when null is sent", async () => {
    const { created } = await createInvoice();

    const result = await patch(created.id, { store_discount: null });

    expect(result.body.data.store_discount).toBeNull();
    expect(result.body.data.total_amount).toBe("10980000"); // 11jt - 20rb
  });

  test("should accept discounts that make the total exactly 0", async () => {
    const { created } = await createInvoice();

    const result = await patch(created.id, {
      store_discount: "11000000",
      customer_discount: "0",
    });

    expect(result.status).toBe(200);
    expect(result.body.data.total_amount).toBe("0");
  });

  test("should return discount exceeds total and keep the one edit available", async () => {
    const { created, before } = await createInvoice();

    const rejected = await patch(created.id, { store_discount: "11000000" }); // + 20rb > subtotal

    expect(rejected.status).toBe(400);
    expect(rejected.body.errors).toBe("DISCOUNT_EXCEEDS_TOTAL");
    await expectUntouched(before); // is_final masih false

    const accepted = await patch(created.id, { store_discount: "1000" });
    expect(accepted.status).toBe(200);
  });

  // ---------- Item, order, dan field sistem tidak berubah ----------

  test("should not change the items, the order or the subtotal", async () => {
    const { created } = await createInvoice();
    const orderBefore = await prisma.order.findUnique({
      where: { id: created.order_id },
      include: { order_items: true },
    });

    const result = await patch(created.id, {
      customer_name: ctx.name("diedit"),
      store_discount: "99999",
    });

    expect(result.status).toBe(200);
    expect(result.body.data.items).toEqual(created.items);
    expect(result.body.data.subtotal).toBe(created.subtotal);
    expect(result.body.data.no_invoice).toBe(created.no_invoice);
    expect(result.body.data.order_id).toBe(created.order_id);
    expect(result.body.data.created_at).toBe(created.created_at);

    // Order tetap berisi data asli saat dibuat
    const orderAfter = await prisma.order.findUnique({
      where: { id: created.order_id },
      include: { order_items: true },
    });
    expect(orderAfter).toEqual(orderBefore);
  });

  // ---------- Hanya sekali ----------

  test("should return invoice already final on the second edit and keep the first result", async () => {
    const { created } = await createInvoice();

    const first = await patch(created.id, { ship: "JNE" });
    const afterFirst = await ctx.findInvoice(created.id);

    const second = await patch(created.id, {
      ship: "J&T",
      payment_method: "QRIS",
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.errors).toBe("INVOICE_ALREADY_FINAL");
    expect(await ctx.findInvoice(created.id)).toEqual(afterFirst);
  });

  test("should not allow editing again even a different field", async () => {
    const { created } = await createInvoice();

    await patch(created.id, { ship: "JNE" });
    const second = await patch(created.id, { customer_name: ctx.name("lain") });

    expect(second.status).toBe(409);
    expect(second.body.errors).toBe("INVOICE_ALREADY_FINAL");
  });

  test("should not allow editing an invoice that was created as final", async () => {
    const created = await ctx.invoiceViaApi({ is_final: true });
    const before = await ctx.findInvoice(created.id);

    const result = await patch(created.id, { ship: "JNE" });

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("INVOICE_ALREADY_FINAL");
    await expectUntouched(before);
  });

  test("should let only one of two edits at the same time win", async () => {
    const { created } = await createInvoice();
    const bodies = [{ payment_method: "A" }, { payment_method: "B" }];

    const results = await Promise.all(
      bodies.map((body) => patch(created.id, body)),
    );

    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);

    const winner = results.findIndex((result) => result.status === 200);
    const loser = results.find((result) => result.status === 409);
    expect(loser.body.errors).toBe("INVOICE_ALREADY_FINAL");

    // Hasil akhirnya persis milik yang menang
    const inDb = await ctx.findInvoice(created.id);
    expect(inDb.payment_method).toBe(bodies[winner].payment_method);
    expect(inDb.is_final).toBe(true);
  });

  // ---------- Request yang gagal nggak menghabiskan jatah ----------

  test.each([
    ["an unknown field is sent", { foo: "bar" }],
    ["no_invoice is sent", { no_invoice: "WAV-20260101-AAAAAA" }],
    ["order_id is sent", { order_id: crypto.randomUUID() }],
    ["total_amount is sent", { total_amount: "1" }],
    ["subtotal is sent", { subtotal: "1" }],
    ["created_at is sent", { created_at: "2020-01-01" }],
    ["is_final is sent", { is_final: false }],
    ["items is sent", { items: [] }],
    ["customer_name is blank", { customer_name: "   " }],
    ["customer_name is null", { customer_name: null }],
    [
      "customer_name is longer than 100 chars",
      { customer_name: "a".repeat(101) },
    ],
    ["customer_address is blank", { customer_address: "   " }],
    [
      "customer_address is longer than 500 chars",
      { customer_address: "a".repeat(501) },
    ],
    ["customer_whatsapp is invalid", { customer_whatsapp: "abc" }],
    ["customer_whatsapp is null", { customer_whatsapp: null }],
    ["store_name is blank", { store_name: "   " }],
    ["store_name is null", { store_name: null }],
    ["store_name is longer than 100 chars", { store_name: "a".repeat(101) }],
    [
      "store_address is longer than 500 chars",
      { store_address: "a".repeat(501) },
    ],
    [
      "whatsapp_store is longer than 100 chars",
      { whatsapp_store: "a".repeat(101) },
    ],
    [
      "payment_method is longer than 100 chars",
      { payment_method: "a".repeat(101) },
    ],
    ["ship is longer than 100 chars", { ship: "a".repeat(101) }],
    ["store_discount is negative", { store_discount: "-1" }],
    ["store_discount is a decimal", { store_discount: 1.5 }],
    ["store_discount has letters", { store_discount: "abc" }],
    ["store_discount is empty", { store_discount: "" }],
    ["customer_discount has leading zeros", { customer_discount: "007" }],
  ])(
    "should return 400, change nothing and keep the edit when %s",
    async (_label, body) => {
      const { created, before } = await createInvoice();

      const rejected = await patch(created.id, { ship: "JNE", ...body });

      expect(rejected.status).toBe(400);
      await expectUntouched(before);

      // Jatah edit masih ada
      const accepted = await patch(created.id, { ship: "JNE" });
      expect(accepted.status).toBe(200);
    },
  );

  test("should return 400 when nothing is sent", async () => {
    const { created, before } = await createInvoice();

    const empty = await patch(created.id, {});
    const noBody = await ctx.send("patch", `/invoices/${created.id}`);

    expect(empty.status).toBe(400);
    expect(noBody.status).toBe(400);
    await expectUntouched(before);
  });

  test("should return 400 when id is not a uuid", async () => {
    const result = await patch("bukan-uuid", { ship: "JNE" });

    expect(result.status).toBe(400);
  });

  test("should return invoice not found", async () => {
    const result = await patch(crypto.randomUUID(), { ship: "JNE" });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("INVOICE_NOT_FOUND");
  });

  test("should change nothing and keep the edit when the transaction fails", async () => {
    const { created, before } = await createInvoice();

    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await patch(created.id, { ship: "JNE" });
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await expectUntouched(before);

    const retry = await patch(created.id, { ship: "JNE" });
    expect(retry.status).toBe(200);
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and keep the edit when %s",
    async (_label, buildAuthorization) => {
      const { created, before } = await createInvoice();

      const result = await patch(
        created.id,
        { ship: "JNE" },
        { authorization: buildAuthorization(ctx.accessToken) },
      );

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      await expectUntouched(before);
    },
  );
});
