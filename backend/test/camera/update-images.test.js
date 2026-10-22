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
const GIF_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

const pngImage = {
  buffer: PNG_BUFFER,
  filename: "camera.png",
  contentType: "image/png",
};
const gifImage = {
  buffer: GIF_BUFFER,
  filename: "camera.gif",
  contentType: "image/gif",
};
// Content-type bilang PNG, isinya bukan gambar
const brokenImage = {
  buffer: Buffer.from("ini bukan gambar"),
  filename: "rusak.png",
  contentType: "image/png",
};

const listFileNames = async (cameraId) => {
  const { data } = await supabase.storage
    .from(BUCKET)
    .list(`cameras/${cameraId}`);
  return (data ?? []).map((file) => file.name).sort();
};

const fileName = (url) => url.split("/").pop();

const removeCameraImages = async (cameraId) => {
  const names = await listFileNames(cameraId);
  if (!names.length) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(names.map((name) => `cameras/${cameraId}/${name}`));

  if (error) console.error("Cleanup remove gagal:", error);
};

const dbImages = (cameraId) =>
  prisma.cameraImage.findMany({
    where: { camera_id: cameraId },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

// Isi bucket harus sama persis dengan isi tabel, dan tepat satu foto utama
const expectConsistent = async (cameraId) => {
  const rows = await dbImages(cameraId);
  const files = await listFileNames(cameraId);

  expect(rows.map((row) => fileName(row.image_url)).sort()).toEqual(files);
  if (rows.length) {
    expect(rows.filter((row) => row.is_primary)).toHaveLength(1);
  }
};

describe("patch /cameras/:id/images", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let tag;
  let category;
  let cameraIds;
  let camera;
  let ids; // id 3 gambar awal
  let primary; // gambar utama awal
  let others; // 2 gambar awal yang bukan utama
  let original;
  let originalFiles;

  // keep: array id (di-JSON-kan). keepRaw: string mentah untuk kasus rusak
  const patchImages = ({
    id = camera.id,
    keep,
    keepRaw,
    primary: primaryField,
    files = [],
    authorization = `Bearer ${accessToken}`,
  } = {}) => {
    let request = supertest(web).patch(`/cameras/${id}/images`);
    if (authorization) request = request.set("Authorization", authorization);

    const keepValue =
      keepRaw ?? (keep === undefined ? undefined : JSON.stringify(keep));
    if (keepValue !== undefined)
      request = request.field("keep_image_ids", keepValue);
    if (primaryField !== undefined)
      request = request.field("primary", primaryField);

    for (const file of files) {
      request = request.attach("images", file.buffer, {
        filename: file.filename,
        contentType: file.contentType,
      });
    }

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
      request = request.attach("images", pngImage.buffer, {
        filename: `camera-${i}.png`,
        contentType: "image/png",
      });
    }

    const result = await request;
    expect(result.status).toBe(201); // setup harus berhasil

    cameraIds.push(result.body.data.id);
    return result.body.data;
  };

  const expectUnchanged = async () => {
    expect(await dbImages(camera.id)).toEqual(original);
    expect(await listFileNames(camera.id)).toEqual(originalFiles);
  };

  const primaryOf = (images) => images.filter((image) => image.is_primary);

  beforeEach(async () => {
    const stamp = Date.now();
    email = `updateimages_${stamp}@gmail.com`;
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

    // 3. Kategori dan kamera dengan 3 gambar
    category = await prisma.category.create({ data: { name: `cat_${tag}` } });

    camera = await createCamera({ imageCount: 3 });
    ids = camera.images.map((image) => image.id);
    primary = camera.images.find((image) => image.is_primary);
    others = camera.images.filter((image) => !image.is_primary);

    original = await dbImages(camera.id);
    originalFiles = await listFileNames(camera.id);
    expect(originalFiles).toHaveLength(3);
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

  test("should do nothing when everything is kept and nothing is added", async () => {
    const result = await patchImages({ keep: ids });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(3);
    await expectUnchanged();
  });

  test("should delete a non-primary image and its file", async () => {
    const target = others[0];

    const result = await patchImages({
      keep: ids.filter((id) => id !== target.id),
    });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(2);
    expect(result.body.data.map((image) => image.id)).not.toContain(target.id);
    expect(result.body.data[0].id).toBe(primary.id); // foto utama di depan

    expect(await listFileNames(camera.id)).not.toContain(
      fileName(target.image_url),
    );
    expect(await dbImages(camera.id)).toHaveLength(2);
    await expectConsistent(camera.id);
  });

  test("should pick a new primary when the primary image is deleted", async () => {
    const keep = others.map((image) => image.id);

    const result = await patchImages({ keep });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(2);

    const rows = await dbImages(camera.id);
    expect(primaryOf(rows)).toHaveLength(1);
    expect(keep).toContain(primaryOf(rows)[0].id);

    expect(await listFileNames(camera.id)).not.toContain(
      fileName(primary.image_url),
    );
    await expectConsistent(camera.id);
  });

  test("should add new images and keep the current primary", async () => {
    const result = await patchImages({ keep: ids, files: [pngImage] });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(4);
    expect(result.body.data[0].id).toBe(primary.id);
    expect(result.body.data.filter((i) => !ids.includes(i.id))).toHaveLength(1);

    expect(await listFileNames(camera.id)).toHaveLength(4);
    await expectConsistent(camera.id);
  });

  test("should delete, keep and add in one request", async () => {
    const keepId = others[0].id;

    const result = await patchImages({
      keep: [keepId],
      files: [pngImage, pngImage],
    });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(3);
    expect(result.body.data.map((image) => image.id)).toContain(keepId);

    // Utama lama terhapus, satu-satunya gambar lama yang tersisa jadi utama
    expect(primaryOf(result.body.data)[0].id).toBe(keepId);

    const files = await listFileNames(camera.id);
    expect(files).not.toContain(fileName(primary.image_url));
    expect(files).not.toContain(fileName(others[1].image_url));
    await expectConsistent(camera.id);
  });

  test("should replace all old images with new ones", async () => {
    const result = await patchImages({ keep: [], files: [pngImage] });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0].is_primary).toBe(true);
    expect(ids).not.toContain(result.body.data[0].id);

    const files = await listFileNames(camera.id);
    expect(files).toHaveLength(1);
    await expectConsistent(camera.id);
  });

  test("should allow exactly 5 images", async () => {
    const result = await patchImages({
      keep: ids,
      files: [pngImage, pngImage],
    });

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(5);
    await expectConsistent(camera.id);
  });

  // ---------- Primary ----------

  test("should set an existing image as primary", async () => {
    const target = others[0];

    const result = await patchImages({ keep: ids, primary: target.id });

    expect(result.status).toBe(200);
    expect(result.body.data[0].id).toBe(target.id);

    const rows = await dbImages(camera.id);
    expect(primaryOf(rows).map((row) => row.id)).toEqual([target.id]);
    await expectConsistent(camera.id);
  });

  test("should set a new image as primary with new:N", async () => {
    const result = await patchImages({
      keep: ids,
      files: [pngImage],
      primary: "new:0",
    });

    expect(result.status).toBe(200);

    const newImage = result.body.data.find((image) => !ids.includes(image.id));
    const rows = await dbImages(camera.id);

    expect(primaryOf(rows).map((row) => row.id)).toEqual([newImage.id]);
    await expectConsistent(camera.id);
  });

  test("should pick an old image as primary before a new one when primary is deleted and omitted", async () => {
    const keep = others.map((image) => image.id);

    const result = await patchImages({ keep, files: [pngImage] });

    expect(result.status).toBe(200);

    const rows = await dbImages(camera.id);
    expect(keep).toContain(primaryOf(rows)[0].id);
    await expectConsistent(camera.id);
  });

  test.each([
    ["primary is not a uuid or new:N", () => ({ primary: "abc" })],
    ["primary is new:-1", () => ({ primary: "new:-1" })],
    [
      "primary is an image that is being deleted",
      () => ({ keep: others.map((i) => i.id), primary: primary.id }),
    ],
    ["primary is new:0 but no file is sent", () => ({ primary: "new:0" })],
    [
      "primary is new:1 but only one file is sent",
      () => ({ files: [pngImage], primary: "new:1" }),
    ],
    [
      "primary is an image of another camera",
      () => ({ primary: crypto.randomUUID() }),
    ],
  ])("should return 400 when %s", async (_label, build) => {
    const result = await patchImages({ keep: ids, ...build() });

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  // ---------- Tidak ditemukan ----------

  test("should return camera not found and upload nothing", async () => {
    const randomId = crypto.randomUUID();

    const result = await patchImages({
      id: randomId,
      keep: [],
      files: [pngImage],
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    expect(await listFileNames(randomId)).toHaveLength(0);
  });

  test("should return image not found when a kept id does not exist", async () => {
    const result = await patchImages({
      keep: [ids[0], crypto.randomUUID()],
      files: [pngImage],
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_IMAGE_NOT_FOUND");
    await expectUnchanged(); // gambar lain nggak terhapus, file baru nggak ter-upload
  });

  test("should not accept an image id that belongs to another camera", async () => {
    const other = await createCamera({ imageCount: 1 });
    const otherFiles = await listFileNames(other.id);

    const result = await patchImages({ keep: [ids[0], other.images[0].id] });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_IMAGE_NOT_FOUND");
    await expectUnchanged();

    // Kamera lain nggak tersentuh
    expect(await listFileNames(other.id)).toEqual(otherFiles);
    expect(await dbImages(other.id)).toHaveLength(1);
  });

  // ---------- Aturan jumlah ----------

  test("should return images required when all images would be removed", async () => {
    const result = await patchImages({ keep: [] });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("CAMERA_IMAGES_REQUIRED");
    await expectUnchanged();
  });

  test("should return too many images when the final count is more than 5", async () => {
    const result = await patchImages({
      keep: ids,
      files: [
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
        pngImage,
      ],
    });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("TOO_MANY_CAMERA_IMAGES");
    await expectUnchanged();
  });

  test("should return too many images when uploading 6 files", async () => {
    const result = await patchImages({
      keep: [],
      files: Array.from({ length: 13 }, () => pngImage),
    });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("TOO_MANY_CAMERA_IMAGES");
    await expectUnchanged();
  });

  // ---------- Validasi ----------

  test("should return 400 when id is not a uuid", async () => {
    const result = await patchImages({ id: "bukan-uuid", keep: ids });

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  test("should return 400 and not wipe old images when keep_image_ids is missing", async () => {
    const result = await patchImages({ files: [pngImage] });

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  test("should return invalid keep image ids when keep_image_ids is not valid JSON", async () => {
    const result = await patchImages({ keepRaw: "[bukan json" });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("INVALID_KEEP_IMAGE_IDS");
    await expectUnchanged();
  });

  test.each([
    ["keep_image_ids is empty text", () => ""],
    ["keep_image_ids is not an array", () => JSON.stringify({ a: 1 })],
    ["keep_image_ids is null", () => "null"],
    [
      "keep_image_ids contains a non-uuid",
      () => JSON.stringify(["bukan-uuid"]),
    ],
    [
      "keep_image_ids contains the same id twice",
      () => JSON.stringify([ids[0], ids[0]]),
    ],
  ])("should return 400 when %s", async (_label, build) => {
    const result = await patchImages({ keepRaw: build(), files: [pngImage] });

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  // ---------- Gambar ----------

  test("should return invalid image format and delete nothing", async () => {
    const result = await patchImages({ keep: [ids[0]], files: [gifImage] });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("INVALID_IMAGE_FORMAT");
    await expectUnchanged(); // gambar lama yang harusnya dihapus tetap ada
  });

  test("should upload and delete nothing when one of the new images is broken", async () => {
    const result = await patchImages({
      keep: [ids[0]],
      files: [pngImage, brokenImage],
    });

    expect(result.status).toBe(400);
    await expectUnchanged(); // gambar pertama yang valid juga nggak boleh ter-upload
  });

  // ---------- Auth ----------

  test("should return unauthorized when authorization header is missing", async () => {
    const result = await patchImages({
      keep: [],
      files: [pngImage],
      authorization: null,
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
    await expectUnchanged();
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await patchImages({
      keep: [],
      files: [pngImage],
      authorization: "Bearer salah_access_token",
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
    await expectUnchanged();
  });

  test("should return unauthorized when auth scheme is wrong", async () => {
    const result = await patchImages({
      keep: [],
      files: [pngImage],
      authorization: `token salah ${accessToken}`,
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
    await expectUnchanged();
  });

  // ---------- Race condition dan kegagalan ----------

  test("should stay consistent when two identical edits run at the same time", async () => {
    const body = { keep: [primary.id, others[0].id] };

    const results = await Promise.all([patchImages(body), patchImages(body)]);

    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await dbImages(camera.id)).toHaveLength(2);
    await expectConsistent(camera.id);
  });

  test("should stay consistent when two edits add images at the same time (last write wins)", async () => {
    const results = await Promise.all([
      patchImages({ keep: ids, files: [pngImage] }),
      patchImages({ keep: ids, files: [pngImage] }),
    ]);

    expect(results.map((result) => result.status)).toEqual([200, 200]);

    // Edit kedua nggak tahu gambar baru milik edit pertama, jadi menghapusnya.
    // Dengan lock, hasil akhirnya selalu 4 (bukan 5), tanpa file yatim.
    expect(await dbImages(camera.id)).toHaveLength(4);
    await expectConsistent(camera.id);
  });

  test("should remove newly uploaded files when the transaction fails", async () => {
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await patchImages({
      keep: [primary.id],
      files: [pngImage, pngImage],
    });
    vi.restoreAllMocks();

    expect(result.status).toBe(500);
    await expectUnchanged(); // file baru bersih, file lama utuh
  });

  test("should return camera not found and clean up when the camera is deleted during the transaction (P2003)", async () => {
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      Object.assign(new Error("Foreign key constraint failed"), {
        code: "P2003",
      }),
    );

    const result = await patchImages({ keep: ids, files: [pngImage] });
    vi.restoreAllMocks();

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    await expectUnchanged();
  });

  test("should still return 200 when removing old files from storage fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const realStorage = supabase.storage;
    vi.spyOn(supabase, "storage", "get").mockReturnValue({
      from: (bucket) => {
        const real = realStorage.from(bucket);
        return {
          upload: (...args) => real.upload(...args),
          getPublicUrl: (...args) => real.getPublicUrl(...args),
          remove: async () => ({
            data: null,
            error: new Error("storage down"),
          }),
        };
      },
    });

    const result = await patchImages({ keep: [primary.id] });
    vi.restoreAllMocks();

    // DB sudah berubah walau storage gagal. File yatim dibersihkan afterEach.
    expect(result.status).toBe(200);
    expect(await dbImages(camera.id)).toHaveLength(1);
    expect(await listFileNames(camera.id)).toHaveLength(3);
  });

  test.each([
    ["points to another camera's folder", (other) => other.images[0].image_url],
    ["is not from the bucket", () => "https://example.com/foto.webp"],
  ])(
    "should not delete other files when a removed image url %s",
    async (_label, buildUrl) => {
      const other = await createCamera({ imageCount: 1 });
      const otherFiles = await listFileNames(other.id);

      vi.spyOn(console, "error").mockImplementation(() => {});

      // Baris dengan URL yang menunjuk ke tempat yang salah
      await prisma.cameraImage.create({
        data: {
          camera_id: camera.id,
          image_url: buildUrl(other),
          is_primary: false,
        },
      });

      const result = await patchImages({ keep: ids }); // baris tadi ikut terhapus
      vi.restoreAllMocks();

      expect(result.status).toBe(200);
      expect(await dbImages(camera.id)).toHaveLength(3);
      expect(await listFileNames(camera.id)).toEqual(originalFiles);
      expect(await listFileNames(other.id)).toEqual(otherFiles); // utuh
    },
  );
});
