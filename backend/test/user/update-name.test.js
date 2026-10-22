
import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("PATCH /users/current/name", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;

  beforeEach(async () => {
    email = `updatename_${Date.now()}@gmail.com`;
    password = "alymnfpassword";

    const createUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUser.error) {
      throw createUser.error;
    }

    supabaseId = createUser.data.user.id;

    const loginResponse = await supertest(web)
      .post("/users/login")
      .send({ email, password });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.access_token;
    expect(accessToken).toBeTruthy();
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email } });

    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
  });

  test("should update current user's name successfully", async () => {
    const newName = "Nama Baru";

    const response = await supertest(web)
      .patch("/users/current/name")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: newName });
    expect(response.status).toBe(200);

    // Sesuaikan assertion ini dengan bentuk response endpoint lo.
    // Contoh jika response mengembalikan { data: { name: "Nama Baru" } }:
    expect(response.body.data.name).toBe(newName);
    const updatedUser = await prisma.user.findUnique({
      where: { email },
    });

    expect(updatedUser.name).toBe(newName);
  });
});
