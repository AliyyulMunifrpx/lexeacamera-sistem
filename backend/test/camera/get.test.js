import crypto from "node:crypto";
import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("get /cameras/:id", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let tag;
  let category;
  let camera;
  let otherCamera;

  const getCamera = ({
    id = camera.id,
    authorization = `Bearer ${accessToken}`,
  } = {}) => {
    let request = supertest(web).get(`/cameras/${id}`);
    if (authorization) request = request.set("Authorization", authorization);
    return request;
  };

  beforeEach(async () => {
    const stamp = Date.now();
    email = `getcamera_${stamp}@gmail.com`;
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

    // 3. Kategori dan 2 kamera (langsung via prisma, jadi nggak ada file di bucket)
    category = await prisma.category.create({ data: { name: `cat_${tag}` } });

    camera = await prisma.camera.create({
      data: {
        name: `Canon EOS 1500D ${tag}`,
        price: 5500000,
        condition: "SECOND",
        stock: 3,
        description: "Kamera DSLR bekas, kondisi mulus",
        inclusions: "Body, baterai, charger, strap",
        category_id: category.id,
        promo: true,
        best_selling: false,
      },
    });

    otherCamera = await prisma.camera.create({
      data: {
        name: `Nikon D3500 ${tag}`,
        price: 7000000,
        condition: "NEW",
        stock: 1,
        category_id: category.id,
      },
    });
  });

  afterEach(async () => {
    // Kamera dulu baru kategori (FK)
    await prisma.camera
      .deleteMany({ where: { category: { name: { contains: tag } } } })
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

  test("should can get camera by id", async () => {
    const result = await getCamera();

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({
      id: camera.id,
      name: `Canon EOS 1500D ${tag}`,
      price: 5500000,
      condition: "SECOND",
      stock: 3,
      description: "Kamera DSLR bekas, kondisi mulus",
      inclusions: "Body, baterai, charger, strap",
      category_id: category.id,
      promo: true,
      best_selling: false,
    });
    expect(result.body.data.created_at).toBeDefined();
  });

  test("should return the requested camera, not another one", async () => {
    const result = await getCamera({ id: otherCamera.id });

    expect(result.status).toBe(200);
    expect(result.body.data.id).toBe(otherCamera.id);
    expect(result.body.data.name).toBe(`Nikon D3500 ${tag}`);
    expect(result.body.data.condition).toBe("NEW");
  });

  test("should return default values for fields that were not set", async () => {
    const result = await getCamera({ id: otherCamera.id });

    expect(result.status).toBe(200);
    expect(result.body.data.description).toBe("");
    expect(result.body.data.inclusions).toBe("");
    expect(result.body.data.promo).toBe(false);
    expect(result.body.data.best_selling).toBe(false);
  });

  // ---------- Tidak ditemukan ----------

  test("should return camera not found", async () => {
    const result = await getCamera({ id: crypto.randomUUID() });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
  });

  test("should return camera not found after the camera is deleted", async () => {
    await prisma.camera.delete({ where: { id: camera.id } });

    const result = await getCamera();

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CAMERA_NOT_FOUND");
  });

  // ---------- Validasi ----------

  test("should return 400 when id is not a uuid", async () => {
    const result = await getCamera({ id: "bukan-uuid" });

    expect(result.status).toBe(400);
  });

  // ---------- Auth ----------

  test("should return unauthorized when authorization header is missing", async () => {
    const result = await getCamera({ authorization: null });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await getCamera({
      authorization: "Bearer salah_access_token",
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });

  test("should return unauthorized when auth scheme is wrong", async () => {
    const result = await getCamera({
      authorization: `token salah ${accessToken}`,
    });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });
});
