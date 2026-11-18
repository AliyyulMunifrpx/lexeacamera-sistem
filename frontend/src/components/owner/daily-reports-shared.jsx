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

/* Metode uang pada baris: tunai hanya bisa disetor tunai, non tunai lewat transfer. */
export const METHODS = [
  { id: "CASH", label: "Tunai" },
  { id: "NON_CASH", label: "Non tunai" },
];

export function methodLabel(method) {
  return METHODS.find((item) => item.id === method)?.label ?? "—";
}

// Setoran transfer lebih dari 0 wajib punya bukti transfer.
export function needsProof(report) {
  return Number(report?.remit_transfer) > 0;
}
// ADMIN sudah mengisi setoran tunai dan transfer (boleh 0).
export function hasRemitAmounts(report) {
  return (
    report?.remit_cash !== null &&
    report?.remit_cash !== undefined &&
    report?.remit_transfer !== null &&
    report?.remit_transfer !== undefined
  );
}

// belum disetor → sudah setor (ADMIN sudah isi) → approve owner
export function getRemitStatus(report) {
  if (report?.remitted) {
    return { key: "approved", label: "Approve owner", tone: "success" };
  }
  if (hasRemitAmounts(report)) {
    return { key: "paid", label: "Sudah setor", tone: "soft" };
  }
  return { key: "unpaid", label: "Belum disetor", tone: "outline" };
}
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
  REMIT_ADMIN_ONLY:
    "Jumlah setoran dan bukti transfer hanya bisa diurus oleh admin.",
  REPORT_NOT_FOUND: "Laporan tidak ditemukan.",
  ENTRY_NOT_FOUND: "Baris tidak ditemukan. Muat ulang halaman lalu coba lagi.",
  PROOF_NOT_FOUND: "Bukti transfer tidak ditemukan.",
  REPORT_ALREADY_EXISTS: "Laporan untuk tanggal tersebut sudah ada.",
  REPORT_LOCKED:
    "Laporan sudah di-approve owner. Minta owner membatalkan approve untuk mengubah.",
  ENTRY_LIMIT_REACHED: "Jumlah baris sudah mencapai batas maksimal (500).",
  INVALID_ENTRY_AMOUNT:
    "Isi salah satu saja: pemasukan atau pengeluaran, dan nilainya harus lebih dari 0.",
  DATE_IN_FUTURE: "Tanggal laporan tidak boleh di masa depan.",
  INVALID_DATE_RANGE:
    "Tanggal awal tidak boleh lebih besar dari tanggal akhir.",
  OPENING_BALANCE_TOO_LARGE:
    "Sisa saldo laporan sebelumnya terlalu besar. Isi saldo awal secara manual.",
  PROOF_REQUIRED:
    "Setoran transfer wajib punya bukti transfer. Unggah buktinya dulu.",
  PROOF_LOCKED:
    "Bukti transfer pada laporan yang sudah di-approve hanya bisa diganti, tidak bisa dihapus. Batalkan approve laporan dulu.",
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

const REMIT_FIELD_LABELS = {
  remit_cash: "setoran tunai",
  remit_transfer: "setoran transfer",
};

export function describeError(error) {
  const body = error?.response?.data;
  const code = body?.errors;
  const details = body?.details ?? {};

  switch (code) {
    case "REMIT_CASH_EXCEEDS_BALANCE":
      return details.closing_cash != null
        ? `Setoran tunai melebihi saldo akhir tunai (${formatMoney(details.closing_cash)}).`
        : "Setoran tunai melebihi saldo akhir tunai.";
    case "REMIT_TRANSFER_EXCEEDS_BALANCE":
      return details.closing_noncash != null
        ? `Setoran transfer melebihi saldo akhir non tunai (${formatMoney(details.closing_noncash)}).`
        : "Setoran transfer melebihi saldo akhir non tunai.";
    case "NEGATIVE_BALANCE":
      return `Saldo akhir ${
        details.closing_cash < 0 ? "tunai" : "non tunai"
      } negatif. Perbaiki baris yang salah dulu, misalnya pengeluaran yang salah metode.`;
    case "REMIT_AMOUNT_REQUIRED": {
      const fields = Array.isArray(details.fields)
        ? details.fields.map((field) => REMIT_FIELD_LABELS[field] ?? field)
        : [];
      return fields.length > 0
        ? `Isi ${fields.join(" dan ")} (boleh 0).`
        : "Isi setoran tunai dan setoran transfer (boleh 0).";
    }
    case "PREVIOUS_REPORT_NOT_REMITTED":
      return details.date
        ? `Laporan ${formatDate(details.date)} belum disetor. Selesaikan dulu, atau isi saldo awal secara manual.`
        : "Laporan sebelumnya belum disetor. Selesaikan dulu, atau isi saldo awal secara manual.";
    default:
      break;
  }

  if (typeof code === "string" && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  return normalizeApiError(error).message;
}

/* ------------------------------ Riwayat edit ------------------------------ */

export const HISTORY_LABELS = {
  REPORT_CREATED: "Membuat laporan",
  OPENING_UPDATED: "Mengubah saldo awal",
  ENTRY_CREATED: "Menambah baris",
  ENTRY_UPDATED: "Mengubah baris",
  ENTRY_DELETED: "Menghapus baris",
  REMIT_UPDATED: "Mengubah isian setoran",
  REMITTED: "Meng-approve setoran",
  REMIT_REOPENED: "Membatalkan approve setoran",
  PROOF_SET: "Mengunggah bukti transfer",
  PROOF_DELETED: "Menghapus bukti transfer",
};

export const ROLE_LABELS = { ADMIN: "Admin", OWNER: "Owner" };

const FIELD_LABELS = {
  opening_cash: "Saldo awal tunai",
  opening_noncash: "Saldo awal non tunai",
  remit_cash: "Setoran tunai",
  remit_transfer: "Setoran transfer",
  income: "Pemasukan",
  expense: "Pengeluaran",
  name: "Atas nama",
  note: "Keterangan",
  method: "Metode",
};

const MONEY_FIELDS = new Set([
  "opening_cash",
  "opening_noncash",
  "remit_cash",
  "remit_transfer",
  "income",
  "expense",
]);

function fieldValue(key, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_FIELDS.has(key)) return formatMoney(value);
  if (key === "method") return methodLabel(value);

  return String(value);
}

function changeLines(before, after) {
  const keys = [
    ...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  ];

  return keys.map(
    (key) =>
      `${FIELD_LABELS[key] ?? key}: ${fieldValue(key, before?.[key])} → ${fieldValue(key, after?.[key])}`,
  );
}

function entryLine(entry) {
  const income = Number(entry?.income) || 0;
  const amount =
    income > 0
      ? `+ ${formatMoney(income)}`
      : `− ${formatMoney(entry?.expense)}`;

  return `“${entry?.name ?? "—"}” (${methodLabel(entry?.method)}) ${amount}${
    entry?.note ? ` · ${entry.note}` : ""
  }`;
}

/* Rincian perubahan dalam bentuk baris teks. */
export function describeHistory(item) {
  const detail = item?.detail ?? {};

  switch (item?.action) {
    case "REPORT_CREATED":
      return [
        `Saldo awal tunai ${formatMoney(detail.opening_cash)}, non tunai ${formatMoney(detail.opening_noncash)}${
          detail.carried ? " (otomatis dari laporan sebelumnya)" : ""
        }`,
      ];
    case "OPENING_UPDATED":
    case "REMIT_UPDATED":
    case "ENTRY_UPDATED":
      return changeLines(detail.before, detail.after);
    case "ENTRY_CREATED":
    case "ENTRY_DELETED":
      return [entryLine(detail.entry)];
    case "REMITTED":
      return [
        `Setoran tunai ${formatMoney(detail.remit_cash)}, transfer ${formatMoney(detail.remit_transfer)}`,
      ];
    case "PROOF_SET":
      return [
        `${detail.replaced ? "Mengganti file lama · " : ""}${
          detail.content_type ?? ""
        }${detail.size ? ` · ${formatBytes(detail.size)}` : ""}`.trim(),
      ].filter(Boolean);
    default:
      return [];
  }
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

export function MethodTag({ method }) {
  return (
    <Tag tone={method === "NON_CASH" ? "strong" : "soft"}>
      {methodLabel(method)}
    </Tag>
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

/* Input rupiah: hanya angka, titik ribuan otomatis. */
export function AmountInput({
  id,
  value,
  onChange,
  disabled,
  hasError,
  describedBy,
  placeholder = "10.000",
  ...rest
}) {
  return (
    <div className="flex">
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center rounded-l-xl border border-r-0 border-second/30 bg-second/5 px-4 text-sm font-medium text-second/60"
      >
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatThousands(value)}
        onChange={(event) => onChange(digitsOnly(event.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        className={`${inputClass(hasError)} rounded-l-none tabular-nums`}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </div>
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
