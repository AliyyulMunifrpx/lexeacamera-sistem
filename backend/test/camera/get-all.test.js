import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("get /cameras", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let tag;
  let categoryIds;
  let categoryA;
  let categoryB;

  const createCategory = async (label) => {
    const category = await prisma.category.create({
      data: { name: `${label}_${tag}` },
    });
    categoryIds.push(category.id);
    return category.id;
  };

  const createCamera = (overrides) =>
    prisma.camera.create({
      data: {
        description: "",
        inclusions: "",
        stock: 1,
        condition: "NEW",
        ...overrides,
      },
    });

  const getCameras = (query = {}) =>
    supertest(web)
      .get("/cameras")
      .set("Authorization", `Bearer ${accessToken}`)
      .query(query);

  beforeEach(async () => {
    const stamp = Date.now();
    email = `getcameras_${stamp}@gmail.com`;
    password = "alymnfpassword";
    tag = `t${stamp}`;
    categoryIds = [];

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

    // 3. Data kamera: 2 kategori, kondisi dan harga bervariasi
    categoryA = await createCategory("cat_a");
    categoryB = await createCategory("cat_b");

    await createCamera({
      name: `Canon EOS 1500D ${tag}`,
      price: 5000000,
      condition: "SECOND",
      category_id: categoryA,
    });
    await createCamera({
      name: `Nikon D3500 ${tag}`,
      price: 7000000,
      condition: "NEW",
      category_id: categoryA,
    });
    await createCamera({
      name: `Canon EOS R50 ${tag}`,
      price: 12000000,
      condition: "NEW",
      category_id: categoryA,
    });
    await createCamera({
      name: `Sony A6000 ${tag}`,
      price: 6000000,
      condition: "SECOND",
      category_id: categoryB,
    });
  });

  afterEach(async () => {
    // Kamera dulu baru kategori (FK). Test ini nggak upload gambar,
    // jadi nggak ada file di bucket yang perlu dibersihkan.
    if (categoryIds.length) {
      await prisma.camera
        .deleteMany({ where: { category_id: { in: categoryIds } } })
        .catch(() => {});
      await prisma.category
        .deleteMany({ where: { id: { in: categoryIds } } })
        .catch(() => {});
    }

    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
    supabaseId = undefined;
  });

  test("should return unauthorized when authorization header is missing", async () => {
    const result = await supertest(web).get("/cameras");

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await supertest(web)
      .get("/cameras")
      .set("Authorization", "Bearer salah_access_token");

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });

  test("should can get cameras with paging info", async () => {
    const result = await getCameras({ category_id: categoryA });
console.log(result.body)
    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(3);
    expect(result.body.paging).toEqual({
      page: 1,
      per_page: 20,
      total: 3,
      total_pages: 1,
    });
    // include category dari service
    expect(result.body.data[0].category.id).toBe(categoryA);
  });

  
});
