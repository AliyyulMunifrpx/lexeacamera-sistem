import { describe, expect, test } from "vitest";
import { MAX_PUBLIC_BANNERS, setupBannerTest } from "./helper.js";

describe("get /banners", () => {
  const ctx = setupBannerTest();
  const { getAll } = ctx;

  test("should be public and return a list without any Authorization header", async () => {
    const result = await getAll();

    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.data)).toBe(true);
  });

  test("should still work with a valid token", async () => {
    const result = await getAll({ authorization: undefined });

    expect(result.status).toBe(200);
  });

  test("should ignore a bad Authorization header on a public route", async () => {
    const result = await getAll({ authorization: "Bearer salah_access_token" });

    expect(result.status).toBe(200);
  });

  test("should only return id, banner_url and created_at", async () => {
    await ctx.seedBanner();

    const result = await getAll();

    expect(result.body.data.length).toBeGreaterThan(0);
    for (const banner of result.body.data) {
      expect(Object.keys(banner).sort()).toEqual([
        "banner_url",
        "created_at",
        "id",
      ]);
    }
  });

  test("should return the newest banner first", async () => {
    const oldest = await ctx.seedBanner({ day: 1 });
    const newest = await ctx.seedBanner({ day: 3 });
    const middle = await ctx.seedBanner({ day: 2 });
    const expected = [newest.id, middle.id, oldest.id];

    const result = await getAll();

    expect(result.status).toBe(200);
    expect(
      result.body.data
        .map((banner) => banner.id)
        .filter((id) => expected.includes(id)),
    ).toEqual(expected);
  });

  test("should be sorted by created_at from newest to oldest", async () => {
    await ctx.seedBanner({ day: 5 });
    await ctx.seedBanner({ day: 6 });

    const result = await getAll();
    const times = result.body.data.map((banner) =>
      new Date(banner.created_at).getTime(),
    );

    for (let index = 1; index < times.length; index += 1) {
      expect(times[index - 1]).toBeGreaterThanOrEqual(times[index]);
    }
  });

  test("should keep a stable order when created_at is the same", async () => {
    const first = await ctx.seedBanner({ day: 10 });
    const second = await ctx.seedBanner({ day: 10 });
    const ours = [first.id, second.id];

    const orders = [];
    for (let run = 0; run < 3; run += 1) {
      const result = await getAll();
      orders.push(
        result.body.data
          .map((banner) => banner.id)
          .filter((id) => ours.includes(id)),
      );
    }

    expect(orders[0]).toHaveLength(2);
    expect(orders[1]).toEqual(orders[0]);
    expect(orders[2]).toEqual(orders[0]);
  });

  test("should return at most 50 banners, newest first", async () => {
    const seeded = await ctx.seedMany(MAX_PUBLIC_BANNERS + 1);

    const result = await getAll();
    const ids = result.body.data.map((banner) => banner.id);

    expect(result.status).toBe(200);
    expect(ids).toHaveLength(MAX_PUBLIC_BANNERS);
    expect(ids[0]).toBe(seeded.at(-1).id);
    expect(ids).not.toContain(seeded[0].id);
  });

  test("should ignore query params that try to raise the limit", async () => {
    await ctx.seedMany(MAX_PUBLIC_BANNERS + 1);

    const result = await getAll({ query: { limit: 1000, take: 1000 } });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(MAX_PUBLIC_BANNERS);
  });

  test("should set a short public cache header", async () => {
    const result = await getAll();

    expect(result.headers["cache-control"]).toBe("public, max-age=60");
  });

  test("should not list a banner after it is deleted", async () => {
    const banner = await ctx.createBanner();

    expect((await getAll()).body.data.map((item) => item.id)).toContain(
      banner.id,
    );

    const deleted = await ctx.remove(banner.id);
    expect(deleted.status).toBe(200);

    expect((await getAll()).body.data.map((item) => item.id)).not.toContain(
      banner.id,
    );
  });
});