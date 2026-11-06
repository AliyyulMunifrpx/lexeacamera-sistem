import logger from "../application/logging.js";
import { createAuthClient, supabase } from "../application/supabase.js";
import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
import { hashPin } from "../utils/secret.js";
import { setPinValidation } from "../validation/pin-validation.js";
import {
  getUserValidation,
  loginUserValidation,
  registerUserValidation,
  updateEmailValidation,
  updateNameValidation,
  updatePasswordValidation,
} from "../validation/user-validation.js";
import { validate } from "../validation/validation.js";
import crypto from "node:crypto";
function emailLockKey(email) {
  const hash = crypto.createHash("md5").update(email.toLowerCase()).digest();
  return hash.readBigInt64BE(0);
}
const register = async function (request) {
  const user = validate(registerUserValidation, request);

  // Fast-fail murah sebelum menyentuh lock / Supabase
  if (await prisma.user.findFirst({ select: { id: true } })) {
    throw new ResponseError(400, "USER_ALREADY_EXIST");
  }

  return await prisma.$transaction(
    async (tx) => {
      // Lock global: semua register diserialkan, bukan per email
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('user_register_singleton'))`;

      // Cek ulang di dalam lock, ini yang jadi acuan
      const existingUser = await tx.user.findFirst({ select: { id: true } });
      if (existingUser) {
        throw new ResponseError(400, "USER_ALREADY_EXIST");
      }

      let authData;
      try {
        const result = await createAuthClient().auth.signUp({
          email: user.email,
          password: user.password,
          options: {
            emailRedirectTo: `${process.env.FRONTEND_URL}/auth/login`,
          },
        });
        if (result.error) {
          logger.error("SUPABASE SIGNUP ERROR", result.error);
          throw new ResponseError(400, "EMAIL_ALREADY_EXIST");
        }
        authData = result.data;
      } catch (e) {
        if (e instanceof ResponseError) throw e;
        logger.error("SUPABASE SIGNUP THREW (raw):", e);
        throw new ResponseError(400, "EMAIL_ALREADY_EXIST");
      }

      if (!authData?.user || authData.user.identities?.length === 0) {
        throw new ResponseError(400, "EMAIL_ALREADY_EXIST");
      }

      try {
        return await tx.user.create({
          data: {
            supabase_id: authData.user.id,
            email: user.email,
            name: user.name,
            // Register publik hanya untuk pemilik pertama. Admin dibuat oleh owner.
            role: "OWNER",
          },
          select: { email: true, name: true },
        });
      } catch (e) {
        logger.error("PRISMA CREATE ERROR:", e);
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
        } catch (cleanupError) {
          logger.error("SUPABASE CLEANUP FAILED:", cleanupError);
        }
        // Email duplikat atau index single-row: dua-duanya berarti sudah ada user
        if (e.code === "P2002") {
          throw new ResponseError(400, "USER_ALREADY_EXIST");
        }
        throw e;
      }
    },
    { timeout: 15000 },
  );
};
// Mencabut sesi Supabase yang baru dibuat tapi tidak jadi diberikan ke klien.
const revokeSession = async (accessToken) => {
  try {
    const { error } = await supabase.auth.admin.signOut(accessToken, "local");
    if (error) logger.error("SUPABASE REVOKE ERROR", error);
  } catch (e) {
    logger.error("SUPABASE REVOKE THREW", e);
  }
};
const login = async function (request) {
  const req = validate(loginUserValidation, request);
  const { data: authData, error: authError } =
    await createAuthClient().auth.signInWithPassword({
      email: req.email,
      password: req.password,
    });

  if (authError) {
    console.log("SUPABASE LOGIN ERROR:", authError.message, authError.status);
    if (authError.message.includes("Email not confirmed")) {
      throw new ResponseError(403, "EMAIL_NOT_VERIVIED");
    }
    if (authError.message.includes("Invalid login credentials")) {
      throw new ResponseError(401, "INCORRECT_EMAIL_OR_PASSWORD");
    }
    if (authError.message.toLowerCase().includes("banned")) {
      throw new ResponseError(403, "ACCOUNT_SUSPEND");
    }
    throw new ResponseError(500, authError.message);
  }

  const supabaseId = authData.user.id;
  const supabaseEmail = authData.user.email;
  if (!supabaseEmail) {
    throw new ResponseError(500, "SUPABASE_EMAIL_MISSING");
  }
  const session = authData.session;

  // Hanya akun yang sudah terdaftar di sistem (owner / admin undangan) yang boleh
  // masuk. Login TIDAK lagi membuat user baru, supaya akun Supabase sembarang
  // tidak otomatis jadi admin.
  let user = await prisma.user.findUnique({
    where: { supabase_id: supabaseId },
    select: { id: true, email: true, name: true, role: true, is_active: true },
  });

  if (!user) {
    await revokeSession(session.access_token);
    throw new ResponseError(401, "INCORRECT_EMAIL_OR_PASSWORD");
  }

  if (!user.is_active) {
    await revokeSession(session.access_token);
    throw new ResponseError(403, "ACCOUNT_SUSPEND");
  }

  // Sinkronkan email kalau diubah lewat Supabase (verifikasi ganti email)
  if (user.email !== supabaseEmail) {
    try {
      user = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { email: supabaseEmail },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            is_active: true,
          },
        });

        await tx.employee.updateMany({
          where: { user_id: user.id },
          data: { email: supabaseEmail },
        });

        return updated;
      });
    } catch (e) {
      await revokeSession(session.access_token);
      if (e.code === "P2002") {
        throw new ResponseError(409, "EMAIL_CONFLICT");
      }
      throw e;
    }
  }

  // Token TIDAK dikembalikan di body. Controller menaruhnya di cookie httpOnly.
  return {
    user: { email: user.email, name: user.name, role: user.role },
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    },
  };
};

const get = async function (request) {
  const req = validate(getUserValidation, request);
  const user = await prisma.user.findFirst({
    where: {
      id: req.id,
    },
    select: {
      email: true,
      name: true,
      role: true,
      employee: { select: { is_active: true, pin_hash: true } },
    },
  });
  if (!user) {
    throw new ResponseError(404, "USER_NOT_FOUND");
  }
  const { employee, ...profile } = user;
  return {
    ...profile,
    attendance: {
      enabled: employee !== null && employee.is_active,
      pin_set: employee !== null && employee.pin_hash !== null,
    },
  };
};
const updatePassword = async function (request) {
  const req = validate(updatePasswordValidation, request);

  const user = await prisma.user.findUnique({
    where: { id: req.id },
  });

  if (!user) {
    throw new ResponseError(404, "USER_NOT_FOUND");
  }

  // 1. Verifikasi password lama menggunakan client terpisah
  const verifyClient = createAuthClient();

  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: req.current_password,
  });

  if (verifyError) {
    throw new ResponseError(400, "CURRENT_PASSWORD_INVALID");
  }

  // 2. Ganti password setelah password lama terverifikasi
  const { error } = await supabase.auth.admin.updateUserById(user.supabase_id, {
    password: req.new_password,
  });

  if (error) {
    console.error("UPDATE PASSWORD ERROR:", error.message);
    throw new ResponseError(400, "PASSWORD_UPDATE_FAILED");
  }

  return {
    message: "PASSWORD_UPDATED",
  };
};
const setPin = async function (request) {
  const req = validate(setPinValidation, request);

  const user = await prisma.user.findUnique({
    where: { id: req.id },
    select: {
      email: true,
      employee: { select: { id: true, is_active: true } },
    },
  });

  if (!user) {
    throw new ResponseError(404, "USER_NOT_FOUND");
  }
  if (!user.employee || !user.employee.is_active) {
    throw new ResponseError(409, "ATTENDANCE_NOT_ENABLED");
  }

  const { error } = await createAuthClient().auth.signInWithPassword({
    email: user.email,
    password: req.current_password,
  });

  if (error) {
    throw new ResponseError(400, "CURRENT_PASSWORD_INVALID");
  }

  const { count } = await prisma.employee.updateMany({
    where: { id: user.employee.id, user_id: req.id, is_active: true },
    data: {
      pin_hash: await hashPin(req.pin),
      pin_failed_count: 0,
      pin_locked_until: null,
    },
  });

  if (count === 0) {
    throw new ResponseError(409, "ATTENDANCE_NOT_ENABLED");
  }

  return { message: "PIN_UPDATED" };
};
const updateName = async function (request) {
  const req = validate(updateNameValidation, request);
  const user = await prisma.user.findUnique({
    where: {
      id: req.id,
    },
  });
  if (!user) {
    throw new ResponseError(404, "USER_NOT_FOUND");
  }
  return await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      name: req.name,
    },
    select: {
      name: true,
      email: true,
    },
  });
};
const updateEmail = async (request, access_token) => {
  const req = validate(updateEmailValidation, request);

  const user = await prisma.user.findUnique({
    where: { id: req.id },
    select: {
      id: true,
      supabase_id: true,
      email: true,
    },
  });

  if (!user) {
    throw new ResponseError(404, "USER_NOT_FOUND");
  }

  if (req.email === user.email) {
    return { message: "EMAIL_UNCHANGED" };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: req.email },
  });

  if (existingUser) {
    throw new ResponseError(409, "EMAIL_ALREADY_EXIST");
  }

  const existingEmployee = await prisma.employee.findUnique({
    where: { email: req.email },
    select: { user_id: true },
  });

  if (existingEmployee && existingEmployee.user_id !== user.id) {
    throw new ResponseError(409, "EMAIL_ALREADY_EXIST");
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: req.email,
    }),
  });

  if (!response.ok) {
    const error = await response.json();

    logger.error("Supabase email update request failed", {
      status: response.status,
      error: error.message,
    });

    throw new ResponseError(400, "UPDATE_EMAIL_REQUEST_FAILED");
  }

  return {
    message: "EMAIL_VERIFICATION_REQUIRED",
  };
};
const logout = async (access_token) => {
  if (!access_token) {
    throw new ResponseError(401, "UNAUTHORIZED");
  }

  // scope "local" = cuma session ini. "global" akan logout semua device.
  const { error } = await supabase.auth.admin.signOut(access_token, "local");

  if (error) {
    logger.error("SUPABASE LOGOUT ERROR", error);
    throw new ResponseError(500, "LOGOUT_FAILED");
  }

  return { message: "LOGGED_OUT" };
};
export default {
  register,
  login,
  get,
  updatePassword,
  setPin,
  updateName,
  updateEmail,
  logout,
};
