import crypto from "node:crypto";
import { describe, expect, test } from "vitest";
import { invalidIds, setupBannerTest, unauthorizedCases } from "./helper.js";

describe("get /banners/:id", () => {
  const ctx = setupBannerTest();
  const { get, findBanner } = ctx;

  test("should can get a banner", async () => {
    const banner = await ctx.createBanner();

    const result = await get(banner.id);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual(banner);
    expect(await findBanner(banner.id)).toEqual(result.body.data);
  });

  test("should only return id, banner_url and created_at", async () => {
    const banner = await ctx.createBanner();

    const result = await get(banner.id);

    expect(Object.keys(result.body.data).sort()).toEqual([
      "banner_url",
      "created_at",
      "id",
    ]);
  });

  test("should return banner not found when the id does not exist", async () => {
    const result = await get(crypto.randomUUID());

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("BANNER_NOT_FOUND");
  });

  test("should return banner not found when the id differs only in letter case", async () => {
    const banner = await ctx.createBanner();

    const result = await get(banner.id.toUpperCase());

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("BANNER_NOT_FOUND");
  });

  test.each(invalidIds)("should return 400 when the id is %s", async (id) => {
    const result = await get(id);

    expect(result.status).toBe(400);
  });

  test.each(unauthorizedCases)(
    "should return unauthorized when %s",
    async (_label, buildAuthorization) => {
      const banner = await ctx.createBanner();

      const result = await get(banner.id, {
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
    },
  );
});
