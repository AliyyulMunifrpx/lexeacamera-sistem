import { createClient } from "@supabase/supabase-js";
import logger from "../application/logging.js";
import { supabase, supabaseAuth } from "../application/supabase.js";
import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
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
        const result = await supabaseAuth.auth.signUp({
          email: user.email,
          password: user.password,
          options: {
            emailRedirectTo: `${process.env.FRONTEND_URL}/auth/verify-email`,
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
const login = async function (request) {
  const req = validate(loginUserValidation, request);
  const { data: authData, error: authError } =
    await supabaseAuth.auth.signInWithPassword({
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
  let user;
  try {
    user = await prisma.user.upsert({
      where: {
        supabase_id: supabaseId,
      },
      update: {
        email: supabaseEmail,
      },
      create: {
        supabase_id: supabaseId,
        email: supabaseEmail,
        name: "User",
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      throw new ResponseError(409, "EMAIL_CONFLICT");
    }
    throw e;
  }

  return {
    email: user.email,
    name: user.name,
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    access_token_expires: authData.session.expires_in,
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
    },
  });
  if (!user) {
    throw new ResponseError(404, "USER_NOT_FOUND");
  }
  return user;
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
  const verifyClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

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
  updateName,
  updateEmail,
  logout,
};
