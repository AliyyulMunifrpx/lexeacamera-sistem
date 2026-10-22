import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("delete /category/:id", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let tag;
  let category;

  const deleteCategory = (id) =>
    supertest(web)
      .delete(`/category/${id}`)
      .set("Authorization", `Bearer ${accessToken}`);

  beforeEach(async () => {
    const stamp = Date.now();
    email = `deletecategory_${stamp}@gmail.com`;
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

    // 3. Siapkan 1 kategori
    category = await prisma.category.create({
      data: { name: `cat_${tag}` },
    });
  });

  afterEach(async () => {
    // Kamera dulu baru kategori (FK). Test ini nggak upload gambar,
    // jadi nggak ada file di bucket yang perlu dibersihkan.
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

  test("should can delete category", async () => {
    const result = await deleteCategory(category.id);

    expect(result.status).toBe(200);

    const inDb = await prisma.category.findUnique({
      where: { id: category.id },
    });
    expect(inDb).toBeNull();
  });

  test("should return category not found", async () => {
    const result = await deleteCategory("123e4567-e89b-12d3-a456-426614174000"); // uuid ngasal

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CATEGORY_NOT_FOUND");
  });

  test("should return category not found when deleted twice", async () => {
    const first = await deleteCategory(category.id);
    const second = await deleteCategory(category.id);

    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
    expect(second.body.errors).toBe("CATEGORY_NOT_FOUND");
  });

  test("should return category still in use when it has cameras", async () => {
    await prisma.camera.create({
      data: {
        name: `Canon EOS 1500D ${tag}`,
        price: 5000000,
        condition: "SECOND",
        stock: 1,
        description: "",
        inclusions: "",
        category_id: category.id,
      },
    });

    const result = await deleteCategory(category.id);

    expect(result.status).toBe(400);
    expect(result.body.errors).toBe("CATEGORY_STILL_IN_USE");

    // Kategori harus tetap ada
    const inDb = await prisma.category.findUnique({
      where: { id: category.id },
    });
    expect(inDb).not.toBeNull();
  });

  test("should can delete category after its cameras are removed", async () => {
    const camera = await prisma.camera.create({
      data: {
        name: `Nikon D3500 ${tag}`,
        price: 7000000,
        condition: "NEW",
        stock: 1,
        description: "",
        inclusions: "",
        category_id: category.id,
      },
    });

    const blocked = await deleteCategory(category.id);
    expect(blocked.status).toBe(400);

    await prisma.camera.delete({ where: { id: camera.id } });

    const result = await deleteCategory(category.id);
    expect(result.status).toBe(200);
  });

  test("should return 400 when id is not a uuid", async () => {
    const result = await deleteCategory("bukan-uuid");

    expect(result.status).toBe(400);
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await supertest(web)
      .delete(`/category/${category.id}`)
      .set("Authorization", "Bearer salah_access_token");

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");

    // Kategori nggak boleh ikut kehapus
    const inDb = await prisma.category.findUnique({
      where: { id: category.id },
    });
    expect(inDb).not.toBeNull();
  });

  test("should return unauthorized when authorization header is missing", async () => {
    const result = await supertest(web).delete(`/category/${category.id}`);

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });
});
