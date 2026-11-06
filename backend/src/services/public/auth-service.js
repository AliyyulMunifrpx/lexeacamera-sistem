import { createAuthClient, supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { getAllowedOrigins } from "../../utils/auth-cookies.js";
import {
  forgotPasswordValidation,
  setPasswordValidation,
} from "../../validation/public/auth-validation.js";
import { validate } from "../../validation/validation.js";

const invalidToken = () => new ResponseError(401, "INVALID_TOKEN");

const RESET_SENT = { message: "RESET_EMAIL_SENT_IF_REGISTERED" };

const sendResetEmail = async (email) => {
  const origin = getAllowedOrigins()[0];

  if (!origin) {
    console.error("Forgot password: FRONTEND_URL belum diatur");
    return;
  }

  const { error } = await createAuthClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/set-password`,
  });

  if (error) console.error("Supabase reset email failed:", error.message);
};

// Jawaban selalu sama, ada atau tidaknya akun, supaya email tidak bisa ditebak.
// Email dikirim di belakang layar agar waktu responsnya juga tidak membedakan.
const forgotPassword = async (request) => {
  const req = validate(forgotPasswordValidation, request);

  const user = await prisma.user.findUnique({
    where: { email: req.email },
    select: { is_active: true },
  });

  if (user?.is_active) {
    sendResetEmail(req.email).catch((error) => {
      console.error("Supabase reset email threw:", error);
    });
  }

  return RESET_SENT;
};

const setPassword = async (request) => {
  const req = validate(setPasswordValidation, request);

  let authUser;
  try {
    const { data, error } = await supabase.auth.getUser(req.access_token);
    if (error || !data?.user) throw invalidToken();
    authUser = data.user;
  } catch (error) {
    if (error instanceof ResponseError) throw error;

    console.error("Supabase getUser threw:", error);
    throw new ResponseError(503, "AUTH_SERVICE_UNAVAILABLE");
  }

  const user = await prisma.user.findUnique({
    where: { supabase_id: authUser.id },
    select: { id: true, is_active: true },
  });

  if (!user) throw invalidToken();
  if (!user.is_active) throw new ResponseError(403, "ACCOUNT_SUSPEND");

  const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
    password: req.password,
  });

  if (error) {
    const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

    if (text.includes("weak_password") || text.includes("password")) {
      throw new ResponseError(400, "WEAK_PASSWORD");
    }

    console.error("Supabase set password failed:", error.message);
    throw new ResponseError(502, "PASSWORD_UPDATE_FAILED");
  }

  // Token undangan dipakai sekali: sesinya dicabut supaya tidak bisa dipakai lagi.
  try {
    const { error: signOutError } = await supabase.auth.admin.signOut(
      req.access_token,
      "local",
    );
    if (signOutError) console.error("Revoke invite session failed:", signOutError.message);
  } catch (signOutError) {
    console.error("Revoke invite session threw:", signOutError);
  }

  return { message: "PASSWORD_SET" };
};

export default { setPassword, forgotPassword };
