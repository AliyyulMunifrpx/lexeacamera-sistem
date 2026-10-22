import supertest from "supertest";
import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("patch /category/:id", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let tag;
  let categoryA;
  let categoryB;

  const patchCategory = (id, body) =>
    supertest(web)
      .patch(`/category/${id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);

  beforeEach(async () => {
    const stamp = Date.now();
    email = `updatecategory_${stamp}@gmail.com`;
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

    // 3. Siapkan 2 kategori
    categoryA = await prisma.category.create({ data: { name: `cat_a_${tag}` } });
    categoryB = await prisma.category.create({ data: { name: `cat_b_${tag}` } });
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Hapus by tag, jadi kategori hasil rename juga ikut kehapus
    await prisma.category
      .deleteMany({ where: { name: { contains: tag } } })
      .catch(() => {});
    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
    supabaseId = undefined;
  });

  test("should can update category name", async () => {
    const newName = `cat_updated_${tag}`;

    const result = await patchCategory(categoryA.id, { name: newName });
console.log(result.body)
    expect(result.status).toBe(200);
    expect(result.body.data.id).toBe(categoryA.id);
    expect(result.body.data.name).toBe(newName);

    const inDb = await prisma.category.findUnique({
      where: { id: categoryA.id },
    });
    expect(inDb.name).toBe(newName);
  });

  test("should return category not found", async () => {
    const result = await patchCategory("123e4567-e89b-12d3-a456-426614174000", {
      name: `cat_x_${tag}`,
    });

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("CATEGORY_NOT_FOUND");
  });

  test("should return category already exist when name is taken", async () => {
    // Ganti nama A jadi nama yang sudah dipakai B
    const result = await patchCategory(categoryA.id, { name: categoryB.name });

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("CATEGORY_ALREADY_EXIST");

    // Nama A nggak boleh berubah
    const inDb = await prisma.category.findUnique({
      where: { id: categoryA.id },
    });
    expect(inDb.name).toBe(categoryA.name);
  });

  test("should return category already exist on race condition (P2002)", async () => {
    // A dan B sama-sama diganti ke nama yang sama, dikirim bersamaan
    const sameName = `cat_race_${tag}`;

    const [res1, res2] = await Promise.all([
      patchCategory(categoryA.id, { name: sameName }),
      patchCategory(categoryB.id, { name: sameName }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const failed = res1.status === 409 ? res1 : res2;
    expect(failed.body.errors).toBe("CATEGORY_ALREADY_EXIST");

    // Di DB cuma boleh ada 1 kategori dengan nama itu
    const count = await prisma.category.count({ where: { name: sameName } });
    expect(count).toBe(1);
  });

  test("should return category already exist when prisma throws P2002", async () => {
    // Deterministik: paksa prisma.update melempar P2002,
    // jadi pasti masuk ke catch di service
    vi.spyOn(prisma.category, "update").mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const result = await patchCategory(categoryA.id, {
      name: `cat_p2002_${tag}`,
    });

    expect(result.status).toBe(409);
    expect(result.body.errors).toBe("CATEGORY_ALREADY_EXIST");
  });

  test("should return 400 when name is empty", async () => {
    const result = await patchCategory(categoryA.id, { name: "" });

    expect(result.status).toBe(400);
  });

  test("should return 400 when name is missing", async () => {
    const result = await patchCategory(categoryA.id, {});

    expect(result.status).toBe(400);
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await supertest(web)
      .patch(`/category/${categoryA.id}`)
      .set("Authorization", "Bearer salah_access_token")
      .send({ name: `cat_x_${tag}` });

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");

    const inDb = await prisma.category.findUnique({
      where: { id: categoryA.id },
    });
    expect(inDb.name).toBe(categoryA.name);
  });
});