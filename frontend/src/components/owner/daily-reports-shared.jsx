"use client";

import { FiAlertCircle } from "react-icons/fi";
import { normalizeApiError } from "../../lib/api/errors.js";

/* -------------------------------------------------------------------------- */
/*  Design rules                                                              */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 gagal/keluar, second3 berhasil/     */
/*            masuk, second4 fokus/aksen, bg-grad aksen utama)                */
/* -------------------------------------------------------------------------- */

export const MAX_ENTRIES = 500;
export const MAX_AMOUNT = 2147483647;
export const MAX_PROOF_SIZE = 10 * 1024 * 1024;
export const PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];
// Hanya format ini yang bisa ditampilkan sebagai gambar di browser.
export const PREVIEWABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

export const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

export const BTN_PRIMARY = `${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const BTN_OUTLINE = `${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const BTN_DANGER = `${BTN_BASE} border border-second2/30 text-second2 hover:bg-second2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const labelClass = "mb-2 block text-sm font-semibold text-second";

export function inputClass(hasError) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

/* -------------------------------- Formatters ------------------------------ */

// Hanya digit, tanpa nol di depan, maksimal 10 digit.
export function digitsOnly(value) {
  return value
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 10);
}

// "1000000" -> "1.000.000"
export function formatThousands(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatMoney(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "";

  return `${sign}Rp ${formatThousands(Math.abs(Math.round(number)))}`;
}

// "2026-11-17" -> "Selasa, 17 November 2026"
export function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00+07:00`);

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0;

  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;

  return `${size} B`;
}

// Tanggal hari ini di WIB, format YYYY-MM-DD (untuk atribut max pada input date).
export function todayWib() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

/* --------------------------------- Errors --------------------------------- */

const ERROR_MESSAGES = {
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  REPORT_NOT_FOUND: "Laporan tidak ditemukan.",
  ENTRY_NOT_FOUND: "Baris tidak ditemukan. Muat ulang halaman lalu coba lagi.",
  PROOF_NOT_FOUND: "Bukti transfer tidak ditemukan.",
  REPORT_ALREADY_EXISTS:
    "Laporan untuk tanggal tersebut sudah ada. Buka laporan yang sudah ada.",
  REPORT_LOCKED:
    "Laporan sudah ditransfer dan terkunci. Hilangkan centang transfer untuk membukanya.",
  ENTRY_LIMIT_REACHED: "Jumlah baris sudah mencapai batas maksimal (500).",
  INVALID_ENTRY_AMOUNT:
    "Isi salah satu saja: pemasukan atau pengeluaran, dan nilainya harus lebih dari 0.",
  DATE_IN_FUTURE: "Tanggal laporan tidak boleh di masa depan.",
  INVALID_DATE_RANGE:
    "Tanggal awal tidak boleh lebih besar dari tanggal akhir.",
  UNSUPPORTED_MEDIA_TYPE:
    "Format file tidak didukung. Gunakan JPEG, PNG, WebP, HEIC, atau PDF.",
  INVALID_PROOF_PATH: "Data file tidak valid. Coba unggah ulang.",
  PROOF_NOT_UPLOADED: "File belum terunggah ke penyimpanan. Coba unggah ulang.",
  PROOF_TYPE_MISMATCH: "Tipe file tidak sesuai. Coba unggah ulang.",
  PROOF_TOO_LARGE: "Ukuran file melebihi 10 MB.",
  REPORT_BUCKET_NOT_CONFIGURED:
    "Penyimpanan bukti transfer belum dikonfigurasi di server. Hubungi owner.",
  REPORT_UPLOAD_URL_FAILED: "Gagal menyiapkan unggahan. Coba lagi.",
  REPORT_UPLOAD_CHECK_FAILED: "Gagal memeriksa file yang diunggah. Coba lagi.",
};

export function describeError(error) {
  const code = error?.response?.data?.errors;

  if (typeof code === "string" && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  return normalizeApiError(error).message;
}

/* ------------------------------ Small pieces ------------------------------ */

export function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
  };

  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ErrorText({ id, children }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

export function FormSection({ title, description, aside, children }) {
  return (
    <section className="flex min-w-0 scroll-mt-16 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-bold text-second">{title}</h2>
          {description && (
            <p className="mt-2 text-pretty text-sm text-second/60">
              {description}
            </p>
          )}
        </div>

        {aside}
      </div>

      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function PageHeader({ icon: Icon, title, accent, description, back }) {
  return (
    <header className="flex flex-col gap-4">
      {back}

      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
        >
          <Icon size={16} />
        </div>

        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
            {title} <span className="text-grad">{accent}</span>
          </h1>
          {description && (
            <p className="mt-2 text-pretty text-sm text-second/60">
              {description}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
