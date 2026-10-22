import { describe, expect, test } from "vitest";
import { setupStoreTest, unauthorizedCases } from "./helper.js";

describe("get /store", () => {
  const ctx = setupStoreTest();
  const { get, createViaApi, createViaPrisma } = ctx;

  test("should can get the store", async () => {
    const store = await createViaPrisma({
      instagram: "@toko_kamera",
      whatsapp: "6281234567890",
      address: "Jl. Contoh No. 1, Jakarta",
      main_banner_url: "https://example.com/banner.png",
    });

    const result = await get();

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual(store);
  });

  test("should return null for optional fields that are not set", async () => {
    await createViaPrisma();

    const result = await get();

    expect(result.status).toBe(200);
    for (const field of [
      "instagram",
      "whatsapp",
      "tiktok",
      "facebook",
      "address",
      "main_banner_url",
    ]) {
      expect(result.body.data[field]).toBeNull();
    }
  });

  test("should return all store fields and nothing else", async () => {
    await createViaPrisma();

    const result = await get();

    expect(Object.keys(result.body.data).sort()).toEqual([
      "address",
      "facebook",
      "id",
      "instagram",
      "logo_url",
      "main_banner_url",
      "name",
      "terms_and_condition",
      "tiktok",
      "whatsapp",
    ]);
  });

  test("should return a store that was created through the API", async () => {
    const store = await createViaApi();

    const result = await get();

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual(store);
  });

  test("should return store not found when no store exists", async () => {
    const result = await get();

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("STORE_NOT_FOUND");
  });

  test.each(unauthorizedCases)(
    "should return unauthorized when %s",
    async (_label, buildAuthorization) => {
      await createViaPrisma();

      const result = await get({
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
    },
  );
});
