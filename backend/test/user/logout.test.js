import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("post /users/current/logout", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;

  beforeEach(async () => {
    email = `logout_${Date.now()}@gmail.com`;
    password = "alymnfpassword";

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
    await prisma.user.delete({ where: { email } }).catch(() => {});
    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
    supabaseId = undefined;
  });

  test("should can logout", async () => {
    const result = await supertest(web)
      .post("/users/current/logout")
      .set("Authorization", `Bearer ${accessToken}`);
console.log(result.body)
    expect(result.status).toBe(200);
    expect(result.body.data.message).toBe("LOGGED_OUT");
  });

  test("should reject the token after logout", async () => {
    const logout = await supertest(web)
      .post("/users/current/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logout.status).toBe(200);

    // Token yang sama dipakai lagi, session-nya sudah di-revoke
    const result = await supertest(web)
      .post("/users/current/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });

  test("should return unauthorized when access token is invalid", async () => {
    const result = await supertest(web)
      .post("/users/current/logout")
      .set("Authorization", "Bearer salah_access_token");

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });

  test("should return unauthorized when authorization header is missing", async () => {
    const result = await supertest(web).post("/users/current/logout");

    expect(result.status).toBe(401);
    expect(result.body.errors).toBe("UNAUTHORIZED");
  });
});