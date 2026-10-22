import supertest from "supertest";
import { describe, expect, test } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("POST /users/login", () => {
  test("should cannot login if email or password is incorrect", async () => {
    const response = await supertest(web).post("/users/login").send({
      email: "wrongemail@gmail.com",
      password: "wrongpassword",
    });

    expect(response.status).toBe(401);
    expect(response.body.errors).toBe("INCORRECT_EMAIL_OR_PASSWORD");
  });

  test("should cannot login if email is not verified", async () => {
    const email = `unverified_${Date.now()}@gmail.com`;
    const password = "alymnfpassword";

    // 1. Buat user di Supabase dengan status BELUM diverifikasi (email_confirm: false)
    const createUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });
    const supabaseId = createUser.data.user.id;

    // 2. Coba login
    const response = await supertest(web).post("/users/login").send({
      email,
      password,
    });

    // 3. Ekspektasi: Harus ditolak dengan status 403 (EMAIL_NOT_VERIVIED)
    expect(response.status).toBe(403);
    expect(response.body.errors).toBe("EMAIL_NOT_VERIVIED");

    // Cleanup: Hapus user dari Supabase & Prisma
    await supabase.auth.admin.deleteUser(supabaseId);
    await prisma.user.delete({ where: { email } }).catch(() => {});
  });

  test("should can login successfully", async () => {
    const email = `login_${Date.now()}@gmail.com`;
    const password = "alymnfpassword";
    const name = "login user";

    // 1. Buat user di Supabase dengan status LANGSUNG TERVERIFIKASI (email_confirm: true)
    const createUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    const supabaseId = createUser.data.user.id;

    // 2. Tembak endpoint login
    const response = await supertest(web).post("/users/login").send({
      email,
      password,
    });

    // 3. Ekspektasi: Login sukses (200) dan ngembaliin token & profil
    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(email);
    expect(response.body.data.name).toBe("User"); // Nama default dari upsert login kita
    expect(response.body.data.access_token).toBeDefined();
    expect(response.body.data.refresh_token).toBeDefined();

    // 4. Verifikasi: Pastikan user juga otomatis ke-sync / ke-upsert ke database Prisma
    const userInPrisma = await prisma.user.findUnique({
      where: { supabase_id: supabaseId },
    });
    expect(userInPrisma).not.toBeNull();
    expect(userInPrisma.email).toBe(email);

    // Cleanup: Hapus data tes dari Supabase & Prisma
    await supabase.auth.admin.deleteUser(supabaseId);
    await prisma.user.delete({ where: { email } }).catch(() => {});
  });
});
