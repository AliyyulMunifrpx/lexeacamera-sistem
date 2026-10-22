import supertest from "supertest";
import { describe, expect, test } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js"; // <-- Jangan lupa import prisma buat cleanup lokal

describe("POST /users/register", () => {
  test("should register new users", async () => {
    const email = `aliyyulmunif_${Date.now()}@gmail.com`;
    const password = "alymnf123";
    const name = "aliyyul munif";

    try {
      const result = await supertest(web).post("/users/register").send({
        email,
        password,
        name,
      });

      expect(result.status).toBe(201);
      expect(result.body.data.email).toBe(email);
      expect(result.body.data.name).toBe(name);
    } finally {
      // Cleanup: Hapus dari Prisma & Supabase Auth
      await prisma.user.delete({ where: { email } }).catch(() => {});

      const authUser = await supabase.auth.admin.listUsers();
      const targetUser = authUser.data?.users.find((u) => u.email === email);
      if (targetUser) {
        await supabase.auth.admin.deleteUser(targetUser.id);
      }
    }
  });

  test("should reject if email already exists", async () => {
    const email = `duplicate_${Date.now()}@gmail.com`;
    const password = "alymnf123";
    const name = "duplicate user";

    try {
      // 1. Register pertama kali
      const firstRegister = await supertest(web).post("/users/register").send({
        email,
        password,
        name,
      });

      expect(firstRegister.status).toBe(201);

      // 2. Register dengan email yang sama
      const secondRegister = await supertest(web).post("/users/register").send({
        email,
        password,
        name,
      });

      expect(secondRegister.status).toBe(400);
      expect(secondRegister.body.errors).toBeDefined();
    } finally {
      // Cleanup: Hapus dari Prisma & Supabase Auth
      await prisma.user.delete({ where: { email } }).catch(() => {});

      const authUser = await supabase.auth.admin.listUsers();
      const targetUser = authUser.data?.users.find((u) => u.email === email);
      if (targetUser) {
        await supabase.auth.admin.deleteUser(targetUser.id);
      }
    }
  });

  test("should reject if email already exists in Supabase Auth", async () => {
    const email = `existing_${Date.now()}@gmail.com`;
    const password = "alymnf123";
    const name = "existing user";

    // 1. Buat user langsung di Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();

    const supabaseUserId = data.user.id;

    try {
      // 2. Register dengan email yang sudah ada di Supabase
      const result = await supertest(web).post("/users/register").send({
        email,
        password,
        name,
      });

      expect(result.status).toBe(400);
      expect(result.body.errors).toBeDefined();
    } finally {
      // 3. Cleanup meskipun assertion gagal
      await supabase.auth.admin.deleteUser(supabaseUserId);
      await prisma.user.delete({ where: { email } }).catch(() => {});
    }
  });

  test("should reject if email format is invalid", async () => {
    const result = await supertest(web).post("/users/register").send({
      email: "invalid-email",
      password: "alymnf123",
      name: "invalid email user",
    });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBeDefined();
  });

  test("should reject if password is less than 8 characters", async () => {
    const result = await supertest(web)
      .post("/users/register")
      .send({
        email: `short_password_${Date.now()}@gmail.com`,
        password: "alymnf",
        name: "short password user",
      });

    expect(result.status).toBe(400);
    expect(result.body.errors).toBeDefined();
  });
});
