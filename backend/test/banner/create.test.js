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
  jpegFile,
  largeFile,
  listBannerFolders,
  setupBannerTest,
  storedMetadata,
  tallFile,
  unauthorizedCases,
  webpFile,
} from "./helper.js";

describe("post /banners", () => {
  const ctx = setupBannerTest();
  const { post, send, findBanner, countBanners } = ctx;

  test("should can create banner and upload the image", async () => {
    const result = await post();

    expect(result.status).toBe(201);

    const { id, banner_url, created_at } = result.body.data;
    ctx.createdIds.push(id);

    expect(banner_url).toContain(`/${BUCKET}/banners/${id}/`);
    expect(banner_url.endsWith(".webp")).toBe(true);
    expect(Math.abs(Date.now() - new Date(created_at).getTime())).toBeLessThan(
      60_000,
    );

    // File benar-benar ada di bucket, satu-satunya
    expect(await bannerFiles(id)).toEqual([fileName(banner_url)]);
    expect(await findBanner(id)).toEqual(result.body.data);
  });

  test("should only return id, banner_url and created_at", async () => {
    const result = await post();
    ctx.createdIds.push(result.body.data?.id);

    expect(Object.keys(result.body.data).sort()).toEqual([
      "banner_url",
      "created_at",
      "id",
    ]);
  });

  test.each([
    ["png", bannerFile],
    ["jpeg", jpegFile],
    ["webp", webpFile],
  ])("should accept a %s image", async (_label, file) => {
    const result = await post({}, { banner: file });
    ctx.createdIds.push(result.body.data?.id);

    expect(result.status).toBe(201);
    expect((await storedMetadata(result.body.data)).format).toBe("webp");
  });

  test("should shrink a large image to fit inside 1600 x 1600", async () => {
    const result = await post({}, { banner: largeFile });
    ctx.createdIds.push(result.body.data?.id);

    expect(result.status).toBe(201);

    const metadata = await storedMetadata(result.body.data);
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(800);
  });

  test("should keep the aspect ratio of a tall image", async () => {
    const result = await post({}, { banner: tallFile });
    ctx.createdIds.push(result.body.data?.id);

    expect(result.status).toBe(201);

    const metadata = await storedMetadata(result.body.data);
    expect(metadata.height).toBe(1600);
    expect(Math.abs(metadata.width - 533)).toBeLessThanOrEqual(1);
  });

  test("should not enlarge a small image", async () => {
    const result = await post();
    ctx.createdIds.push(result.body.data?.id);

    const metadata = await storedMetadata(result.body.data);
    expect(metadata.width).toBe(800);
    expect(metadata.height).toBe(400);
  });

  test("should ignore id, banner_url and created_at sent by the client", async () => {
    const sentId = crypto.randomUUID();

    const result = await post({
      id: sentId,
      banner_url: "https://example.com/evil.png",
      created_at: "2000-01-01T00:00:00.000Z",
    });
    ctx.createdIds.push(result.body.data?.id);

    expect(result.status).toBe(201);
    expect(result.body.data.id).not.toBe(sentId);
    expect(result.body.data.banner_url).toContain(`/${BUCKET}/banners/`);
    expect(new Date(result.body.data.created_at).getFullYear()).not.toBe(2000);
    expect(await findBanner(sentId)).toBeNull();
  });

  test("should give every banner its own folder", async () => {
    const first = await ctx.createBanner();
    const second = await ctx.createBanner();

    expect(first.id).not.toBe(second.id);
    expect(await bannerFiles(first.id)).toHaveLength(1);
    expect(await bannerFiles(second.id)).toHaveLength(1);
  });

  test("should create every banner when several creates run at the same time", async () => {
    const results = await Promise.all([post(), post(), post()]);
    const ids = results.map((result) => result.body.data?.id);
    ctx.createdIds.push(...ids);

    expect(results.map((result) => result.status)).toEqual([201, 201, 201]);
    expect(new Set(ids).size).toBe(3);

    for (const id of ids) {
      expect(await bannerFiles(id)).toHaveLength(1);
    }
  });

  test("should remove the uploaded image when saving fails", async () => {
    const before = await listBannerFolders();
    const count = await countBanners();

    vi.spyOn(prisma.banner, "create").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await post();
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await expectNoNewFolders(before);
    expect(await countBanners()).toBe(count);
  });

  // ---------- Gambar ----------

  test("should return image required when no image is sent", async () => {
    const before = await listBannerFolders();
    const count = await countBanners();

    const result = await post({}, {});

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("BANNER_IMAGE_REQUIRED");
    expect(await countBanners()).toBe(count);
    await expectNoNewFolders(before);
  });

  test("should return image required when only text fields are sent", async () => {
    const result = await post({ foo: "bar" }, {});

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("BANNER_IMAGE_REQUIRED");
  });

  test("should return image required when the request is plain JSON", async () => {
    const result = await send("post", "/banners", {}).send({ foo: "bar" });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("BANNER_IMAGE_REQUIRED");
  });

  test.each(invalidBannerCases)(
    "should return 400 and create nothing when %s",
    async (_label, options, errors) => {
      const before = await listBannerFolders();
      const count = await countBanners();

      const result = await post({}, options);

      expect(result.status).toBe(400);
      expect(errors).toContain(result.body.errors);
      expect(await countBanners()).toBe(count);
      await expectNoNewFolders(before);
    },
  );

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and create nothing when %s",
    async (_label, buildAuthorization) => {
      const before = await listBannerFolders();
      const count = await countBanners();

      const result = await post(
        {},
        {
          banner: bannerFile,
          authorization: buildAuthorization(ctx.accessToken),
        },
      );

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      expect(await countBanners()).toBe(count);
      await expectNoNewFolders(before);
    },
  );
});