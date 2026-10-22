import crypto from "node:crypto";
import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

// Test ini upload file betulan ke Supabase
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const BUCKET = process.env.SUPABASE_CAMERA_BUCKET;

const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const listFileNames = async (cameraId) => {
  const { data } = await supabase.storage
    .from(BUCKET)
    .list(`cameras/${cameraId}`);
  return (data ?? []).map((file) => file.name).sort();
};

const removeCameraImages = async (cameraId) => {
  const names = await listFileNames(cameraId);
  if (!names.length) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(names.map((name) => `cameras/${cameraId}/${name}`));

  if (error) console.error("Cleanup remove gagal:", error);
};

describe("delete /cameras/:id (soft delete)", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let tag;
  let category;
  let cameraIds;

  const deleteCamera = ({
    id,
    authorization = `Bearer ${accessToken}`,
  } = {}) => {
    let request = supertest(web).delete(`/cameras/${id}`);
    if (authorization) request = request.set("Authorization", authorization);
    return request;
  };

  // Kamera dibuat lewat endpoint asli: gambar benar-benar ada di bucket
  const createCamera = async ({ imageCount = 1 } = {}) => {
    let request = supertest(web)
      .post("/cameras")
      .set("Authorization", `Bearer ${accessToken}`)
      .field("name", `Canon EOS 1500D ${tag}`)
      .field("price", "5500000")
      .field("stock", "3")
      .field("category_id", category.id);

    for (let i = 0; i < imageCount; i++) {
      request = request.attach("images", PNG_BUFFER, {
        filename: `camera-${i}.png`,
        contentType: "image/png",
      });
    }

    const result = await request;
    expect(result.status).toBe(201); // setup harus berhasil

    cameraIds.push(result.body.data.id);
    return result.body.data;
  };

  const findCamera = (id) => prisma.camera.findUnique({ where: { id } });
  const countImages = (id) =>
    prisma.cameraImage.count({ where: { camera_id: id } });

  beforeEach(async () => {
    const stamp = Date.now();
    email = `deletecamera_${stamp}@gmail.com`;
    password = "alymnfpassword";
    tag = `t${stamp}`;
    cameraIds = [];

    // 1. Siapkan user di Supabase Auth
    const createUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    supabaseId = createUser.data.user.id;

    // 2. Login untuk dapetin access_token
    const loginResponse = await supertest(web).post("/users/login").send({
      email,
      password,
    });
    accessToken = loginResponse.body.data.access_token;

    // 3. Kategori
    category = await prisma.category.create({ data: { name: `cat_${tag}` } });
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    for (const id of cameraIds) {
      await removeCameraImages(id);
    }

    await prisma.camera
      .deleteMany({ where: { category_id: category.id } })
      .catch(() => {});
    await prisma.category
      .deleteMany({ where: { name: { contains: tag } } })
      .catch(() => {});
    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
    supabaseId = undefined;
  });

  // ---------- Sukses ----------

  test("should soft delete the camera and remove its images", async () => {
    const created = await createCamera({ imageCount: 3 });
    expect(await listFileNames(created.id)).toHaveLength(3);

    const result = await deleteCamera({ id: created.id });

    expect(result.status).toBe(200);
    expect(result.body.data.message).toBe("CAMERA_DELETED");

    // Baris kamera tetap ada (buat riwayat order), cuma ditandai terhapus
    const inDb = await findCamera(created.id);
    expect(inDb).not.toBeNull();
    expect(inDb.is_deleted).toBe(true);
    expect(inDb.name).toBe(`Canon EOS 1500D ${tag}`);
    expect(inDb.price).toBe(5500000);

    // Gambar hilang dari DB dan dari bucket
    expect(await countImages(created.id)).toBe(0);
    expect(await listFileNames(created.id)).toHaveLength(0);
  });

  test("should also remove files that are not recorded in the database", async () => {
    const created = await createCamera();

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`cameras/${created.id}/orphan-${tag}.webp`, PNG_BUFFER, {
        contentType: "image/png",
      });
    expect(error).toBeNull();
    expect(await listFileNames(created.id)).toHaveLength(2);

    const result = await deleteCamera({ id: created.id });

    expect(result.status).toBe(200);
    expect(await listFileNames(created.id)).toHaveLength(0);
  });

  test("should not touch other cameras", async () => {
    const target = await createCamera();
    const other = await createCamera({ imageCount: 2 });

    const result = await deleteCamera({ id: target.id });

    expect(result.status).toBe(200);
    expect((await findCamera(other.id)).is_deleted).toBe(false);
    expect(await countImages(other.id)).toBe(2);
    expect(await listFileNames(other.id)).toHaveLength(2);
  });

  test("should can delete a camera that has no images", async () => {
    const camera = await prisma.camera.create({
      data: {
        name: `Tanpa Gambar ${tag}`,
        price: 1000000,
        condition: "NEW",
        stock: 1,
        category_id: category.id,
      },
    });

    const result = await deleteCamera({ id: camera.id });

    expect(result.status).toBe(200);
    expect((await findCamera(camera.id)).is_deleted).toBe(true);
  });

  // ---------- Tidak ditemukan ----------

  test("should return camera not found", async () => {
    const result = await deleteCamera({ id: crypto.randomUUID() });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
  });

  test("should return camera not found when deleted twice", async () => {
    const created = await createCamera();

    const first = await deleteCamera({ id: created.id });
    const second = await deleteCamera({ id: created.id });

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expect(second.body.errors).toBe("CAMERA_NOT_FOUND");
  });

  // ---------- Kamera terhapus tidak bisa diakses lagi ----------
  // Test di bagian ini gagal sampai filter is_deleted dipasang di query lain

  test("should not return the deleted camera on get by id", async () => {
    const created = await createCamera();
    await deleteCamera({ id: created.id });

    const result = await supertest(web)
      .get(`/cameras/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
  });

  test("should not list the deleted camera", async () => {
    const kept = await createCamera();
    const deleted = await createCamera();
    await deleteCamera({ id: deleted.id });

    const result = await supertest(web)
      .get("/cameras")
      .query({ category_id: category.id })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(result.status).toBe(200);
    expect(result.body.data.map((camera) => camera.id)).toEqual([kept.id]);
    expect(result.body.paging.total).toBe(1);
  });

  test("should not allow editing a deleted camera", async () => {
    const created = await createCamera();
    await deleteCamera({ id: created.id });

    const result = await supertest(web)
      .patch(`/cameras/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: `Diedit ${tag}` });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    expect((await findCamera(created.id)).name).toBe(`Canon EOS 1500D ${tag}`);
  });

  test("should not allow uploading images to a deleted camera", async () => {
    const created = await createCamera();
    await deleteCamera({ id: created.id });

    const result = await supertest(web)
      .patch(`/cameras/${created.id}/images`)
      .set("Authorization", `Bearer ${accessToken}`)
      .field("keep_image_ids", "[]")
      .attach("images", PNG_BUFFER, {
        filename: "camera.png",
        contentType: "image/png",
      });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    expect(await countImages(created.id)).toBe(0);
    expect(await listFileNames(created.id)).toHaveLength(0);
  });

  // ---------- Validasi ----------

  test("should return 400 when id is not a uuid", async () => {
    const result = await deleteCamera({ id: "bukan-uuid" });

    expect(result.status).toBe(400);
  });

  // ---------- Auth ----------

  test.each([
    ["authorization header is missing", null],
    ["access token is invalid", "Bearer salah_access_token"],
    ["auth scheme is wrong", "token salah"],
  ])(
    "should return unauthorized and keep everything when %s",
    async (_label, authorization) => {
      const created = await createCamera();

      const result = await deleteCamera({ id: created.id, authorization });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
      expect((await findCamera(created.id)).is_deleted).toBe(false);
      expect(await countImages(created.id)).toBe(1);
      expect(await listFileNames(created.id)).toHaveLength(1);
    },
  );

  // ---------- Race condition dan kegagalan ----------

  test("should delete only once when two deletes run at the same time", async () => {
    const created = await createCamera();

    const results = await Promise.all([
      deleteCamera({ id: created.id }),
      deleteCamera({ id: created.id }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 404]);
    expect((await findCamera(created.id)).is_deleted).toBe(true);
    expect(await listFileNames(created.id)).toHaveLength(0);
  });

  test("should leave no images behind when delete and image edit run at the same time", async () => {
    const created = await createCamera({ imageCount: 2 });

    const [deleteResult, editResult] = await Promise.all([
      deleteCamera({ id: created.id }),
      supertest(web)
        .patch(`/cameras/${created.id}/images`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("keep_image_ids", "[]")
        .attach("images", PNG_BUFFER, {
          filename: "camera.png",
          contentType: "image/png",
        }),
    ]);

    // Siapa pun yang menang, hasil akhirnya harus bersih
    expect(deleteResult.status).toBe(200);
    expect([200, 404]).toContain(editResult.status);
    expect((await findCamera(created.id)).is_deleted).toBe(true);
    expect(await countImages(created.id)).toBe(0);
    expect(await listFileNames(created.id)).toHaveLength(0);
  });

  test("should change nothing when the transaction fails", async () => {
    const created = await createCamera({ imageCount: 2 });

    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await deleteCamera({ id: created.id });
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    expect((await findCamera(created.id)).is_deleted).toBe(false);
    expect(await countImages(created.id)).toBe(2);
    expect(await listFileNames(created.id)).toHaveLength(2); // file utuh
  });

  test("should still return 200 when cleaning up storage fails", async () => {
    const created = await createCamera();

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(supabase, "storage", "get").mockReturnValue({
      from: () => ({
        list: async () => ({ data: null, error: new Error("storage down") }),
        remove: async () => ({ data: null, error: new Error("storage down") }),
      }),
    });

    const result = await deleteCamera({ id: created.id });
    vi.restoreAllMocks();

    // DB sudah berubah walau storage gagal. File yatim dibersihkan afterEach.
    expect(result.status).toBe(200);
    expect((await findCamera(created.id)).is_deleted).toBe(true);
    expect(await countImages(created.id)).toBe(0);
    expect(await listFileNames(created.id)).toHaveLength(1);
  });
});
