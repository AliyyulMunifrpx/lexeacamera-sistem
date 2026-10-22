import supertest from "supertest";
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { web } from "../../src/application/web.js";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";

describe("PATCH /users/current/password", () => {
  let email;
  let password;
  let supabaseId;
  let accessToken;
  let refreshToken;
  beforeEach(async () => {
    email = `updatepassword_${Date.now()}@gmail.com`;
    password = "alymnfpassword";

    // 1. Buat user di Supabase Auth
    const createUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUser.error) {
      throw createUser.error;
    }

    supabaseId = createUser.data.user.id;

    // 2. Login untuk mendapatkan access token
    const loginResponse = await supertest(web).post("/users/login").send({
      email,
      password,
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.access_token;
    refreshToken = loginResponse.body.data.refresh_token;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { email } }).catch(() => {});

    if (supabaseId) {
      await supabase.auth.admin.deleteUser(supabaseId).catch(() => {});
    }
  });

  test("should update password successfully", async () => {
    const newPassword = "inipasswordbaru";

    const response = await supertest(web)
      .patch("/users/current/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        new_password: newPassword,
        current_password: password,
      });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("PASSWORD_UPDATED");

    // Pastikan password baru bisa digunakan untuk login
    const loginResponse = await supertest(web).post("/users/login").send({
      email,
      password: newPassword,
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.access_token).toBeDefined();
  });
  test("should update password successfully with refresh token only", async () => {
    const newPassword = "inipasswordbaru";

    const response = await supertest(web)
      .patch("/users/current/password")
      .set("x-refresh-token", refreshToken)
      .send({
        new_password: newPassword,
        current_password: password,
      });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("PASSWORD_UPDATED");

    // Pastikan password baru bisa digunakan untuk login
    const loginResponse = await supertest(web).post("/users/login").send({
      email,
      password: newPassword,
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.access_token).toBeDefined();
  });

  test("should can reject is curret password is incorrect", async () => {
    const newPassword = "inipasswordbaru";

    const response = await supertest(web)
      .patch("/users/current/password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        new_password: newPassword,
        current_password: password + "123",
      });
    expect(response.status).toBe(400);
    expect(response.body.errors).toBe("CURRENT_PASSWORD_INVALID");

    // Pastikan password baru bisa digunakan untuk login
    const loginResponse = await supertest(web).post("/users/login").send({
      email,
      password: newPassword,
    });
    console.log(loginResponse);
    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.errors).toBe("INCORRECT_EMAIL_OR_PASSWORD");
  });

  test("should return PASSWORD_UPDATE_FAILED when Supabase update fails", async () => {
    const updatePasswordMock = vi
      .spyOn(supabase.auth.admin, "updateUserById")
      .mockResolvedValue({
        data: { user: null },
        error: { message: "Simulated password update failure" },
      });

    try {
      const response = await supertest(web)
        .patch("/users/current/password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          current_password: password,
          new_password: "inipasswordbaru",
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBe("PASSWORD_UPDATE_FAILED");

      expect(updatePasswordMock).toHaveBeenCalledOnce();
    } finally {
      updatePasswordMock.mockRestore();
    }
  });
});
