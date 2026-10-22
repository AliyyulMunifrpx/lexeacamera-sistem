import crypto from "node:crypto";
import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

const BUCKET = process.env.SUPABASE_CAMERA_BUCKET;

// PNG 1x1 valid, biar lolos processImage tanpa perlu file fixture
const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
// GIF 1x1 valid: gambar asli yang bisa di-decode, tapi formatnya bukan webp/jpeg/png
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

// Hapus semua file gambar kamera di bucket Supabase
const removeCameraImages = async (cameraId) => {
  if (!BUCKET) {
    console.error("SUPABASE_CAMERA_BUCKET belum ke-load di test");
    return;
  }

  const folder = `cameras/${cameraId}`;
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(folder);

  if (error) {
    console.error("Cleanup list gagal:", error);
    return;
  }
  if (!files?.length) return;

  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove(files.map((file) => `${folder}/${file.name}`));

  if (removeError) console.error("Cleanup remove gagal:", removeError);
};

const listCameraImages = async (cameraId) => {
  const { data } = await supabase.storage
    .from(BUCKET)
    .list(`cameras/${cameraId}`);
  return data ?? [];
};

describe("post /cameras", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let tag;
  let categoryId;
  let marketplaceA;
  let marketplaceB;

  const validFields = () => ({
    name: "Canon EOS 1500D",
    price: "5500000",
    condition: "SECOND",
    stock: "3",
    description: "Kamera DSLR bekas, kondisi mulus",
    inclusions: "Body, baterai, charger, strap",
    category_id: categoryId,
    promo: "true",
    best_selling: "false",
  });

  // fields: timpa field valid (isi undefined untuk menghilangkan field)
  // authorization: null = tanpa header Authorization
  const postCamera = ({
    fields = {},
    images = [pngImage],
    authorization = `Bearer ${accessToken}`,
  } = {}) => {
    let request = supertest(web).post("/cameras");

    if (authorization) request = request.set("Authorization", authorization);

    for (const [key, value] of Object.entries({
      ...validFields(),
      ...fields,
    })) {
      if (value !== undefined) request = request.field(key, value);
    }

    for (const image of images) {
      request = request.attach("images", image.buffer, {
        filename: image.filename,
        contentType: image.contentType,
      });
    }

    return request;
  };

  const link = (marketplace, url = "https://www.tokopedia.com/toko/canon") => ({
    marketplace_id: marketplace.id,
    product_url: url,
  });

  const countCameras = () =>
    prisma.camera.count({ where: { category_id: categoryId } });

  // Paksa prisma.camera.create gagal sekali, sambil menangkap id kamera
  // supaya bisa dicek apakah gambar yang sudah ter-upload dibersihkan
  const mockCameraCreateFailure = (error) => {
    const captured = {};
    vi.spyOn(prisma.camera, "create").mockImplementationOnce(async (args) => {
      captured.cameraId = args.data.id;
      throw error;
    });
    return captured;
  };

  beforeEach(async () => {
    const stamp = Date.now();
    email = `createcamera_${stamp}@gmail.com`;
    password = "alymnfpassword";
    tag = `t${stamp}`;

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

    // 3. Siapkan kategori dan 2 marketplace
    const category = await prisma.category.create({
      data: { name: `cat_${tag}` },
    });
    categoryId = category.id;

    marketplaceA = await prisma.marketplace.create({
      data: {
        name: `mp_tokopedia_${tag}`,
        logo_url: "https://example.com/tokopedia.png",
        is_active: true,
      },
    });
    marketplaceB = await prisma.marketplace.create({
      data: {
        name: `mp_shopee_${tag}`,
        logo_url: "https://example.com/shopee.png",
        is_active: true,
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    if (categoryId) {
      // Ambil semua kamera hasil test, apapun test-nya
      const cameras = await prisma.camera.findMany({
        where: { category_id: categoryId },
        select: { id: true },
      });

      for (const camera of cameras) {
        await removeCameraImages(camera.id);
      }

      // Link marketplace ikut terhapus (onDelete: Cascade)
      await prisma.camera
        .deleteMany({ where: { category_id: categoryId } })
        .catch(() => {});
      await prisma.category
        .delete({ where: { id: categoryId } })
        .catch(() => {});
    }

    await prisma.marketplace
      .deleteMany({ where: { name: { contains: tag } } })
      .catch(() => {});
    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }

    categoryId = undefined;
    supabaseId = undefined;
  });

  // ---------- Sukses ----------

  test("should can create new camera", async () => {
    const result = await postCamera();

    expect(result.status).toBe(201);
    expect(result.body.data.id).toBeDefined();
    expect(result.body.data.name).toBe("Canon EOS 1500D");
    expect(result.body.data.price).toBe(5500000);
    expect(result.body.data.stock).toBe(3);
    expect(result.body.data.condition).toBe("SECOND");
    expect(result.body.data.promo).toBe(true);
    expect(result.body.data.best_selling).toBe(false);
    expect(result.body.data.category.id).toBe(categoryId);
    expect(result.body.data.images).toHaveLength(1);
    expect(result.body.data.images[0].is_primary).toBe(true);
    expect(result.body.data.marketplaceLinks).toEqual([]);

    // File benar-benar ada di bucket
    expect(await listCameraImages(result.body.data.id)).toHaveLength(1);
  });

  test("should can create camera with marketplace links", async () => {
    const result = await postCamera({
      fields: {
        marketplace: JSON.stringify([
          link(marketplaceA, "https://www.tokopedia.com/toko/canon"),
          link(marketplaceB, "https://shopee.co.id/canon"),
        ]),
      },
    });

    expect(result.status).toBe(201);
    expect(result.body.data.marketplaceLinks).toHaveLength(2);
    expect(
      result.body.data.marketplaceLinks.map((l) => l.marketplace_id).sort(),
    ).toEqual([marketplaceA.id, marketplaceB.id].sort());

    const links = await prisma.cameraMarketplaceLink.findMany({
      where: { camera_id: result.body.data.id },
    });
    expect(links).toHaveLength(2);
  });

  test("should use default values when optional fields are omitted", async () => {
    const result = await postCamera({
      fields: {
        condition: undefined,
        description: undefined,
        inclusions: undefined,
        promo: undefined,
        best_selling: undefined,
      },
    });

    expect(result.status).toBe(201);
    expect(result.body.data.condition).toBe("NEW");
    expect(result.body.data.description).toBe("");
    expect(result.body.data.inclusions).toBe("");
    expect(result.body.data.promo).toBe(false);
    expect(result.body.data.best_selling).toBe(false);
    expect(result.body.data.marketplaceLinks).toEqual([]);
  });

  test("should treat blank marketplace as no marketplace", async () => {
    const result = await postCamera({ fields: { marketplace: "" } });

    expect(result.status).toBe(201);
    expect(result.body.data.marketplaceLinks).toEqual([]);
  });

  test("should can upload multiple images and only the first is primary", async () => {
    const result = await postCamera({
      images: [pngImage, pngImage, pngImage],
    });

    expect(result.status).toBe(201);

    const { images } = result.body.data;
    expect(images).toHaveLength(3);
    expect(images.filter((image) => image.is_primary)).toHaveLength(1);
    expect(new Set(images.map((image) => image.image_url)).size).toBe(3);

    expect(await listCameraImages(result.body.data.id)).toHaveLength(3);
  });

  // ---------- Auth ----------

  test("should return unauthorized when authorization header is missing", async () => {
    const result = await postCamera({ authorization: null });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
    expect(await countCameras()).toBe(0);
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await postCamera({ authorization: "Bearer salah_token" });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
    expect(await countCameras()).toBe(0);
  });

  test("should return unauthorized when auth scheme is wrong", async () => {
    const result = await postCamera({
      authorization: `token salah ${accessToken}`,
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });

  // ---------- Relasi tidak ditemukan ----------

  test("should return category not found", async () => {
    const result = await postCamera({
      fields: { category_id: crypto.randomUUID() },
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CATEGORY_NOT_FOUND");
    expect(await countCameras()).toBe(0);
  });

  test("should return marketplace not found", async () => {
    const result = await postCamera({
      fields: {
        marketplace: JSON.stringify([
          {
            marketplace_id: crypto.randomUUID(),
            product_url: "https://a.com/x",
          },
        ]),
      },
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("MARKETPLACE_NOT_FOUND");
    expect(await countCameras()).toBe(0);
  });

  test("should return marketplace not found when only one of them exists", async () => {
    const result = await postCamera({
      fields: {
        marketplace: JSON.stringify([
          link(marketplaceA),
          {
            marketplace_id: crypto.randomUUID(),
            product_url: "https://a.com/x",
          },
        ]),
      },
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("MARKETPLACE_NOT_FOUND");
    // Kamera nggak boleh kebuat setengah-setengah
    expect(await countCameras()).toBe(0);
  });

  // ---------- Validasi field ----------

  test.each([
    ["name is missing", { name: undefined }],
    ["name is blank", { name: "   " }],
    ["name is longer than 100 chars", { name: "a".repeat(101) }],
    ["price is missing", { price: undefined }],
    ["price is negative", { price: "-1" }],
    ["price is not a number", { price: "murah" }],
    ["stock is missing", { stock: undefined }],
    ["stock is a decimal", { stock: "1.5" }],
    ["stock is negative", { stock: "-1" }],
    ["condition is invalid", { condition: "BEKAS" }],
    ["category_id is missing", { category_id: undefined }],
    ["category_id is not a uuid", { category_id: "bukan-uuid" }],
    [
      "description is longer than 1000 chars",
      { description: "a".repeat(1001) },
    ],
    ["inclusions is longer than 1000 chars", { inclusions: "a".repeat(1001) }],
  ])("should return 400 when %s", async (_label, fields) => {
    const result = await postCamera({ fields });

    expect(result.status).toBe(400);
    expect(await countCameras()).toBe(0);
  });

  // ---------- Validasi marketplace ----------

  test("should return invalid marketplace data when marketplace is not valid JSON", async () => {
    const result = await postCamera({ fields: { marketplace: "{bukan json" } });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("INVALID_MARKETPLACE_DATA");
    expect(await countCameras()).toBe(0);
  });

  test.each([
    ["marketplace is not an array", JSON.stringify({ a: 1 })],
    [
      "marketplace_id is not a uuid",
      JSON.stringify([
        { marketplace_id: "bukan-uuid", product_url: "https://a.com/x" },
      ]),
    ],
    [
      "product_url is not a url",
      JSON.stringify([
        { marketplace_id: crypto.randomUUID(), product_url: "bukan-url" },
      ]),
    ],
    [
      "product_url uses a non-http scheme",
      JSON.stringify([
        {
          marketplace_id: crypto.randomUUID(),
          product_url: "javascript:alert(1)",
        },
      ]),
    ],
    [
      "product_url is missing",
      JSON.stringify([{ marketplace_id: crypto.randomUUID() }]),
    ],
  ])("should return 400 when %s", async (_label, marketplace) => {
    const result = await postCamera({ fields: { marketplace } });

    expect(result.status).toBe(400);
    expect(await countCameras()).toBe(0);
  });

  test("should return 400 when the same marketplace is sent twice", async () => {
    const result = await postCamera({
      fields: {
        marketplace: JSON.stringify([
          link(marketplaceA, "https://www.tokopedia.com/toko/a"),
          link(marketplaceA, "https://www.tokopedia.com/toko/b"),
        ]),
      },
    });

    expect(result.status).toBe(400);
    expect(await countCameras()).toBe(0);
  });

  // ---------- Gambar ----------

  test("should return camera images required when no image is uploaded", async () => {
    const result = await postCamera({ images: [] });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("CAMERA_IMAGES_REQUIRED");
    expect(await countCameras()).toBe(0);
  });

  test("should return too many camera images when uploading 6 images", async () => {
    const result = await postCamera({
      images: Array.from({ length: 6 }, () => pngImage),
    });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("TOO_MANY_CAMERA_IMAGES");
    expect(await countCameras()).toBe(0);
  });

  test("should return invalid image format when uploading non webp/jpeg/png", async () => {
    const result = await postCamera({ images: [gifImage] });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("INVALID_IMAGE_FORMAT");
    expect(await countCameras()).toBe(0);
  });

  test("should return 400 when the image file is broken", async () => {
    const result = await postCamera({ images: [brokenImage] });

    expect(result.status).toBe(400);
    expect(["INVALID_IMAGE_FORMAT", "INVALID_IMAGE"]).toContain(
      result.body.errors,
    );
    expect(await countCameras()).toBe(0);
  });

  test("should not create camera when one of the images is broken", async () => {
    // Gambar pertama valid dan sempat ter-upload, gambar kedua rusak
    const result = await postCamera({ images: [pngImage, brokenImage] });

    expect(result.status).toBe(400);
    expect(await countCameras()).toBe(0);
  });

  // ---------- Rollback ----------

  test("should remove uploaded images when saving the camera fails", async () => {
    const captured = mockCameraCreateFailure(new Error("DB down"));

    const result = await postCamera();

    expect(result.status).toBe(500);
    expect(captured.cameraId).toBeDefined(); // upload sudah terjadi sebelum create
    expect(await listCameraImages(captured.cameraId)).toHaveLength(0);
    expect(await countCameras()).toBe(0);
  });

  test.each([
    ["category", "Camera_category_id_fkey (index)", "CATEGORY_NOT_FOUND"],
    [
      "marketplace",
      "CameraMarketplaceLink_marketplace_id_fkey (index)",
      "MARKETPLACE_NOT_FOUND",
    ],
  ])(
    "should return not found and clean up images when %s is deleted before create (P2003)",
    async (_label, fieldName, expectedError) => {
      const captured = mockCameraCreateFailure(
        Object.assign(new Error("Foreign key constraint failed"), {
          code: "P2003",
          meta: { field_name: fieldName },
        }),
      );

      const result = await postCamera();

      expect(result.status).toBe(404);
      expect(result.body.errors).toBe(expectedError);
      expect(await listCameraImages(captured.cameraId)).toHaveLength(0);
    },
  );
});
