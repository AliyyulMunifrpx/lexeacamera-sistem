import { describe, expect, test } from "vitest";
import {
  setupMarketplaceTest,
  unauthorizedCases,
} from "./helper.js";

describe("get /marketplaces", () => {
  const ctx = setupMarketplaceTest();
  const { send, createMarketplace } = ctx;

  test("should can get all marketplaces with only the public fields", async () => {
    const result = await send("get", "/marketplaces");

    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.data)).toBe(true);

    // DB bisa berisi marketplace lain, jadi cek yang dibuat test ini ada di dalamnya
    expect(result.body.data.map((m) => m.id)).toContain(ctx.target.id);

    for (const marketplace of result.body.data) {
      expect(Object.keys(marketplace).sort()).toEqual([
        "id",
        "is_active",
        "logo_url",
        "name",
      ]);
    }
  });

  test("should order by name", async () => {
    await createMarketplace("mp_b");
    await createMarketplace("mp_a");

    const result = await send("get", "/marketplaces");
    const names = result.body.data
      .map((m) => m.name)
      .filter((name) => name.includes(ctx.tag));

    expect(names).toEqual([
      `mp_a_${ctx.tag}`,
      `mp_b_${ctx.tag}`,
      `mp_target_${ctx.tag}`,
    ]);
  });

  test("should filter by is_active", async () => {
    const inactive = await createMarketplace("mp_inactive", {
      is_active: false,
    });

    const active = await send("get", "/marketplaces", {
      query: { is_active: "true" },
    });
    const notActive = await send("get", "/marketplaces", {
      query: { is_active: "false" },
    });

    const mine = (result) =>
      result.body.data
        .map((m) => m.id)
        .filter((id) => [ctx.target.id, inactive.id].includes(id));

    expect(active.status).toBe(200);
    expect(mine(active)).toEqual([ctx.target.id]);
    expect(notActive.status).toBe(200);
    expect(mine(notActive)).toEqual([inactive.id]);
  });

  test("should return 400 when is_active is invalid", async () => {
    const result = await send("get", "/marketplaces", {
      query: { is_active: "mungkin" },
    });

    expect(result.status).toBe(400);
  });

  test.each(unauthorizedCases)(
    "should return unauthorized when %s",
    async (_label, buildAuthorization) => {
      const result = await send("get", "/marketplaces", {
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
    },
  );
});
