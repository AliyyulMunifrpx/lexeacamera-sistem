"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  useCreateEmployee,
  useGetEmployees,
} from "../../../features/employees/hooks.js";
import PrimaryButton from "./../../../../components/primary-button";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const EMPLOYEE_PATH = (id) => `/owner/employees/${id}`;

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

const STATUS = {
  READY: { label: "Siap absen", tone: "blue" },
  PENDING: { label: "Menunggu PIN", tone: "violet" },
  INACTIVE: { label: "Nonaktif", tone: "muted" },
};

const CONTRACT_STATUS = {
  NONE: { label: "Tanpa kontrak", tone: "muted" },
  UPCOMING: { label: "Belum mulai", tone: "violet" },
  ACTIVE: { label: "Berjalan", tone: "blue" },
  ENDED: { label: "Berakhir", tone: "red" },
};

const STATUS_FILTERS = [
  { value: "ALL", label: "Semua" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Nonaktif" },
];

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

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

function daysLeftLabel(days) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Hari terakhir";
  if (days > 0) return `Sisa ${days} hari`;
  return `Berakhir ${Math.abs(days)} hari lalu`;
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function validateContract(start, end) {
  const errors = {};
  if (start && !isValidDateOnly(start))
    errors.contract_start = "Isi tanggal awal kontrak yang valid.";
  if (end && !isValidDateOnly(end))
    errors.contract_end = "Isi tanggal akhir kontrak yang valid.";
  if (
    !errors.contract_start &&
    !errors.contract_end &&
    start &&
    end &&
    end < start
  )
    errors.contract_end =
      "Akhir kontrak tidak boleh lebih awal dari awal kontrak.";
  return errors;
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

function StatusTag({ status }) {
  const config = STATUS[status] ?? { label: status ?? "—", tone: "muted" };
  return <Tag tone={config.tone}>{config.label}</Tag>;
}

/* Status kontrak + sisa hari (kalau ada tanggal akhir). */
function ContractCell({ employee }) {
  const info =
    CONTRACT_STATUS[employee.contract_status] ?? CONTRACT_STATUS.NONE;
  const hint = employee.contract_end
    ? daysLeftLabel(employee.contract_days_left)
    : "";

  return (
    <div className="flex flex-col items-start gap-2">
      <Tag tone={info.tone}>{info.label}</Tag>
      {hint && (
        <span className="text-xs tabular-nums text-second/60">{hint}</span>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, featured = false }) {
  return (
    <article
      className={`flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:p-8 ${
        featured
          ? "bg-grad text-primary shadow-lg shadow-second4/25"
          : "border border-second/30 bg-primary text-second shadow-xl shadow-second/5"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
            featured
              ? "bg-primary text-second"
              : "bg-grad text-primary shadow-lg shadow-second4/25"
          }`}
        >
          <Icon size={16} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>
      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {value}
        </p>
        {hint && (
          <p
            className={`mt-2 text-xs tabular-nums ${featured ? "text-primary/90" : "text-second/60"}`}
          >
            {hint}
          </p>
        )}
      </div>
    </article>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
        <div className="h-8 w-40 animate-pulse rounded-xl bg-second/10" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
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

/* Field tanggal opsional (kontrak). */
function DateField({ id, label, error, ...inputProps }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
        <span className="ml-2 text-xs font-normal text-second/50">
          Opsional
        </span>
      </label>
      <input
        id={id}
        type="date"
        min="2000-01-01"
        max="2100-12-31"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass(Boolean(error))} tabular-nums`}
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

/* ------------------------- Add Employee Dialog ---------------------------- */

function AddEmployeeDialog({ onClose }) {
  const createMutation = useCreateEmployee();
  const busy = createMutation.isPending;

  const nameRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [displayId, setDisplayId] = useState("");
  const [bank, setBank] = useState({
    job_title: "",
    bank_name: "",
    account_number: "",
    account_holder: "",
  });
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nameRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape" && !busyRef.current) onCloseRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nextErrors = {};

    if (!trimmedName) nextErrors.name = "Nama wajib diisi.";
    else if (trimmedName.length > 100)
      nextErrors.name = "Nama maksimal 100 karakter.";

    if (!trimmedEmail) nextErrors.email = "Email wajib diisi.";
    else if (!EMAIL_PATTERN.test(trimmedEmail) || trimmedEmail.length > 254)
      nextErrors.email = "Format email tidak valid.";

    const trimmedId = displayId.trim();
    if (!trimmedId) nextErrors.display_id = "ID wajib diisi.";
    else if (!ID_PATTERN.test(trimmedId))
      nextErrors.display_id =
        "ID hanya boleh huruf dan angka, maksimal 10 karakter.";

    const trimmedBank = {};
    for (const field of BANK_FIELDS) {
      const value = bank[field.name].trim();
      trimmedBank[field.name] = value;

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

    Object.assign(nextErrors, validateContract(contractStart, contractEnd));

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => {
        document
          .querySelector("[role='dialog'] [aria-invalid='true']")
          ?.scrollIntoView({ block: "center" });
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        name: trimmedName,
        email: trimmedEmail,
        display_id: trimmedId,
        ...trimmedBank,
        ...(contractStart && { contract_start: contractStart }),
        ...(contractEnd && { contract_end: contractEnd }),
      });

      if (result?.email_sent === false) {
        notify.error(
          "Karyawan dibuat, tetapi email gagal terkirim. Buka detail karyawan lalu kirim ulang tautan.",
        );
      } else {
        notify.success(
          "Karyawan ditambahkan. Tautan verifikasi sudah dikirim ke email.",
        );
      }

      onClose();
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

      if (code === "INVALID_CONTRACT_PERIOD") {
        setErrors({
          contract_end:
            "Akhir kontrak tidak boleh lebih awal dari awal kontrak.",
        });
        return;
      }

      setFormError(normalizeApiError(err).message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-employee-title"
        onSubmit={handleSubmit}
        noValidate
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
            <FiUserPlus size={16} aria-hidden="true" />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup dialog"
            className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="add-employee-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Tambah karyawan
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-second/60">
          Karyawan akan menerima email berisi tautan untuk verifikasi dan
          membuat PIN sendiri. Anda tidak perlu mengetahui PIN-nya.
        </p>

        <div className="mt-8 space-y-4">
          <div className="min-w-0">
            <label htmlFor="employee-name" className={labelClass}>
              Nama
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="employee-name"
              ref={nameRef}
              type="text"
              name="name"
              autoComplete="off"
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Ani…"
              aria-invalid={errors.name ? "true" : undefined}
              aria-describedby={errors.name ? "employee-name-error" : undefined}
              className={inputClass(Boolean(errors.name))}
            />
            {errors.name && (
              <p
                id="employee-name-error"
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
            <label htmlFor="employee-email" className={labelClass}>
              Email
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="employee-email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              maxLength={254}
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ani@example.com"
              aria-invalid={errors.email ? "true" : undefined}
              aria-describedby={
                errors.email ? "employee-email-error" : undefined
              }
              className={inputClass(Boolean(errors.email))}
            />
            {errors.email && (
              <p
                id="employee-email-error"
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
          </div>

          <div className="min-w-0">
            <label htmlFor="employee-id" className={labelClass}>
              ID
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="employee-id"
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
              placeholder="Contoh: KRY001"
              aria-invalid={errors.display_id ? "true" : undefined}
              aria-describedby="employee-id-hint"
              className={inputClass(Boolean(errors.display_id))}
            />
            {errors.display_id ? (
              <p
                id="employee-id-hint"
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
              <p id="employee-id-hint" className="mt-2 text-xs text-second/60">
                Huruf dan angka, maksimal 10 karakter.
              </p>
            )}
          </div>

          <p className="pt-2 text-sm font-bold text-second">
            Jabatan dan rekening
          </p>

          {BANK_FIELDS.map((field) => (
            <TextField
              key={field.name}
              id={`employee-${field.name}`}
              name={field.name}
              label={field.label}
              error={errors[field.name]}
              maxLength={field.max}
              value={bank[field.name]}
              disabled={busy}
              placeholder={field.placeholder}
              inputMode={
                field.name === "account_number" ? "numeric" : undefined
              }
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

          <p className="pt-2 text-sm font-bold text-second">Kontrak</p>

          <DateField
            id="employee-contract-start"
            name="contract_start"
            label="Awal kontrak"
            error={errors.contract_start}
            value={contractStart}
            disabled={busy}
            onChange={(event) => {
              setContractStart(event.target.value);
              if (errors.contract_start || errors.contract_end)
                setErrors((current) => ({
                  ...current,
                  contract_start: "",
                  contract_end: "",
                }));
            }}
          />

          <DateField
            id="employee-contract-end"
            name="contract_end"
            label="Akhir kontrak"
            error={errors.contract_end}
            value={contractEnd}
            disabled={busy}
            onChange={(event) => {
              setContractEnd(event.target.value);
              if (errors.contract_end)
                setErrors((current) => ({ ...current, contract_end: "" }));
            }}
          />

          <p className="-mt-2 text-xs leading-relaxed text-second/60">
            Kosongkan untuk karyawan tetap. Hari akhir kontrak masih dihitung
            berjalan.
          </p>
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

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={busy}
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
                Menambahkan…
              </>
            ) : (
              "Tambah & kirim email"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function EmployeesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isPending, isError, isFetching, error, refetch } =
    useGetEmployees({
      search,
      status,
      page: currentPage,
    });

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const employees = data?.data ?? [];
  const paging = data?.paging;

  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? currentPage;
  const perPage = paging?.per_page ?? employees.length;
  const startItem = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, total);

  const readyCount = employees.filter((e) => e.status === "READY").length;
  const pendingCount = employees.filter((e) => e.status === "PENDING").length;

  const hasFilters = search !== "" || status !== "ALL";

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("ALL");
    setCurrentPage(1);
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiUsers size={16} />
            </div>
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                <span className="text-grad">Karyawan</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Kelola karyawan yang melakukan absen.
              </p>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat karyawan
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi Anda, lalu coba kembali.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiUsers size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              <span className="text-grad">Karyawan</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kelola karyawan yang melakukan absen. Mereka tidak punya akun
              login, cukup verifikasi email dan membuat PIN.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui daftar"
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </button>

          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
          >
            <FiPlus size={16} aria-hidden="true" />
            Tambah karyawan
          </button>
        </div>
      </header>

      {isError && data && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <FiAlertTriangle size={16} aria-hidden="true" />
            Gagal memperbarui data. Menampilkan data terakhir.
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className={`${BTN_BASE} w-fit border border-second2/40 text-second2 hover:bg-second2/10 ${FOCUS_RING}`}
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Stat cards */}
      <section
        aria-label="Ringkasan karyawan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          featured
          icon={FiUsers}
          label="Total karyawan"
          value={formatNumber(total)}
          hint={hasFilters ? "Sesuai filter" : "Semua karyawan"}
        />
        <StatCard
          icon={FiCheckCircle}
          label="Siap absen"
          value={formatNumber(readyCount)}
          hint="Pada halaman ini"
        />
        <StatCard
          icon={FiClock}
          label="Menunggu PIN"
          value={formatNumber(pendingCount)}
          hint="Pada halaman ini"
        />
      </section>

      {/* Filter */}
      <section
        aria-label="Filter karyawan"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Filter</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Cari karyawan berdasarkan nama atau email, atau filter berdasarkan
            status.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="employee-search" className={labelClass}>
              Cari karyawan
            </label>
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                id="employee-search"
                type="search"
                name="search"
                autoComplete="off"
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari nama atau email…"
                className={`${inputClass(false)} pl-8`}
              />
            </div>
          </div>

          <div role="group" aria-label="Filter status" className="flex gap-2">
            {STATUS_FILTERS.map((item) => {
              const active = status === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStatus(item.value);
                    setCurrentPage(1);
                  }}
                  className={`${BTN_BASE} ${
                    active
                      ? "bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90"
                      : "border border-second/30 text-second hover:border-second4 hover:text-second4"
                  } ${FOCUS_RING}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* List header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar karyawan</h2>
          <p
            className="mt-2 text-sm tabular-nums text-second/60"
            aria-live="polite"
          >
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(total)} karyawan
          </p>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="strong">Filter aktif</Tag>
            <button
              type="button"
              onClick={resetFilters}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
            >
              <FiX size={16} aria-hidden="true" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="relative min-h-40">
        {isFetching && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px]"
          >
            <div className="flex items-center gap-2 rounded-xl border border-second/30 bg-primary px-4 py-2 shadow-xl shadow-second/5">
              <FiLoader
                className="animate-spin motion-reduce:animate-none text-second4"
                size={16}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-second">
                Memperbarui data…
              </span>
            </div>
          </div>
        )}

        {employees.length > 0 ? (
          <div
            className={`transition-opacity duration-200 ${isFetching ? "opacity-40" : "opacity-100"}`}
          >
            {/* Tabel desktop */}
            <div className="hidden overflow-hidden rounded-2xl bg-primary shadow-xl shadow-second/5 md:block">
              <table className="min-w-full text-left">
                <thead className="bg-grad text-sm text-primary">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      ID
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Nama
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Kontrak
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-second/10">
                  {employees.map((employee, i) => (
                    <tr
                      key={employee.id}
                      className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                    >
                      <td className="px-4 py-4 text-sm tabular-nums text-second/70">
                        {employee.display_id ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-second">
                        {employee.name}
                      </td>
                      <td className="max-w-72 truncate px-4 py-4 text-sm text-second/70">
                        {employee.email}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatusTag status={employee.status} />
                          {employee.linked_to_user && (
                            <Tag tone="muted">Akun admin</Tag>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <ContractCell employee={employee} />
                      </td>

                      <td className="px-4 py-4 text-right">
                        <PrimaryButton href={EMPLOYEE_PATH(employee.id)}>
                          Detail
                          <FiChevronRight size={16} aria-hidden="true" />
                        </PrimaryButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card mobile */}
            <ul className="flex flex-col gap-4 md:hidden">
              {employees.map((employee) => {
                const contract =
                  CONTRACT_STATUS[employee.contract_status] ??
                  CONTRACT_STATUS.NONE;
                const contractHint = employee.contract_end
                  ? daysLeftLabel(employee.contract_days_left)
                  : "";

                return (
                  <li key={employee.id}>
                    <Link
                      href={EMPLOYEE_PATH(employee.id)}
                      className={`group block min-w-0 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-second group-hover:text-second4">
                            {employee.name}
                          </p>
                          <p className="mt-2 break-all text-xs text-second/60">
                            {employee.email}
                          </p>
                        </div>
                        <FiChevronRight
                          size={18}
                          className="mt-0.5 shrink-0 text-second/40"
                          aria-hidden="true"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {employee.display_id && (
                          <Tag tone="outline">ID {employee.display_id}</Tag>
                        )}
                        <StatusTag status={employee.status} />
                        {employee.linked_to_user && (
                          <Tag tone="muted">Akun admin</Tag>
                        )}
                        {employee.contract_status &&
                          employee.contract_status !== "NONE" && (
                            <Tag tone={contract.tone}>
                              Kontrak {contract.label.toLowerCase()}
                              {contractHint ? ` · ${contractHint}` : ""}
                            </Tag>
                          )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiUsers size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters ? "Karyawan tidak ditemukan" : "Belum ada karyawan"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada karyawan yang sesuai dengan pencarian atau filter."
                : "Tambahkan karyawan pertama Anda agar bisa mulai absen."}
            </p>
            <button
              type="button"
              onClick={hasFilters ? resetFilters : () => setShowAdd(true)}
              className={`${BTN_BASE} mt-4 ${
                hasFilters
                  ? "border border-second/30 text-second hover:border-second2 hover:text-second2"
                  : "bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90"
              } ${FOCUS_RING}`}
            >
              {hasFilters ? (
                "Reset filter"
              ) : (
                <>
                  <FiPlus size={16} aria-hidden="true" />
                  Tambah karyawan
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Paginasi */}
      {total > 0 && (
        <nav
          aria-label="Paginasi karyawan"
          className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm tabular-nums text-second/60">
            Halaman {formatNumber(safePage)} dari {formatNumber(totalPages)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className={`${BTN_BASE} flex-1 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>

            <button
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className={`${BTN_BASE} flex-1 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              Berikutnya
              <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}

      {showAdd && <AddEmployeeDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}
