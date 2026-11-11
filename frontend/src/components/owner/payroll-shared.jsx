import { FiAlertCircle } from "react-icons/fi";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

export const PAYROLL_PATH = "/owner/payrolls";
export const MAX_AMOUNT = 2147483647;
export const MAX_ITEMS = 50;

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

export const STATUS = {
  PENDING: { label: "Belum cair", tone: "strong" },
  PAID: { label: "Sudah cair", tone: "grad" },
};

/* -------------------------------- Formatters ------------------------------ */

export function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  const sign = amount < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))}`;
}

export function formatThousands(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* "YYYY-MM-DD" -> "25 November 2026" (tanpa bergeser zona waktu) */
export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

/* Tanggal hari ini (WIB) sebagai "YYYY-MM-DD" */
export function todayWib() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/* Kode error server -> pesan yang mudah dipahami */
export function describePayrollError(error, normalize) {
  const code = error?.response?.data?.errors;

  switch (code) {
    case "PAYROLL_NOT_FOUND":
      return "Slip gaji tidak ditemukan atau sudah dihapus.";
    case "PAYROLL_ITEM_NOT_FOUND":
      return "Penerimaan tidak ditemukan di slip ini.";
    case "EMPLOYEE_NOT_FOUND":
      return "Karyawan tidak ditemukan.";
    case "PAYROLL_ALREADY_PAID":
      return "Slip ini sudah cair. Kembalikan ke “Belum cair” dulu kalau mau mengubah atau menghapusnya.";
    case "DISBURSEMENT_DATE_IN_FUTURE":
      return "Slip yang sudah cair tidak boleh bertanggal cair di masa depan.";
    case "AMOUNT_TOO_LARGE":
      return "Total semua penerimaan terlalu besar.";
    case "INVALID_DATE_RANGE":
      return "Tanggal awal tidak boleh setelah tanggal akhir.";
    default:
      return normalize(error).message;
  }
}

/* ------------------------------ Small pieces ------------------------------ */

export function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    grad: "bg-grad text-primary",
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

export function Section({ title, description, aside, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
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

export function SummaryRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs text-second/60">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-semibold tabular-nums text-second">
        {children}
      </dd>
    </div>
  );
}

export function ConfirmModal({
  title,
  icon: Icon,
  tone = "default",
  busy,
  confirmLabel,
  busyLabel,
  confirmDisabled = false,
  onClose,
  onConfirm,
  children,
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-second/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
              tone === "danger"
                ? "bg-second2/10 text-second2"
                : "bg-grad text-primary"
            }`}
          >
            <Icon size={16} />
          </div>
          <h2 id="confirm-title" className="text-lg font-bold text-second">
            {title}
          </h2>
        </div>

        <div className="flex flex-col gap-4 text-sm leading-relaxed text-second/60">
          {children}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_OUTLINE} w-full sm:w-auto`}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            aria-busy={busy}
            className={`${
              tone === "danger"
                ? `${BTN_BASE} bg-second2 text-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`
                : BTN_PRIMARY
            } w-full sm:w-auto`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
