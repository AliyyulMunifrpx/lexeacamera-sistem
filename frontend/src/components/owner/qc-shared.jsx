import { FiAlertCircle } from "react-icons/fi";

import { normalizeApiError } from "../../lib/api/errors.js";

export const QC_PATH = "/owner/quality-controls";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

export const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

export const BTN_PRIMARY = `${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const BTN_OUTLINE = `${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

export const BTN_DANGER = `${BTN_BASE} border border-second2/30 text-second2 hover:border-second2 hover:bg-second2/5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

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

export const SECTIONS = [
  {
    value: "PHYSICAL",
    label: "Fisik",
    description: "Centang kerusakan yang ADA pada unit.",
  },
  {
    value: "FUNCTION",
    label: "Fungsi",
    description: "Pilih normal atau minor untuk tiap fungsi.",
  },
  {
    value: "ACCESSORY",
    label: "Aksesories",
    description: "Kondisi komponen aksesories unit.",
  },
  {
    value: "COMPLETENESS",
    label: "Kelengkapan",
    description: "Centang kelengkapan yang ADA, dan asalnya.",
  },
];

export const TYPE_LABEL = { BUY: "Beli", SELL: "Jual" };

export const STATUS_LABEL = {
  DEAL: { label: "Deal", tone: "blue" },
  CANCEL: { label: "Belum Deal", tone: "red" },
};
export const STATUS_LABEL_ADMIN = {
  DEAL: { label: "Deal", tone: "blue" },
  CANCEL: { label: "Belum Deal", tone: "red" },
};
export const CLASS_LABEL = {
  NORMAL: { label: "Normal", tone: "muted" },
  MINOR: { label: "Minor", tone: "red" },
};

export const ORIGIN_LABEL = { ORIGINAL: "Original", OEM: "OEM" };

const TAG_TONES = {
  outline: "border border-second/30 text-second/60",
  strong: "border border-second4 text-second4",
  soft: "bg-second/10 text-second",
  blue: "bg-second3/10 text-second3",
  violet: "bg-second4/10 text-second4",
  red: "bg-second2/10 text-second2",
  muted: "border border-second/30 text-second/65",
};

export function Tag({ children, tone = "outline" }) {
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${TAG_TONES[tone]}`}
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

/* ------------------------------- Formatters ------------------------------- */

export function todayWib() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/* Tanggal murni (YYYY-MM-DD) tanpa konversi zona waktu. */
export function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatThousands(digits) {
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

/* -------------------------------- Errors ---------------------------------- */

export function describeQcError(err) {
  const body = err?.response?.data;
  const name = body?.name;

  switch (body?.errors) {
    case "PRICE_OWNER_ONLY":
      return "Harga QC yang sudah deal hanya bisa diisi atau diubah oleh owner.";
    case "STATUS_OWNER_ONLY":
      return "QC yang sudah deal hanya bisa dikembalikan ke cancel oleh owner.";
    case "QC_UPLOAD_URL_FAILED":
      return "Gagal menyiapkan unggahan file. Coba lagi.";
    case "QC_UPLOAD_CHECK_FAILED":
      return "Gagal memeriksa file yang terunggah. Coba lagi.";
    case "QC_NOT_FOUND":
      return "QC tidak ditemukan. Mungkin sudah dihapus.";
    case "QC_ITEM_NOT_FOUND":
      return "Item checklist tidak ditemukan. Muat ulang halaman lalu coba lagi.";
    case "QC_ITEM_ALREADY_EXISTS":
      return "Nama item ini sudah ada di bagian yang sama.";
    case "INVALID_QC_ENTRY":
      return name
        ? `Isian item “${name}” tidak valid untuk bagian ini.`
        : "Ada isian checklist yang tidak valid.";
    case "DUPLICATE_QC_ENTRY":
      return name
        ? `Item “${name}” muncul dua kali.`
        : "Ada item checklist yang muncul dua kali.";
    case "INVALID_DATE_RANGE":
      return "Tanggal awal tidak boleh lebih besar dari tanggal akhir.";
    case "UNSUPPORTED_MEDIA_TYPE":
      return "Format file tidak didukung.";
    case "MEDIA_LIMIT_REACHED":
      return "Batas jumlah foto atau video untuk QC ini sudah tercapai.";
    case "MEDIA_TOO_LARGE":
      return "Ukuran file melebihi batas.";
    case "MEDIA_NOT_UPLOADED":
      return "File belum terunggah ke penyimpanan. Coba lagi.";
    case "MEDIA_ALREADY_ADDED":
      return "File ini sudah ditambahkan.";
    case "MEDIA_TYPE_MISMATCH":
    case "INVALID_MEDIA_PATH":
      return "File tidak valid. Coba unggah ulang.";
    case "MEDIA_NOT_FOUND":
      return "File tidak ditemukan.";
    case "QC_BUCKET_NOT_CONFIGURED":
      return "Penyimpanan QC belum dikonfigurasi di server.";
    default:
      return normalizeApiError(err).message;
  }
}
