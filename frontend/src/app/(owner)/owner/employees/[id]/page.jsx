"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiDollarSign,
  FiLoader,
  FiMail,
  FiRefreshCw,
  FiSave,
  FiTrash2,
  FiUser,
} from "react-icons/fi";

import {
  useDeleteEmployee,
  useGetEmployee,
  useResendEmployeeVerification,
  useUpdateEmployee,
} from "../../../../features/employees/hooks.js";
import { useGetEmployeePayrolls } from "../../../../features/payrolls/hooks.js";
import {
  STATUS as PAYROLL_STATUS,
  formatCurrency,
  formatDate,
} from "../../../../../components/owner/payroll-shared.jsx";
import notify from "../../../../../lib/notify.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const EMPLOYEES_PATH = "/owner/employees";
const RESEND_COOLDOWN_SECONDS = 60;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

function inputClass(hasError, disabled = false) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4",
    disabled
      ? "bg-second/5 text-second/50 cursor-not-allowed"
      : "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

const STATUS = {
  READY: { label: "Siap absen", tone: "blue" },
  PENDING: { label: "Menunggu PIN", tone: "violet" },
  INACTIVE: { label: "Nonaktif", tone: "muted" },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PATTERN = /^[A-Za-z0-9]{1,10}$/;
const ACCOUNT_PATTERN = /^[\d\s-]+$/;

const BANK_FIELDS = [
  {
    name: "job_title",
    label: "Jabatan",
    placeholder: "Contoh: Kasir",
    max: 100,
  },
  {
    name: "bank_name",
    label: "Nama bank",
    placeholder: "Contoh: BCA",
    max: 100,
  },
  {
    name: "account_number",
    label: "Nomor rekening",
    placeholder: "1234567890",
    max: 30,
  },
  {
    name: "account_holder",
    label: "Atas nama",
    placeholder: "Nama pemilik rekening",
    max: 100,
  },
];

/* -------------------------------- Formatters ------------------------------ */

function formatDateTime(value) {
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

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
    blue: "bg-second3/10 text-second3",
    violet: "bg-second4/10 text-second4",
    red: "bg-second2/10 text-second2",
    muted: "border border-second/30 text-second/65",
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-second/60">{label}</dt>
      <dd className="min-w-0 text-right font-semibold tabular-nums text-second">
        {children}
      </dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href={EMPLOYEES_PATH}
      className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
    >
      <FiArrowLeft size={16} aria-hidden="true" />
      Semua karyawan
    </Link>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-12 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
      </div>
    </div>
  );
}

/* ------------------------------- Text field ------------------------------- */

function TextField({ id, label, error, ...inputProps }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
        <span className="ml-2 text-second2" aria-hidden="true">
          *
        </span>
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(Boolean(error))}
        {...inputProps}
      />
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-2 flex items-start gap-2 text-sm text-second2"
        >
          <FiAlertCircle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------- Form edit ------------------------------- */

function EmployeeForm({ employee }) {
  const updateMutation = useUpdateEmployee();
  const busy = updateMutation.isPending;

  const [name, setName] = useState(employee.name ?? "");
  const [email, setEmail] = useState(employee.email ?? "");
  const [displayId, setDisplayId] = useState(employee.display_id ?? "");
  const [bank, setBank] = useState(() =>
    Object.fromEntries(
      BANK_FIELDS.map((field) => [field.name, employee[field.name] ?? ""]),
    ),
  );
  const [isActive, setIsActive] = useState(Boolean(employee.is_active));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedId = displayId.trim();

  const nameChanged = trimmedName !== employee.name;
  const emailChanged =
    trimmedEmail.toLowerCase() !== (employee.email ?? "").toLowerCase();
  const idChanged = trimmedId !== (employee.display_id ?? "");
  const activeChanged = isActive !== Boolean(employee.is_active);
  const bankChanged = Object.fromEntries(
    BANK_FIELDS.map((field) => [
      field.name,
      bank[field.name].trim() !== (employee[field.name] ?? ""),
    ]),
  );
  const anyBankChanged = Object.values(bankChanged).some(Boolean);
  const dirty =
    nameChanged || idChanged || emailChanged || activeChanged || anyBankChanged;

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const nextErrors = {};

    if (!trimmedName) nextErrors.name = "Nama wajib diisi.";
    else if (trimmedName.length > 100)
      nextErrors.name = "Nama maksimal 100 karakter.";

    if (idChanged) {
      if (!trimmedId) nextErrors.display_id = "ID wajib diisi.";
      else if (!ID_PATTERN.test(trimmedId))
        nextErrors.display_id =
          "ID hanya boleh huruf dan angka, maksimal 10 karakter.";
    }

    for (const field of BANK_FIELDS) {
      if (!bankChanged[field.name]) continue;
      const value = bank[field.name].trim();

      if (!value) nextErrors[field.name] = `${field.label} wajib diisi.`;
      else if (field.name === "account_number") {
        if (!ACCOUNT_PATTERN.test(value))
          nextErrors.account_number =
            "Nomor rekening hanya boleh angka, spasi, atau tanda strip.";
        else if (value.length < 4 || value.length > 30)
          nextErrors.account_number = "Nomor rekening harus 4–30 karakter.";
      } else if (value.length > field.max) {
        nextErrors[field.name] =
          `${field.label} maksimal ${field.max} karakter.`;
      }
    }

    if (emailChanged) {
      if (!trimmedEmail) nextErrors.email = "Email wajib diisi.";
      else if (!EMAIL_PATTERN.test(trimmedEmail) || trimmedEmail.length > 254)
        nextErrors.email = "Format email tidak valid.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !dirty) return;

    const data = {
      ...(nameChanged && { name: trimmedName }),
      ...(idChanged && { display_id: trimmedId }),
      ...Object.fromEntries(
        BANK_FIELDS.filter((field) => bankChanged[field.name]).map((field) => [
          field.name,
          bank[field.name].trim(),
        ]),
      ),
      ...(emailChanged && { email: trimmedEmail }),
      ...(activeChanged && { is_active: isActive }),
    };

    try {
      const result = await updateMutation.mutateAsync({
        id: employee.id,
        data,
      });

      if (emailChanged && result?.email_sent === false) {
        notify.error(
          "Perubahan disimpan, tetapi email gagal terkirim. Gunakan “Kirim ulang tautan”.",
        );
      } else {
        notify.success("Perubahan disimpan.");
      }
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "EMAIL_ALREADY_USED") {
        setErrors({ email: "Email ini sudah dipakai." });
        return;
      }
      if (typeof code === "string" && code.includes("DISPLAY_ID")) {
        setErrors({ display_id: "ID ini sudah dipakai." });
        return;
      }
      if (code === "EMPLOYEE_LINKED_TO_USER") {
        setErrors({
          email:
            "Email karyawan yang terhubung ke akun admin tidak bisa diganti.",
        });
        return;
      }
      if (code === "EMPLOYEE_NOT_FOUND") {
        notify.error("Karyawan tidak ditemukan.");
        return;
      }

      setFormError(normalizeApiError(err).message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
    >
      <div>
        <h2 className="text-lg font-bold text-second">Data karyawan</h2>
        <p className="mt-2 text-pretty text-sm text-second/60">
          Hanya perubahan yang akan dikirim.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <label htmlFor="emp-name" className={labelClass}>
            Nama
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="emp-name"
            type="text"
            name="name"
            autoComplete="off"
            maxLength={100}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={errors.name ? "emp-name-error" : undefined}
            className={inputClass(Boolean(errors.name))}
          />
          {errors.name && (
            <p
              id="emp-name-error"
              role="alert"
              className="mt-2 flex items-start gap-2 text-sm text-second2"
            >
              <FiAlertCircle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              {errors.name}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor="emp-id" className={labelClass}>
            ID
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="emp-id"
            type="text"
            name="display_id"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={10}
            value={displayId}
            disabled={busy}
            onChange={(event) =>
              setDisplayId(
                event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 10),
              )
            }
            aria-invalid={errors.display_id ? "true" : undefined}
            aria-describedby={
              errors.display_id ? "emp-id-error" : "emp-id-note"
            }
            className={inputClass(Boolean(errors.display_id))}
          />
          {errors.display_id ? (
            <p
              id="emp-id-error"
              role="alert"
              className="mt-2 flex items-start gap-2 text-sm text-second2"
            >
              <FiAlertCircle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              {errors.display_id}
            </p>
          ) : (
            <p id="emp-id-note" className="mt-2 text-xs text-second/60">
              Huruf dan angka, maksimal 10 karakter.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor="emp-email" className={labelClass}>
            Email
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="emp-email"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            maxLength={254}
            value={email}
            disabled={busy || employee.linked_to_user}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby="emp-email-note"
            className={inputClass(
              Boolean(errors.email),
              employee.linked_to_user,
            )}
          />
          {errors.email && (
            <p
              role="alert"
              className="mt-2 flex items-start gap-2 text-sm text-second2"
            >
              <FiAlertCircle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              {errors.email}
            </p>
          )}
          <p
            id="emp-email-note"
            className="mt-2 text-xs leading-relaxed text-second/60"
          >
            {employee.linked_to_user
              ? "Karyawan ini terhubung ke akun admin, jadi emailnya tidak bisa diganti dari sini."
              : "Mengganti email menghapus verifikasi dan PIN. Tautan baru dikirim ke email baru dan karyawan harus membuat PIN lagi."}
          </p>

          {emailChanged && !employee.linked_to_user && (
            <p
              role="status"
              className="mt-4 flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-xs text-second4"
            >
              <FiAlertTriangle
                size={14}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Email berubah. Saat disimpan, PIN lama karyawan tidak berlaku
              lagi.
            </p>
          )}
        </div>

        <p className="pt-2 text-sm font-bold text-second">
          Jabatan dan rekening
        </p>

        {BANK_FIELDS.map((field) => (
          <TextField
            key={field.name}
            id={`emp-${field.name}`}
            name={field.name}
            label={field.label}
            error={errors[field.name]}
            maxLength={field.max}
            value={bank[field.name]}
            disabled={busy}
            placeholder={field.placeholder}
            inputMode={field.name === "account_number" ? "numeric" : undefined}
            onChange={(event) => {
              const raw = event.target.value;
              const value =
                field.name === "account_number"
                  ? raw.replace(/[^\d\s-]/g, "")
                  : raw;
              setBank((current) => ({ ...current, [field.name]: value }));
              if (errors[field.name])
                setErrors((current) => ({ ...current, [field.name]: "" }));
            }}
          />
        ))}

        <div className="flex items-start justify-between gap-4 rounded-xl border border-second/30 p-4">
          <div className="min-w-0">
            <p
              id="emp-active-label"
              className="text-sm font-semibold text-second"
            >
              Karyawan aktif
            </p>
            <p
              id="emp-active-desc"
              className="mt-2 text-xs leading-relaxed text-second/60"
            >
              Jika dinonaktifkan, karyawan hilang dari daftar absen. Riwayat
              absen tetap tersimpan dan bisa diaktifkan kembali kapan saja.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-labelledby="emp-active-label"
            aria-describedby="emp-active-desc"
            disabled={busy}
            onClick={() => setIsActive((value) => !value)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              isActive ? "bg-grad" : "bg-second/20"
            } ${FOCUS_RING}`}
          >
            <span
              aria-hidden="true"
              className={`inline-block size-5 rounded-full bg-primary shadow transition-transform ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
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
        <Link
          href={EMPLOYEES_PATH}
          className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 sm:w-auto ${FOCUS_RING}`}
        >
          Kembali
        </Link>

        <button
          type="submit"
          disabled={busy || !dirty}
          aria-busy={busy}
          className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
        >
          {busy ? (
            <>
              <FiLoader
                className="animate-spin motion-reduce:animate-none"
                size={16}
                aria-hidden="true"
              />
              Menyimpan…
            </>
          ) : (
            <>
              <FiSave size={16} aria-hidden="true" />
              Simpan perubahan
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/* ----------------------- Panel kirim ulang tautan ----------------------- */

function ResendPanel({ employee }) {
  const resendMutation = useResendEmployeeVerification();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const unavailable = employee.linked_to_user || !employee.is_active;
  const busy = resendMutation.isPending;

  async function handleResend() {
    try {
      const result = await resendMutation.mutateAsync(employee.id);
      setCooldown(RESEND_COOLDOWN_SECONDS);

      if (result?.email_sent === false) {
        notify.error("Email gagal terkirim. Coba lagi sebentar lagi.");
      } else {
        notify.success("Tautan baru dikirim ke email karyawan.");
      }
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "VERIFICATION_RECENTLY_SENT") {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        notify.error(
          "Tautan baru saja dikirim. Tunggu satu menit sebelum mengirim lagi.",
        );
        return;
      }
      if (code === "EMPLOYEE_INACTIVE") {
        notify.error(
          "Karyawan nonaktif. Aktifkan dulu sebelum mengirim tautan.",
        );
        return;
      }
      if (code === "EMPLOYEE_LINKED_TO_USER") {
        notify.error("Karyawan ini terhubung ke akun admin.");
        return;
      }
      if (code === "MAIL_SEND_FAILED") {
        notify.error("Email gagal terkirim. Coba lagi sebentar lagi.");
        return;
      }
      if (code === "MAIL_NOT_CONFIGURED") {
        notify.error("Pengiriman email belum dikonfigurasi di server (SMTP).");
        return;
      }

      notify.error(normalizeApiError(err).message);
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
          <FiMail size={16} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-second">
          Tautan verifikasi & PIN
        </h2>
      </div>

      <p className="text-sm leading-relaxed text-second/60">
        Kirim ulang jika email tidak sampai, tautan kedaluwarsa, atau karyawan
        lupa PIN (reset). Tautan lama otomatis hangus; PIN lama tetap berlaku
        sampai karyawan membuat yang baru.
      </p>

      <button
        type="button"
        onClick={handleResend}
        disabled={busy || cooldown > 0 || unavailable}
        aria-busy={busy}
        className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
      >
        {busy ? (
          <>
            <FiLoader
              className="animate-spin motion-reduce:animate-none"
              size={16}
              aria-hidden="true"
            />
            Mengirim…
          </>
        ) : cooldown > 0 ? (
          <span className="tabular-nums">Kirim ulang dalam {cooldown} dtk</span>
        ) : (
          <>
            <FiMail size={16} aria-hidden="true" />
            Kirim ulang tautan
          </>
        )}
      </button>

      {unavailable && (
        <p className="text-xs text-second/60">
          {employee.linked_to_user
            ? "Tidak tersedia untuk karyawan yang terhubung ke akun admin."
            : "Aktifkan karyawan terlebih dahulu untuk mengirim tautan."}
        </p>
      )}
    </section>
  );
}

/* ------------------------------- Slip gaji -------------------------------- */

function PayrollPanel({ employee }) {
  const query = useGetEmployeePayrolls(employee.id, { page: 1 });
  const slips = (query.data?.data ?? []).slice(0, 3);
  const total = query.data?.paging?.total ?? 0;

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
          <FiDollarSign size={16} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-second">Slip gaji</h2>
      </div>

      {query.isPending ? (
        <p role="status" className="text-sm text-second/60">
          Memuat slip gaji…
        </p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-second2">
          Gagal memuat slip gaji.
        </p>
      ) : slips.length === 0 ? (
        <p className="text-sm text-second/60">
          Belum ada slip gaji untuk karyawan ini.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-second/10">
          {slips.map((slip) => {
            const state = PAYROLL_STATUS[slip.status] ?? PAYROLL_STATUS.PENDING;
            return (
              <li key={slip.id} className="py-2">
                <Link
                  href={`/owner/payrolls/${slip.id}`}
                  className={`flex items-center justify-between gap-4 rounded ${FOCUS_RING}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold tabular-nums text-second">
                      {formatCurrency(slip.total_amount)}
                    </span>
                    <span className="mt-2 block text-xs text-second/60">
                      {formatDate(slip.disbursement_date)}
                    </span>
                  </span>
                  <Tag tone={state.tone}>{state.label}</Tag>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <Link
          href={`/owner/payrolls/create?employee_id=${employee.id}`}
          className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
        >
          Buat slip gaji
        </Link>
        {total > 0 && (
          <Link
            href={`/owner/payrolls?employee_id=${employee.id}`}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
          >
            Lihat semua ({total})
          </Link>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ Hapus karyawan ---------------------------- */

function DeleteEmployeeModal({ employee, busy, onClose, onConfirm }) {
  const [understood, setUnderstood] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-employee-title"
      aria-describedby="delete-employee-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-second/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second2/10 text-second2"
          >
            <FiTrash2 size={16} />
          </div>
          <h2
            id="delete-employee-title"
            className="text-lg font-bold text-second"
          >
            Hapus karyawan?
          </h2>
        </div>

        <div
          id="delete-employee-desc"
          className="flex flex-col gap-2 text-sm leading-relaxed text-second/60"
        >
          <p>
            <span className="break-words font-semibold text-second">
              {employee.name}
            </span>{" "}
            akan dihapus <span className="font-semibold">permanen</span> beserta
            seluruh riwayat absennya. Tindakan ini tidak bisa dibatalkan.
          </p>
          <p>
            Jika riwayat absen masih dibutuhkan, nonaktifkan saja karyawan ini
            lewat tombol “Karyawan aktif”.
          </p>
          {employee.linked_to_user && (
            <p>
              Karyawan ini terhubung ke akun admin. Hanya data karyawannya yang
              dihapus, akun admin tidak ikut terhapus.
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-second2/30 bg-second2/5 p-4">
          <input
            type="checkbox"
            checked={understood}
            disabled={busy}
            onChange={(event) => setUnderstood(event.target.checked)}
            className={`size-4 shrink-0 cursor-pointer accent-second2 ${FOCUS_RING}`}
          />
          <span className="text-sm font-semibold text-second">
            Saya mengerti riwayat absen ikut terhapus permanen
          </span>
        </label>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !understood}
            aria-busy={busy}
            className={`${BTN_BASE} w-full bg-second2 text-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
          >
            {busy ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Menghapus…
              </>
            ) : (
              <>
                <FiTrash2 size={16} aria-hidden="true" />
                Hapus permanen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeletePanel({ employee }) {
  const router = useRouter();
  const deleteMutation = useDeleteEmployee();
  const [open, setOpen] = useState(false);
  const busy = deleteMutation.isPending;

  async function handleDelete() {
    try {
      const result = await deleteMutation.mutateAsync(employee.id);
      const count = Number(result?.deleted_attendances);

      notify.success(
        Number.isFinite(count) && count > 0
          ? `Karyawan dihapus beserta ${count} riwayat absen.`
          : "Karyawan dihapus.",
      );
      router.replace(EMPLOYEES_PATH);
    } catch (err) {
      const code = err?.response?.data?.errors;
      setOpen(false);

      if (code === "EMPLOYEE_NOT_FOUND") {
        notify.error("Karyawan tidak ditemukan atau sudah dihapus.");
        router.replace(EMPLOYEES_PATH);
        return;
      }

      notify.error(normalizeApiError(err).message);
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second2/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <h2 className="text-lg font-bold text-second2">Zona berbahaya</h2>

      <p className="text-sm leading-relaxed text-second/60">
        Hapus karyawan beserta seluruh riwayat absennya secara permanen. Untuk
        menyimpan riwayat, nonaktifkan saja.
      </p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className={`${BTN_BASE} w-full border border-second2/30 text-second2 hover:border-second2 hover:bg-second2/5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
      >
        <FiTrash2 size={16} aria-hidden="true" />
        Hapus karyawan
      </button>

      {open && (
        <DeleteEmployeeModal
          employee={employee}
          busy={busy}
          onClose={() => setOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const {
    data: employee,
    isPending,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetEmployee(id);

  const code = error?.response?.data?.errors;
  const notFound =
    isError &&
    (code === "EMPLOYEE_NOT_FOUND" || error?.response?.status === 404);

  if (isPending) {
    return <LoadingState />;
  }

  if (isError || !employee) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <BackLink />
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            {notFound ? "Karyawan tidak ditemukan" : "Gagal memuat karyawan"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            {notFound
              ? "Data karyawan mungkin sudah tidak ada."
              : normalizeApiError(error).message}
          </p>
          {!notFound && (
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              <FiRefreshCw
                size={16}
                className={
                  isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : "hidden"
                }
                aria-hidden="true"
              />
              {isFetching ? "Memuat…" : "Coba lagi"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const status = STATUS[employee.status] ?? {
    label: employee.status ?? "—",
    tone: "muted",
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <BackLink />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiUser size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-second/60">Detail karyawan</p>
              <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-second sm:text-3xl">
                {employee.name}
              </h1>
              <p className="mt-2 break-all text-sm text-second/60">
                {employee.email}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {employee.display_id && (
                  <Tag tone="strong">ID {employee.display_id}</Tag>
                )}
                <Tag tone={status.tone}>{status.label}</Tag>
                {employee.linked_to_user && <Tag tone="muted">Akun admin</Tag>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <EmployeeForm key={employee.id} employee={employee} />

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-16">
          <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
            <h2 className="text-lg font-bold text-second">Status akun absen</h2>

            <dl className="divide-y divide-second/10">
              <InfoRow label="PIN">
                {employee.pin_set ? (
                  <Tag tone="blue">Sudah dibuat</Tag>
                ) : (
                  <Tag tone="violet">Belum dibuat</Tag>
                )}
              </InfoRow>
              <InfoRow label="Email terverifikasi">
                {employee.email_verified_at
                  ? formatDateTime(employee.email_verified_at)
                  : "Belum"}
              </InfoRow>
              <InfoRow label="Tautan terakhir dikirim">
                {formatDateTime(employee.verify_sent_at)}
              </InfoRow>
              <InfoRow label="Ditambahkan">
                {formatDateTime(employee.created_at)}
              </InfoRow>
            </dl>
          </section>

          <ResendPanel employee={employee} />

          <PayrollPanel employee={employee} />

          <DeletePanel employee={employee} />
        </aside>
      </div>
    </div>
  );
}
