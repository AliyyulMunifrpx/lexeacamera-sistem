import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  BUCKET,
  bannerFile,
  expectNoNewFolders,
  fileName,
  invalidImageCases,
  listStoreFolders,
  logoFile,
  setupStoreTest,
  storeFiles,
  unauthorizedCases,
} from "./helper.js";

describe("post /store", () => {
  const ctx = setupStoreTest();
  const { post, send, validFields, createViaPrisma, countStores, findStore } =
    ctx;

  test("should can create store with logo and banner", async () => {
    const result = await post(validFields(), {
      logo: logoFile,
      banner: bannerFile,
    });

    expect(result.status).toBe(201);

    const data = result.body.data;
    expect(data).toMatchObject(validFields());
    expect(data.logo_url).toContain(`/${BUCKET}/store/${data.id}/logo-`);
    expect(data.main_banner_url).toContain(
      `/${BUCKET}/store/${data.id}/banner-`,
    );
    expect(data.logo_url.endsWith(".webp")).toBe(true);
    expect(data.main_banner_url.endsWith(".webp")).toBe(true);

    // File benar-benar ada di bucket, cuma dua itu
    expect(await storeFiles(data.id)).toEqual(
      [fileName(data.logo_url), fileName(data.main_banner_url)].sort(),
    );
    expect(await findStore(data.id)).toEqual(data);
  });

  test("should can create store with logo only", async () => {
    const result = await post();

    expect(result.status).toBe(201);
    expect(result.body.data.main_banner_url).toBeNull();
    expect(await storeFiles(result.body.data.id)).toEqual([
      fileName(result.body.data.logo_url),
    ]);
  });

  test("should return all store fields and nothing else", async () => {
    const result = await post();

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

  test("should save optional fields as null when only the required fields are sent", async () => {
    const result = await post({
      name: validFields().name,
      terms_and_condition: "Syarat",
    });

    expect(result.status).toBe(201);
    for (const field of [
      "instagram",
      "whatsapp",
      "tiktok",
      "facebook",
      "address",
    ]) {
      expect(result.body.data[field]).toBeNull();
    }
  });

  test("should save empty strings as null", async () => {
    const result = await post({
      ...validFields(),
      instagram: "",
      whatsapp: "",
      tiktok: "",
      facebook: "",
      address: "",
    });

    expect(result.status).toBe(201);
    for (const field of [
      "instagram",
      "whatsapp",
      "tiktok",
      "facebook",
      "address",
    ]) {
      expect(result.body.data[field]).toBeNull();
    }
  });

  test("should trim text fields", async () => {
    const result = await post({
      ...validFields(),
      name: `  ${validFields().name}  `,
      terms_and_condition: "  Syarat  ",
      instagram: "  @toko  ",
    });

    expect(result.status).toBe(201);
    expect(result.body.data.name).toBe(validFields().name);
    expect(result.body.data.terms_and_condition).toBe("Syarat");
    expect(result.body.data.instagram).toBe("@toko");
  });

  test("should accept terms_and_condition of exactly 3000 chars", async () => {
    const result = await post({
      ...validFields(),
      terms_and_condition: "a".repeat(3000),
    });

    expect(result.status).toBe(201);
  });

  // ---------- Hanya satu toko ----------

  test("should return store already exist and upload nothing when a store exists", async () => {
    const existing = await createViaPrisma();
    const before = await listStoreFolders();

    const result = await post();

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("STORE_ALREADY_EXIST");
    expect(await countStores()).toBe(1);
    await ctx.expectUnchanged(existing);
    await expectNoNewFolders(before);
  });

  test("should create only one store when two creates run at the same time", async () => {
    const before = await listStoreFolders();

    const results = await Promise.all([post(), post()]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);

    const winner = results.find((result) => result.status === 201).body.data;
    expect(results.find((result) => result.status === 409).body.errors).toBe(
      "STORE_ALREADY_EXIST",
    );
    expect(await countStores()).toBe(1);

    // Yang kalah nggak boleh meninggalkan file yatim: cuma folder pemenang yang baru
    const after = await listStoreFolders();
    expect(after.filter((name) => !before.includes(name))).toEqual([winner.id]);
  });

  test("should remove the uploaded images when saving fails", async () => {
    const before = await listStoreFolders();

    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await post(validFields(), {
      logo: logoFile,
      banner: bannerFile,
    });
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    expect(await countStores()).toBe(0);
    await expectNoNewFolders(before);
  });

  // ---------- Validasi ----------

  test.each([
    ["name is missing", { name: undefined }],
    ["name is blank", { name: "   " }],
    ["name is longer than 100 chars", { name: "a".repeat(101) }],
    ["terms_and_condition is missing", { terms_and_condition: undefined }],
    ["terms_and_condition is blank", { terms_and_condition: "   " }],
    [
      "terms_and_condition is longer than 3000 chars",
      { terms_and_condition: "a".repeat(3001) },
    ],
    ["instagram is longer than 100 chars", { instagram: "a".repeat(101) }],
    ["whatsapp is longer than 100 chars", { whatsapp: "a".repeat(101) }],
    ["tiktok is longer than 100 chars", { tiktok: "a".repeat(101) }],
    ["facebook is longer than 100 chars", { facebook: "a".repeat(101) }],
    ["address is longer than 255 chars", { address: "a".repeat(256) }],
    ["an unknown field is sent", { foo: "bar" }],
    ["id is sent", { id: crypto.randomUUID() }],
    ["logo_url is sent as text", { logo_url: "https://example.com/x.png" }],
    [
      "main_banner_url is sent as text",
      { main_banner_url: "https://example.com/x.png" },
    ],
    ["remove_main_banner is sent", { remove_main_banner: "true" }],
  ])("should return 400 when %s", async (_label, overrides) => {
    const before = await listStoreFolders();

    const result = await post({ ...validFields(), ...overrides });

    expect(result.status).toBe(400);
    expect(await countStores()).toBe(0);
    await expectNoNewFolders(before);
  });

  // ---------- Gambar ----------

  test("should return logo required when no logo is sent", async () => {
    const result = await post(validFields(), {});

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("LOGO_REQUIRED");
    expect(await countStores()).toBe(0);
  });

  test("should return logo required when only a banner is sent", async () => {
    const before = await listStoreFolders();

    const result = await post(validFields(), { banner: bannerFile });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("LOGO_REQUIRED");
    expect(await countStores()).toBe(0);
    await expectNoNewFolders(before);
  });

  test("should return logo required when the request is plain JSON", async () => {
    const result = await send("post", "/store").send(validFields());

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("LOGO_REQUIRED");
  });

  test.each(invalidImageCases)(
    "should return 400 and create nothing when %s",
    async (_label, options, errors) => {
      const before = await listStoreFolders();

      const result = await post(validFields(), options);

      expect(result.status).toBe(400);
      expect(errors).toContain(result.body.errors);
      expect(await countStores()).toBe(0);
      // Termasuk saat logo valid tapi banner rusak: logo nggak boleh sempat ter-upload
      await expectNoNewFolders(before);
    },
  );

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and create nothing when %s",
    async (_label, buildAuthorization) => {
      const before = await listStoreFolders();

      const result = await send("post", "/store", {
        fields: validFields(),
        logo: logoFile,
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      expect(await countStores()).toBe(0);
      await expectNoNewFolders(before);
    },
  );
});
