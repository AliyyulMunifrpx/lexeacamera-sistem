import crypto from "node:crypto";
import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("patch /cameras/:id", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let tag;
  let categoryA;
  let categoryB;
  let marketplaceA;
  let marketplaceB;
  let camera;
  let original;
  let originalLinks;

  const patchCamera = ({
    id = camera.id,
    body = {},
    authorization = `Bearer ${accessToken}`,
  } = {}) => {
    let request = supertest(web).patch(`/cameras/${id}`);
    if (authorization) request = request.set("Authorization", authorization);
    return request.send(body);
  };

  const link = (marketplace, url = "https://www.tokopedia.com/toko/canon") => ({
    marketplace_id: marketplace.id,
    product_url: url,
  });

  const getCamera = () =>
    prisma.camera.findUnique({ where: { id: camera.id } });
  const getLinks = () =>
    prisma.cameraMarketplaceLink.findMany({ where: { camera_id: camera.id } });

  // Pastikan request yang gagal nggak mengubah apa-apa
  const expectUnchanged = async () => {
    expect(await getCamera()).toEqual(original);
    expect(await getLinks()).toEqual(originalLinks);
  };

  beforeEach(async () => {
    const stamp = Date.now();
    email = `updatecamera_${stamp}@gmail.com`;
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

    // 3. Siapkan 2 kategori dan 2 marketplace
    categoryA = await prisma.category.create({
      data: { name: `cat_a_${tag}` },
    });
    categoryB = await prisma.category.create({
      data: { name: `cat_b_${tag}` },
    });

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

    // 4. Kamera awal (langsung via prisma, jadi nggak ada file di bucket)
    //    Sengaja pakai nilai non-default (promo true, stock 3) supaya
    //    perubahan ke nilai falsy terdeteksi.
    camera = await prisma.camera.create({
      data: {
        name: `Canon EOS 1500D ${tag}`,
        price: 5500000,
        condition: "SECOND",
        stock: 3,
        description: "Kamera DSLR bekas, kondisi mulus",
        inclusions: "Body, baterai, charger, strap",
        category_id: categoryA.id,
        promo: true,
        best_selling: false,
        marketplaceLinks: {
          create: [link(marketplaceA, "https://www.tokopedia.com/toko/awal")],
        },
      },
    });

    original = await getCamera();
    originalLinks = await getLinks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Link marketplace ikut terhapus (onDelete: Cascade)
    await prisma.camera
      .deleteMany({ where: { category: { name: { contains: tag } } } })
      .catch(() => {});
    await prisma.category
      .deleteMany({ where: { name: { contains: tag } } })
      .catch(() => {});
    await prisma.marketplace
      .deleteMany({ where: { name: { contains: tag } } })
      .catch(() => {});
    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
    supabaseId = undefined;
  });

  // ---------- Sukses ----------

  test("should only change the fields that are sent", async () => {
    const result = await patchCamera({ body: { name: `Canon R50 ${tag}` } });

    expect(result.status).toBe(200);
    expect(result.body.data.id).toBe(camera.id);
    expect(result.body.data.name).toBe(`Canon R50 ${tag}`);

    // Sisanya nggak boleh berubah
    expect(result.body.data.price).toBe(5500000);
    expect(result.body.data.stock).toBe(3);
    expect(result.body.data.condition).toBe("SECOND");
    expect(result.body.data.promo).toBe(true);
    expect(result.body.data.category.id).toBe(categoryA.id);
    expect(result.body.data.marketplaceLinks).toHaveLength(1);

    const inDb = await getCamera();
    expect(inDb).toEqual({ ...original, name: `Canon R50 ${tag}` });
  });

  test("should can update all fields at once", async () => {
    const body = {
      name: `Nikon D3500 ${tag}`,
      price: 7000000,
      condition: "NEW",
      stock: 10,
      description: "Kamera baru segel",
      inclusions: "Body, lensa kit",
      category_id: categoryB.id,
      promo: false,
      best_selling: true,
    };

    const result = await patchCamera({ body });

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({
      id: camera.id,
      name: body.name,
      price: 7000000,
      condition: "NEW",
      stock: 10,
      description: body.description,
      inclusions: body.inclusions,
      promo: false,
      best_selling: true,
    });
    expect(result.body.data.category.id).toBe(categoryB.id);

    const inDb = await getCamera();
    expect(inDb.category_id).toBe(categoryB.id);
    expect(inDb.name).toBe(body.name);
  });

  test("should keep falsy values (0, false, empty string)", async () => {
    const result = await patchCamera({
      body: {
        price: 0,
        stock: 0,
        promo: false,
        description: "",
        inclusions: "",
      },
    });

    expect(result.status).toBe(200);

    const inDb = await getCamera();
    expect(inDb.price).toBe(0);
    expect(inDb.stock).toBe(0);
    expect(inDb.promo).toBe(false);
    expect(inDb.description).toBe("");
    expect(inDb.inclusions).toBe("");
  });

  test("should trim the name", async () => {
    const result = await patchCamera({
      body: { name: `  Sony A6000 ${tag}  ` },
    });

    expect(result.status).toBe(200);
    expect(result.body.data.name).toBe(`Sony A6000 ${tag}`);
  });

  test("should return 200 when the values are the same as before", async () => {
    const result = await patchCamera({
      body: { name: original.name, stock: original.stock },
    });

    expect(result.status).toBe(200);
    expect(await getCamera()).toEqual(original);
  });

  // ---------- Marketplace ----------

  test("should not touch marketplace links when marketplace is omitted", async () => {
    const result = await patchCamera({ body: { stock: 9 } });

    expect(result.status).toBe(200);
    expect(await getLinks()).toEqual(originalLinks);
  });

  test("should replace marketplace links", async () => {
    const result = await patchCamera({
      body: { marketplace: [link(marketplaceB, "https://shopee.co.id/canon")] },
    });

    expect(result.status).toBe(200);
    expect(result.body.data.marketplaceLinks).toHaveLength(1);
    expect(result.body.data.marketplaceLinks[0].marketplace_id).toBe(
      marketplaceB.id,
    );

    const links = await getLinks();
    expect(links).toHaveLength(1);
    expect(links[0].marketplace_id).toBe(marketplaceB.id);
  });

  test("should can replace a link with the same marketplace but a new url", async () => {
    // Menjaga urutan delete-lalu-create. Kalau create jalan duluan,
    // unique (camera_id, marketplace_id) akan bentrok.
    const result = await patchCamera({
      body: {
        marketplace: [
          link(marketplaceA, "https://www.tokopedia.com/toko/baru"),
        ],
      },
    });

    expect(result.status).toBe(200);

    const links = await getLinks();
    expect(links).toHaveLength(1);
    expect(links[0].product_url).toBe("https://www.tokopedia.com/toko/baru");
  });

  test("should can send multiple marketplaces", async () => {
    const result = await patchCamera({
      body: {
        marketplace: [
          link(marketplaceA, "https://www.tokopedia.com/toko/a"),
          link(marketplaceB, "https://shopee.co.id/b"),
        ],
      },
    });

    expect(result.status).toBe(200);
    expect(
      result.body.data.marketplaceLinks.map((l) => l.marketplace_id).sort(),
    ).toEqual([marketplaceA.id, marketplaceB.id].sort());
  });

  test("should remove all marketplace links when marketplace is an empty array", async () => {
    const result = await patchCamera({ body: { marketplace: [] } });

    expect(result.status).toBe(200);
    expect(result.body.data.marketplaceLinks).toEqual([]);
    expect(await getLinks()).toHaveLength(0);
  });

  // ---------- Tidak ditemukan ----------

  test("should return camera not found", async () => {
    const result = await patchCamera({
      id: crypto.randomUUID(),
      body: { name: `x ${tag}` },
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
    await expectUnchanged();
  });

  test("should return category not found and change nothing", async () => {
    const result = await patchCamera({
      body: { name: `x ${tag}`, category_id: crypto.randomUUID() },
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CATEGORY_NOT_FOUND");
    await expectUnchanged();
  });

  test("should return marketplace not found and change nothing", async () => {
    const result = await patchCamera({
      body: {
        name: `x ${tag}`,
        marketplace: [
          {
            marketplace_id: crypto.randomUUID(),
            product_url: "https://a.com/x",
          },
        ],
      },
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("MARKETPLACE_NOT_FOUND");
    await expectUnchanged(); // link lama harus tetap ada
  });

  test("should return marketplace not found when only one of them exists", async () => {
    const result = await patchCamera({
      body: {
        marketplace: [
          link(marketplaceB),
          {
            marketplace_id: crypto.randomUUID(),
            product_url: "https://a.com/x",
          },
        ],
      },
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("MARKETPLACE_NOT_FOUND");
    await expectUnchanged();
  });

  // ---------- Validasi ----------

  test("should return 400 when id is not a uuid", async () => {
    const result = await patchCamera({
      id: "bukan-uuid",
      body: { name: `x ${tag}` },
    });

    expect(result.status).toBe(400);
  });

  test("should return 400 when body is empty", async () => {
    const result = await patchCamera({ body: {} });

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  test("should return 400 when there is no body at all", async () => {
    const result = await supertest(web)
      .patch(`/cameras/${camera.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  test.each([
    ["an unknown field is sent", { foo: "bar" }],
    ["images is sent", { images: ["x"] }],
    ["created_at is sent", { created_at: "2020-01-01" }],
    ["name is blank", { name: "   " }],
    ["name is null", { name: null }],
    ["name is longer than 100 chars", { name: "a".repeat(101) }],
    ["price is negative", { price: -1 }],
    ["price is not a number", { price: "murah" }],
    ["stock is a decimal", { stock: 1.5 }],
    ["stock is negative", { stock: -1 }],
    ["condition is invalid", { condition: "BEKAS" }],
    ["condition is lowercase", { condition: "new" }],
    ["category_id is not a uuid", { category_id: "bukan-uuid" }],
    ["description is null", { description: null }],
    [
      "description is longer than 1000 chars",
      { description: "a".repeat(1001) },
    ],
    ["inclusions is longer than 1000 chars", { inclusions: "a".repeat(1001) }],
    ["promo is not a boolean", { promo: "ya" }],
    ["best_selling is not a boolean", { best_selling: 5 }],
  ])("should return 400 when %s", async (_label, body) => {
    const result = await patchCamera({ body });

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  test.each([
    ["marketplace is null", null],
    ["marketplace is not an array", { a: 1 }],
    [
      "marketplace_id is not a uuid",
      [{ marketplace_id: "bukan-uuid", product_url: "https://a.com/x" }],
    ],
    [
      "product_url is not a url",
      [{ marketplace_id: crypto.randomUUID(), product_url: "bukan-url" }],
    ],
    [
      "product_url uses a non-http scheme",
      [
        {
          marketplace_id: crypto.randomUUID(),
          product_url: "javascript:alert(1)",
        },
      ],
    ],
    ["product_url is missing", [{ marketplace_id: crypto.randomUUID() }]],
    ["marketplace_id is missing", [{ product_url: "https://a.com/x" }]],
    [
      "a marketplace item has an unknown field",
      [
        {
          marketplace_id: crypto.randomUUID(),
          product_url: "https://a.com/x",
          foo: "bar",
        },
      ],
    ],
  ])("should return 400 when %s", async (_label, marketplace) => {
    const result = await patchCamera({ body: { marketplace } });

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  test("should return 400 when the same marketplace is sent twice", async () => {
    const result = await patchCamera({
      body: {
        marketplace: [
          link(marketplaceB, "https://shopee.co.id/a"),
          link(marketplaceB, "https://shopee.co.id/b"),
        ],
      },
    });

    expect(result.status).toBe(400);
    await expectUnchanged();
  });

  // ---------- Auth ----------

  test("should return unauthorized when authorization header is missing", async () => {
    const result = await patchCamera({
      authorization: null,
      body: { name: `x ${tag}` },
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
    await expectUnchanged();
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await patchCamera({
      authorization: "Bearer salah_access_token",
      body: { name: `x ${tag}` },
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
    await expectUnchanged();
  });

  test("should return unauthorized when auth scheme is wrong", async () => {
    const result = await patchCamera({
      authorization: `token salah ${accessToken}`,
      body: { name: `x ${tag}` },
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
    await expectUnchanged();
  });

  // ---------- Race condition ----------

  test("should not return 500 when two edits replace marketplace links at the same time", async () => {
    const body = {
      marketplace: [link(marketplaceA, "https://www.tokopedia.com/toko/race")],
    };

    const results = await Promise.all([
      patchCamera({ body }),
      patchCamera({ body }),
    ]);

    // Salah satu menang. Yang kalah boleh 409, tapi tidak boleh 500
    for (const result of results) {
      expect([200, 409]).toContain(result.status);
      if (result.status === 409) {
        expect(result.body.errors).toBe("CAMERA_UPDATE_CONFLICT");
      }
    }
    expect(results.some((result) => result.status === 200)).toBe(true);

    // Link nggak boleh dobel atau hilang
    expect(await getLinks()).toHaveLength(1);
  });

  test("should return conflict when prisma throws P2002", async () => {
    vi.spyOn(prisma.camera, "update").mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const result = await patchCamera({ body: { name: `x ${tag}` } });

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("CAMERA_UPDATE_CONFLICT");
  });

  test("should return camera not found when it is deleted before update (P2025)", async () => {
    vi.spyOn(prisma.camera, "update").mockRejectedValueOnce(
      Object.assign(new Error("Record to update not found"), { code: "P2025" }),
    );

    const result = await patchCamera({ body: { name: `x ${tag}` } });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
  });

  test.each([
    ["category", "Camera_category_id_fkey (index)", "CATEGORY_NOT_FOUND"],
    [
      "marketplace",
      "CameraMarketplaceLink_marketplace_id_fkey (index)",
      "MARKETPLACE_NOT_FOUND",
    ],
    [
      "camera",
      "CameraMarketplaceLink_camera_id_fkey (index)",
      "CAMERA_NOT_FOUND",
    ],
  ])(
    "should return not found when %s is deleted during update (P2003)",
    async (_label, fieldName, expectedError) => {
      vi.spyOn(prisma.camera, "update").mockRejectedValueOnce(
        Object.assign(new Error("Foreign key constraint failed"), {
          code: "P2003",
          meta: { field_name: fieldName },
        }),
      );

      const result = await patchCamera({ body: { name: `x ${tag}` } });

      expect(result.status).toBe(404);
      expect(result.body.errors).toBe(expectedError);
    },
  );

  test("should not hide unknown database errors", async () => {
    vi.spyOn(prisma.camera, "update").mockRejectedValueOnce(
      new Error("DB down"),
    );

    const result = await patchCamera({ body: { name: `x ${tag}` } });

    expect(result.status).toBe(500);
  });
});
