import { supabase, createAuthClient } from "../application/supabase.js";
import { prisma } from "../lib/database.js";
import {
  getAllowedOrigins,
  readAuthCookies,
  setAuthCookies,
} from "../utils/auth-cookies.js";

// Log hanya menyala kalau AUTH_DEBUG=true (di production biarkan mati).
const debug = (...args) => {
  if (process.env.AUTH_DEBUG === "true") console.log("[auth]", ...args);
};

const maskToken = (token) => {
  if (!token) return null;
  return token.length <= 12
    ? "***"
    : `${token.slice(0, 6)}...${token.slice(-6)}`;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Refresh token sekali pakai. Browser sering mengirim banyak request bersamaan
// (React Query) dengan cookie yang sama, jadi refresh yang sama bisa terpanggil
// berkali-kali. Request yang bersamaan berbagi SATU hasil refresh. Hasilnya
// disimpan 10 detik (sama dengan "refresh token reuse interval" Supabase) untuk
// request yang sudah terkirim dengan cookie lama sebelum cookie baru sampai.
const REFRESH_SHARE_MS = 10_000;
const refreshCache = new Map();

function refreshSessionOnce(refreshToken) {
  const cached = refreshCache.get(refreshToken);
  if (cached) return cached;

  // Client baru untuk setiap refresh, jangan pakai client bersama.
  const promise = createAuthClient().auth.refreshSession({
    refresh_token: refreshToken,
  });

  const timer = setTimeout(
    () => refreshCache.delete(refreshToken),
    REFRESH_SHARE_MS,
  );
  timer.unref?.();
  refreshCache.set(refreshToken, promise);

  // Hasil gagal tidak perlu dibagikan, request berikutnya boleh mencoba lagi.
  const forget = () => {
    clearTimeout(timer);
    if (refreshCache.get(refreshToken) === promise) {
      refreshCache.delete(refreshToken);
    }
  };
  promise.then(({ data, error }) => {
    if (error || !data?.session) forget();
  }, forget);

  return promise;
}

// Gangguan di sisi Supabase (bukan token salah) tidak boleh membuat user logout.
const isUpstreamFailure = (error) =>
  Boolean(error) &&
  (error.name === "AuthRetryableFetchError" ||
    (typeof error.status === "number" && error.status >= 500));

// Request yang mengubah data dan memakai COOKIE harus datang dari frontend kita.
// (Pelindung CSRF. Request dengan header Authorization tidak terkena CSRF.)
function isUntrustedCookieRequest(req) {
  if (SAFE_METHODS.has(req.method)) return false;

  const origin = req.headers.origin;
  if (!origin) return false; // bukan browser (Postman, curl, server ke server)

  const allowed = getAllowedOrigins();

  if (allowed.length === 0) {
    // Production tanpa FRONTEND_ORIGINS: tolak dan beri tahu, jangan diam-diam terbuka.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[auth] FRONTEND_ORIGINS belum diset, request cookie ditolak",
      );
      return true;
    }
    return false;
  }

  return !allowed.includes(origin.replace(/\/+$/, ""));
}

export const authMiddleware = async (req, res, next) => {
  try {
    const cookies = readAuthCookies(req);
    const usingCookies = Boolean(cookies.accessToken || cookies.refreshToken);

    // Cookie diutamakan. Header (Authorization / x-refresh-token) hanya dipakai
    // kalau tidak ada cookie sama sekali (Postman, tes, klien lama).
    let accessToken;
    let refreshToken;

    if (usingCookies) {
      accessToken = cookies.accessToken;
      refreshToken = cookies.refreshToken;
    } else {
      const authorization = req.headers.authorization;
      accessToken = authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim() || null
        : null;

      const headerRefresh = req.headers["x-refresh-token"];
      refreshToken = typeof headerRefresh === "string" ? headerRefresh : null;
    }

    debug(
      "access",
      maskToken(accessToken),
      "| refresh",
      maskToken(refreshToken),
    );

    if (usingCookies && isUntrustedCookieRequest(req)) {
      debug("origin ditolak:", req.headers.origin);
      return res.status(403).json({ errors: "FORBIDDEN_ORIGIN" });
    }

    // 1. Tidak ada token sama sekali
    if (!accessToken && !refreshToken) {
      return res.status(401).json({ errors: "UNAUTHORIZED" });
    }

    let user = null;
    let refreshedSession = null;

    // 2. Validasi access token
    if (accessToken) {
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (error) {
        if (isUpstreamFailure(error)) {
          return res.status(503).json({ errors: "AUTH_SERVICE_UNAVAILABLE" });
        }
        debug("access token tidak valid:", error.message);
      } else {
        user = data.user;
      }
    }

    // 3. Access token tidak valid / tidak ada: coba refresh
    if (!user && refreshToken) {
      const { data, error } = await refreshSessionOnce(refreshToken);

      if (error || !data?.session) {
        if (isUpstreamFailure(error)) {
          return res.status(503).json({ errors: "AUTH_SERVICE_UNAVAILABLE" });
        }
        debug("refresh gagal:", error?.message);
        // Cookie TIDAK dihapus di sini: request lain yang bersamaan bisa saja
        // baru berhasil refresh, dan menghapus akan membuang cookie barunya.
        // Cookie dihapus oleh endpoint login dan logout.
        return res.status(401).json({ errors: "SESSION_EXPIRED" });
      }

      refreshedSession = data.session;
      user = data.user ?? data.session.user;
      accessToken = refreshedSession.access_token;
    }

    // 4. Harus ada user
    if (!user) {
      return res.status(401).json({ errors: "UNAUTHORIZED" });
    }

    // 5. Ambil user dari database lokal, termasuk role dan status aktif
    const prismaUser = await prisma.user.findUnique({
      where: { supabase_id: user.id },
      select: {
        id: true,
        supabase_id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
      },
    });

    if (!prismaUser) {
      return res.status(401).json({ errors: "USER_DATABASE_MISMATCH" });
    }

    // Akun dinonaktifkan: ditolak di semua endpoint (dan tidak diberi cookie baru).
    if (!prismaUser.is_active) {
      return res.status(401).json({ errors: "UNAUTHORIZED" });
    }

    // 6. Kirim token baru ke klien (setelah semua pengecekan lolos)
    if (refreshedSession) {
      if (usingCookies) {
        setAuthCookies(res, refreshedSession);
      } else {
        res.setHeader("x-new-access-token", refreshedSession.access_token);
        res.setHeader("x-new-refresh-token", refreshedSession.refresh_token);
      }
    }

    req.user = prismaUser;
    req.access_token = accessToken;
    req.refresh_token = refreshToken
      ? (refreshedSession?.refresh_token ?? refreshToken)
      : null;

    next();
  } catch (err) {
    console.error("AUTH MIDDLEWARE CRASH:", err);
    next(err);
  }
};

// Pakai SETELAH authMiddleware:
//   router.use(authMiddleware);
//   ownerRouter.use(requireRole("OWNER"));
export const requireRole = (...roles) => {
  if (roles.length === 0) {
    throw new Error("requireRole membutuhkan minimal satu role");
  }

  const allowed = new Set(roles);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ errors: "UNAUTHORIZED" });
    }

    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ errors: "OWNER_ROLE_REQUIRED" });
    }

    next();
  };
};
