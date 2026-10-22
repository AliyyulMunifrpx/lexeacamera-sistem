import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import { setupOrderTest, unauthorizedCases } from "./helper.js";

describe("delete /invoices/:id", () => {
  const ctx = setupOrderTest();

  const remove = (id, options = {}) =>
    ctx.send("delete", `/invoices/${id}`, options);

  const orderExists = async (orderId) =>
    (await prisma.order.findUnique({ where: { id: orderId } })) !== null;
  const countItems = (orderId) =>
    prisma.orderItem.count({ where: { order_id: orderId } });

  // ---------- Sukses ----------

  test("should delete the invoice, its order and its items", async () => {
    const created = await ctx.invoiceViaApi({
      items: [
        { camera_id: ctx.cameraA.id, quantity: 1 },
        { camera_id: ctx.cameraB.id, quantity: 1 },
      ],
    });
    expect(await countItems(created.order_id)).toBe(2);

    const result = await remove(created.id);

    expect(result.status).toBe(200);
    expect(result.body.data.message).toBe("INVOICE_DELETED");
    expect(await ctx.findInvoice(created.id)).toBeNull();
    expect(await orderExists(created.order_id)).toBe(false);
    expect(await countItems(created.order_id)).toBe(0);
  });

  test("should delete an invoice that was created from a public order", async () => {
    const { invoice } = await ctx.orderViaApi();

    const result = await remove(invoice.id);

    expect(result.status).toBe(200);
    expect(await ctx.findInvoice(invoice.id)).toBeNull();
    expect(await orderExists(invoice.order_id)).toBe(false);
  });

  test("should delete a final invoice", async () => {
    const created = await ctx.invoiceViaApi({ is_final: true });
    expect(created.is_final).toBe(true);

    const result = await remove(created.id);

    expect(result.status).toBe(200);
    expect(await ctx.findInvoice(created.id)).toBeNull();
  });

  test("should delete an invoice that was already edited", async () => {
    const created = await ctx.invoiceViaApi();
    await ctx.send("patch", `/invoices/${created.id}`, {
      body: { ship: "JNE" },
    });

    const result = await remove(created.id);

    expect(result.status).toBe(200);
    expect(await ctx.findInvoice(created.id)).toBeNull();
  });

  test("should not touch other invoices", async () => {
    const target = await ctx.invoiceViaApi({
      customer_name: ctx.name("hapus"),
    });
    const other = await ctx.invoiceViaApi({ customer_name: ctx.name("tetap") });

    await remove(target.id);

    expect(await ctx.findInvoice(other.id)).not.toBeNull();
    expect(await orderExists(other.order_id)).toBe(true);
    expect(await countItems(other.order_id)).toBe(1);
  });

  test("should not touch the cameras or their stock", async () => {
    const created = await ctx.invoiceViaApi({
      items: [{ camera_id: ctx.cameraA.id, quantity: 3 }],
    });

    await remove(created.id);

    const camera = await prisma.camera.findUnique({
      where: { id: ctx.cameraA.id },
    });
    expect(camera).not.toBeNull();
    expect(camera.is_deleted).toBe(false);
    expect(camera.stock).toBe(5); // stok nggak dikembalikan atau dikurangi
  });

  // ---------- Tidak ditemukan dan validasi ----------

  test("should return invoice not found", async () => {
    const result = await remove(crypto.randomUUID());

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("INVOICE_NOT_FOUND");
  });

  test("should return invoice not found when deleted twice", async () => {
    const created = await ctx.invoiceViaApi();

    const first = await remove(created.id);
    const second = await remove(created.id);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expect(second.body.errors).toBe("INVOICE_NOT_FOUND");
  });

  test("should return 400 when id is not a uuid", async () => {
    const result = await remove("bukan-uuid");

    expect(result.status).toBe(400);
  });

  // ---------- Race condition dan kegagalan ----------

  test("should delete only once when two deletes run at the same time", async () => {
    const created = await ctx.invoiceViaApi();

    const results = await Promise.all([remove(created.id), remove(created.id)]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 404]);
    expect(await ctx.findInvoice(created.id)).toBeNull();
  });

  test("should return invoice not found when it is deleted before the delete runs (P2025)", async () => {
    const created = await ctx.invoiceViaApi();

    vi.spyOn(prisma.order, "delete").mockRejectedValueOnce(
      Object.assign(new Error("Record to delete does not exist"), {
        code: "P2025",
      }),
    );

    const result = await remove(created.id);
    vi.restoreAllMocks();

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("INVOICE_NOT_FOUND");
  });

  test("should not hide unknown database errors and should keep everything", async () => {
    const created = await ctx.invoiceViaApi();

    vi.spyOn(prisma.order, "delete").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await remove(created.id);
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    expect(await ctx.findInvoice(created.id)).not.toBeNull();
    expect(await orderExists(created.order_id)).toBe(true);
    expect(await countItems(created.order_id)).toBe(1);
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and delete nothing when %s",
    async (_label, buildAuthorization) => {
      const created = await ctx.invoiceViaApi();

      const result = await remove(created.id, {
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      expect(await ctx.findInvoice(created.id)).not.toBeNull();
      expect(await orderExists(created.order_id)).toBe(true);
    },
  );
});
