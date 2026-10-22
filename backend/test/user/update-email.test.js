import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { supabase } from "../../src/application/supabase.js";
import { prisma } from "../../src/lib/database.js";
import { web } from "../../src/application/web.js";



const password = "TestPassword123!";
const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const primaryEmail = `update-email-${uniqueId}@example.com`;
const duplicateEmail = `duplicate-email-${uniqueId}@example.com`;
const invalidEmail = "not-an-email";

let primaryUser;
let accessToken;
let authUserIds = [];

async function createTestUser(email) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw error;

  authUserIds.push(data.user.id);

  const prismaUser = await prisma.user.create({
    data: {
      supabase_id: data.user.id,
      name: "Email Test User",
      email,
    },
  });

  return prismaUser;
}
async function login(email) {
  const response = await request(web).post("/users/login").send({
    email,
    password,
  });

  expect(response.status).toBe(200);

  const token = response.body.data?.access_token;

  expect(token).toBeTruthy();

  return token;
}

describe("PATCH /users/current/email", () => {
  beforeEach(async () => {
    primaryUser = await createTestUser(primaryEmail);
    accessToken = await login(primaryEmail);
  });

  afterEach(async () => {
    // Bersihkan data Prisma terlebih dahulu.
    await prisma.user.deleteMany({
      where: {
        supabase_id: {
          in: authUserIds,
        },
      },
    });

    // Hapus user testing dari Supabase Auth.
    for (const userId of authUserIds) {
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        console.error("Failed to delete test Auth user:", error.message);
      }
    }

    authUserIds = [];
  });

  it("should request an email change successfully", async () => {
    const newEmail = `new-email-${uniqueId}@example.com`;

    const response = await request(web)
      .patch("/users/current/email")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: newEmail });

    expect(response.status).toBe(200);

    // Email Prisma tidak boleh langsung berubah sebelum verifikasi.
    const prismaUser = await prisma.user.findUnique({
      where: { id: primaryUser.id },
    });

    expect(prismaUser.email).toBe(primaryEmail);
  });

  it("should not request a change when the email is unchanged", async () => {
    const response = await request(web)
      .patch("/users/current/email")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: primaryEmail });

    expect(response.status).toBe(200);

    const prismaUser = await prisma.user.findUnique({
      where: { id: primaryUser.id },
    });

    expect(prismaUser.email).toBe(primaryEmail);
  });

  it("should reject an email already used by another Prisma user", async () => {
    await createTestUser(duplicateEmail);

    const response = await request(web)
      .patch("/users/current/email")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: duplicateEmail });

    expect(response.status).toBe(409);

    const prismaUser = await prisma.user.findUnique({
      where: { id: primaryUser.id },
    });

    expect(prismaUser.email).toBe(primaryEmail);
  });

  it("should reject an invalid email format", async () => {
    const response = await request(web)
      .patch("/users/current/email")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: invalidEmail });

    expect(response.status).toBe(400);
  });

  it("should reject a request without authentication", async () => {
    const response = await request(web)
      .patch("/users/current/email")
      .send({
        email: `unauth-${uniqueId}@example.com`,
      });

    expect(response.status).toBe(401);
  });
});
