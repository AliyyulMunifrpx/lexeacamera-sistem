import crypto from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";
import {
  BUCKET,
  PNG_BUFFER,
  expectNoNewFolders,
  listMarketplaceFolders,
  logoFiles,
  mockStorageDown,
  setupMarketplaceTest,
  unauthorizedCases,
} from "./helper.js";

describe("delete /marketplaces/:id", () => {
  const ctx = setupMarketplaceTest();
  const {
    remove,
    createViaApi,
    createMarketplace,
    createCamera,
    findMarketplace,
    taggedMarketplaces,
    countLinks,
    expectUnchanged,
  } = ctx;

  test("should can delete marketplace and its logo files", async () => {
    const m = await createViaApi("mp_logo");
    expect(await logoFiles(m.id)).toHaveLength(1);

    const result = await remove(m.id);

    expect(result.status).toBe(200);
    expect(result.body.data.message).toBe("MARKETPLACE_DELETED");
    expect(await findMarketplace(m.id)).toBeNull();
    expect(await logoFiles(m.id)).toEqual([]);
  });

  test("should can delete a marketplace whose logo is not in the bucket", async () => {
    const result = await remove(ctx.target.id);

    expect(result.status).toBe(200);
    expect(await findMarketplace(ctx.target.id)).toBeNull();
  });

  test("should also remove files that are not recorded in the database", async () => {
    const m = await createViaApi("mp_logo");

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`marketplaces/${m.id}/orphan-${ctx.tag}.webp`, PNG_BUFFER, {
        contentType: "image/png",
      });
    expect(error).toBeNull();
    expect(await logoFiles(m.id)).toHaveLength(2);

    const result = await remove(m.id);

    expect(result.status).toBe(200);
    expect(await logoFiles(m.id)).toEqual([]);
  });

  test("should not touch other marketplaces", async () => {
    const m = await createViaApi("mp_logo");
    const other = await createViaApi("mp_other");
    const otherFiles = await logoFiles(other.id);

    await remove(m.id);

    await expectUnchanged(other);
    expect(await logoFiles(other.id)).toEqual(otherFiles);
  });

  test("should return marketplace not found", async () => {
    const result = await remove(crypto.randomUUID());

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("MARKETPLACE_NOT_FOUND");
  });

  test("should return marketplace not found when deleted twice", async () => {
    const first = await remove();
    const second = await remove();

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expect(second.body.errors).toBe("MARKETPLACE_NOT_FOUND");
  });

  test("should return 400 when id is not a uuid", async () => {
    const result = await remove("bukan-uuid");

    expect(result.status).toBe(400);
  });

  // ---------- Masih dipakai kamera ----------

  test("should return still in use with the cameras that use it", async () => {
    const m = await createViaApi("mp_logo");
    const cameraB = await createCamera([m], { name: `Camera_b_${ctx.tag}` });
    const cameraA = await createCamera([m], { name: `Camera_a_${ctx.tag}` });

    const result = await remove(m.id);

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("MARKETPLACE_STILL_IN_USE");
    // Urut nama
    expect(result.body.details).toEqual({
      total: 2,
      cameras: [
        { id: cameraA.id, name: `Camera_a_${ctx.tag}` },
        { id: cameraB.id, name: `Camera_b_${ctx.tag}` },
      ],
    });

    // Marketplace, link, dan logo harus utuh
    await expectUnchanged(m);
    expect(await countLinks(m.id)).toBe(2);
    expect(await logoFiles(m.id)).toHaveLength(1);
  });

  test("should list at most 10 cameras but report the real total", async () => {
    const names = Array.from(
      { length: 12 },
      (_, i) => `Camera_${String(i).padStart(2, "0")}_${ctx.tag}`,
    );
    await Promise.all(
      names.map((name) => createCamera([ctx.target], { name })),
    );

    const result = await remove();

    expect(result.status).toBe(400);
    expect(result.body.details.total).toBe(12);
    expect(result.body.details.cameras.map((camera) => camera.name)).toEqual(
      names.slice(0, 10),
    );
  });

  test("should not list soft-deleted cameras in the clue", async () => {
    const active = await createCamera([ctx.target], {
      name: `Camera_a_${ctx.tag}`,
    });
    await createCamera([ctx.target], {
      name: `Camera_b_${ctx.tag}`,
      is_deleted: true,
    });

    const result = await remove();

    expect(result.status).toBe(400);
    expect(result.body.details).toEqual({
      total: 1,
      cameras: [{ id: active.id, name: `Camera_a_${ctx.tag}` }],
    });
  });

  test("should block deleting an inactive marketplace that is still used", async () => {
    const inactive = await createMarketplace("mp_inactive", {
      is_active: false,
    });
    await createCamera([inactive]);

    const result = await remove(inactive.id);

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("MARKETPLACE_STILL_IN_USE");
    expect(await findMarketplace(inactive.id)).not.toBeNull();
  });

  test("should only be blocked by its own cameras", async () => {
    const used = await createMarketplace("mp_used");
    await createCamera([used]);

    const result = await remove(); // target nggak dipakai siapa pun

    expect(result.status).toBe(200);
    expect(await findMarketplace(ctx.target.id)).toBeNull();
    expect(await findMarketplace(used.id)).not.toBeNull();
    expect(await countLinks(used.id)).toBe(1);
  });

  test("should can delete after the camera that used it is replaced", async () => {
    const camera = await createCamera([ctx.target]);

    const blocked = await remove();
    expect(blocked.status).toBe(400);

    await prisma.cameraMarketplaceLink.deleteMany({
      where: { camera_id: camera.id },
    });

    const result = await remove();
    expect(result.status).toBe(200);
    expect(await findMarketplace(ctx.target.id)).toBeNull();
  });

  test("should not be blocked by soft-deleted cameras", async () => {
    const m = await createViaApi("mp_logo");
    const camera = await createCamera([m], { is_deleted: true });

    const result = await remove(m.id);

    expect(result.status).toBe(200);
    expect(await findMarketplace(m.id)).toBeNull();
    expect(await logoFiles(m.id)).toEqual([]);

    // Link milik kamera terhapus ikut hilang, kameranya sendiri tetap ada
    expect(await countLinks(m.id)).toBe(0);
    expect(
      await prisma.camera.findUnique({ where: { id: camera.id } }),
    ).not.toBeNull();
  });

  // ---------- Race condition dan kegagalan ----------

  test("should delete only once when two deletes run at the same time", async () => {
    const m = await createViaApi("mp_logo");

    const results = await Promise.all([remove(m.id), remove(m.id)]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 404]);
    expect(await findMarketplace(m.id)).toBeNull();
    expect(await logoFiles(m.id)).toEqual([]);
  });

  test("should never lose a link when a camera takes the marketplace during delete", async () => {
    const camera = await createCamera();

    const [deleteResult, linkResult] = await Promise.allSettled([
      remove(),
      prisma.cameraMarketplaceLink.create({
        data: {
          camera_id: camera.id,
          marketplace_id: ctx.target.id,
          product_url: "https://www.tokopedia.com/toko/canon",
        },
      }),
    ]);

    const deleted = deleteResult.value.status === 200;
    const linked = linkResult.status === "fulfilled";

    // Tepat satu yang menang: kalau link berhasil dibuat, delete harus ditolak
    // (link nggak boleh hilang diam-diam lewat Cascade). Kalau delete berhasil,
    // pembuatan link harus gagal.
    expect(linked).not.toBe(deleted);

    if (linked) {
      expect(deleteResult.value.body.errors).toBe("MARKETPLACE_STILL_IN_USE");
      expect(deleteResult.value.body.details.total).toBe(1);
      expect(await findMarketplace(ctx.target.id)).not.toBeNull();
      expect(await countLinks(ctx.target.id)).toBe(1);
    } else {
      expect(await findMarketplace(ctx.target.id)).toBeNull();
    }
  });

  test("should change nothing when the transaction fails", async () => {
    const m = await createViaApi("mp_logo");
    const filesBefore = await logoFiles(m.id);

    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await remove(m.id);
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await expectUnchanged(m);
    expect(await logoFiles(m.id)).toEqual(filesBefore); // file utuh
  });

  test("should still return 200 when cleaning up storage fails", async () => {
    const m = await createViaApi("mp_logo");

    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorageDown();

    const result = await remove(m.id);
    vi.restoreAllMocks();

    // Baris sudah terhapus walau storage gagal. File yatim dibersihkan afterEach.
    expect(result.status).toBe(200);
    expect(await findMarketplace(m.id)).toBeNull();
    expect(await logoFiles(m.id)).toHaveLength(1);
  });

  // ---------- Auth ----------

  test.each(unauthorizedCases)(
    "should return unauthorized and delete nothing when %s",
    async (_label, buildAuthorization) => {
      const before = await listMarketplaceFolders();

      const result = await remove(ctx.target.id, {
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      expect(await taggedMarketplaces()).toEqual([ctx.target]);
      await expectNoNewFolders(before);
    },
  );
});
