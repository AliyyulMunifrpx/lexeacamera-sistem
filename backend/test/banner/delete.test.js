import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  addStrayFile,
  bannerFiles,
  fileName,
  invalidIds,
  mockStorageDown,
  setupBannerTest,
  unauthorizedCases,
} from "./helper.js";

describe("delete /banners/:id", () => {
  const ctx = setupBannerTest();
  const { remove, findBanner } = ctx;

  test("should can delete a banner and its file", async () => {
    const banner = await ctx.createBanner();

    const result = await remove(banner.id);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ message: "BANNER_DELETED" });
    expect(await findBanner(banner.id)).toBeNull();
    expect(await bannerFiles(banner.id)).toEqual([]);
  });

  test("should remove every file in the banner folder, not only the recorded one", async () => {
    const banner = await ctx.createBanner();
    await addStrayFile(banner.id);
    expect(await bannerFiles(banner.id)).toHaveLength(2);

    const result = await remove(banner.id);

    expect(result.status).toBe(200);
    expect(await bannerFiles(banner.id)).toEqual([]);
  });

  test("should not touch other banners", async () => {
    const banner = await ctx.createBanner();
    const other = await ctx.createBanner();

    const result = await remove(banner.id);

    expect(result.status).toBe(200);
    await ctx.expectUnchanged(other);
    expect(await bannerFiles(other.id)).toEqual([fileName(other.banner_url)]);
  });

  test("should delete a banner whose url is not from our bucket", async () => {
    const seeded = await ctx.seedBanner();

    const result = await remove(seeded.id);

    expect(result.status).toBe(200);
    expect(await findBanner(seeded.id)).toBeNull();
  });

  test("should disappear from the public list after delete", async () => {
    const banner = await ctx.createBanner();

    await remove(banner.id);

    const list = await ctx.getAll();
    expect(list.body.data.map((item) => item.id)).not.toContain(banner.id);
  });

  // ---------- Nggak ketemu / id salah ----------

  test("should return banner not found when the id does not exist", async () => {
    const result = await remove(crypto.randomUUID());

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("BANNER_NOT_FOUND");
  });

  test("should return banner not found when deleting the same banner twice", async () => {
    const banner = await ctx.createBanner();

    const first = await remove(banner.id);
    const second = await remove(banner.id);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expect(second.body.errors).toBe("BANNER_NOT_FOUND");
  });

  test.each(invalidIds)("should return 400 when the id is %s", async (id) => {
    const result = await remove(id);

    expect(result.status).toBe(400);
  });

  // ---------- Gagal di tengah jalan ----------

  test("should keep the banner and its file when the database delete fails", async () => {
    const banner = await ctx.createBanner();

    vi.spyOn(prisma.banner, "delete").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await remove(banner.id);
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await ctx.expectUnchanged(banner);
    expect(await bannerFiles(banner.id)).toEqual([fileName(banner.banner_url)]);
  });

  test("should still succeed when cleaning the folder fails", async () => {
    const banner = await ctx.createBanner();
    mockStorageDown();

    const result = await remove(banner.id);
    vi.restoreAllMocks();

    expect(result.status).toBe(200);
    expect(await findBanner(banner.id)).toBeNull();
  });

  // ---------- Bersamaan ----------

  test("should delete only once when two deletes run at the same time", async () => {
    const banner = await ctx.createBanner();

    const results = await Promise.all([remove(banner.id), remove(banner.id)]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 404]);
    expect(await findBanner(banner.id)).toBeNull();
    expect(await bannerFiles(banner.id)).toEqual([]);
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and delete nothing when %s",
    async (_label, buildAuthorization) => {
      const banner = await ctx.createBanner();

      const result = await remove(banner.id, {
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      await ctx.expectUnchanged(banner);
      expect(await bannerFiles(banner.id)).toEqual([
        fileName(banner.banner_url),
      ]);
    },
  );
});
