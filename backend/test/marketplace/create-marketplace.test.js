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
  setupMarketplaceTest,
  unauthorizedCases,
} from "./helper.js";

describe("post /marketplaces", () => {
  const ctx = setupMarketplaceTest();
  const { post, send, validFields, findMarketplace, taggedMarketplaces } = ctx;

  test("should can create marketplace and upload the logo", async () => {
    const result = await post();

    expect(result.status).toBe(201);

    const { id, logo_url } = result.body.data;
    ctx.createdIds.push(id);

    expect(result.body.data.name).toBe(`mp_${ctx.tag}`);
    expect(result.body.data.is_active).toBe(true);
    expect(logo_url).toContain(`/${BUCKET}/marketplaces/${id}/`);
    expect(logo_url.endsWith(".webp")).toBe(true);

    // File benar-benar ada di bucket, satu-satunya
    expect(await logoFiles(id)).toEqual([fileName(logo_url)]);
    expect(await findMarketplace(id)).toEqual(result.body.data);
  });

  test("should only return id, name, logo_url and is_active", async () => {
    const result = await post();
    ctx.createdIds.push(result.body.data?.id);

    expect(Object.keys(result.body.data).sort()).toEqual([
      "id",
      "is_active",
      "logo_url",
      "name",
    ]);
  });

  test("should default is_active to true when omitted", async () => {
    const result = await post({ name: `mp_${ctx.tag}` });
    ctx.createdIds.push(result.body.data?.id);

    expect(result.status).toBe(201);
    expect(result.body.data.is_active).toBe(true);
  });

  test("should can create an inactive marketplace", async () => {
    const result = await post({ name: `mp_${ctx.tag}`, is_active: "false" });
    ctx.createdIds.push(result.body.data?.id);

    expect(result.status).toBe(201);
    expect(result.body.data.is_active).toBe(false);
    expect((await findMarketplace(result.body.data.id)).is_active).toBe(false);
  });

  test("should trim the name", async () => {
    const result = await post({ name: `  mp_${ctx.tag}  ` });
    ctx.createdIds.push(result.body.data?.id);

    expect(result.status).toBe(201);
    expect(result.body.data.name).toBe(`mp_${ctx.tag}`);
  });

  // ---------- Nama unik ----------

  test("should return marketplace already exist and upload nothing when the name is taken", async () => {
    const before = await listMarketplaceFolders();

    const result = await post({ name: ctx.target.name });

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("MARKETPLACE_ALREADY_EXIST");
    await expectNoNewFolders(before);
    expect(await taggedMarketplaces()).toEqual([ctx.target]);
  });

  test("should create only one when two creates with the same name run at the same time", async () => {
    const before = await listMarketplaceFolders();

    const results = await Promise.all([post(), post()]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);

    const winner = results.find((result) => result.status === 201).body.data;
    ctx.createdIds.push(winner.id);
    expect(results.find((result) => result.status === 409).body.errors).toBe(
      "MARKETPLACE_ALREADY_EXIST",
    );

    // Yang kalah nggak boleh meninggalkan file yatim: cuma folder pemenang yang baru
    const after = await listMarketplaceFolders();
    expect(after.filter((name) => !before.includes(name))).toEqual([winner.id]);
    expect(
      await prisma.marketplace.count({ where: { name: `mp_${ctx.tag}` } }),
    ).toBe(1);
  });

  test("should return already exist and remove the uploaded logo when prisma throws P2002", async () => {
    const before = await listMarketplaceFolders();

    vi.spyOn(prisma.marketplace, "create").mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const result = await post();
    vi.restoreAllMocks();

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("MARKETPLACE_ALREADY_EXIST");
    await expectNoNewFolders(before);
  });

  test("should remove the uploaded logo when saving fails", async () => {
    const before = await listMarketplaceFolders();

    vi.spyOn(prisma.marketplace, "create").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await post();
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await expectNoNewFolders(before);
  });

  // ---------- Validasi ----------

  test.each([
    ["name is missing", { name: undefined }],
    ["name is blank", { name: "   " }],
    ["name is longer than 100 chars", { name: "a".repeat(101) }],
    ["is_active is not a boolean", { is_active: "ya" }],
    ["is_active is empty", { is_active: "" }],
    ["logo_url is sent as text", { logo_url: "https://example.com/x.png" }],
    ["an unknown field is sent", { foo: "bar" }],
    ["id is sent", { id: crypto.randomUUID() }],
  ])("should return 400 when %s", async (_label, overrides) => {
    const before = await listMarketplaceFolders();

    const result = await post({ ...validFields(), ...overrides });

    expect(result.status).toBe(400);
    expect(await taggedMarketplaces()).toEqual([ctx.target]);
    await expectNoNewFolders(before);
  });

  // ---------- Logo ----------

  test("should return logo required when no logo is sent", async () => {
    const result = await post(validFields(), {});

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("LOGO_REQUIRED");
    expect(await taggedMarketplaces()).toEqual([ctx.target]);
  });

  test("should return logo required when the request is plain JSON", async () => {
    const result = await send("post", "/marketplaces", {
      fields: undefined,
    }).send(validFields());

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("LOGO_REQUIRED");
  });

  test.each(invalidLogoCases)(
    "should return 400 and create nothing when %s",
    async (_label, options, errors) => {
      const before = await listMarketplaceFolders();

      const result = await post(validFields(), options);

      expect(result.status).toBe(400);
      expect(errors).toContain(result.body.errors);
      expect(await taggedMarketplaces()).toEqual([ctx.target]);
      await expectNoNewFolders(before);
    },
  );

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and create nothing when %s",
    async (_label, buildAuthorization) => {
      const before = await listMarketplaceFolders();

      const result = await send("post", "/marketplaces", {
        fields: validFields(),
        logo: logoFile,
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      expect(await taggedMarketplaces()).toEqual([ctx.target]);
      await expectNoNewFolders(before);
    },
  );
});
