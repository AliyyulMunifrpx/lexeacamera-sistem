"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link.js";
import { useRouter } from "next/navigation";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiInbox,
  FiLayers,
  FiLoader,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiSend,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiUnlock,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";

import {
  useCreateEntry,
  useDeleteDailyReport,
  useDeleteEntry,
  useDeleteProof,
  useGetDailyReport,
  useGetReportHistory,
  useUpdateDailyReport,
  useUpdateEntry,
  useUploadProof,
} from "../../app/features/daily-reports/hooks.js";
import { ExportReportButton } from "./export-reports-button.jsx";
import {
  AmountInput,
  BTN_BASE,
  BTN_DANGER,
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  FormSection,
  HISTORY_LABELS,
  MethodTag,
  METHODS,
  PREVIEWABLE_TYPES,
  PROOF_TYPES,
  ROLE_LABELS,
  Tag,
  describeError,
  describeHistory,
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  inputClass,
  labelClass,
  MAX_AMOUNT,
  MAX_ENTRIES,
  MAX_PROOF_SIZE,
  needsProof,
  getRemitStatus,
} from "./daily-reports-shared.jsx";
import notify from "../../lib/notify.js";
import { MdCancel } from "react-icons/md";

/* ------------------------------ Error mapping ----------------------------- */
function hasRemitAmounts(report) {
  return (
    report.remit_cash !== null &&
    report.remit_cash !== undefined &&
    report.remit_transfer !== null &&
    report.remit_transfer !== undefined
  );
}
function explainError(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.errors;

  if (status === 404 || code === "REPORT_NOT_FOUND") {
    return {
      title: "Laporan tidak ditemukan",
      description: "Laporan ini tidak ada atau sudah dihapus.",
      canRetry: false,
    };
  }
  if (status === 401) {
    return {
      title: "Sesi Anda telah berakhir",
      description: "Silakan login ulang.",
      canRetry: false,
    };
  }
  if (status === 403) {
    return {
      title: "Anda tidak punya akses",
      description: "Akun Anda tidak punya izin untuk membuka laporan ini.",
      canRetry: false,
    };
  }
  if (status >= 500) {
    return {
      title: "Server sedang bermasalah",
      description: "Coba lagi beberapa saat.",
      canRetry: true,
    };
  }
  if (error?.code === "ERR_NETWORK" || status === undefined) {
    return {
      title: "Koneksi ke server gagal",
      description: "Periksa koneksi internet Anda, lalu coba lagi.",
      canRetry: true,
    };
  }
  return {
    title: "Gagal memuat laporan",
    description: describeError(error) || "Terjadi kesalahan tak terduga.",
    canRetry: true,
  };
}

/* ------------------------------ Small pieces ------------------------------ */

function Spinner() {
  return (
    <FiLoader
      className="animate-spin motion-reduce:animate-none"
      size={16}
      aria-hidden="true"
    />
  );
}
// Status setoran: belum diapprove → sudah setor (ADMIN sudah isi) → approve owner.

function IconButton({ label, onClick, disabled, tone = "default", children }) {
  const tones = {
    default: "text-second/60 hover:bg-second4 hover:text-primary",
    danger: "text-second2 hover:bg-second2 hover:text-primary",
    success: "text-second3 hover:bg-second3 hover:text-primary",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 touch-manipulation ${tones[tone]} ${FOCUS_RING}`}
    >
      {children}
    </button>
  );
}

function ProgressBar({ value, max, tone = "bg-second3", label }) {
  const percent =
    max > 0
      ? Math.min(100, Math.max(0, ((Number(value) || 0) / max) * 100))
      : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className="h-2 w-full overflow-hidden rounded-full bg-second/10"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${tone}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function IconChip({ icon: Icon, className = "bg-second4/10 text-second4" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${className}`}
    >
      <Icon size={16} />
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  action,
  tone = "neutral",
}) {
  const iconTones = {
    neutral: "bg-grad text-primary shadow-lg shadow-second4/25",
    success: "bg-second3 text-primary shadow-lg shadow-second3/25",
    failure: "bg-second2 text-primary shadow-lg shadow-second2/25",
    pending: "bg-second4 text-primary shadow-lg shadow-second4/25",
  };

  return (
    <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${iconTones[tone]}`}
      >
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-second/60">{label}</p>
        <div className="mt-1 break-words text-lg font-bold tabular-nums text-second">
          {value}
        </div>
        {hint && (
          <p className="mt-0.5 break-words text-xs tabular-nums text-second/60">
            {hint}
          </p>
        )}
      </div>
      {action}
    </article>
  );
}

// Dua pilihan bergaya tombol (jenis baris, metode).
function Toggle({ label, options, value, onChange, disabled }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          disabled={disabled}
          onClick={() => onChange(option.id)}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 touch-manipulation ${FOCUS_RING} ${
            value === option.id
              ? (option.active ?? "border-second4 bg-second4/10 text-second4")
              : "border-second/30 text-second/60 hover:border-second4"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const KIND_OPTIONS = [
  {
    id: "income",
    label: "Pemasukan",
    active: "border-second3 bg-second3/10 text-second3",
  },
  {
    id: "expense",
    label: "Pengeluaran",
    active: "border-second2 bg-second2/10 text-second2",
  },
];

function validateEntry({ name, amount }) {
  const found = {};

  if (!name.trim()) found.name = "Atas nama wajib diisi.";
  if (amount === "" || Number(amount) <= 0) {
    found.amount = "Nominal harus lebih dari 0.";
  } else if (Number(amount) > MAX_AMOUNT) {
    found.amount = "Nominal terlalu besar.";
  }

  return found;
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ error, onRetry, isFetching }) {
  const info = explainError(error);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center"
    >
      <FiAlertTriangle size={32} className="text-second2" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold text-second">{info.title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-second/60">
        {info.description}
      </p>
      {info.canRetry && (
        <button
          type="button"
          onClick={onRetry}
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
      )}
    </div>
  );
}

/* --------------------------------- Summary -------------------------------- */

function OpeningBalanceCard({ report, canEdit }) {
  const updateReport = useUpdateDailyReport();
  const [editing, setEditing] = useState(false);
  const [cash, setCash] = useState("");
  const [noncash, setNoncash] = useState("");
  const [errors, setErrors] = useState({});

  function startEdit() {
    setCash(String(report.opening_cash ?? 0));
    setNoncash(String(report.opening_noncash ?? 0));
    setErrors({});
    setEditing(true);
  }

  function save() {
    const found = {};

    if (Number(cash || 0) > MAX_AMOUNT) found.cash = "Nominal terlalu besar.";
    if (Number(noncash || 0) > MAX_AMOUNT) {
      found.noncash = "Nominal terlalu besar.";
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const nextCash = Number(cash || 0);
    const nextNoncash = Number(noncash || 0);

    if (
      nextCash === Number(report.opening_cash) &&
      nextNoncash === Number(report.opening_noncash)
    ) {
      setEditing(false);
      return;
    }

    updateReport.mutate(
      {
        id: report.id,
        data: { opening_cash: nextCash, opening_noncash: nextNoncash },
      },
      {
        onSuccess: () => {
          setEditing(false);
          notify.success(
            "Saldo awal diperbarui. Saldo berjalan dihitung ulang.",
          );
        },
        onError: (err) => notify.error(describeError(err)),
      },
    );
  }

  if (editing) {
    const disabled = updateReport.isPending;

    return (
      <StatCard
        icon={FiLayers}
        label="Saldo awal"
        value={
          <div className="flex flex-col gap-2 text-base font-normal">
            <label
              htmlFor="opening-cash-edit"
              className="text-xs text-second/60"
            >
              Tunai
            </label>
            <AmountInput
              id="opening-cash-edit"
              value={cash}
              onChange={(value) => {
                setCash(value);
                setErrors((previous) => ({ ...previous, cash: undefined }));
              }}
              disabled={disabled}
              hasError={Boolean(errors.cash)}
              placeholder="0"
            />
            {errors.cash && <ErrorText>{errors.cash}</ErrorText>}

            <label
              htmlFor="opening-noncash-edit"
              className="text-xs text-second/60"
            >
              Non tunai
            </label>
            <AmountInput
              id="opening-noncash-edit"
              value={noncash}
              onChange={(value) => {
                setNoncash(value);
                setErrors((previous) => ({ ...previous, noncash: undefined }));
              }}
              disabled={disabled}
              hasError={Boolean(errors.noncash)}
              placeholder="0"
            />
            {errors.noncash && <ErrorText>{errors.noncash}</ErrorText>}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={disabled}
                className={`${BTN_PRIMARY} flex-1`}
              >
                {disabled ? <Spinner /> : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={disabled}
                className={BTN_OUTLINE}
              >
                Batal
              </button>
            </div>
          </div>
        }
      />
    );
  }

  return (
    <StatCard
      icon={FiLayers}
      label="Saldo awal"
      value={formatMoney(report.opening_balance)}
      hint={`Tunai ${formatMoney(report.opening_cash)} · Non tunai ${formatMoney(report.opening_noncash)}`}
      action={
        canEdit ? (
          <IconButton label="Ubah saldo awal" onClick={startEdit}>
            <FiEdit2 size={16} aria-hidden="true" />
          </IconButton>
        ) : null
      }
    />
  );
}

/* ------------------------------- Saldo akhir ------------------------------ */

function MoneyBreakdown({
  title,
  icon,
  opening,
  income,
  expense,
  closing,
  remitLabel,
  remitValue, // number | null (null = belum diapprove)
  remaining,
}) {
  const settled = remitValue !== null;

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <IconChip icon={icon} />
          <h3 className="truncate text-sm font-bold text-second">{title}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-second/60">Saldo akhir</p>
          <p
            className={`text-lg font-bold tabular-nums ${
              closing < 0 ? "text-second2" : "text-second"
            }`}
          >
            {formatMoney(closing)}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-xl bg-second/[0.04] p-3">
          <dt className="text-xs text-second/60">Awal</dt>
          <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-second">
            {formatMoney(opening)}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl bg-second3/10 p-3">
          <dt className="text-xs text-second3">Masuk</dt>
          <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-second3">
            + {formatMoney(income)}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl bg-second2/10 p-3">
          <dt className="text-xs text-second2">Keluar</dt>
          <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-second2">
            − {formatMoney(expense)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 border-t border-second/10 pt-4">
        <ProgressBar
          value={settled ? remitValue : 0}
          max={closing}
          label={remitLabel}
        />
        <div className="flex items-start justify-between gap-4 text-xs">
          <div className="min-w-0">
            <p className="text-second/60">{remitLabel}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-second3">
              {settled ? formatMoney(remitValue) : "Belum diapprove"}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-second/60">Sisa belum diapprove</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-second">
              {formatMoney(remaining)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function BalanceSection({ report }) {
  const net = (Number(report.total_in) || 0) - (Number(report.total_out) || 0);
  const remainingTotal = report.remaining_balance ?? report.closing_balance;
  const remainingCash = report.remaining_cash ?? report.closing_cash;
  const remainingNoncash = report.remaining_noncash ?? report.closing_noncash;

  const cashRemitted =
    report.remitted &&
    report.remit_cash !== null &&
    report.remit_cash !== undefined
      ? Number(report.remit_cash)
      : null;
  const transferRemitted =
    report.remitted &&
    report.remit_transfer !== null &&
    report.remit_transfer !== undefined
      ? Number(report.remit_transfer)
      : null;

  return (
    <section
      aria-label="Saldo akhir"
      className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
    >
      <div>
        <h2 className="text-lg font-bold text-second">Saldo akhir</h2>
        <p className="mt-2 text-pretty text-sm text-second/60">
          Tunai dan non tunai dihitung terpisah. Sisa yang belum diapprove
          otomatis menjadi saldo awal laporan berikutnya.
        </p>
      </div>

      {/* Tiga angka utama */}
      <dl className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col justify-between gap-4 rounded-2xl bg-grad p-4 text-primary shadow-lg shadow-second4/25 sm:p-6">
          <dt className="text-xs text-primary/90">
            Saldo akhir (tunai + non tunai)
          </dt>
          <dd className="break-words text-3xl font-bold tabular-nums">
            {formatMoney(report.closing_balance)}
          </dd>
          <p className="text-xs text-primary/90">Gabungan kedua jenis uang</p>
        </div>

        <div className="flex min-w-0 items-start gap-4 rounded-2xl border border-second/30 p-4 sm:p-6">
          <IconChip
            icon={net < 0 ? FiTrendingDown : FiTrendingUp}
            className={
              net < 0
                ? "bg-second2/10 text-second2"
                : "bg-second3/10 text-second3"
            }
          />
          <div className="min-w-0">
            <dt className="text-xs text-second/60">Selisih hari ini</dt>
            <dd
              className={`mt-2 break-words text-2xl font-bold tabular-nums ${
                net < 0 ? "text-second2" : "text-second3"
              }`}
            >
              {formatMoney(net)}
            </dd>
            <p className="mt-2 text-xs text-second/60">
              Total masuk dikurangi total keluar
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-4 rounded-2xl border border-second4/30 bg-second4/5 p-4 sm:p-6">
          <IconChip icon={FiInbox} />
          <div className="min-w-0">
            <dt className="text-xs text-second4">Sisa belum diapprove</dt>
            <dd className="mt-2 break-words text-2xl font-bold tabular-nums text-second">
              {formatMoney(remainingTotal)}
            </dd>
            <p className="mt-2 text-xs text-second/60">
              {report.remitted
                ? "Jadi saldo awal laporan berikutnya"
                : "Sama dengan saldo akhir sampai diapprove"}
            </p>
          </div>
        </div>
      </dl>

      {/* Rincian per jenis uang */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MoneyBreakdown
          title="Tunai"
          icon={FiDollarSign}
          opening={Number(report.opening_cash) || 0}
          income={Number(report.cash_in) || 0}
          expense={Number(report.cash_out) || 0}
          closing={Number(report.closing_cash) || 0}
          remitLabel="Disetor tunai"
          remitValue={cashRemitted}
          remaining={Number(remainingCash) || 0}
        />
        <MoneyBreakdown
          title="Non tunai"
          icon={FiCreditCard}
          opening={Number(report.opening_noncash) || 0}
          income={Number(report.noncash_in) || 0}
          expense={Number(report.noncash_out) || 0}
          closing={Number(report.closing_noncash) || 0}
          remitLabel="Disetor transfer"
          remitValue={transferRemitted}
          remaining={Number(remainingNoncash) || 0}
        />
      </div>
    </section>
  );
}

/* --------------------------------- Entries -------------------------------- */
function EntryForm({ report }) {
  const createEntry = useCreateEntry();
  const nameRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState("income");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState({});

  const atLimit = (report.entries?.length ?? 0) >= MAX_ENTRIES;

  // Fokus ke "Atas nama" begitu form dibuka.
  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  function resetForm() {
    setName("");
    setNote("");
    setAmount("");
    setErrors({});
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (createEntry.isPending || atLimit) return;

    const found = validateEntry({ name, amount });
    setErrors(found);

    if (Object.keys(found).length > 0) {
      (found.name
        ? nameRef.current
        : document.getElementById("entry-amount")
      )?.focus();
      return;
    }

    const payload = {
      method,
      name: name.trim(),
      [kind]: Number(amount),
    };

    if (note.trim()) payload.note = note.trim();

    createEntry.mutate(
      { id: report.id, data: payload },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false); // form hilang, tinggal tombol "Tambah baris"
        },
        onError: (err) => notify.error(describeError(err)),
      },
    );
  }

  const disabled = createEntry.isPending || atLimit;

  // Keadaan tertutup: hanya tombol "Tambah baris".
  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={atLimit}
          className={`${BTN_PRIMARY} w-fit`}
        >
          <FiPlus size={16} aria-hidden="true" />
          Tambah baris
        </button>
        {atLimit && (
          <ErrorText>
            Jumlah baris sudah mencapai batas maksimal ({MAX_ENTRIES}).
          </ErrorText>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-dashed border-second/30 p-4"
    >
      <p className="text-sm font-semibold text-second">Tambah baris</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <span className={labelClass}>Metode uang</span>
          <Toggle
            label="Metode uang"
            options={METHODS}
            value={method}
            onChange={setMethod}
            disabled={disabled}
          />
        </div>

        <div className="min-w-0">
          <span className={labelClass}>Jenis</span>
          <Toggle
            label="Jenis baris"
            options={KIND_OPTIONS}
            value={kind}
            onChange={setKind}
            disabled={disabled}
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="entry-name" className={labelClass}>
            Atas nama
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <input
            ref={nameRef}
            id="entry-name"
            autoComplete="off"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((previous) => ({ ...previous, name: undefined }));
            }}
            placeholder="Contoh: Budi…"
            maxLength={100}
            disabled={disabled}
            className={inputClass(Boolean(errors.name))}
            aria-required="true"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "entry-name-desc" : undefined}
          />
          {errors.name && (
            <ErrorText id="entry-name-desc">{errors.name}</ErrorText>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor="entry-amount" className={labelClass}>
            Nominal
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <AmountInput
            id="entry-amount"
            value={amount}
            onChange={(next) => {
              setAmount(next);
              setErrors((previous) => ({ ...previous, amount: undefined }));
            }}
            disabled={disabled}
            hasError={Boolean(errors.amount)}
            describedBy={errors.amount ? "entry-amount-desc" : undefined}
          />
          {errors.amount && (
            <ErrorText id="entry-amount-desc">{errors.amount}</ErrorText>
          )}
        </div>

        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="entry-note" className={labelClass}>
            Keterangan
            <span className="ml-2 text-xs font-normal text-second/50">
              Opsional
            </span>
          </label>
          <input
            id="entry-note"
            autoComplete="off"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Contoh: Jual lensa 50mm…"
            maxLength={255}
            disabled={disabled}
            className={inputClass(false)}
          />
        </div>
      </div>

      {atLimit && (
        <ErrorText>
          Jumlah baris sudah mencapai batas maksimal ({MAX_ENTRIES}).
        </ErrorText>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled}
          className={`${BTN_PRIMARY} w-fit`}
        >
          {createEntry.isPending ? (
            <>
              <Spinner />
              Menyimpan…
            </>
          ) : (
            <>
              <FiCheck size={16} aria-hidden="true" />
              Simpan
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setOpen(false);
          }}
          disabled={createEntry.isPending}
          className={BTN_OUTLINE}
        >
          Batal
        </button>
      </div>
    </form>
  );
}
function EntryEditRow({ report, entry, onClose }) {
  const updateEntry = useUpdateEntry();

  const [method, setMethod] = useState(entry.method ?? "CASH");
  const [name, setName] = useState(entry.name);
  const [note, setNote] = useState(entry.note ?? "");
  const [kind, setKind] = useState(entry.income > 0 ? "income" : "expense");
  const [amount, setAmount] = useState(
    String(entry.income > 0 ? entry.income : entry.expense),
  );
  const [errors, setErrors] = useState({});

  function save() {
    const found = validateEntry({ name, amount });
    setErrors(found);

    if (Object.keys(found).length > 0) return;

    // Kirim income dan expense sekaligus supaya jenis bisa berubah.
    updateEntry.mutate(
      {
        id: report.id,
        entryId: entry.id,
        data: {
          method,
          name: name.trim(),
          note: note.trim() || null,
          income: kind === "income" ? Number(amount) : 0,
          expense: kind === "expense" ? Number(amount) : 0,
        },
      },
      {
        onSuccess: () => {
          notify.success("Baris diperbarui.");
          onClose();
        },
        onError: (err) => notify.error(describeError(err)),
      },
    );
  }

  const disabled = updateEntry.isPending;

  return (
    <tr className="bg-second4/5">
      <td colSpan={5} className="p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <span className={labelClass}>Metode uang</span>
            <Toggle
              label="Metode uang"
              options={METHODS}
              value={method}
              onChange={setMethod}
              disabled={disabled}
            />
          </div>

          <div className="min-w-0">
            <span className={labelClass}>Jenis</span>
            <Toggle
              label="Jenis baris"
              options={KIND_OPTIONS}
              value={kind}
              onChange={setKind}
              disabled={disabled}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor={`edit-name-${entry.id}`} className={labelClass}>
              Atas nama
            </label>
            <input
              id={`edit-name-${entry.id}`}
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              disabled={disabled}
              className={inputClass(Boolean(errors.name))}
            />
            {errors.name && <ErrorText>{errors.name}</ErrorText>}
          </div>

          <div className="min-w-0">
            <label htmlFor={`edit-amount-${entry.id}`} className={labelClass}>
              Nominal
            </label>
            <AmountInput
              id={`edit-amount-${entry.id}`}
              value={amount}
              onChange={setAmount}
              disabled={disabled}
              hasError={Boolean(errors.amount)}
            />
            {errors.amount && <ErrorText>{errors.amount}</ErrorText>}
          </div>

          <div className="min-w-0 sm:col-span-2">
            <label htmlFor={`edit-note-${entry.id}`} className={labelClass}>
              Keterangan
            </label>
            <input
              id={`edit-note-${entry.id}`}
              autoComplete="off"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={255}
              disabled={disabled}
              className={inputClass(false)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={disabled}
            className={BTN_PRIMARY}
          >
            {disabled ? <Spinner /> : "Simpan"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className={BTN_OUTLINE}
          >
            Batal
          </button>
        </div>
      </td>
    </tr>
  );
}

function EntryRow({ report, entry, index, canEdit }) {
  const deleteEntry = useDeleteEntry();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <EntryEditRow
        report={report}
        entry={entry}
        onClose={() => setEditing(false)}
      />
    );
  }

  function remove() {
    deleteEntry.mutate(
      { id: report.id, entryId: entry.id },
      {
        onSuccess: () => notify.success("Baris dihapus. Saldo dihitung ulang."),
        onError: (err) => {
          setConfirming(false);
          notify.error(describeError(err));
        },
      },
    );
  }

  return (
    <tr
      className={`align-top transition-colors hover:bg-second/20 ${index % 2 === 0 ? "" : "bg-second3/20"}`}
    >
      <td className="min-w-0 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words text-sm font-semibold text-second">
            {entry.name}
          </p>
          <MethodTag method={entry.method} />
        </div>
        {entry.note && (
          <p className="mt-2 break-words text-xs text-second/60">
            {entry.note}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-second3">
        {entry.income > 0 ? formatMoney(entry.income) : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-second2">
        {entry.expense > 0 ? formatMoney(entry.expense) : "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-second">
        {formatMoney(entry.balance)}
      </td>
      {canEdit && (
        <td className="px-4 py-3">
          {confirming ? (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-second/60">Hapus?</span>
              <IconButton
                label="Ya, hapus baris"
                tone="danger"
                onClick={remove}
                disabled={deleteEntry.isPending}
              >
                {deleteEntry.isPending ? (
                  <Spinner />
                ) : (
                  <FiCheck size={16} aria-hidden="true" />
                )}
              </IconButton>
              <IconButton
                label="Batal hapus"
                onClick={() => setConfirming(false)}
                disabled={deleteEntry.isPending}
              >
                <FiX size={16} aria-hidden="true" />
              </IconButton>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <IconButton
                label={`Ubah baris ${entry.name}`}
                onClick={() => setEditing(true)}
              >
                <FiEdit2 size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                label={`Hapus baris ${entry.name}`}
                tone="danger"
                onClick={() => setConfirming(true)}
              >
                <FiTrash2 size={16} aria-hidden="true" />
              </IconButton>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

// Rincian tunai / non tunai di bawah label "Saldo awal" dan "Saldo akhir".
function CashSplit({ cash, noncash }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-base font-bold tabular-nums text-second">
      <span className="bg-second2 px-2 rounded-full text-primary">
        <span className="mr-2 text-sm text-primary">Tunai</span>
        {formatMoney(cash)}
      </span>
      <span className="bg-second2 px-2 rounded-full text-primary">
        <span className="mr-2 text-sm text-primary">Non tunai</span>
        {formatMoney(noncash)}
      </span>
    </div>
  );
}
function EntriesSection({ report, canLock, lockedBySetor }) {
  const entries = report.entries ?? [];
  const canEdit = !report.remitted && !lockedBySetor;

  return (
    <FormSection
      title="Catatan kas"
      description="Setiap baris bermetode tunai atau non tunai. Saldo di tabel adalah saldo berjalan gabungan keduanya, mengikuti urutan pencatatan."
      aside={
        <Tag tone="soft">
          {entries.length}/{MAX_ENTRIES} baris
        </Tag>
      }
    >
      {report.remitted && (
        <p className="flex items-start gap-2 rounded-xl bg-second/5 p-4 text-sm text-second/60">
          <FiLock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {canLock
            ? "Laporan sudah diapprove dan terapprove untuk semua orang. Batalkan approve di bagian Setoran untuk menambah, mengubah, atau menghapus baris."
            : "Laporan sudah diapprove dan terapprove. Minta OWNER membatalkan approve kalau ada yang perlu diubah."}
        </p>
      )}
      {lockedBySetor && (
        <p className="flex items-start gap-2 rounded-xl bg-second/5 p-4 text-sm text-second/60">
          <FiLock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Setoran sudah dicatat, jadi catatan kas terkunci. Klik “Batalkan
          setor” di bagian Setoran untuk menambah, mengubah, atau menghapus
          baris.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl">
        <table className="min-w-full text-left">
          <thead className="bg-grad text-sm text-primary">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Atas nama
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Masuk
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Keluar
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Saldo
              </th>
              {canEdit && (
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  <span className="sr-only">Aksi</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-second/10">
            <tr className="bg-second/[0.03]">
              <td className="px-4 py-3 text-sm font-semibold text-second">
                Saldo awal
                <CashSplit
                  cash={report.opening_cash}
                  noncash={report.opening_noncash}
                />
              </td>
              <td className="px-4 py-3 text-right text-sm text-second/40">—</td>
              <td className="px-4 py-3 text-right text-sm text-second/40">—</td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-second">
                {formatMoney(report.opening_balance)}
              </td>
              {canEdit && <td />}
            </tr>

            {entries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                report={report}
                entry={entry}
                index={index}
                canEdit={canEdit}
              />
            ))}

            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? 5 : 4}
                  className="px-4 py-12 text-center text-sm text-second/60"
                >
                  Belum ada catatan pemasukan atau pengeluaran.
                </td>
              </tr>
            )}
          </tbody>

          <tfoot className="border-t border-second/30 bg-second/[0.03]">
            <tr>
              <td className="px-4 py-3 text-sm font-bold text-second">
                Saldo akhir
                <CashSplit
                  cash={report.closing_cash}
                  noncash={report.closing_noncash}
                />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-second3">
                {formatMoney(report.total_in)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-second2">
                {formatMoney(report.total_out)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-second">
                {formatMoney(report.closing_balance)}
              </td>
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {canEdit && <EntryForm report={report} />}
    </FormSection>
  );
}

/* ------------------------------ Setoran & bukti --------------------------- */

function Stepper({ steps }) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors ${
            step.done
              ? "border-second3/40 bg-second3/5"
              : "border-second/20 bg-second/[0.02]"
          }`}
        >
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              step.done
                ? "bg-second3 text-primary"
                : "bg-second/10 text-second/60"
            }`}
          >
            {step.done ? (
              <FiCheck size={16} aria-hidden="true" />
            ) : (
              <span aria-hidden="true">{index + 1}</span>
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-second">{step.label}</p>
            <p className="break-words text-xs text-second/60">{step.hint}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RemitField({
  id,
  icon,
  title,
  source,
  closing,
  value,
  amount, // number | null
  onChange,
  onFillAll,
  error,
  disabled,
}) {
  const remaining =
    amount !== null && amount <= closing ? closing - amount : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
      <div className="flex items-center gap-3">
        <IconChip icon={icon} />
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-second"
          >
            {title}
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <p className="text-xs text-second/60">{source}</p>
        </div>
      </div>

      <div>
        <AmountInput
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          hasError={Boolean(error)}
          describedBy={error ? `${id}-desc` : undefined}
          placeholder="0"
        />
        {error && <ErrorText id={`${id}-desc`}>{error}</ErrorText>}
      </div>

      <button
        type="button"
        onClick={onFillAll}
        disabled={disabled || closing <= 0}
        className={`${BTN_OUTLINE} w-fit !px-3 !py-1 text-xs`}
      >
        Setor semua ({formatMoney(Math.max(0, closing))})
      </button>

      <div className="flex flex-col gap-2 rounded-xl bg-second/[0.03] p-3">
        <ProgressBar
          value={amount !== null && amount <= closing ? amount : 0}
          max={closing}
          tone="bg-second4"
          label={`Porsi ${title}`}
        />
        <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-second/60">
          <span>Saldo akhir {formatMoney(closing)}</span>
          <span className="font-semibold text-second">
            {remaining !== null ? `Sisa ${formatMoney(remaining)}` : "Sisa —"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProofPreview({ proof }) {
  const previewable = PREVIEWABLE_TYPES.includes(proof.content_type);
  const isPdf = proof.content_type === "application/pdf";

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-second/20 bg-second/[0.02] p-4 sm:flex-row sm:items-center">
      <a
        href={proof.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-primary text-second/40 transition-shadow hover:shadow-lg ${FOCUS_RING}`}
        aria-label="Buka bukti transfer di tab baru"
      >
        {previewable ? (
          <img
            src={proof.url}
            alt="Bukti transfer"
            className="h-full w-full object-cover"
          />
        ) : (
          <FiFileText size={32} aria-hidden="true" />
        )}
      </a>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="soft">
            {isPdf
              ? "PDF"
              : proof.content_type.replace("image/", "").toUpperCase()}
          </Tag>
          <Tag tone="outline">{formatBytes(proof.size)}</Tag>
        </div>
        <a
          href={proof.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 inline-flex items-center gap-2 rounded text-sm font-semibold text-second hover:text-second4 ${FOCUS_RING}`}
        >
          Buka bukti transfer
          <FiExternalLink size={16} aria-hidden="true" />
        </a>
        <p className="mt-2 text-xs text-second/60">
          Diunggah {formatDateTime(proof.uploaded_at)}
        </p>
        <p className="mt-1 text-xs text-second/50">
          Link berlaku sekitar 1 jam. Muat ulang halaman jika sudah kedaluwarsa.
        </p>
      </div>
    </div>
  );
}

function RemitSection({ report, canRemit, canLock }) {
  const updateReport = useUpdateDailyReport();
  const uploadProof = useUploadProof();
  const deleteProof = useDeleteProof();

  const toText = (value) =>
    value !== null && value !== undefined ? String(value) : "";
  const toNumber = (value) =>
    value !== null && value !== undefined ? Number(value) : null;

  // Nilai yang sudah tersimpan di server (isian ADMIN).
  const savedCash = toText(report.remit_cash);
  const savedTransfer = toText(report.remit_transfer);
  const savedCashNumber = toNumber(report.remit_cash);
  const savedTransferNumber = toNumber(report.remit_transfer);
  const amountsFilled =
    savedCashNumber !== null && savedTransferNumber !== null;

  const [cash, setCash] = useState(savedCash);
  const [transfer, setTransfer] = useState(savedTransfer);
  const [errors, setErrors] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const restoreRef = useRef(null);

  useEffect(() => {
    const restore = restoreRef.current;

    if (restore && savedCash === "" && savedTransfer === "") {
      setCash(restore.cash);
      setTransfer(restore.transfer);
      restoreRef.current = null;
    } else {
      setCash(savedCash);
      setTransfer(savedTransfer);
    }
    setErrors({});
  }, [savedCash, savedTransfer]);

  const closingCash = Number(report.closing_cash) || 0;
  const closingNoncash = Number(report.closing_noncash) || 0;
  const locked = report.remitted;
  const proof = report.proof;
  // ADMIN mengisi jumlah setoran selama laporan belum dikunci OWNER.
  const editing = canRemit && !locked;
  const busy =
    updateReport.isPending || uploadProof.isPending || deleteProof.isPending;

  const cashNumber = cash === "" ? null : Number(cash);
  const transferNumber = transfer === "" ? null : Number(transfer);
  const isSetor = amountsFilled;
  // Perkiraan sisa dari isian form (tampilan ADMIN).
  const previewRemainingCash =
    cashNumber !== null && cashNumber <= closingCash
      ? closingCash - cashNumber
      : null;
  const previewRemainingNoncash =
    transferNumber !== null && transferNumber <= closingNoncash
      ? closingNoncash - transferNumber
      : null;

  // Sisa yang ditampilkan di ringkasan: dari server kalau sudah dikunci,
  // kalau belum dihitung dari jumlah yang sudah tersimpan.
  let remainingShown = null;
  if (locked) {
    remainingShown = {
      cash: Number(report.remaining_cash) || 0,
      noncash: Number(report.remaining_noncash) || 0,
      total: Number(report.remaining_balance) || 0,
    };
  } else if (
    amountsFilled &&
    savedCashNumber <= closingCash &&
    savedTransferNumber <= closingNoncash
  ) {
    const cashLeft = closingCash - savedCashNumber;
    const noncashLeft = closingNoncash - savedTransferNumber;
    remainingShown = {
      cash: cashLeft,
      noncash: noncashLeft,
      total: cashLeft + noncashLeft,
    };
  }

  // Bukti wajib kalau setoran transfer lebih dari 0. Saat ADMIN mengisi, ikut
  // isian form; selain itu ikut nilai yang tersimpan.
  const proofRequired = editing
    ? transferNumber !== null && transferNumber > 0
    : needsProof(report);

  const steps = [
    {
      label: "Isi jumlah setoran",
      hint: "ADMIN: tunai dan transfer (boleh 0)",
      done: locked || amountsFilled,
    },
    {
      label: "Bukti transfer",
      hint: proofRequired
        ? "ADMIN: wajib untuk setoran transfer"
        : "Tidak diperlukan",
      done: locked || !proofRequired || Boolean(proof),
    },
    {
      label: "Approve setoran (oleh owner)",
      hint: locked ? "Laporan terapprove" : "OWNER memeriksa lalu mengapprove",

      done: locked,
    },
  ];

  /* --------------------------------- ADMIN -------------------------------- */

  function validateAmounts() {
    const found = {};

    if (cash === "") {
      found.cash = "Wajib diisi (boleh 0).";
    } else if (Number(cash) > MAX_AMOUNT) {
      found.cash = "Nominal terlalu besar.";
    } else if (Number(cash) > closingCash) {
      found.cash = `Melebihi saldo akhir tunai (${formatMoney(closingCash)}).`;
    }

    if (transfer === "") {
      found.transfer = "Wajib diisi (boleh 0).";
    } else if (Number(transfer) > MAX_AMOUNT) {
      found.transfer = "Nominal terlalu besar.";
    } else if (Number(transfer) > closingNoncash) {
      found.transfer = `Melebihi saldo akhir non tunai (${formatMoney(closingNoncash)}).`;
    }

    return found;
  }

  function saveAmounts() {
    const found = validateAmounts();
    setErrors(found);

    if (Object.keys(found).length > 0) return;

    updateReport.mutate(
      {
        id: report.id,
        data: {
          remit_cash: Number(cash),
          remit_transfer: Number(transfer),
        },
      },
      {
        onSuccess: () =>
          notify.success(
            "Setoran disimpan. Catatan kas dan jumlah setoran terkunci sampai setor dibatalkan.",
          ),
        onError: (err) => notify.error(describeError(err)),
      },
    );
  }

  function cancelSetor() {
    restoreRef.current = { cash: savedCash, transfer: savedTransfer };

    updateReport.mutate(
      { id: report.id, data: { remit_cash: null, remit_transfer: null } },
      {
        onSuccess: () =>
          notify.success("Setor dibatalkan. Kas dan setoran bisa diubah lagi."),
        onError: (err) => {
          restoreRef.current = null;
          notify.error(describeError(err));
        },
      },
    );
  }
  function handleFile(event) {
    const file = event.target.files?.[0];

    // Reset input agar file yang sama bisa dipilih kembali.
    event.target.value = "";

    if (!file) return;

    if (!PROOF_TYPES.includes(file.type)) {
      notify.error("Format file harus JPEG, PNG, WebP, HEIC, atau PDF.");
      return;
    }

    if (file.size > MAX_PROOF_SIZE) {
      notify.error("Ukuran file maksimal 10 MB.");
      return;
    }

    uploadProof.mutate(
      { id: report.id, file },
      {
        onSuccess: () => notify.success("Bukti transfer berhasil diunggah."),
        onError: (err) => notify.error(describeError(err)),
      },
    );
  }

  function removeProof() {
    deleteProof.mutate(
      { id: report.id },
      {
        onSuccess: () => {
          setConfirmingDelete(false);
          notify.success("Bukti transfer dihapus.");
        },
        onError: (err) => {
          setConfirmingDelete(false);
          notify.error(describeError(err));
        },
      },
    );
  }

  /* --------------------------------- OWNER -------------------------------- */

  // Server menilai dari jumlah yang sudah tersimpan, jadi pengecekan di sini
  // juga memakai nilai tersimpan, bukan isian form.
  function lock() {
    const problems = [];

    if (!amountsFilled) {
      problems.push(
        "ADMIN belum mengisi jumlah setoran tunai dan transfer (boleh 0).",
      );
    } else {
      if (savedCashNumber > closingCash) {
        problems.push(
          `Setoran tunai melebihi saldo akhir tunai (${formatMoney(closingCash)}).`,
        );
      }
      if (savedTransferNumber > closingNoncash) {
        problems.push(
          `Setoran transfer melebihi saldo akhir non tunai (${formatMoney(closingNoncash)}).`,
        );
      }
      if (savedTransferNumber > 0 && !proof) {
        problems.push(
          "Setoran transfer wajib punya bukti. Minta ADMIN mengunggahnya dulu.",
        );
      }
    }

    if (closingCash < 0 || closingNoncash < 0) {
      problems.push(
        "Saldo akhir tunai atau non tunai negatif. Perbaiki baris yang salah dulu, misalnya pengeluaran yang salah metode.",
      );
    }

    setErrors({ lock: problems });
    if (problems.length > 0) return;

    updateReport.mutate(
      { id: report.id, data: { remitted: true } },
      {
        onSuccess: () =>
          notify.success(
            "Setoran diapprove. Laporan terapprove untuk semua orang.",
          ),
        onError: (err) => notify.error(describeError(err)),
      },
    );
  }

  function unlock() {
    updateReport.mutate(
      { id: report.id, data: { remitted: false } },
      {
        onSuccess: () => notify.success("Approve dibatalkan."),
        onError: (err) => notify.error(describeError(err)),
      },
    );
  }

  const fileInput = (
    <input
      type="file"
      accept={PROOF_TYPES.join(",")}
      disabled={busy}
      onChange={handleFile}
      className="sr-only"
    />
  );

  const remitNumber = (value) =>
    value !== null && value !== undefined ? formatMoney(value) : "—";

  const panelTitle = locked
    ? "Setoran sudah dicatat"
    : !amountsFilled
      ? "Menunggu ADMIN mengisi setoran"
      : canLock
        ? "Periksa lalu approve setoran"
        : "Menunggu OWNER approve";

  const panelText = locked
    ? `Disetor ${formatDateTime(report.remitted_at)}. Laporan terapprove dan sisa saldo menjadi saldo awal laporan berikutnya.`
    : !amountsFilled
      ? "ADMIN mengisi jumlah setoran tunai dan transfer serta mengunggah bukti transfer. OWNER lalu memeriksa dan mengapprove laporan."
      : "ADMIN sudah mengisi jumlah setoran. Periksa jumlah dan bukti transfer di bawah, lalu approve laporan.";

  return (
    <FormSection
      title="Setoran ke owner"
      description="Uang tunai diapprove tunai, uang non tunai diapprove lewat transfer. Jumlah tidak harus seluruh saldo. ADMIN mengisi jumlah dan mengunggah bukti, OWNER memeriksa lalu mengapprove. Sisa yang belum diapprove otomatis menjadi saldo awal laporan berikutnya."
      aside={
        <Tag tone={getRemitStatus(report).tone}>
          {getRemitStatus(report).label}
        </Tag>
      }
    >
      <Stepper steps={steps} />

      {/* Ringkasan setoran (OWNER, atau semua orang setelah dikunci) */}
      {!editing ? (
        <div
          className={`flex flex-col gap-4 rounded-2xl border p-4 sm:p-6 ${
            locked
              ? "border-second3/40 bg-second3/5"
              : "border-second/30 bg-second/[0.02]"
          }`}
        >
          <div className="flex items-start gap-4">
            <IconChip
              icon={locked ? FiCheckCircle : FiClock}
              className={
                locked
                  ? "bg-second3 text-primary"
                  : "bg-second/10 text-second/60"
              }
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-second">{panelTitle}</p>
              <p className="mt-1 text-sm text-second/60">{panelText}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-primary p-4 shadow-sm">
              <dt className="flex items-center gap-2 text-xs text-second/60">
                <FiDollarSign size={16} aria-hidden="true" />
                Disetor tunai
              </dt>
              <dd className="mt-2 text-lg font-bold tabular-nums text-second">
                {remitNumber(report.remit_cash)}
              </dd>
            </div>
            <div className="rounded-xl bg-primary p-4 shadow-sm">
              <dt className="flex items-center gap-2 text-xs text-second/60">
                <FiCreditCard size={16} aria-hidden="true" />
                Disetor transfer
              </dt>
              <dd className="mt-2 text-lg font-bold tabular-nums text-second">
                {remitNumber(report.remit_transfer)}
              </dd>
            </div>
            <div className="rounded-xl bg-primary p-4 shadow-sm">
              <dt className="flex items-center gap-2 text-xs text-second/60">
                <FiInbox size={16} aria-hidden="true" />
                {locked ? "Sisa belum diapprove" : "Sisa jika diapprove"}
              </dt>
              <dd className="mt-2 text-lg font-bold tabular-nums text-second">
                {remainingShown ? formatMoney(remainingShown.total) : "—"}
              </dd>
              {remainingShown && (
                <p className="mt-1 text-xs tabular-nums text-second/60">
                  Tunai {formatMoney(remainingShown.cash)} · Non tunai{" "}
                  {formatMoney(remainingShown.noncash)}
                </p>
              )}
            </div>
          </dl>

          {locked && !canLock && (
            <p className="text-sm text-second/60">
              Minta OWNER membatalkan approve kalau ada yang perlu diubah.
            </p>
          )}

          {locked && canLock && (
            <button
              type="button"
              onClick={unlock}
              disabled={busy}
              className={`${BTN_OUTLINE} w-fit`}
            >
              {updateReport.isPending ? (
                <Spinner />
              ) : (
                <FiUnlock size={16} aria-hidden="true" />
              )}
              Batalkan Approve{" "}
            </button>
          )}

          {!locked && canLock && (
            <div className="flex flex-col gap-2">
              {errors.lock?.map((problem) => (
                <ErrorText key={problem}>{problem}</ErrorText>
              ))}

              <button
                type="button"
                onClick={lock}
                disabled={busy}
                className={`${BTN_PRIMARY} w-full sm:w-fit`}
              >
                {updateReport.isPending ? (
                  <Spinner />
                ) : (
                  <FiCheck size={16} aria-hidden="true" />
                )}
                Approve
              </button>

              <p className="text-xs text-second/50">
                Approve akan menandai laporan sudah diapprove dan mengunci
                laporan untuk semua orang. Jumlah dan bukti hanya bisa diubah
                ADMIN setelah Anda membatalkan approve.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Isian setoran (ADMIN, selama belum dikunci) */
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RemitField
              id="remit-cash"
              icon={FiDollarSign}
              title="Setoran tunai"
              source="Diambil dari saldo tunai"
              closing={closingCash}
              value={cash}
              amount={cashNumber}
              disabled={busy || isSetor}
              error={errors.cash}
              onChange={(next) => {
                setCash(next);
                setErrors((previous) => ({ ...previous, cash: undefined }));
              }}
              onFillAll={() => {
                setCash(String(Math.max(0, closingCash)));
                setErrors((previous) => ({ ...previous, cash: undefined }));
              }}
            />
            <RemitField
              id="remit-transfer"
              icon={FiCreditCard}
              title="Setoran transfer"
              source="Diambil dari saldo non tunai"
              closing={closingNoncash}
              value={transfer}
              amount={transferNumber}
              disabled={busy || isSetor}
              error={errors.transfer}
              onChange={(next) => {
                setTransfer(next);
                setErrors((previous) => ({ ...previous, transfer: undefined }));
              }}
              onFillAll={() => {
                setTransfer(String(Math.max(0, closingNoncash)));
                setErrors((previous) => ({ ...previous, transfer: undefined }));
              }}
            />
          </div>

          {/* Ringkasan perkiraan + aksi */}
          <div className="flex flex-col gap-4 rounded-2xl border border-second4/30 bg-second4/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <dl className="grid grid-cols-2 gap-6">
              <div>
                <dt className="text-xs text-second/60">Saldo akhir hari ini</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-second">
                  {formatMoney(report.closing_balance)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-second/60">Sisa (perkiraan)</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums text-second4">
                  {previewRemainingCash !== null &&
                  previewRemainingNoncash !== null
                    ? formatMoney(
                        previewRemainingCash + previewRemainingNoncash,
                      )
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {isSetor ? (
                <>
                  <button
                    type="button"
                    disabled
                    className={`${BTN_PRIMARY} w-full sm:w-auto`}
                  >
                    <FiCheckCircle size={16} aria-hidden="true" />
                    Sudah setor
                  </button>
                  <button
                    type="button"
                    onClick={cancelSetor}
                    disabled={busy}
                    className={`${BTN_OUTLINE} w-full sm:w-auto`}
                  >
                    {updateReport.isPending ? (
                      <Spinner />
                    ) : (
                      <FiX size={16} aria-hidden="true" />
                    )}
                    Batalkan setor
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={saveAmounts}
                  disabled={busy}
                  className={`${BTN_PRIMARY} w-full sm:w-auto`}
                >
                  {updateReport.isPending ? (
                    <Spinner />
                  ) : (
                    <FiCheck size={16} aria-hidden="true" />
                  )}
                  Setor
                </button>
              )}
            </div>
          </div>

          {isSetor && (
            <p className="flex items-start gap-2 text-sm text-second3">
              <FiCheckCircle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Setoran sudah dicatat dan menunggu OWNER memeriksa. Untuk mengubah
              jumlah setoran atau catatan kas, klik “Batalkan setor” dulu.
            </p>
          )}

          <p className="text-xs text-second/50">
            Klik Setor setelah kedua jumlah terisi (boleh 0). Setelah itu
            catatan kas dan jumlah setoran terkunci sampai setor dibatalkan.
            Laporan baru terapprove setelah OWNER memeriksa dan mengapprove.
          </p>
        </div>
      )}

      {/* Bukti transfer */}
      <div className="flex flex-col gap-4 rounded-2xl border border-second/30 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <IconChip icon={FiFileText} />
            <h3 className="text-sm font-bold text-second">Bukti transfer</h3>
          </div>
          {proofRequired && !proof ? (
            <Tag tone="failure">Wajib</Tag>
          ) : !proofRequired ? (
            <Tag tone="outline">Opsional</Tag>
          ) : (
            <Tag tone="success">Lengkap</Tag>
          )}
        </div>

        {proof ? (
          <ProofPreview proof={proof} />
        ) : editing ? (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-second/30 px-4 py-8 text-center transition-colors hover:border-second4 hover:bg-second4/5 focus-within:ring-2 focus-within:ring-second4/40 ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {uploadProof.isPending ? (
              <>
                <Spinner />
                <span className="text-sm font-semibold text-second">
                  Mengunggah…
                </span>
              </>
            ) : (
              <>
                <FiUploadCloud
                  size={32}
                  className="text-second4"
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-second">
                  Unggah bukti transfer
                </span>
                <span className="text-xs text-second/60">
                  JPEG, PNG, WebP, HEIC, atau PDF · maks 10 MB
                </span>
              </>
            )}
            {fileInput}
          </label>
        ) : (
          <p className="rounded-xl border border-dashed border-second/30 p-6 text-center text-sm text-second/60">
            {locked
              ? "Laporan terapprove, jadi bukti transfer tidak bisa diunggah. OWNER perlu membatalkan approve dulu."
              : "Belum ada bukti transfer. ADMIN yang mengunggahnya."}
          </p>
        )}

        {editing && proof && (
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`${BTN_OUTLINE} cursor-pointer focus-within:ring-2 focus-within:ring-second4/40 ${
                busy ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {uploadProof.isPending ? (
                <>
                  <Spinner />
                  Mengunggah…
                </>
              ) : (
                <>
                  <FiUploadCloud size={16} aria-hidden="true" />
                  Ganti bukti
                </>
              )}
              {fileInput}
            </label>

            {confirmingDelete ? (
              <>
                <span className="text-sm text-second/60">Hapus bukti?</span>
                <button
                  type="button"
                  onClick={removeProof}
                  disabled={busy}
                  className={BTN_DANGER}
                >
                  {deleteProof.isPending ? <Spinner /> : "Ya, hapus"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className={BTN_OUTLINE}
                >
                  Batal
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className={BTN_DANGER}
              >
                <FiTrash2 size={16} aria-hidden="true" />
                Hapus bukti
              </button>
            )}
          </div>
        )}

        {locked && proof && (
          <p className="flex items-start gap-2 text-xs text-second/60">
            <FiLock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {canLock
              ? "Laporan terapprove, jadi bukti transfer tidak bisa diganti atau dihapus. Batalkan approve laporan dulu kalau perlu mengubahnya."
              : "Laporan terapprove, jadi bukti transfer tidak bisa diganti atau dihapus. Minta OWNER membatalkan approve kalau perlu mengubahnya."}
          </p>
        )}

        <p className="text-xs text-second/50">
          {canRemit
            ? "Wajib kalau ada setoran transfer, tidak diperlukan untuk setoran tunai saja. Unggah ulang akan mengganti file lama. Tidak bisa diubah selama laporan terapprove."
            : "Hanya ADMIN yang bisa mengunggah, mengganti, atau menghapus bukti transfer, dan hanya selama laporan belum terapprove."}
        </p>
      </div>
    </FormSection>
  );
}

/* --------------------------------- Riwayat -------------------------------- */

const HISTORY_ICONS = {
  REPORT_CREATED: { icon: FiPlus, tone: "bg-second3/10 text-second3" },
  OPENING_UPDATED: { icon: FiLayers, tone: "bg-second4/10 text-second4" },
  ENTRY_CREATED: { icon: FiPlus, tone: "bg-second3/10 text-second3" },
  ENTRY_UPDATED: { icon: FiEdit2, tone: "bg-second4/10 text-second4" },
  ENTRY_DELETED: { icon: FiTrash2, tone: "bg-second2/10 text-second2" },
  REMIT_UPDATED: { icon: FiSend, tone: "bg-second4/10 text-second4" },
  REMITTED: { icon: FiCheck, tone: "bg-second3 text-primary" },
  REMIT_REOPENED: { icon: FiUnlock, tone: "bg-second2/10 text-second2" },
  PROOF_SET: { icon: FiUploadCloud, tone: "bg-second4/10 text-second4" },
  PROOF_DELETED: { icon: FiTrash2, tone: "bg-second2/10 text-second2" },
};

function initialOf(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function HistorySection({ report }) {
  const [page, setPage] = useState(1);

  // Kunci berubah setiap data laporan berubah, jadi riwayat ikut dimuat ulang.
  const signature = [
    report.updated_at,
    report.entry_count,
    report.closing_balance,
    report.opening_balance,
    report.remitted,
    report.remit_cash,
    report.remit_transfer,
    report.has_proof,
  ].join("|");

  const query = useGetReportHistory(report.id, page, signature);

  const list = query.data?.data ?? [];
  const paging = query.data?.paging;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? page;

  return (
    <FormSection
      title="Riwayat perubahan"
      description="Siapa mengubah apa dan kapan. Perubahan yang tidak mengubah nilai tidak dicatat."
      aside={paging ? <Tag tone="soft">{paging.total} catatan</Tag> : null}
    >
      {query.isPending ? (
        <div
          role="status"
          aria-label="Memuat riwayat"
          className="flex flex-col gap-4"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex gap-4">
              <div className="size-8 shrink-0 animate-pulse rounded-full bg-second/10" />
              <div className="h-20 flex-1 animate-pulse rounded-xl bg-second/10" />
            </div>
          ))}
        </div>
      ) : query.isError && !query.data ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-second2">
            {describeError(query.error)}
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className={BTN_OUTLINE}
          >
            Coba lagi
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-second/30 px-4 py-10 text-center">
          <FiClock size={32} className="text-second/30" aria-hidden="true" />
          <p className="text-sm text-second/60">Belum ada riwayat.</p>
        </div>
      ) : (
        <ol className={query.isFetching ? "opacity-60 transition-opacity" : ""}>
          {list.map((item, index) => {
            const lines = describeHistory(item);
            const meta = HISTORY_ICONS[item.action] ?? {
              icon: FiClock,
              tone: "bg-second/10 text-second/60",
            };
            const Icon = meta.icon;
            const isLast = index === list.length - 1;

            return (
              <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-4 top-8 w-px -translate-x-1/2 bg-second/15"
                  />
                )}

                <span
                  aria-hidden="true"
                  className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-primary ${meta.tone}`}
                >
                  <Icon size={16} />
                </span>

                <div className="min-w-0 flex-1 rounded-xl border border-second/20 bg-second/[0.02] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-second">
                      {HISTORY_LABELS[item.action] ?? item.action}
                    </p>
                    <p className="flex items-center gap-2 text-xs tabular-nums text-second/60">
                      <FiClock size={16} aria-hidden="true" />
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-second/60">
                    <span
                      aria-hidden="true"
                      className="flex size-6 items-center justify-center rounded-full bg-second/10 text-xs font-bold text-second"
                    >
                      {initialOf(item.user_name)}
                    </span>
                    <span className="font-medium text-second">
                      {item.user_name}
                    </span>
                    {item.user_role && (
                      <Tag
                        tone={item.user_role === "OWNER" ? "strong" : "soft"}
                      >
                        {ROLE_LABELS[item.user_role] ?? item.user_role}
                      </Tag>
                    )}
                  </div>

                  {lines.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1 border-l-2 border-second/15 pl-3">
                      {lines.map((line, lineIndex) => (
                        <li
                          key={lineIndex}
                          className="break-words text-xs tabular-nums text-second/70"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {paging && paging.total_pages > 1 && (
        <nav
          aria-label="Paginasi riwayat"
          className="flex items-center justify-between gap-2"
        >
          <p className="text-sm tabular-nums text-second/60">
            Halaman {safePage} dari {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || query.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className={BTN_OUTLINE}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages || query.isFetching}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className={BTN_OUTLINE}
            >
              Berikutnya
              <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </FormSection>
  );
}

/* ------------------------------ Delete report ----------------------------- */

function DeleteReportSection({ report, basePath, canLock }) {
  const router = useRouter();
  const deleteReport = useDeleteDailyReport();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    deleteReport.mutate(
      { id: report.id },
      {
        onSuccess: () => {
          notify.success("Laporan dihapus.");
          router.push(basePath);
        },
        onError: (err) => {
          setConfirming(false);
          notify.error(describeError(err));
        },
      },
    );
  }

  return (
    <FormSection
      title="Hapus laporan"
      description="Menghapus laporan beserta semua baris, riwayat, dan bukti transfernya secara permanen. Salah tanggal? Hapus lalu buat ulang."
    >
      {report.remitted ? (
        <p className="flex items-start gap-2 text-sm text-second/60">
          <FiLock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {canLock
            ? "Laporan yang sudah diapprove tidak bisa dihapus. Batalkan approvenya di bagian Setoran terlebih dahulu."
            : "Laporan yang sudah diapprove tidak bisa dihapus. Minta OWNER membatalkan approve terlebih dahulu."}
        </p>
      ) : confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-second">
            Hapus permanen laporan {formatDate(report.date)}?
          </span>
          <button
            type="button"
            onClick={remove}
            disabled={deleteReport.isPending}
            className={BTN_DANGER}
          >
            {deleteReport.isPending ? <Spinner /> : "Ya, hapus"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleteReport.isPending}
            className={BTN_OUTLINE}
          >
            Batal
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${BTN_DANGER} w-fit`}
        >
          <FiTrash2 size={16} aria-hidden="true" />
          Hapus laporan
        </button>
      )}
    </FormSection>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function ReportDetailView({ id, role }) {
  const basePath = `/${role}/daily-reports`;
  // ADMIN mengisi jumlah setoran dan mengunggah bukti transfer. OWNER sebagai
  // penerima setoran yang memeriksa lalu mengunci atau membuka kunci.
  const canRemit = role === "admin";
  const canLock = role === "owner";

  const query = useGetDailyReport(id);
  const report = query.data;

  const backLink = (
    <Link
      href={basePath}
      className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
    >
      <FiArrowLeft size={16} aria-hidden="true" />
      Kembali ke daftar laporan
    </Link>
  );

  if (query.isPending) {
    return <LoadingState />;
  }

  if (query.isError || !report) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>{backLink}</header>
        <ErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          isFetching={query.isFetching}
        />
      </div>
    );
  }
  const remitStatus = getRemitStatus(report);
  const lockedBySetor = canRemit && hasRemitAmounts(report) && !report.remitted;
  const remainingTotal = report.remaining_balance ?? report.closing_balance;
  const remainingCash = report.remaining_cash ?? report.closing_cash;
  const remainingNoncash = report.remaining_noncash ?? report.closing_noncash;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        {backLink}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiBookOpen size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Laporan <span className="text-grad">kasir</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                {formatDate(report.date)}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              aria-label="Perbarui data"
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              <FiRefreshCw
                size={16}
                className={
                  query.isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : ""
                }
                aria-hidden="true"
              />
              {query.isFetching ? "Memperbarui…" : "Perbarui"}
            </button>
            <ExportReportButton report={report} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={remitStatus.tone}>{remitStatus.label}</Tag>
          {report.remitted ? (
            <Tag tone="soft">
              <FiCheck size={16} aria-hidden="true" />
              Setor
            </Tag>
          ) : (
            <Tag tone="soft">
              <MdCancel size={16} aria-hidden="true" />
              Belum Approve
            </Tag>
          )}
          <Tag tone={report.proof ? "soft" : "outline"}>
            {report.proof ? "Ada bukti transfer" : "Belum ada bukti"}
          </Tag>
          {canLock && <Tag tone="outline">Setoran: Anda yang approve</Tag>}{" "}
        </div>

        {report.updated_at && (
          <p className="text-xs tabular-nums text-second/60">
            Diperbarui {formatDateTime(report.updated_at)}. Lihat siapa yang
            mengubah di Riwayat perubahan.
          </p>
        )}
      </header>

      {/* Ringkasan */}
      <section
        aria-label="Ringkasan laporan"
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${
          query.isFetching ? "opacity-60" : ""
        }`}
      >
        <OpeningBalanceCard
          report={report}
          canEdit={!report.remitted && !lockedBySetor}
        />{" "}
        <StatCard
          icon={FiTrendingUp}
          label="Total masuk"
          value={formatMoney(report.total_in)}
          hint={`Tunai ${formatMoney(report.cash_in)} · Non tunai ${formatMoney(report.noncash_in)}`}
          tone="success"
        />
        <StatCard
          icon={FiTrendingDown}
          label="Total keluar"
          value={formatMoney(report.total_out)}
          hint={`Tunai ${formatMoney(report.cash_out)} · Non tunai ${formatMoney(report.noncash_out)}`}
          tone="failure"
        />
        <StatCard
          icon={FiInbox}
          label="Sisa belum diapprove"
          value={formatMoney(remainingTotal)}
          hint={`Tunai ${formatMoney(remainingCash)} · Non tunai ${formatMoney(remainingNoncash)}`}
          tone="pending"
        />
      </section>

      <BalanceSection report={report} />

      <EntriesSection
        report={report}
        canLock={canLock}
        lockedBySetor={lockedBySetor}
      />
      <RemitSection report={report} canRemit={canRemit} canLock={canLock} />

      <HistorySection report={report} />

      <DeleteReportSection
        report={report}
        basePath={basePath}
        canLock={canLock}
      />
    </div>
  );
}
