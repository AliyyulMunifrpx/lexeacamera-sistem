import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  BUCKET,
  bannerFile,
  bannerFiles,
  expectNoNewFolders,
  fileName,
  invalidBannerCases,
  invalidIds,
  jpegFile,
  largeFile,
  listBannerFolders,
  mockStorageDown,
  setupBannerTest,
  storedMetadata,
  unauthorizedCases,
} from "./helper.js";

describe("patch /banners/:id", () => {
  const ctx = setupBannerTest();
  const { patch, remove, findBanner } = ctx;

  test("should can replace the image and remove the old file", async () => {
    const banner = await ctx.createBanner();
    const oldName = fileName(banner.banner_url);

    const result = await patch(banner.id, {}, { banner: jpegFile });

    expect(result.status).toBe(200);

    const { banner_url } = result.body.data;
    expect(result.body.data.id).toBe(banner.id);
    expect(banner_url).not.toBe(banner.banner_url);
    expect(banner_url).toContain(`/${BUCKET}/banners/${banner.id}/`);
    expect(banner_url.endsWith(".webp")).toBe(true);

    // Hanya file baru yang tersisa
    expect(await bannerFiles(banner.id)).toEqual([fileName(banner_url)]);
    expect(await bannerFiles(banner.id)).not.toContain(oldName);
    expect(await findBanner(banner.id)).toEqual(result.body.data);
  });

  test("should only return id, banner_url and created_at", async () => {
    const banner = await ctx.createBanner();

    const result = await patch(banner.id);

    expect(Object.keys(result.body.data).sort()).toEqual([
      "banner_url",
      "created_at",
      "id",
    ]);
  });

  test("should keep created_at so the banner keeps its position", async () => {
    const banner = await ctx.createBanner();

    const result = await patch(banner.id);

    expect(result.status).toBe(200);
    expect(result.body.data.created_at).toBe(banner.created_at);
  });

  test("should shrink a large image to fit inside 1600 x 1600", async () => {
    const banner = await ctx.createBanner();

    const result = await patch(banner.id, {}, { banner: largeFile });

    expect(result.status).toBe(200);

    const metadata = await storedMetadata(result.body.data);
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
  });

  test("should not touch other banners", async () => {
    const banner = await ctx.createBanner();
    const other = await ctx.createBanner();

    const result = await patch(banner.id);

    expect(result.status).toBe(200);
    await ctx.expectUnchanged(other);
    expect(await bannerFiles(other.id)).toEqual([fileName(other.banner_url)]);
  });

  test("should ignore id, banner_url and created_at sent by the client", async () => {
    const banner = await ctx.createBanner();
    const other = await ctx.createBanner();

    const result = await patch(banner.id, {
      id: other.id,
      banner_url: "https://example.com/evil.png",
      created_at: "2000-01-01T00:00:00.000Z",
    });

    expect(result.status).toBe(200);
    expect(result.body.data.id).toBe(banner.id);
    expect(result.body.data.banner_url).toContain(
      `/${BUCKET}/banners/${banner.id}/`,
    );
    expect(result.body.data.created_at).toBe(banner.created_at);
    await ctx.expectUnchanged(other);
  });

  // ---------- URL lama dari luar bucket ----------

  test("should replace a banner whose old url is not from our bucket", async () => {
    const seeded = await ctx.seedBanner();

    const result = await patch(seeded.id);

    expect(result.status).toBe(200);
    expect(await bannerFiles(seeded.id)).toEqual([
      fileName(result.body.data.banner_url),
    ]);
  });

  test("should never delete another banner's file through a crafted old url", async () => {
    const victim = await ctx.createBanner();
    const seeded = await ctx.seedBanner({ url: victim.banner_url });

    const result = await patch(seeded.id);

    expect(result.status).toBe(200);
    expect(await bannerFiles(victim.id)).toEqual([fileName(victim.banner_url)]);
  });

  test("should never delete a file through a path traversal old url", async () => {
    const victim = await ctx.createBanner();
    const seeded = await ctx.seedBanner({
      url: `https://example.com/storage/v1/object/public/${BUCKET}/banners/x/../${victim.id}/${fileName(victim.banner_url)}`,
    });
    // Path traversal harus berada di bawah folder banner yang sedang diedit
    await prisma.banner.update({
      where: { id: seeded.id },
      data: {
        banner_url: `https://example.com/storage/v1/object/public/${BUCKET}/banners/${seeded.id}/../${victim.id}/${fileName(victim.banner_url)}`,
      },
    });

    const result = await patch(seeded.id);

    expect(result.status).toBe(200);
    expect(await bannerFiles(victim.id)).toEqual([fileName(victim.banner_url)]);
  });

  // ---------- Nggak ketemu / id salah ----------

  test("should return banner not found and upload nothing", async () => {
    const before = await listBannerFolders();

    const result = await patch(crypto.randomUUID());

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("BANNER_NOT_FOUND");
    await expectNoNewFolders(before);
  });

  test.each(invalidIds)("should return 400 when the id is %s", async (id) => {
    const before = await listBannerFolders();

    const result = await patch(id);

    expect(result.status).toBe(400);
    await expectNoNewFolders(before);
  });

  // ---------- Gambar ----------

  test("should return image required and change nothing when no image is sent", async () => {
    const banner = await ctx.createBanner();

    const result = await patch(banner.id, {}, {});

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("BANNER_IMAGE_REQUIRED");
    await ctx.expectUnchanged(banner);
    expect(await bannerFiles(banner.id)).toEqual([fileName(banner.banner_url)]);
  });

  test.each(invalidBannerCases)(
    "should return 400 and change nothing when %s",
    async (_label, options, errors) => {
      const banner = await ctx.createBanner();

      const result = await patch(banner.id, {}, options);

      expect(result.status).toBe(400);
      expect(errors).toContain(result.body.errors);
      await ctx.expectUnchanged(banner);
      expect(await bannerFiles(banner.id)).toEqual([
        fileName(banner.banner_url),
      ]);
    },
  );

  // ---------- Gagal di tengah jalan ----------

  test("should remove the new file and keep the old one when the transaction fails", async () => {
    const banner = await ctx.createBanner();

    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await patch(banner.id);
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await ctx.expectUnchanged(banner);
    expect(await bannerFiles(banner.id)).toEqual([fileName(banner.banner_url)]);
  });

  test("should still succeed when removing the old file fails", async () => {
    const banner = await ctx.createBanner();
    mockStorageDown();

    const result = await patch(banner.id);
    vi.restoreAllMocks();

    expect(result.status).toBe(200);
    expect((await findBanner(banner.id)).banner_url).toBe(
      result.body.data.banner_url,
    );

    // File lama jadi yatim, tapi request tidak gagal
    expect(await bannerFiles(banner.id)).toHaveLength(2);
  });

  // ---------- Bersamaan ----------

  test("should leave exactly one file when two updates run at the same time", async () => {
    const banner = await ctx.createBanner();

    const results = await Promise.all([
      patch(banner.id),
      patch(banner.id, {}, { banner: jpegFile }),
    ]);

    expect(results.map((result) => result.status)).toEqual([200, 200]);

    const row = await findBanner(banner.id);
    expect(await bannerFiles(banner.id)).toEqual([fileName(row.banner_url)]);
  });

  test("should leave nothing behind when an update and a delete run at the same time", async () => {
    const banner = await ctx.createBanner();

    const [patchResult, deleteResult] = await Promise.all([
      patch(banner.id),
      remove(banner.id),
    ]);

    expect(deleteResult.status).toBe(200);
    expect([200, 404]).toContain(patchResult.status);
    expect(await findBanner(banner.id)).toBeNull();
    expect(await bannerFiles(banner.id)).toEqual([]);
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and change nothing when %s",
    async (_label, buildAuthorization) => {
      const banner = await ctx.createBanner();

      const result = await patch(
        banner.id,
        {},
        {
          banner: bannerFile,
          authorization: buildAuthorization(ctx.accessToken),
        },
      );

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      await ctx.expectUnchanged(banner);
      expect(await bannerFiles(banner.id)).toEqual([
        fileName(banner.banner_url),
      ]);
    },
  );
});
