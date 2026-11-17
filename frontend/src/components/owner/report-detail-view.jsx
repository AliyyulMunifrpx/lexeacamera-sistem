"use client";

import { useRef, useState } from "react";
import Link from "next/link.js";
import { useRouter } from "next/navigation";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBookOpen,
  FiCheck,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiLayers,
  FiList,
  FiLoader,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";

import {
  useCreateEntry,
  useDeleteDailyReport,
  useDeleteEntry,
  useDeleteProof,
  useGetDailyReport,
  useUpdateDailyReport,
  useUpdateEntry,
  useUploadProof,
} from "../../app/features/daily-reports/hooks.js";
import { ExportReportButton } from "./export-reports-button.jsx";
import {
  BTN_BASE,
  BTN_DANGER,
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  FormSection,
  PREVIEWABLE_TYPES,
  PROOF_TYPES,
  Tag,
  describeError,
  digitsOnly,
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  formatThousands,
  inputClass,
  labelClass,
  MAX_AMOUNT,
  MAX_ENTRIES,
  MAX_PROOF_SIZE,
} from "./daily-reports-shared.jsx";
import notify from "../../lib/notify.js";

const formatNumber = (value = 0) =>
  new Intl.NumberFormat("id-ID").format(Math.round(value));

/* ------------------------------ Error mapping ----------------------------- */

function explainError(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.errors;

  if (status === 404 || code === "REPORT_NOT_FOUND") {
    return {
      title: "Laporan tidak ditemukan",
      description: "Laporan ini tidak ada atau bukan milik Anda.",
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
          <p className="mt-0.5 truncate text-xs tabular-nums text-second/60">
            {hint}
          </p>
        )}
      </div>
      {action}
    </article>
  );
}

// Pilih jenis baris: pemasukan atau pengeluaran.
function KindToggle({ value, onChange, disabled }) {
  const options = [
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

  return (
    <div
      role="group"
      aria-label="Jenis baris"
      className="grid grid-cols-2 gap-2"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          disabled={disabled}
          onClick={() => onChange(option.id)}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 touch-manipulation ${FOCUS_RING} ${
            value === option.id
              ? option.active
              : "border-second/30 text-second/60 hover:border-second4"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AmountInput({ id, value, onChange, disabled, hasError, describedBy }) {
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
        placeholder="10.000"
        disabled={disabled}
        className={`${inputClass(hasError)} rounded-l-none tabular-nums`}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
      />
    </div>
  );
}

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
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function startEdit() {
    setValue(String(report.opening_balance));
    setError("");
    setEditing(true);
  }

  function save() {
    if (value === "") {
      setError("Saldo awal wajib diisi.");
      return;
    }

    if (Number(value) > MAX_AMOUNT) {
      setError("Nominal terlalu besar.");
      return;
    }

    if (Number(value) === report.opening_balance) {
      setEditing(false);
      return;
    }

    updateReport.mutate(
      { id: report.id, data: { opening_balance: Number(value) } },
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
    return (
      <StatCard
        icon={FiLayers}
        label="Saldo awal"
        value={
          <div className="flex flex-col gap-2 text-base font-normal">
            <AmountInput
              id="opening-balance-edit"
              value={value}
              onChange={(next) => {
                setValue(next);
                setError("");
              }}
              disabled={updateReport.isPending}
              hasError={Boolean(error)}
              describedBy={error ? "opening-balance-edit-desc" : undefined}
            />
            {error && (
              <ErrorText id="opening-balance-edit-desc">{error}</ErrorText>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={updateReport.isPending}
                className={`${BTN_PRIMARY} flex-1`}
              >
                {updateReport.isPending ? <Spinner /> : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={updateReport.isPending}
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
      hint="Kas di laci saat toko buka"
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

/* --------------------------------- Entries -------------------------------- */

function EntryForm({ report }) {
  const createEntry = useCreateEntry();
  const nameRef = useRef(null);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState("income");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState({});

  const atLimit = (report.entries?.length ?? 0) >= MAX_ENTRIES;

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
      name: name.trim(),
      [kind]: Number(amount),
    };

    if (note.trim()) payload.note = note.trim();

    createEntry.mutate(
      { id: report.id, data: payload },
      {
        onSuccess: () => {
          setName("");
          setNote("");
          setAmount("");
          setErrors({});
          nameRef.current?.focus();
        },
        onError: (err) => notify.error(describeError(err)),
      },
    );
  }

  const disabled = createEntry.isPending || atLimit;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-dashed border-second/30 p-4"
    >
      <p className="text-sm font-semibold text-second">Tambah baris</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <div className="min-w-0">
          <span className={labelClass}>Jenis</span>
          <KindToggle value={kind} onChange={setKind} disabled={disabled} />
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
      </div>

      {atLimit && (
        <ErrorText>
          Jumlah baris sudah mencapai batas maksimal ({MAX_ENTRIES}).
        </ErrorText>
      )}

      <button
        type="submit"
        disabled={disabled}
        className={`${BTN_PRIMARY} w-fit`}
      >
        {createEntry.isPending ? (
          <>
            <Spinner />
            Menambahkan…
          </>
        ) : (
          <>
            <FiPlus size={16} aria-hidden="true" />
            Tambah baris
          </>
        )}
      </button>
    </form>
  );
}

function EntryEditRow({ report, entry, onClose }) {
  const updateEntry = useUpdateEntry();

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

          <div className="min-w-0">
            <span className={labelClass}>Jenis</span>
            <KindToggle value={kind} onChange={setKind} disabled={disabled} />
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
        <p className="break-words text-sm font-semibold text-second">
          {entry.name}
        </p>
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

function EntriesSection({ report, isAdmin }) {
  const entries = report.entries ?? [];
  const canEdit = isAdmin && !report.transferred;

  return (
    <FormSection
      title="Catatan kas"
      description="Saldo dihitung berjalan dari saldo awal, mengikuti urutan pencatatan."
      aside={
        <Tag tone="soft">
          {entries.length}/{MAX_ENTRIES} baris
        </Tag>
      }
    >
      {isAdmin && report.transferred && (
        <p className="flex items-start gap-2 rounded-xl bg-second/5 p-4 text-sm text-second/60">
          <FiLock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Laporan sudah ditransfer dan terkunci. Hilangkan centang transfer
          untuk menambah, mengubah, atau menghapus baris.
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

/* ---------------------------- Transfer & Bukti ---------------------------- */

function ProofPreview({ proof }) {
  const previewable = PREVIEWABLE_TYPES.includes(proof.content_type);
  const isPdf = proof.content_type === "application/pdf";

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
      <a
        href={proof.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-second/5 text-second/40 ${FOCUS_RING}`}
        aria-label="Buka bukti transfer di tab baru"
      >
        {previewable ? (
          <img
            src={proof.url}
            alt="Bukti transfer"
            className="h-full w-full object-cover"
          />
        ) : (
          <FiFileText size={16} aria-hidden="true" />
        )}
      </a>

      <div className="min-w-0 flex-1">
        <a
          href={proof.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 rounded text-sm font-semibold text-second hover:text-second4 ${FOCUS_RING}`}
        >
          Buka bukti transfer
          <FiExternalLink size={16} aria-hidden="true" />
        </a>
        <p className="mt-2 text-xs text-second/60">
          {isPdf
            ? "PDF"
            : proof.content_type.replace("image/", "").toUpperCase()}{" "}
          · {formatBytes(proof.size)} · diunggah{" "}
          {formatDateTime(proof.uploaded_at)}
        </p>
        <p className="mt-2 text-xs text-second/50">
          Link berlaku sekitar 1 jam. Muat ulang halaman jika sudah kedaluwarsa.
        </p>
      </div>
    </div>
  );
}

function TransferSection({ report, isAdmin }) {
  const updateReport = useUpdateDailyReport();
  const uploadProof = useUploadProof();
  const deleteProof = useDeleteProof();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const proof = report.proof;
  const busy =
    updateReport.isPending || uploadProof.isPending || deleteProof.isPending;

  function handleToggle(event) {
    const checked = event.target.checked;

    updateReport.mutate(
      { id: report.id, data: { transferred: checked } },
      {
        onSuccess: () =>
          notify.success(
            checked
              ? "Laporan ditandai sudah transfer dan dikunci."
              : "Kunci laporan dibuka.",
          ),
        onError: (err) => notify.error(describeError(err)),
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

  return (
    <FormSection
      title="Transfer ke owner"
      description="Setelah toko tutup, transfer saldo akhir ke owner, unggah bukti, lalu centang sudah transfer."
    >
      <div
        className={`rounded-xl border p-4 transition-colors ${
          report.transferred
            ? "border-second3 bg-second3/5"
            : "border-second/30"
        }`}
      >
        {isAdmin ? (
          <label className="flex cursor-pointer items-center gap-4">
            <input
              type="checkbox"
              checked={report.transferred}
              onChange={handleToggle}
              disabled={busy}
              className={`size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-second">
                Sudah transfer ke owner
              </span>
              <span className="mt-2 block text-sm text-second/60">
                {report.transferred
                  ? `Ditransfer ${formatDateTime(report.transferred_at)}. Laporan terkunci.`
                  : `Nominal yang ditransfer: ${formatMoney(report.closing_balance)}. Mencentang akan mengunci laporan.`}
              </span>
            </span>
          </label>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Tag tone={report.transferred ? "success" : "outline"}>
              {report.transferred ? "Sudah transfer" : "Belum transfer"}
            </Tag>
            <p className="text-sm text-second/60">
              {report.transferred
                ? `Ditransfer ${formatDateTime(report.transferred_at)}`
                : "Kasir belum menandai laporan ini sebagai ditransfer."}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-second/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-second">Bukti transfer</h3>
          {report.transferred && !proof && <Tag tone="failure">Belum ada</Tag>}
        </div>

        {proof ? (
          <ProofPreview proof={proof} />
        ) : (
          !isAdmin && (
            <p className="text-sm text-second/60">
              Belum ada bukti transfer yang diunggah.
            </p>
          )
        )}

        {isAdmin && (
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
                  {proof ? "Ganti bukti" : "Unggah bukti"}
                </>
              )}
              <input
                type="file"
                accept={PROOF_TYPES.join(",")}
                disabled={busy}
                onChange={handleFile}
                className="sr-only"
              />
            </label>

            {proof &&
              (confirmingDelete ? (
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
              ))}
          </div>
        )}

        {isAdmin && (
          <p className="text-xs text-second/50">
            JPEG, PNG, WebP, HEIC, atau PDF. Maksimal 10 MB. Satu bukti untuk
            satu hari; unggah ulang akan mengganti file lama.
          </p>
        )}
      </div>
    </FormSection>
  );
}

/* ------------------------------ Delete report ----------------------------- */

function DeleteReportSection({ report, basePath }) {
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
      description="Menghapus laporan beserta semua baris dan bukti transfernya secara permanen. Salah tanggal? Hapus lalu buat ulang."
    >
      {report.transferred ? (
        <p className="flex items-start gap-2 text-sm text-second/60">
          <FiLock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Laporan yang sudah ditransfer tidak bisa dihapus. Hilangkan centang
          transfer terlebih dahulu.
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
  const isAdmin = role === "admin";
  const basePath = `/${role}/daily-reports`;

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

  const net = (Number(report.total_in) || 0) - (Number(report.total_out) || 0);

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
                Laporan <span className="text-grad">harian</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                {formatDate(report.date)} · Kasir {report.cashier_name}
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
          <Tag tone={report.transferred ? "success" : "outline"}>
            {report.transferred ? "Sudah transfer" : "Belum transfer"}
          </Tag>
          {report.transferred && (
            <Tag tone="soft">
              <FiLock size={16} aria-hidden="true" />
              Terkunci
            </Tag>
          )}
          <Tag tone={report.proof ? "soft" : "outline"}>
            {report.proof ? "Ada bukti transfer" : "Belum ada bukti"}
          </Tag>
        </div>

        {report.updated_at && (
          <p className="text-xs tabular-nums text-second/60">
            Diperbarui {formatDateTime(report.updated_at)}
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
          canEdit={isAdmin && !report.transferred}
        />
        <StatCard
          icon={FiTrendingUp}
          label="Total masuk"
          value={formatMoney(report.total_in)}
          hint="Semua pemasukan hari ini"
          tone="success"
        />
        <StatCard
          icon={FiTrendingDown}
          label="Total keluar"
          value={formatMoney(report.total_out)}
          hint="Semua pengeluaran hari ini"
          tone="failure"
        />
        <StatCard
          icon={FiList}
          label="Jumlah baris"
          value={formatNumber(report.entry_count ?? report.entries?.length)}
          hint={`Maksimal ${formatNumber(MAX_ENTRIES)} baris`}
          tone="pending"
        />
      </section>

      {/* Ringkasan kas */}
      <section
        aria-label="Saldo akhir"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Saldo akhir</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Saldo akhir = saldo awal + total masuk − total keluar, yaitu uang
            yang ditransfer ke owner.
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-second/[0.03] p-4">
            <dt className="text-xs text-second/60">Saldo awal</dt>
            <dd className="mt-2 text-lg font-bold tabular-nums text-second">
              {formatMoney(report.opening_balance)}
            </dd>
            <p className="mt-2 text-xs text-second/60">Kas saat toko buka</p>
          </div>
          <div className="rounded-xl bg-second/[0.03] p-4">
            <dt className="text-xs text-second/60">Selisih hari ini</dt>
            <dd
              className={`mt-2 text-lg font-bold tabular-nums ${
                net < 0 ? "text-second2" : "text-second3"
              }`}
            >
              {formatMoney(net)}
            </dd>
            <p className="mt-2 text-xs text-second/60">
              Total masuk dikurangi total keluar
            </p>
          </div>
          <div className="rounded-xl bg-grad p-4 text-primary shadow-lg shadow-second4/25">
            <dt className="text-xs text-primary/90">Saldo akhir</dt>
            <dd className="mt-2 text-lg font-bold tabular-nums">
              {formatMoney(report.closing_balance)}
            </dd>
            <p className="mt-2 text-xs text-primary/90">Ditransfer ke owner</p>
          </div>
        </dl>
      </section>

      <EntriesSection report={report} isAdmin={isAdmin} />

      <TransferSection report={report} isAdmin={isAdmin} />

      {isAdmin && <DeleteReportSection report={report} basePath={basePath} />}
    </div>
  );
}
