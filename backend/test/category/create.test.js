import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("post /category", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let categoryName;

  beforeEach(async () => {
    email = `createcategory_${Date.now()}@gmail.com`;
    password = "alymnfpassword";
    categoryName = `test_category_${Date.now()}`;

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
  });

  afterEach(async () => {
    // Hapus kategori berdasarkan nama, jadi aman walau test gagal di tengah
    await prisma.category.deleteMany({ where: { name: categoryName } });
    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
  });

  test("should can create new category", async () => {
    const result = await supertest(web)
      .post("/category")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: categoryName });
      console.log(result.body)

    expect(result.status).toBe(201);
    expect(result.body.data.id).toBeDefined();
    expect(result.body.data.name).toBe(categoryName);
  });

  test("should reject duplicate category name on race condition (P2002)", async () => {
    // Dua request dikirim bersamaan dengan nama sama
    const [res1, res2] = await Promise.all([
      supertest(web)
        .post("/category")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: categoryName }),
      supertest(web)
        .post("/category")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: categoryName }),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // Satu berhasil, satu kena P2002 -> 409
    expect(statuses).toEqual([201, 409]);

    // Di DB harus tetap cuma 1 kategori dengan nama itu
    const count = await prisma.category.count({
      where: { name: categoryName },
    });
    expect(count).toBe(1);
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await supertest(web)
      .post("/category")
      .set("Authorization", "Bearer salah_access_token")
      .send({ name: categoryName });

    expect(result.status).toBe(401);

    // Pastikan kategori nggak ikut kebuat
    const count = await prisma.category.count({
      where: { name: categoryName },
    });
    expect(count).toBe(0);
  });
  test("should can reject if types name is invalid", async () => {
    const result = await supertest(web)
      .post("/category")
        .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: 123 });

    expect(result.status).toBe(400);

    // Pastikan kategori nggak ikut kebuat
    const count = await prisma.category.count({
      where: { name: categoryName },
    });
    expect(count).toBe(0);
  });
});
