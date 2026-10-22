import { describe, expect, test } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  INVOICE_KEYS,
  setupOrderTest,
  unauthorizedCases,
} from "./helper.js";

describe("get /invoices", () => {
  const ctx = setupOrderTest();

  // Semua query diisolasi dengan search = tag, supaya data lain di DB nggak ikut
  const list = (query = {}, options = {}) =>
    ctx.send("get", "/invoices", {
      query: { search: ctx.tag, ...query },
      ...options,
    });

  const names = (result) => result.body.data.map((invoice) => invoice.customer_name);

  // ---------- Bentuk respons dan urutan ----------

  test("should return invoices with paging info and only the list fields", async () => {
    await ctx.seedInvoice({ cameraNames: ["Cam 1", "Cam 2"] });

    const result = await list();

    expect(result.status).toBe(200);
    expect(result.body.paging).toEqual({
      page: 1,
      per_page: 20,
      total: 1,
      total_pages: 1,
    });

    const invoice = result.body.data[0];
    const expectedKeys = [
      ...INVOICE_KEYS.filter((key) => key !== "items"),
      "item_count",
    ];
    expect(Object.keys(invoice).sort()).toEqual(expectedKeys.sort());
    expect(invoice.subtotal).toBe("2000000");
    expect(invoice.item_count).toBe(2);
  });

  test("should sort by newest first", async () => {
    await ctx.seedInvoice({ customer: "lama", createdAt: new Date("2026-01-01T00:00:00Z") });
    await ctx.seedInvoice({ customer: "baru", createdAt: new Date("2026-03-01T00:00:00Z") });
    await ctx.seedInvoice({ customer: "tengah", createdAt: new Date("2026-02-01T00:00:00Z") });

    const result = await list();

    expect(names(result)).toEqual([
      ctx.name("baru"),
      ctx.name("tengah"),
      ctx.name("lama"),
    ]);
  });

  test("should include invoices made through the public order and the admin endpoint", async () => {
    await ctx.orderViaApi();
    await ctx.invoiceViaApi();

    const result = await list();

    expect(result.status).toBe(200);
    expect(result.body.paging.total).toBe(2);
  });

  // ---------- Search ----------

  test("should search by customer name (case insensitive, partial)", async () => {
    await ctx.seedInvoice({ customer: "Budi Santoso" });
    await ctx.seedInvoice({ customer: "Siti" });

    const result = await list({ search: `${ctx.tag}_budi sant` });
    const upper = await list({ search: `${ctx.tag}_BUDI` });

    expect(names(result)).toEqual([ctx.name("Budi Santoso")]);
    expect(upper.body.paging.total).toBe(1);
  });

  test("should search by camera name from the item snapshot", async () => {
    await ctx.seedInvoice({
      customer: "a",
      cameraNames: [`Fujifilm X-T5 ${ctx.tag}`],
    });
    await ctx.seedInvoice({
      customer: "b",
      cameraNames: [`Sony A7 IV ${ctx.tag}`],
    });

    const result = await list({ search: `fujifilm x-t5 ${ctx.tag}` });

    expect(names(result)).toEqual([ctx.name("a")]);
  });

  test("should search the snapshot name, not the current camera name", async () => {
    await ctx.seedInvoice({
      customer: "a",
      cameraNames: [`Fujifilm X-T5 ${ctx.tag}`],
    });

    // Kamera yang dirujuk item berganti nama
    await prisma.camera.update({
      where: { id: ctx.cameraA.id },
      data: { name: `Sony ZV-E10 ${ctx.tag}` },
    });

    const oldName = await list({ search: `Fujifilm X-T5 ${ctx.tag}` });
    const newName = await list({ search: `Sony ZV-E10 ${ctx.tag}` });

    expect(oldName.body.paging.total).toBe(1);
    expect(newName.body.paging.total).toBe(0);
  });

  test("should search by invoice number", async () => {
    const invoice = await ctx.seedInvoice({ customer: "a" });
    await ctx.seedInvoice({ customer: "b" });

    const result = await ctx.send("get", "/invoices", {
      query: { search: invoice.no_invoice.toLowerCase() },
    });

    expect(result.status).toBe(200);
    expect(result.body.data.map((row) => row.id)).toEqual([invoice.id]);
  });

  test("should return each invoice once when several items match", async () => {
    await ctx.seedInvoice({
      cameraNames: [`Canon A ${ctx.tag}`, `Canon B ${ctx.tag}`],
    });

    const result = await list({ search: `canon ` });
    const scoped = await list({ search: ctx.tag });

    expect(result.status).toBe(200);
    expect(scoped.body.data).toHaveLength(1);
    expect(scoped.body.paging.total).toBe(1);
  });

  test("should return an empty list when nothing matches", async () => {
    await ctx.seedInvoice();

    const result = await list({ search: `tidak_ada_${ctx.tag}` });

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual([]);
    expect(result.body.paging.total).toBe(0);
    expect(result.body.paging.total_pages).toBe(0);
  });

  // ---------- Filter tanggal (WIB) ----------

  describe("created_from and created_to", () => {
    // Batas hari WIB: 11 Jan 00:00 WIB = 10 Jan 17:00 UTC
    const seedBoundaries = async () => {
      await ctx.seedInvoice({ customer: "a", createdAt: new Date("2026-01-10T16:59:59Z") }); // 10 Jan 23:59:59 WIB
      await ctx.seedInvoice({ customer: "b", createdAt: new Date("2026-01-10T17:00:00Z") }); // 11 Jan 00:00:00 WIB
      await ctx.seedInvoice({ customer: "c", createdAt: new Date("2026-01-11T16:59:59Z") }); // 11 Jan 23:59:59 WIB
      await ctx.seedInvoice({ customer: "d", createdAt: new Date("2026-01-11T17:00:00Z") }); // 12 Jan 00:00:00 WIB
    };

    test("should filter from a date (inclusive, WIB)", async () => {
      await seedBoundaries();

      const result = await list({ created_from: "2026-01-11" });

      expect(names(result).sort()).toEqual(
        [ctx.name("b"), ctx.name("c"), ctx.name("d")].sort(),
      );
    });

    test("should filter to a date (inclusive until the end of the day, WIB)", async () => {
      await seedBoundaries();

      const result = await list({ created_to: "2026-01-11" });

      expect(names(result).sort()).toEqual(
        [ctx.name("a"), ctx.name("b"), ctx.name("c")].sort(),
      );
    });

    test("should return exactly one day when from and to are the same", async () => {
      await seedBoundaries();

      const result = await list({
        created_from: "2026-01-11",
        created_to: "2026-01-11",
      });

      expect(names(result).sort()).toEqual([ctx.name("b"), ctx.name("c")].sort());
    });

    test.each([
      ["created_from is not a date", { created_from: "abc" }],
      ["created_from has the wrong format", { created_from: "11-01-2026" }],
      ["created_from has a month 13", { created_from: "2026-13-01" }],
      ["created_to is a date that does not exist", { created_to: "2026-02-30" }],
      ["created_to includes a time", { created_to: "2026-01-11T10:00:00Z" }],
    ])("should return 400 when %s", async (_label, query) => {
      const result = await list(query);

      expect(result.status).toBe(400);
    });

    test("should return invalid date range when created_from is after created_to", async () => {
      const result = await list({
        created_from: "2026-02-01",
        created_to: "2026-01-01",
      });

      expect(result.status).toBe(400);
      expect(result.body.errors).toBe("INVALID_DATE_RANGE");
    });
  });

  // ---------- is_final dan kombinasi ----------

  test("should filter by is_final", async () => {
    await ctx.seedInvoice({ customer: "draft", isFinal: false });
    await ctx.seedInvoice({ customer: "final", isFinal: true });

    const final = await list({ is_final: "true" });
    const draft = await list({ is_final: "false" });

    expect(names(final)).toEqual([ctx.name("final")]);
    expect(names(draft)).toEqual([ctx.name("draft")]);
  });

  test("should combine search, date and is_final", async () => {
    await ctx.seedInvoice({
      customer: "cocok",
      cameraNames: [`Canon R50 ${ctx.tag}`],
      createdAt: new Date("2026-05-10T05:00:00Z"),
      isFinal: true,
    });
    await ctx.seedInvoice({
      customer: "salah_tanggal",
      cameraNames: [`Canon R50 ${ctx.tag}`],
      createdAt: new Date("2026-06-10T05:00:00Z"),
      isFinal: true,
    });
    await ctx.seedInvoice({
      customer: "salah_final",
      cameraNames: [`Canon R50 ${ctx.tag}`],
      createdAt: new Date("2026-05-10T05:00:00Z"),
      isFinal: false,
    });

    const result = await list({
      search: `canon r50 ${ctx.tag}`,
      created_from: "2026-05-01",
      created_to: "2026-05-31",
      is_final: "true",
    });

    expect(names(result)).toEqual([ctx.name("cocok")]);
  });

  // ---------- Paginasi ----------

  test("should paginate 20 invoices per page", async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        ctx.seedInvoice({
          customer: `p${String(i).padStart(2, "0")}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
        }),
      ),
    );

    const page1 = await list({ page: 1 });
    const page2 = await list({ page: 2 });
    const page3 = await list({ page: 3 });

    expect(page1.body.data).toHaveLength(20);
    expect(page1.body.paging).toEqual({
      page: 1,
      per_page: 20,
      total: 25,
      total_pages: 2,
    });
    expect(page2.body.data).toHaveLength(5);
    expect(page2.body.paging.page).toBe(2);

    // Halaman di luar jangkauan: 200 dengan data kosong, bukan error
    expect(page3.status).toBe(200);
    expect(page3.body.data).toHaveLength(0);

    // Urutan stabil: nggak ada invoice yang muncul di dua halaman
    const ids1 = page1.body.data.map((invoice) => invoice.id);
    const ids2 = page2.body.data.map((invoice) => invoice.id);
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0);
  });

  // ---------- Validasi ----------

  test.each([
    ["page is 0", { page: 0 }],
    ["page is not a number", { page: "abc" }],
    ["search is longer than 100 chars", { search: "a".repeat(101) }],
    ["is_final is invalid", { is_final: "mungkin" }],
    ["an unknown query parameter is sent", { foo: "bar" }],
  ])("should return 400 when %s", async (_label, query) => {
    const result = await list(query);

    expect(result.status).toBe(400);
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized when %s",
    async (_label, buildAuthorization) => {
      const result = await list(
        {},
        { authorization: buildAuthorization(ctx.accessToken) },
      );

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
    },
  );
});