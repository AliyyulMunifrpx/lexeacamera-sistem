"use client";

import { useState } from "react";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiClock,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiLogIn,
  FiLogOut,
  FiRefreshCw,
  FiUser,
  FiUsers,
  FiWifiOff,
  FiX,
} from "react-icons/fi";

import {
  useCheckIn,
  useCheckOut,
  useGetAttendanceEmployees,
  useGetAttendanceToday,
  useGetAttendanceHistory,
} from "../../../features/public-attendances/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import { MdHistory } from "react-icons/md";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const PIN_PATTERN = /^\d{4,6}$/;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

function inputClass(hasError) {
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

const ERROR_MESSAGES = {
  INVALID_PIN: "PIN salah. Periksa lagi PIN Anda.",
  PIN_LOCKED:
    "PIN terkunci selama 15 menit karena salah berulang kali. Coba lagi nanti.",
  ALREADY_CHECKED_IN:
    "Anda masih tercatat masuk hari ini. Silakan absen pulang.",
  ALREADY_ATTENDED_TODAY: "Anda sudah absen masuk dan pulang hari ini.",
  NOT_CHECKED_IN: "Belum ada absen masuk hari ini yang terbuka.",
  TOO_SOON: "Terlalu cepat. Tunggu 1 menit sebelum absen lagi.",
  EMPLOYEE_NOT_FOUND:
    "Karyawan tidak ditemukan atau belum bisa absen. Hubungi pemilik toko.",
  NETWORK_NOT_ALLOWED:
    "Perangkat ini tidak terhubung ke wifi toko. Sambungkan ke wifi toko lalu coba lagi.",
  STORE_NOT_READY: "Data toko belum lengkap. Hubungi pemilik toko.",
};

const STATUS_LABEL = {
  DONE: { label: "Selesai", tone: "success" },
  WORKING: { label: "Di toko", tone: "pending" },
  MISSED: { label: "Lupa pulang", tone: "failure" },
  NOT_YET: { label: "Belum absen", tone: "outline" },
};

/* -------------------------------- Formatters ------------------------------ */

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
    .replace(".", ":");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatDuration(minutes) {
  if (typeof minutes !== "number") return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} menit`;
  if (rest === 0) return `${hours} jam`;
  return `${hours} jam ${rest} menit`;
}

function currentMonthWIB() {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ErrorText({ id, children }) {
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

/* --------------------------------- Shell --------------------------------- */

function Shell({ children }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary px-4 py-10 text-second">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-sm font-bold uppercase tracking-[0.2em] text-second/60">
          lexea camera
        </p>
        <div className="rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

function StateMessage({ icon: Icon, tone = "muted", title, children, action }) {
  const tones = {
    muted: "bg-second/10 text-second",
    red: "bg-second2/10 text-second2",
    blue: "bg-second3/10 text-second3",
    violet: "bg-second4/10 text-second4",
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`flex size-16 items-center justify-center rounded-full ${tones[tone]}`}
      >
        <Icon size={24} aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-balance text-lg font-bold text-second">
        {title}
      </h1>
      <div className="mt-2 text-sm leading-relaxed text-second/60">
        {children}
      </div>
      {action}
    </div>
  );
}

function RetryButton({ onClick, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className={`${BTN_BASE} mt-6 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
    >
      <FiRefreshCw
        size={16}
        className={busy ? "animate-spin motion-reduce:animate-none" : ""}
        aria-hidden="true"
      />
      {busy ? "Memuat…" : "Coba lagi"}
    </button>
  );
}

/* ------------------------------- Result Card ----------------------------- */

function ResultCard({ result, onDone, onOpenHistory }) {
  const isCheckOut = result.type === "CHECK_OUT";

  return (
    <Shell>
      <div role="status">
        <StateMessage
          icon={FiCheckCircle}
          tone="blue"
          title={isCheckOut ? "Absen pulang berhasil" : "Absen masuk berhasil"}
        >
          <p>
            Terima kasih,{" "}
            <span className="font-semibold text-second">
              {result.employee?.name}
            </span>
            .
          </p>
        </StateMessage>

        <dl className="mt-6 divide-y divide-second/10 rounded-xl bg-second/[0.03] px-4 text-sm">
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-second/60">Tanggal</dt>
            <dd className="text-right font-semibold tabular-nums text-second">
              {formatDate(result.at)}
            </dd>
          </div>
          {isCheckOut && (
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-second/60">Jam masuk</dt>
              <dd className="font-semibold tabular-nums text-second">
                {formatTime(result.check_in_at)} WIB
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-second/60">
              {isCheckOut ? "Jam pulang" : "Jam masuk"}
            </dt>
            <dd className="font-semibold tabular-nums text-second">
              {formatTime(result.at)} WIB
            </dd>
          </div>
          {isCheckOut && (
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-second/60">Durasi kerja</dt>
              <dd className="font-semibold tabular-nums text-second">
                {formatDuration(result.duration_minutes)}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpenHistory}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
          >
            <MdHistory size={16} aria-hidden="true" />
            Riwayat Saya
          </button>

          <button
            type="button"
            onClick={onDone}
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
          >
            Selesai
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* --------------------------- Today Status Table -------------------------- */
function TodayStatus({ query }) {
  if (query.isPending) {
    return (
      <div
        className="flex items-center justify-center gap-4 py-6"
        role="status"
        aria-live="polite"
      >
        <FiLoader
          className="animate-spin motion-reduce:animate-none text-second4"
          size={18}
          aria-hidden="true"
        />
        <span className="text-sm text-second/60">Memuat status hari ini…</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
      >
        <p className="flex items-center gap-2">
          <FiAlertTriangle size={16} aria-hidden="true" />
          {normalizeApiError(query.error).message}
        </p>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className={`${BTN_BASE} border border-second2/40 text-second2 hover:bg-second2/10 ${FOCUS_RING}`}
        >
          <FiRefreshCw
            size={14}
            className={
              query.isFetching ? "animate-spin motion-reduce:animate-none" : ""
            }
            aria-hidden="true"
          />
          Coba lagi
        </button>
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  const { summary, employees } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="strong">{summary.total} karyawan</Tag>
        <Tag tone="pending">{summary.working} di toko</Tag>
        <Tag tone="success">{summary.done} selesai</Tag>
        <Tag tone="outline">{summary.not_yet} belum</Tag>
      </div>

      <div className="overflow-hidden rounded-xl">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-grad text-xs text-primary">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Nama
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Status
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-right font-semibold"
              >
                Masuk
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-right font-semibold"
              >
                Pulang
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-second/10">
            {employees.map((employee, i) => {
              const status = STATUS_LABEL[employee.status] ?? {
                label: employee.status,
                tone: "outline",
              };
              return (
                <tr
                  key={employee.id}
                  className={i % 2 === 0 ? "bg-second/10" : ""}
                >
                  <td className="px-3 py-2 font-semibold text-second">
                    {employee.name}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Tag tone={status.tone}>{status.label}</Tag>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-second/70">
                    {employee.check_in_at
                      ? `${formatTime(employee.check_in_at)} WIB`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-second/70">
                    {employee.check_out_at
                      ? `${formatTime(employee.check_out_at)} WIB`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------- History (Modal) ----------------------------- */
function HistoryModal({ onClose, initialEmployeeId, initialPin }) {
  const historyMutation = useGetAttendanceHistory();
  const employeesQuery = useGetAttendanceEmployees();

  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? "");
  const [pin, setPin] = useState(initialPin ?? "");
  const [showPin, setShowPin] = useState(false);
  const [month, setMonth] = useState(currentMonthWIB());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [data, setData] = useState(null);

  const employees = employeesQuery.data ?? [];
  const busy = historyMutation.isPending;

  const hasFixedEmployee = Boolean(initialEmployeeId);
  const fixedEmployeeName =
    employees.find((employee) => employee.id === initialEmployeeId)?.name ??
    null;

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const nextErrors = {};
    if (!employeeId) nextErrors.employee = "Pilih nama Anda.";
    if (!PIN_PATTERN.test(pin))
      nextErrors.pin = "PIN harus 4 sampai 6 digit angka.";
    if (!/^\d{4}-\d{2}$/.test(month))
      nextErrors.month = "Format bulan tidak valid.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const result = await historyMutation.mutateAsync({
        employee_id: employeeId,
        pin,
        month,
      });
      setData(result);
      setErrors({});
    } catch (err) {
      const code = err?.response?.data?.errors;
      if (code === "INVALID_PIN" || code === "PIN_LOCKED") setPin("");

      setFormError(ERROR_MESSAGES[code] ?? normalizeApiError(err).message);
    }
  }

  function handleBack() {
    setData(null);
    setFormError("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiClock size={16} />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
            className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2 id="history-title" className="mt-4 text-lg font-bold text-second">
          {data ? "Riwayat absen" : "Riwayat Saya"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-second/60">
          {data
            ? `${data.employee?.name ?? ""} · ${data.month ?? month}`
            : hasFixedEmployee
              ? "Masukkan PIN dan bulan untuk melihat riwayat absen Anda."
              : "Masukkan nama, PIN, dan bulan untuk melihat riwayat absen Anda."}
        </p>

        {!data ? (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {hasFixedEmployee ? (
              <div className="flex items-center gap-4 rounded-xl border border-second/30 bg-second/[0.03] p-4">
                <div
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
                >
                  <FiUser size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-second/60">Karyawan</p>
                  <p className="mt-2 break-words text-sm font-semibold text-second">
                    {fixedEmployeeName ?? "Karyawan"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <label htmlFor="history-employee" className={labelClass}>
                  Nama
                  <span className="ml-2 text-second2" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="history-employee"
                  value={employeeId}
                  disabled={busy}
                  onChange={(event) => {
                    setEmployeeId(event.target.value);
                    setErrors((c) => ({ ...c, employee: undefined }));
                  }}
                  aria-invalid={errors.employee ? "true" : undefined}
                  className={inputClass(Boolean(errors.employee))}
                >
                  <option value="">Pilih nama…</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
                {errors.employee && (
                  <ErrorText id="history-employee-error">
                    {errors.employee}
                  </ErrorText>
                )}
              </div>
            )}

            <div className="min-w-0">
              <label htmlFor="history-pin" className={labelClass}>
                PIN
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </label>
              <div className="relative">
                <input
                  id="history-pin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  disabled={busy}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setErrors((c) => ({ ...c, pin: undefined }));
                  }}
                  placeholder="••••"
                  aria-invalid={errors.pin ? "true" : undefined}
                  className={`${inputClass(Boolean(errors.pin))} pr-12 text-center text-lg font-semibold tracking-[0.5em] tabular-nums`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
                  aria-pressed={showPin}
                  className={`absolute inset-y-0 right-0 flex items-center justify-center px-4 text-second/50 transition-colors hover:text-second4 ${FOCUS_RING}`}
                >
                  {showPin ? (
                    <FiEyeOff size={16} aria-hidden="true" />
                  ) : (
                    <FiEye size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.pin && (
                <ErrorText id="history-pin-error">{errors.pin}</ErrorText>
              )}
            </div>

            <div className="min-w-0">
              <label htmlFor="history-month" className={labelClass}>
                Bulan
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="history-month"
                type="month"
                value={month}
                disabled={busy}
                onChange={(event) => {
                  setMonth(event.target.value);
                  setErrors((c) => ({ ...c, month: undefined }));
                }}
                aria-invalid={errors.month ? "true" : undefined}
                className={inputClass(Boolean(errors.month))}
              />
              {errors.month && (
                <ErrorText id="history-month-error">{errors.month}</ErrorText>
              )}
            </div>

            {formError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
              >
                <FiAlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {formError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busy}
                aria-busy={busy}
                className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
              >
                {busy ? (
                  <>
                    <FiLoader
                      className="animate-spin motion-reduce:animate-none"
                      size={16}
                      aria-hidden="true"
                    />
                    Memuat…
                  </>
                ) : (
                  "Lihat riwayat"
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            {/* Summary */}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-second/[0.03] p-3">
                <dt className="text-xs text-second/60">Hari</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-second">
                  {data.summary?.days ?? 0}
                </dd>
              </div>
              <div className="rounded-xl bg-second/[0.03] p-3">
                <dt className="text-xs text-second/60">Selesai</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-second3">
                  {data.summary?.completed ?? 0}
                </dd>
              </div>
              <div className="rounded-xl bg-second/[0.03] p-3">
                <dt className="text-xs text-second/60">Lupa pulang</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-second2">
                  {data.summary?.missed ?? 0}
                </dd>
              </div>
              <div className="rounded-xl bg-second/[0.03] p-3">
                <dt className="text-xs text-second/60">Total durasi</dt>
                <dd className="mt-1 text-sm font-bold tabular-nums text-second">
                  {formatDuration(data.summary?.total_minutes ?? 0)}
                </dd>
              </div>
            </dl>

            {/* Records */}
            {(data.records ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-second/20 px-4 py-8 text-center text-sm text-second/60">
                Belum ada absen di bulan ini.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-grad text-xs text-primary">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Tanggal
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-semibold"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-semibold"
                      >
                        Masuk
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-semibold"
                      >
                        Pulang
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-second/10">
                    {(data.records ?? []).map((record, i) => {
                      const status = STATUS_LABEL[record.status] ?? {
                        label: record.status,
                        tone: "outline",
                      };
                      return (
                        <tr
                          key={record.date}
                          className={`${i % 2 === 0 ? "bg-second/10" : ""}`}
                        >
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-second">
                            {formatShortDate(record.date)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Tag tone={status.tone}>{status.label}</Tag>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-second/70">
                            {record.check_in_at
                              ? formatTime(record.check_in_at)
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-second/70">
                            {record.check_out_at
                              ? formatTime(record.check_out_at)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleBack}
                className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 sm:w-auto ${FOCUS_RING}`}
              >
                <FiChevronLeft size={16} aria-hidden="true" />
                Cari lagi
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
              >
                Selesai
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
/* ---------------------------------- Page --------------------------------- */

export default function AbsenPage() {
  const employeesQuery = useGetAttendanceEmployees();
  const todayQuery = useGetAttendanceToday();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySeed, setHistorySeed] = useState({ employeeId: "", pin: "" });

  const busy = checkInMutation.isPending || checkOutMutation.isPending;
  const pendingAction = checkInMutation.isPending
    ? "in"
    : checkOutMutation.isPending
      ? "out"
      : null;

  const queryCode = employeesQuery.error?.response?.data?.errors;

  function openHistory(seed = {}) {
    setHistorySeed({
      employeeId: seed.employeeId ?? employeeId,
      pin: seed.pin ?? pin,
    });
    setHistoryOpen(true);
  }

  if (employeesQuery.isPending) {
    return (
      <Shell>
        <div
          className="flex items-center justify-center gap-4 py-8"
          role="status"
          aria-live="polite"
        >
          <FiLoader
            className="animate-spin motion-reduce:animate-none text-second4"
            size={24}
            aria-hidden="true"
          />
          <span className="text-sm text-second/60">
            Memuat daftar karyawan…
          </span>
        </div>
      </Shell>
    );
  }

  if (employeesQuery.isError) {
    const blocked = queryCode === "NETWORK_NOT_ALLOWED";

    return (
      <Shell>
        <div role="alert">
          <StateMessage
            icon={blocked ? FiWifiOff : FiAlertTriangle}
            tone={blocked ? "violet" : "red"}
            title={
              blocked ? "Bukan wifi toko" : "Halaman absen belum bisa dibuka"
            }
            action={
              <RetryButton
                onClick={() => employeesQuery.refetch()}
                busy={employeesQuery.isFetching}
              />
            }
          >
            <p>
              {ERROR_MESSAGES[queryCode] ??
                normalizeApiError(employeesQuery.error).message}
            </p>
          </StateMessage>
        </div>
      </Shell>
    );
  }

  if (result) {
    return (
      <>
        <ResultCard
          result={result}
          onDone={() => setResult(null)}
          onOpenHistory={() =>
            openHistory({
              employeeId: result.employee?.id ?? "",
              pin: "",
            })
          }
        />
        {historyOpen && (
          <HistoryModal
            onClose={() => setHistoryOpen(false)}
            initialEmployeeId={historySeed.employeeId}
            initialPin={historySeed.pin}
          />
        )}
      </>
    );
  }

  const employees = employeesQuery.data ?? [];

  if (employees.length === 0) {
    return (
      <Shell>
        <StateMessage
          icon={FiClock}
          title="Belum ada karyawan yang siap absen"
          action={
            <RetryButton
              onClick={() => employeesQuery.refetch()}
              busy={employeesQuery.isFetching}
            />
          }
        >
          <p>
            Karyawan baru bisa absen setelah memverifikasi email dan membuat PIN
            lewat tautan dari pemilik toko.
          </p>
        </StateMessage>
      </Shell>
    );
  }

  async function submit(kind) {
    setFormError("");

    const nextErrors = {};
    if (!employeeId) nextErrors.employee = "Pilih nama Anda.";
    if (!PIN_PATTERN.test(pin))
      nextErrors.pin = "PIN harus 4 sampai 6 digit angka.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const mutation = kind === "in" ? checkInMutation : checkOutMutation;

    try {
      const data = await mutation.mutateAsync({ employee_id: employeeId, pin });

      setPin("");
      setShowPin(false);
      setEmployeeId("");
      setResult(data);
      todayQuery.refetch();
    } catch (err) {
      const code = err?.response?.data?.errors;
      const status = err?.response?.status;

      if (code === "INVALID_PIN" || code === "PIN_LOCKED") setPin("");
      if (code === "EMPLOYEE_NOT_FOUND") {
        setEmployeeId("");
        setPin("");
        employeesQuery.refetch();
      }

      setFormError(
        ERROR_MESSAGES[code] ??
          (status === 429
            ? "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
            : normalizeApiError(err).message),
      );
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary px-4 py-10 text-second">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-sm font-bold uppercase tracking-[0.2em] text-second/60">
          lexea camera
        </p>

        {/* Absen form */}
        <div className="rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit("in");
            }}
            noValidate
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-balance text-lg font-bold text-second">
                  Absen karyawan
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-second/60">
                  Pilih nama, masukkan PIN, lalu tekan masuk atau pulang. Waktu
                  dicatat otomatis oleh server.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openHistory()}
                className={`${BTN_BASE} shrink-0 border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
              >
                <MdHistory size={16} aria-hidden="true" />
                Riwayat
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="min-w-0">
                <label htmlFor="employee" className={labelClass}>
                  Nama
                  <span className="ml-2 text-second2" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="employee"
                  name="employee"
                  value={employeeId}
                  disabled={busy}
                  onChange={(event) => {
                    setEmployeeId(event.target.value);
                    setErrors((c) => ({ ...c, employee: undefined }));
                  }}
                  aria-invalid={errors.employee ? "true" : undefined}
                  aria-describedby={
                    errors.employee ? "employee-error" : undefined
                  }
                  className={inputClass(Boolean(errors.employee))}
                >
                  <option value="">Pilih nama…</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
                {errors.employee && (
                  <ErrorText id="employee-error">{errors.employee}</ErrorText>
                )}
              </div>

              <div className="min-w-0">
                <label htmlFor="pin" className={labelClass}>
                  PIN
                  <span className="ml-2 text-second2" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="pin"
                  name="pin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin}
                  disabled={busy}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setErrors((c) => ({ ...c, pin: undefined }));
                  }}
                  placeholder="••••"
                  aria-invalid={errors.pin ? "true" : undefined}
                  aria-describedby="pin-hint"
                  className={`${inputClass(Boolean(errors.pin))} text-center text-lg font-semibold tracking-[0.5em] tabular-nums`}
                />

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {errors.pin ? (
                    <p
                      id="pin-hint"
                      role="alert"
                      className="flex items-start gap-2 text-sm text-second2"
                    >
                      <FiAlertCircle
                        size={16}
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      {errors.pin}
                    </p>
                  ) : (
                    <p id="pin-hint" className="text-xs text-second/60">
                      4 sampai 6 digit angka.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-pressed={showPin}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-2 py-1 text-xs font-semibold text-second/70 transition-colors hover:bg-second/10 hover:text-second ${FOCUS_RING}`}
                  >
                    {showPin ? (
                      <FiEyeOff size={14} aria-hidden="true" />
                    ) : (
                      <FiEye size={14} aria-hidden="true" />
                    )}
                    {showPin ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
              >
                <FiAlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {formError}
              </p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={busy}
                aria-busy={pendingAction === "in"}
                className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
              >
                {pendingAction === "in" ? (
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                ) : (
                  <FiLogIn size={16} aria-hidden="true" />
                )}
                {pendingAction === "in" ? "Memproses…" : "Absen masuk"}
              </button>

              <button
                type="button"
                onClick={() => submit("out")}
                disabled={busy}
                aria-busy={pendingAction === "out"}
                className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
              >
                {pendingAction === "out" ? (
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                ) : (
                  <FiLogOut size={16} aria-hidden="true" />
                )}
                {pendingAction === "out" ? "Memproses…" : "Absen pulang"}
              </button>
            </div>
          </form>
        </div>

        {/* Hari ini */}
        <section
          aria-label="Status absen hari ini"
          className="mt-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
        >
          <div className="mb-4 flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiUsers size={16} />
            </div>
            <h2 className="text-lg font-bold text-second">Hari ini</h2>
          </div>

          <TodayStatus query={todayQuery} />
        </section>

        {historyOpen && (
          <HistoryModal
            onClose={() => setHistoryOpen(false)}
            initialEmployeeId={historySeed.employeeId}
            initialPin={historySeed.pin}
          />
        )}
      </div>
    </main>
  );
}
