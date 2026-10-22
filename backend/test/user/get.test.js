import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("GET /users/current", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let refreshToken;
  // Dijalankan SETIAP MAU MULAI SATU TEST
  beforeEach(async () => {
    email = `getuser_${Date.now()}@gmail.com`;
    password = "alymnfpassword";

    // 1. Siapkan user di Supabase Auth
    const createUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    supabaseId = createUser.data.user.id;

    // 2. Login untuk dapetin access_token supaya siap dipakai test
    const loginResponse = await supertest(web).post("/users/login").send({
      email,
      password,
    });

    accessToken = loginResponse.body.data.access_token;
    refreshToken = loginResponse.body.data.refresh_token;
  });

  // Dijalankan SETIAP SELESAI SATU TEST (Buat bersih-bersih)
  afterEach(async () => {
    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
  });

  test("should can get current login user", async () => {
    // Tinggal tembak endpoint aja karena token & user udah disiapin di beforeEach!
    const response = await supertest(web)
      .get("/users/current")
      .set("Authorization", `Bearer ${accessToken}`);
    console.log(response.body);
    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(email);
    expect(response.body.data.name).toBeDefined();
  });
  test("should get current user using refresh token without access token", async () => {
    const response = await supertest(web)
      .get("/users/current")
      .set("x-refresh-token", refreshToken);

    console.log(response.body);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(email);
    expect(response.body.data.name).toBeDefined();
  });
  test("should cannot get user if unauthorized (no token)", async () => {
    // Test ini sengaja tidak ngirim token untuk ngetes unautorized
    const response = await supertest(web).get("/users/current");

    expect(response.status).toBe(401);
    expect(response.body.errors).toBe("UNAUTHORIZED");
  });
  test("should fail if user exists in Supabase but not in Prisma", async () => {
    // 1. Hapus user dari Prisma setelah login di beforeEach
    await prisma.user.delete({
      where: { email },
    });

    // 2. Request menggunakan access token yang masih valid di Supabase
    const response = await supertest(web)
      .get("/users/current")
      .set("Authorization", `Bearer ${accessToken}`);

    // 3. Pastikan request ditolak karena user tidak ditemukan di Prisma
    expect(response.status).toBe(401);
    expect(response.body.errors).toBe("USER_DATABASE_MISMATCH");
  });
  test("should fail if refresh token is invalid", async () => {
    const response = await supertest(web)
      .get("/users/current")
      .set("x-refresh-token", "invalid-refresh-token");

    expect(response.status).toBe(401);
    expect(response.body.errors).toBe("SESSION_EXPIRED");
  });
});
