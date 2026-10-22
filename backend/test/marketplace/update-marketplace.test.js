import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "../../src/lib/database.js";
import {
  BUCKET,
  expectNoNewFolders,
  fileName,
  invalidLogoCases,
  listMarketplaceFolders,
  logoFile,
  logoFiles,
  mockStorageDown,
  setupMarketplaceTest,
  unauthorizedCases,
} from "./helper.js";

describe("patch /marketplaces/:id", () => {
  const ctx = setupMarketplaceTest();
  const {
    send,
    patch,
    remove,
    createViaApi,
    createMarketplace,
    createCamera,
    findMarketplace,
    taggedMarketplaces,
    countLinks,
    expectUnchanged,
  } = ctx;

  // ---------- Field biasa ----------

  test("should only change the fields that are sent", async () => {
    const result = await patch(ctx.target.id, { name: `mp_baru_${ctx.tag}` });

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({
      ...ctx.target,
      name: `mp_baru_${ctx.tag}`,
    });
    expect(await findMarketplace(ctx.target.id)).toEqual({
      ...ctx.target,
      name: `mp_baru_${ctx.tag}`,
    });
  });

  test("should keep is_active false and can turn it back on", async () => {
    const off = await patch(ctx.target.id, { is_active: "false" });
    expect(off.status).toBe(200);
    expect((await findMarketplace(ctx.target.id)).is_active).toBe(false);

    const on = await patch(ctx.target.id, { is_active: "true" });
    expect(on.status).toBe(200);
    expect((await findMarketplace(ctx.target.id)).is_active).toBe(true);
  });

  test("should trim the name", async () => {
    const result = await patch(ctx.target.id, {
      name: `  mp_trim_${ctx.tag}  `,
    });

    expect(result.status).toBe(200);
    expect(result.body.data.name).toBe(`mp_trim_${ctx.tag}`);
  });

  test("should return 200 when the name is the same as its own name", async () => {
    const result = await patch(ctx.target.id, { name: ctx.target.name });

    expect(result.status).toBe(200);
    await expectUnchanged(ctx.target);
  });

  test("should use the id from the path and ignore the id in the body", async () => {
    const other = await createMarketplace("mp_other");

    const result = await patch(ctx.target.id, {
      id: other.id,
      name: `mp_baru_${ctx.tag}`,
    });

    expect(result.status).toBe(200);
    expect(result.body.data.id).toBe(ctx.target.id);
    expect((await findMarketplace(ctx.target.id)).name).toBe(
      `mp_baru_${ctx.tag}`,
    );
    await expectUnchanged(other);
  });

  test("should not change other marketplaces or cameras that use it", async () => {
    const other = await createMarketplace("mp_other");
    await createCamera([ctx.target]);

    await patch(ctx.target.id, {
      name: `mp_baru_${ctx.tag}`,
      is_active: "false",
    });

    await expectUnchanged(other);
    expect(await countLinks(ctx.target.id)).toBe(1);
  });

  // ---------- Nama unik ----------

  test("should return marketplace already exist when the name is taken", async () => {
    const other = await createMarketplace("mp_other");

    const result = await patch(ctx.target.id, { name: other.name });

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("MARKETPLACE_ALREADY_EXIST");
    await expectUnchanged(ctx.target);
    await expectUnchanged(other);
  });

  test("should upload nothing when the name is taken", async () => {
    const m = await createViaApi("mp_logo");
    const other = await createMarketplace("mp_other");
    const filesBefore = await logoFiles(m.id);

    const result = await patch(m.id, { name: other.name }, { logo: logoFile });

    expect(result.status).toBe(409);
    await expectUnchanged(m);
    expect(await logoFiles(m.id)).toEqual(filesBefore);
  });

  test("should keep only one name when two renames to the same name run at the same time", async () => {
    const other = await createMarketplace("mp_other");
    const sameName = `mp_race_${ctx.tag}`;

    const results = await Promise.all([
      patch(ctx.target.id, { name: sameName }),
      patch(other.id, { name: sameName }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(results.find((result) => result.status === 409).body.errors).toBe(
      "MARKETPLACE_ALREADY_EXIST",
    );
    expect(await prisma.marketplace.count({ where: { name: sameName } })).toBe(
      1,
    );
  });

  test("should return already exist and remove the new logo when prisma throws P2002", async () => {
    const m = await createViaApi("mp_logo");
    const filesBefore = await logoFiles(m.id);

    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const result = await patch(
      m.id,
      { name: `x_${ctx.tag}` },
      { logo: logoFile },
    );
    vi.restoreAllMocks();

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("MARKETPLACE_ALREADY_EXIST");
    await expectUnchanged(m);
    expect(await logoFiles(m.id)).toEqual(filesBefore);
  });

  // ---------- Logo ----------

  test("should replace the logo and remove the old file", async () => {
    const m = await createViaApi("mp_logo");
    const oldFile = fileName(m.logo_url);

    const result = await patch(m.id, {}, { logo: logoFile });

    expect(result.status).toBe(200);
    expect(result.body.data.name).toBe(m.name);
    expect(result.body.data.logo_url).not.toBe(m.logo_url);
    expect(result.body.data.logo_url).toContain(
      `/${BUCKET}/marketplaces/${m.id}/`,
    );

    const files = await logoFiles(m.id);
    expect(files).toEqual([fileName(result.body.data.logo_url)]);
    expect(files).not.toContain(oldFile);
    expect(await findMarketplace(m.id)).toEqual(result.body.data);
  });

  test("should can change the fields and the logo in one request", async () => {
    const m = await createViaApi("mp_logo");

    const result = await patch(
      m.id,
      { name: `mp_semua_${ctx.tag}`, is_active: "false" },
      { logo: logoFile },
    );

    expect(result.status).toBe(200);
    expect(result.body.data.name).toBe(`mp_semua_${ctx.tag}`);
    expect(result.body.data.is_active).toBe(false);
    expect(result.body.data.logo_url).not.toBe(m.logo_url);
    expect(await logoFiles(m.id)).toHaveLength(1);
  });

  test("should leave only one file after replacing the logo twice", async () => {
    const m = await createViaApi("mp_logo");

    await patch(m.id, {}, { logo: logoFile });
    const result = await patch(m.id, {}, { logo: logoFile });

    expect(result.status).toBe(200);
    expect(await logoFiles(m.id)).toEqual([
      fileName(result.body.data.logo_url),
    ]);
  });

  test("should not touch the logo when only other fields are sent", async () => {
    const m = await createViaApi("mp_logo");
    const filesBefore = await logoFiles(m.id);

    const result = await patch(m.id, { name: `mp_baru_${ctx.tag}` });

    expect(result.status).toBe(200);
    expect(result.body.data.logo_url).toBe(m.logo_url);
    expect(await logoFiles(m.id)).toEqual(filesBefore);
  });

  test("should keep a consistent logo when two logo replacements run at the same time", async () => {
    const m = await createViaApi("mp_logo");

    const results = await Promise.all([
      patch(m.id, {}, { logo: logoFile }),
      patch(m.id, {}, { logo: logoFile }),
    ]);

    expect(results.map((result) => result.status)).toEqual([200, 200]);

    // Yang kalah menghapus logo pemenang, jadi sisa satu file dan DB menunjuk ke file itu
    const inDb = await findMarketplace(m.id);
    expect(await logoFiles(m.id)).toEqual([fileName(inDb.logo_url)]);
  });

  test.each(invalidLogoCases)(
    "should return 400 and change nothing when %s",
    async (_label, options, errors) => {
      const m = await createViaApi("mp_logo");
      const filesBefore = await logoFiles(m.id);

      const result = await patch(m.id, { name: `x_${ctx.tag}` }, options);

      expect(result.status).toBe(400);
      expect(errors).toContain(result.body.errors);
      await expectUnchanged(m); // nama juga nggak boleh berubah
      expect(await logoFiles(m.id)).toEqual(filesBefore);
    },
  );

  // ---------- Tidak ditemukan dan validasi ----------

  test("should return marketplace not found and upload nothing", async () => {
    const randomId = crypto.randomUUID();

    const result = await patch(
      randomId,
      { name: `x_${ctx.tag}` },
      { logo: logoFile },
    );

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("MARKETPLACE_NOT_FOUND");
    expect(await logoFiles(randomId)).toEqual([]);
  });

  test("should return 400 when id is not a uuid", async () => {
    const result = await patch("bukan-uuid", { name: `x_${ctx.tag}` });

    expect(result.status).toBe(400);
  });

  test("should return 400 when nothing is sent", async () => {
    const empty = await patch(ctx.target.id);
    const noBody = await send("patch", `/marketplaces/${ctx.target.id}`);

    expect(empty.status).toBe(400);
    expect(noBody.status).toBe(400);
    await expectUnchanged(ctx.target);
  });

  test.each([
    ["an unknown field is sent", { foo: "bar" }],
    ["logo_url is sent as text", { logo_url: "https://example.com/x.png" }],
    ["has_logo is sent as text", { has_logo: "true" }],
    ["name is blank", { name: "   " }],
    ["name is longer than 100 chars", { name: "a".repeat(101) }],
    ["is_active is not a boolean", { is_active: "ya" }],
    ["is_active is empty", { is_active: "" }],
  ])("should return 400 when %s", async (_label, overrides) => {
    // Dasarnya field valid, supaya cuma field bermasalah yang bikin gagal
    const result = await patch(ctx.target.id, {
      name: `valid_${ctx.tag}`,
      ...overrides,
    });

    expect(result.status).toBe(400);
    await expectUnchanged(ctx.target);
  });

  // ---------- Kegagalan dan race condition ----------

  test("should not hide unknown database errors and should remove the new logo", async () => {
    const m = await createViaApi("mp_logo");
    const filesBefore = await logoFiles(m.id);

    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await patch(
      m.id,
      { name: `x_${ctx.tag}` },
      { logo: logoFile },
    );
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await expectUnchanged(m);
    expect(await logoFiles(m.id)).toEqual(filesBefore);
  });

  test("should still return 200 when removing the old logo fails", async () => {
    const m = await createViaApi("mp_logo");

    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorageDown();

    const result = await patch(m.id, {}, { logo: logoFile });
    vi.restoreAllMocks();

    // DB sudah pakai logo baru walau storage gagal. File lama dibersihkan afterEach.
    expect(result.status).toBe(200);
    const inDb = await findMarketplace(m.id);
    expect(inDb.logo_url).toBe(result.body.data.logo_url);
    expect(inDb.logo_url).not.toBe(m.logo_url);
    expect(await logoFiles(m.id)).toHaveLength(2);
  });

  test("should leave no files behind when the marketplace is deleted during the edit", async () => {
    const m = await createViaApi("mp_race");

    const [deleteResult, patchResult] = await Promise.all([
      remove(m.id),
      patch(m.id, { name: `mp_renamed_${ctx.tag}` }, { logo: logoFile }),
    ]);

    // Siapa pun yang menang, hasil akhirnya harus bersih
    expect(deleteResult.status).toBe(200);
    expect([200, 404]).toContain(patchResult.status);
    expect(await findMarketplace(m.id)).toBeNull();
    expect(await logoFiles(m.id)).toEqual([]);
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and change nothing when %s",
    async (_label, buildAuthorization) => {
      const before = await listMarketplaceFolders();

      const result = await patch(
        ctx.target.id,
        { name: `diedit_${ctx.tag}` },
        {
          logo: logoFile,
          authorization: buildAuthorization(ctx.accessToken),
        },
      );

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      expect(await taggedMarketplaces()).toEqual([ctx.target]);
      await expectNoNewFolders(before);
    },
  );
});
