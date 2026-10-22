import { supabase } from "../application/supabase.js";
import { prisma } from "../lib/database.js";

const maskToken = (token) => {
  if (!token) return null;

  if (token.length <= 12) {
    return "***";
  }

  return `${token.slice(0, 6)}...${token.slice(-6)}`;
};

export const authMiddleware = async (req, res, next) => {
  try {
    let accessToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;

    const refreshToken = req.headers["x-refresh-token"];

    console.log("\n========== AUTH MIDDLEWARE ==========");
    console.log("🔐 Access Token  :", maskToken(accessToken));
    console.log("🔄 Refresh Token :", maskToken(refreshToken));

    // 1. Cek jika tidak ada token sama sekali
    if (!accessToken && !refreshToken) {
      console.log("❌ Neither access token nor refresh token provided.");

      return res.status(401).json({
        errors: "UNAUTHORIZED",
      });
    }

    let user = null;
    let error = null;

    // 2. Validasi Access Token jika ada
    if (accessToken) {
      console.log("🔍 Validating access token with Supabase...");

      const result = await supabase.auth.getUser(accessToken);

      user = result.data.user;
      error = result.error;

      if (error) {
        console.log("⚠️ Access token invalid or expired:", error.message);
      } else {
        console.log("✅ Access token is valid.");
        console.log("👤 Supabase User ID:", user?.id);
      }
    } else {
      console.log("ℹ️ No access token provided, will attempt refresh.");
    }
    let newRefreshToken = null;

    // 3. Refresh session jika access token tidak valid / tidak ada, tapi refresh token ada
    if ((!user || error) && refreshToken) {
      console.log("🔄 Initiating token refresh session...");

      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (refreshError || !refreshData.session) {
        console.log("❌ Session refresh failed:", refreshError?.message);

        return res.status(401).json({
          errors: "SESSION_EXPIRED",
        });
      }

      accessToken = refreshData.session.access_token;
      newRefreshToken = refreshData.session.refresh_token;
      user = refreshData.user;
      error = null;

      console.log("✅ Session refresh successful.");
      console.log("👤 Refreshed User ID    :", user?.id);
      console.log("🆕 New Access Token     :", maskToken(accessToken));
      console.log("🆕 New Refresh Token    :", maskToken(newRefreshToken));

      res.setHeader("x-new-access-token", accessToken);
      res.setHeader("x-new-refresh-token", newRefreshToken);

      console.log(
        "📤 Sent header [x-new-access-token]  :",
        maskToken(accessToken),
      );
      console.log(
        "📤 Sent header [x-new-refresh-token] :",
        maskToken(newRefreshToken),
      );
    }

    // 4. Pastikan user benar-benar terautentikasi
    if (error || !user) {
      console.log("❌ Authentication failed: Invalid user session.");

      return res.status(401).json({
        errors: "UNAUTHORIZED",
      });
    }

    // 5. Cari user di database lokal Prisma
    console.log("🔍 Querying user in Prisma database for ID:", user.id);

    const prismaUser = await prisma.user.findUnique({
      where: {
        supabase_id: user.id,
      },
      select: {
        id: true,
        supabase_id: true,
        email: true,
        name: true,
      },
    });

    if (!prismaUser) {
      console.log("❌ User found in Supabase but missing in Prisma database.");

      return res.status(401).json({
        errors: "USER_DATABASE_MISMATCH",
      });
    }

    console.log("✅ Prisma user successfully matched:", prismaUser.id);

    // 6. Sukses
    req.user = prismaUser;
    req.access_token = accessToken;
    req.refresh_token = refreshToken ? (newRefreshToken ?? refreshToken) : null;
    console.log("✅ AUTHENTICATION PASSED");
    console.log("=====================================\n");

    next();
  } catch (err) {
    console.error("💥 AUTH MIDDLEWARE CRASH:", err);
    next(err);
  }
};
