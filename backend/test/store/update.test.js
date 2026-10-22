import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  BUCKET,
  NAME_PREFIX,
  bannerFile,
  expectNoNewFolders,
  fileName,
  invalidImageCases,
  listStoreFolders,
  logoFile,
  mockStorageDown,
  setupStoreTest,
  storeFiles,
  unauthorizedCases,
} from "./helper.js";

describe("patch /store", () => {
  const ctx = setupStoreTest();
  const {
    send,
    patch,
    createViaApi,
    createViaPrisma,
    findStore,
    expectUnchanged,
  } = ctx;

  const newName = (label = "baru") => `${NAME_PREFIX}${label}_${ctx.tag}`;

  // ---------- Field teks ----------

  test("should only change the fields that are sent", async () => {
    const store = await createViaPrisma({
      instagram: "@lama",
      address: "Alamat lama",
    });

    const result = await patch({ name: newName() });

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ ...store, name: newName() });
    expect(await findStore(store.id)).toEqual({ ...store, name: newName() });
  });

  test("should can update all text fields at once", async () => {
    const store = await createViaPrisma();
    const fields = {
      name: newName("semua"),
      terms_and_condition: "Syarat baru",
      instagram: "@baru",
      whatsapp: "6289999999999",
      tiktok: "@baru_tiktok",
      facebook: "Toko Baru",
      address: "Jl. Baru No. 2",
    };

    const result = await patch(fields);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ ...store, ...fields });
  });

  test("should trim text fields", async () => {
    await createViaPrisma();

    const result = await patch({
      name: `  ${newName("trim")}  `,
      instagram: "  @trim  ",
    });

    expect(result.status).toBe(200);
    expect(result.body.data.name).toBe(newName("trim"));
    expect(result.body.data.instagram).toBe("@trim");
  });

  test("should clear optional fields when an empty string is sent", async () => {
    const store = await createViaPrisma({
      instagram: "@a",
      whatsapp: "1",
      tiktok: "t",
      facebook: "f",
      address: "x",
    });

    const result = await patch({
      instagram: "",
      whatsapp: "",
      tiktok: "",
      facebook: "",
      address: "",
    });

    expect(result.status).toBe(200);
    for (const field of [
      "instagram",
      "whatsapp",
      "tiktok",
      "facebook",
      "address",
    ]) {
      expect(result.body.data[field]).toBeNull();
    }
    // Yang nggak dikirim nggak berubah
    expect(result.body.data.name).toBe(store.name);
    expect(result.body.data.terms_and_condition).toBe(
      store.terms_and_condition,
    );
  });

  test("should return 200 when the values are the same as before", async () => {
    const store = await createViaPrisma();

    const result = await patch({ name: store.name });

    expect(result.status).toBe(200);
    await expectUnchanged(store);
  });

  // ---------- Logo ----------

  test("should replace the logo and remove the old file", async () => {
    const store = await createViaApi();
    const oldLogo = fileName(store.logo_url);

    const result = await patch({}, { logo: logoFile });

    expect(result.status).toBe(200);
    expect(result.body.data.logo_url).not.toBe(store.logo_url);
    expect(result.body.data.logo_url).toContain(
      `/${BUCKET}/store/${store.id}/`,
    );
    // Banner dan field lain nggak tersentuh
    expect(result.body.data.main_banner_url).toBe(store.main_banner_url);
    expect(result.body.data.name).toBe(store.name);

    const files = await storeFiles(store.id);
    expect(files).toEqual(
      [
        fileName(result.body.data.logo_url),
        fileName(store.main_banner_url),
      ].sort(),
    );
    expect(files).not.toContain(oldLogo);
    expect(await findStore(store.id)).toEqual(result.body.data);
  });

  test("should leave only one logo after replacing it twice", async () => {
    const store = await createViaApi();

    await patch({}, { logo: logoFile });
    const result = await patch({}, { logo: logoFile });

    expect(result.status).toBe(200);
    expect(await storeFiles(store.id)).toEqual(
      [
        fileName(result.body.data.logo_url),
        fileName(store.main_banner_url),
      ].sort(),
    );
  });

  test("should replace a logo that is not in the bucket without errors", async () => {
    const store = await createViaPrisma(); // logo_url palsu (example.com)

    const result = await patch({}, { logo: logoFile });

    expect(result.status).toBe(200);
    expect(result.body.data.logo_url).toContain(
      `/${BUCKET}/store/${store.id}/`,
    );
    expect(await storeFiles(store.id)).toEqual([
      fileName(result.body.data.logo_url),
    ]);
  });

  // ---------- Banner ----------

  test("should add a banner to a store that has none", async () => {
    const store = await createViaApi({ banner: false });
    expect(store.main_banner_url).toBeNull();

    const result = await patch({}, { banner: bannerFile });

    expect(result.status).toBe(200);
    expect(result.body.data.main_banner_url).toContain(
      `/${BUCKET}/store/${store.id}/banner-`,
    );
    expect(result.body.data.logo_url).toBe(store.logo_url);
    expect(await storeFiles(store.id)).toHaveLength(2);
  });

  test("should replace the banner and remove the old file", async () => {
    const store = await createViaApi();
    const oldBanner = fileName(store.main_banner_url);

    const result = await patch({}, { banner: bannerFile });

    expect(result.status).toBe(200);
    expect(result.body.data.main_banner_url).not.toBe(store.main_banner_url);
    expect(result.body.data.logo_url).toBe(store.logo_url);

    const files = await storeFiles(store.id);
    expect(files).toEqual(
      [
        fileName(store.logo_url),
        fileName(result.body.data.main_banner_url),
      ].sort(),
    );
    expect(files).not.toContain(oldBanner);
  });

  test("should remove the banner and its file when remove_main_banner is true", async () => {
    const store = await createViaApi();

    const result = await patch({ remove_main_banner: "true" });

    expect(result.status).toBe(200);
    expect(result.body.data.main_banner_url).toBeNull();
    expect(result.body.data.logo_url).toBe(store.logo_url);
    expect(await storeFiles(store.id)).toEqual([fileName(store.logo_url)]);
  });

  test("should return 200 when removing a banner that does not exist", async () => {
    const store = await createViaApi({ banner: false });

    const result = await patch({ remove_main_banner: "true" });

    expect(result.status).toBe(200);
    expect(result.body.data.main_banner_url).toBeNull();
    expect(await storeFiles(store.id)).toEqual([fileName(store.logo_url)]);
  });

  test("should keep the banner when remove_main_banner is false", async () => {
    const store = await createViaApi();

    const result = await patch({
      name: newName(),
      remove_main_banner: "false",
    });

    expect(result.status).toBe(200);
    expect(result.body.data.main_banner_url).toBe(store.main_banner_url);
  });

  test("should return banner conflict when removing and uploading a banner together", async () => {
    const store = await createViaApi();
    const filesBefore = await storeFiles(store.id);

    const result = await patch(
      { remove_main_banner: "true" },
      { banner: bannerFile },
    );

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("BANNER_CONFLICT");
    await expectUnchanged(store);
    expect(await storeFiles(store.id)).toEqual(filesBefore);
  });

  // ---------- Gabungan ----------

  test("should can change the fields, the logo and the banner in one request", async () => {
    const store = await createViaApi();

    const result = await patch(
      { name: newName("semua"), address: "Alamat baru" },
      { logo: logoFile, banner: bannerFile },
    );

    expect(result.status).toBe(200);
    expect(result.body.data.name).toBe(newName("semua"));
    expect(result.body.data.address).toBe("Alamat baru");
    expect(result.body.data.logo_url).not.toBe(store.logo_url);
    expect(result.body.data.main_banner_url).not.toBe(store.main_banner_url);

    // File lama (logo dan banner) hilang, tinggal dua yang baru
    expect(await storeFiles(store.id)).toEqual(
      [
        fileName(result.body.data.logo_url),
        fileName(result.body.data.main_banner_url),
      ].sort(),
    );
  });

  // ---------- Tidak ada yang berubah ----------

  test("should return nothing to update when nothing is sent", async () => {
    const store = await createViaPrisma();

    const empty = await patch({});
    const noBody = await send("patch", "/store");
    const onlyFalse = await patch({ remove_main_banner: "false" });

    for (const result of [empty, noBody, onlyFalse]) {
      expect(result.status).toBe(400);
      expect(result.body.errors).toBe("NOTHING_TO_UPDATE");
    }
    await expectUnchanged(store);
  });

  test("should return store not found and upload nothing when there is no store", async () => {
    const before = await listStoreFolders();

    const result = await patch(
      { name: newName() },
      { logo: logoFile, banner: bannerFile },
    );

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("STORE_NOT_FOUND");
    await expectNoNewFolders(before);
  });

  // ---------- Validasi ----------

  test.each([
    ["an unknown field is sent", { foo: "bar" }],
    ["id is sent", { id: crypto.randomUUID() }],
    ["logo_url is sent as text", { logo_url: "https://example.com/x.png" }],
    [
      "main_banner_url is sent as text",
      { main_banner_url: "https://example.com/x.png" },
    ],
    ["name is blank", { name: "   " }],
    ["name is longer than 100 chars", { name: "a".repeat(101) }],
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
    ["remove_main_banner is not a boolean", { remove_main_banner: "ya" }],
    ["remove_main_banner is empty", { remove_main_banner: "" }],
  ])("should return 400 when %s", async (_label, overrides) => {
    const store = await createViaPrisma();

    // Dasarnya field valid, supaya cuma field bermasalah yang bikin gagal
    const result = await patch({ name: newName("valid"), ...overrides });

    expect(result.status).toBe(400);
    await expectUnchanged(store);
  });

  // ---------- Gambar tidak valid ----------

  test.each(invalidImageCases)(
    "should return 400 and change nothing when %s",
    async (_label, options, errors) => {
      const store = await createViaApi();
      const filesBefore = await storeFiles(store.id);

      const result = await patch({ name: newName() }, options);

      expect(result.status).toBe(400);
      expect(errors).toContain(result.body.errors);
      await expectUnchanged(store); // nama juga nggak boleh berubah
      expect(await storeFiles(store.id)).toEqual(filesBefore);
    },
  );

  // ---------- Kegagalan dan race condition ----------

  test("should keep a consistent state when two logo replacements run at the same time", async () => {
    const store = await createViaApi();

    const results = await Promise.all([
      patch({}, { logo: logoFile }),
      patch({}, { logo: logoFile }),
    ]);

    expect(results.map((result) => result.status)).toEqual([200, 200]);

    // Yang kalah menghapus logo pemenang, jadi sisa satu logo dan satu banner,
    // dan DB menunjuk ke file yang ada
    const inDb = await findStore(store.id);
    expect(await storeFiles(store.id)).toEqual(
      [fileName(inDb.logo_url), fileName(inDb.main_banner_url)].sort(),
    );
  });

  test("should remove the new images and change nothing when the transaction fails", async () => {
    const store = await createViaApi();
    const filesBefore = await storeFiles(store.id);

    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await patch(
      { name: newName() },
      { logo: logoFile, banner: bannerFile },
    );
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await expectUnchanged(store);
    expect(await storeFiles(store.id)).toEqual(filesBefore);
  });

  test("should still return 200 when removing the old logo fails", async () => {
    const store = await createViaApi();

    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorageDown();

    const result = await patch({}, { logo: logoFile });
    vi.restoreAllMocks();

    // DB sudah pakai logo baru walau storage gagal. File lama dibersihkan afterEach.
    expect(result.status).toBe(200);
    const inDb = await findStore(store.id);
    expect(inDb.logo_url).toBe(result.body.data.logo_url);
    expect(inDb.logo_url).not.toBe(store.logo_url);
    expect(await storeFiles(store.id)).toHaveLength(3); // logo lama, logo baru, banner
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and change nothing when %s",
    async (_label, buildAuthorization) => {
      const store = await createViaApi();
      const filesBefore = await storeFiles(store.id);

      const result = await patch(
        { name: newName() },
        {
          logo: logoFile,
          authorization: buildAuthorization(ctx.accessToken),
        },
      );

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      await expectUnchanged(store);
      expect(await storeFiles(store.id)).toEqual(filesBefore);
    },
  );
});
