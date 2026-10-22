import crypto from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  INVOICE_KEYS,
  ITEM_KEYS,
  setupOrderTest,
  unauthorizedCases,
} from "./helper.js";

describe("get /invoices/:id", () => {
  const ctx = setupOrderTest();

  const get = (id, options = {}) => ctx.send("get", `/invoices/${id}`, options);

  test("should get the invoice with its items", async () => {
    const created = await ctx.invoiceViaApi({
      items: [
        { camera_id: ctx.cameraB.id, quantity: 2 },
        { camera_id: ctx.cameraA.id, quantity: 1 },
      ],
      payment_method: "Transfer BCA",
      store_discount: "100000",
    });

    const result = await get(created.id);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual(created);
    expect(result.body.data.subtotal).toBe("19500000");
    expect(result.body.data.total_amount).toBe("19400000");

    // Item diurutkan berdasarkan nama kamera
    expect(result.body.data.items.map((item) => item.camera_name)).toEqual([
      ctx.cameraA.name,
      ctx.cameraB.name,
    ]);
    expect(result.body.data.items.map((item) => item.line_total)).toEqual([
      "5500000",
      "14000000",
    ]);
  });

  test("should return the invoice fields, subtotal and items", async () => {
    const created = await ctx.invoiceViaApi();

    const result = await get(created.id);

    expect(Object.keys(result.body.data).sort()).toEqual(
      [...INVOICE_KEYS].sort(),
    );
    expect(Object.keys(result.body.data.items[0]).sort()).toEqual(
      [...ITEM_KEYS].sort(),
    );
  });

  test("should get an invoice that was created from a public order", async () => {
    const { invoice, response } = await ctx.orderViaApi();

    const result = await get(invoice.id);

    expect(result.status).toBe(200);
    expect(result.body.data.no_invoice).toBe(response.no_invoice);
    expect(result.body.data.is_final).toBe(false);
    expect(result.body.data.store_discount).toBeNull();
    expect(result.body.data.customer_discount).toBeNull();
    expect(result.body.data.items).toHaveLength(1);
  });

  test("should not change when the camera is edited or deleted later", async () => {
    const created = await ctx.invoiceViaApi();
    const before = await get(created.id);

    await prisma.camera.update({
      where: { id: ctx.cameraA.id },
      data: { name: `Nama Baru ${ctx.tag}`, price: 1, is_deleted: true },
    });

    const after = await get(created.id);

    expect(after.status).toBe(200);
    expect(after.body.data).toEqual(before.body.data);
    expect(after.body.data.items[0].camera_name).toBe(ctx.cameraA.name);
    expect(after.body.data.items[0].camera_price).toBe("5500000");
  });

  test("should return the requested invoice, not another one", async () => {
    const first = await ctx.invoiceViaApi({
      customer_name: ctx.name("pertama"),
    });
    const second = await ctx.invoiceViaApi({
      customer_name: ctx.name("kedua"),
    });

    const result = await get(second.id);

    expect(result.body.data.id).toBe(second.id);
    expect(result.body.data.customer_name).toBe(ctx.name("kedua"));
    expect(result.body.data.id).not.toBe(first.id);
  });

  test("should return invoice not found", async () => {
    const result = await get(crypto.randomUUID());

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("INVOICE_NOT_FOUND");
  });

  test("should return invoice not found after it is deleted", async () => {
    const created = await ctx.invoiceViaApi();
    await prisma.order.delete({ where: { id: created.order_id } });

    const result = await get(created.id);

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("INVOICE_NOT_FOUND");
  });

  test("should return 400 when id is not a uuid", async () => {
    const result = await get("bukan-uuid");

    expect(result.status).toBe(400);
  });

  test.each(unauthorizedCases)(
    "should return unauthorized when %s",
    async (_label, buildAuthorization) => {
      const created = await ctx.invoiceViaApi();

      const result = await get(created.id, {
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
    },
  );
});
