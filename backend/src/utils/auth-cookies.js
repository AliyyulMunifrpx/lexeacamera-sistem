// Cookie untuk access token dan refresh token (httpOnly, tidak terbaca JavaScript).
//
// Konfigurasi lewat env:
//   COOKIE_SAMESITE  lax (default) | strict | none
//   COOKIE_DOMAIN    kosong = cookie milik host backend saja.
//                    Isi ".wavcamera.id" kalau frontend dan backend adalah subdomain
//                    dari domain yang sama (wavcamera.id dan api.wavcamera.id).
//   FRONTEND_URL     URL frontend utama, dipakai untuk CORS dan untuk pengecekan
//                    Origin di authMiddleware. Origin tambahan: EXTRA_ALLOWED_ORIGINS.
//
// Frontend dan backend di subdomain yang sama (rekomendasi): SameSite=lax.
// Beda domain sama sekali (misalnya wavcamera.id dan xxx.onrender.com):
// SameSite=none (otomatis Secure). Safari/iPhone memblokir cookie jenis ini,
// jadi login bisa gagal diam-diam di sana.

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // diperpanjang tiap refresh
const DEFAULT_ACCESS_MAX_AGE_MS = 60 * 60 * 1000;

const SAME_SITE_VALUES = ["lax", "strict", "none"];

// Opsi dasar. TANPA maxAge, supaya clearCookie memakai atribut yang sama persis
// (browser hanya menghapus cookie kalau domain, path, dan atributnya cocok).
function baseOptions() {
  const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();

  if (!SAME_SITE_VALUES.includes(sameSite)) {
    throw new Error(
      `COOKIE_SAMESITE tidak valid: "${process.env.COOKIE_SAMESITE}" (pilih lax, strict, atau none)`,
    );
  }

  const options = {
    httpOnly: true,
    // SameSite=None wajib Secure. Di production selalu Secure (HTTPS).
    secure: sameSite === "none" || process.env.NODE_ENV === "production",
    sameSite,
    path: "/",
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
}

// `session` = objek session dari Supabase (access_token, refresh_token, expires_in)
export function setAuthCookies(res, session) {
  const base = baseOptions();

  const accessMaxAge =
    Number.isFinite(session.expires_in) && session.expires_in > 0
      ? session.expires_in * 1000
      : DEFAULT_ACCESS_MAX_AGE_MS;

  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...base,
    maxAge: accessMaxAge,
  });
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...base,
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res) {
  const base = baseOptions();

  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

// Parser kecil supaya tidak perlu cookie-parser (dan tidak bergantung urutan app.use).
// Kalau ada nama cookie ganda, yang pertama dipakai.
function parseCookieHeader(header) {
  const cookies = Object.create(null);

  if (typeof header !== "string" || header === "") return cookies;

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;

    const name = part.slice(0, index).trim();
    if (!name || name in cookies) continue;

    let value = part.slice(index + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    try {
      value = decodeURIComponent(value);
    } catch {
      // nilai tidak ter-encode, pakai apa adanya
    }

    cookies[name] = value;
  }

  return cookies;
}

export function readAuthCookies(req) {
  const cookies = parseCookieHeader(req.headers.cookie);

  return {
    accessToken: cookies[ACCESS_COOKIE] || null,
    refreshToken: cookies[REFRESH_COOKIE] || null,
  };
}

// Origin frontend yang diizinkan:
//   FRONTEND_URL          SATU url frontend utama (dipakai juga untuk link email,
//                         jadi jangan diisi beberapa url). Path atau slash di akhir
//                         tidak masalah, yang dipakai hanya origin-nya.
//   EXTRA_ALLOWED_ORIGINS (opsional) origin tambahan dipisah koma, misalnya
//                         "https://www.wavcamera.id,http://localhost:3000"
// Pakai fungsi yang SAMA untuk konfigurasi CORS supaya satu sumber kebenaran.
export function getAllowedOrigins() {
  const origins = new Set();

  const add = (raw, name) => {
    const value = raw.trim();
    if (!value) return;

    try {
      origins.add(new URL(value).origin);
    } catch {
      console.error(`[auth] ${name} berisi URL tidak valid: "${value}"`);
    }
  };

  add(process.env.FRONTEND_URL || "", "FRONTEND_URL");

  for (const entry of (process.env.EXTRA_ALLOWED_ORIGINS || "").split(",")) {
    add(entry, "EXTRA_ALLOWED_ORIGINS");
  }

  return [...origins];
}
