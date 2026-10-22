import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("get /category", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let categoryIds;
  let tag;

  beforeEach(async () => {
    const stamp = Date.now();
    email = `getcategory_${stamp}@gmail.com`;
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

    // 3. Siapkan 2 kategori
    const categories = await Promise.all([
      prisma.category.create({ data: { name: `cat_a_${tag}` } }),
      prisma.category.create({ data: { name: `cat_b_${tag}` } }),
    ]);
    categoryIds = categories.map((category) => category.id);
  });

  afterEach(async () => {
    await prisma.category
      .deleteMany({ where: { id: { in: categoryIds } } })
      .catch(() => {});
    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
    supabaseId = undefined;
  });

  test("should can get all categories", async () => {
    const result = await supertest(web)
      .get("/category")
      .set("Authorization", `Bearer ${accessToken}`);
console.log(result.body)
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.data)).toBe(true);

    // DB bisa berisi kategori lain, jadi cek yang dibuat test ini ada di dalamnya
    const ids = result.body.data.map((category) => category.id);
    expect(ids).toEqual(expect.arrayContaining(categoryIds));

    const names = result.body.data.map((category) => category.name);
    expect(names).toEqual(
      expect.arrayContaining([`cat_a_${tag}`, `cat_b_${tag}`]),
    );
  });

  test("should only return id and name", async () => {
    const result = await supertest(web)
      .get("/category")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(result.status).toBe(200);
    expect(result.body.data.length).toBeGreaterThan(0);

    for (const category of result.body.data) {
      expect(Object.keys(category).sort()).toEqual(["created_at","id", "name",]);
    }
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await supertest(web)
      .get("/category")
      .set("Authorization", "Bearer salah_access_token");

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });

  test("should return unauthorized when authorization header is missing", async () => {
    const result = await supertest(web).get("/category");

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });
});