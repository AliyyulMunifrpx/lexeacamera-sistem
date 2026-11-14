"use client";

import { useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiEdit2,
  FiLoader,
  FiPlus,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import {
  useCreateEmployeeContract,
  useDeleteEmployeeContract,
  useGetEmployeeContracts,
  useUpdateEmployeeContract,
} from "../../app/features/employees/hooks.js";
import { normalizeApiError } from "../../lib/api/errors.js";
import notify from "../../lib/notify.js";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

const inputClass = (hasError) =>
  [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second tabular-nums",
    "placeholder:text-second/35 transition-colors duration-150 outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");

export const CONTRACT_STATUS = {
  NONE: { label: "Tanpa kontrak", tone: "muted" },
  UPCOMING: { label: "Belum mulai", tone: "violet" },
  ACTIVE: { label: "Berjalan", tone: "blue" },
  ENDED: { label: "Berakhir", tone: "red" },
};

const TAG_TONES = {
  blue: "bg-second3/10 text-second3",
  violet: "bg-second4/10 text-second4",
  red: "bg-second2/10 text-second2",
  muted: "border border-second/30 text-second/65",
};

function Tag({ tone = "muted", children }) {
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${TAG_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Helpers ---------------------------------- */

/* Tanggal murni (YYYY-MM-DD) tanpa konversi zona waktu. */
export function formatDateOnly(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function daysLeftLabel(days) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Hari terakhir";
  if (days > 0) return `Sisa ${days} hari`;
  return `Berakhir ${Math.abs(days)} hari lalu`;
}

function todayWib() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

function describeError(err) {
  const code = err?.response?.data?.errors;

  if (code === "CONTRACT_OVERLAP")
    return "Periode ini bertabrakan dengan kontrak lain. Atur tanggal awal atau akhirnya.";
  if (code === "INVALID_CONTRACT_PERIOD")
    return "Akhir kontrak tidak boleh lebih awal dari awal kontrak.";
  if (code === "CONTRACT_NOT_FOUND") return "Kontrak tidak ditemukan.";
  if (code === "EMPLOYEE_NOT_FOUND") return "Karyawan tidak ditemukan.";

  return normalizeApiError(err).message;
}

/* ------------------------------- Dialog ----------------------------------- */

function ContractDialog({ employeeId, contract, defaults, onClose }) {
  const isEdit = Boolean(contract);
  const createMutation = useCreateEmployeeContract();
  const updateMutation = useUpdateEmployeeContract();
  const busy = createMutation.isPending || updateMutation.isPending;

  const startRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  const [start, setStart] = useState(contract?.start_date ?? defaults.start);
  const [end, setEnd] = useState(contract?.end_date ?? defaults.end);
  const [note, setNote] = useState(contract?.note ?? "");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    startRef.current?.focus();

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

    const next = {};
    if (!start) next.start = "Awal kontrak wajib diisi.";
    else if (!isValidDateOnly(start)) next.start = "Isi tanggal yang valid.";

    if (end && !isValidDateOnly(end)) next.end = "Isi tanggal yang valid.";
    else if (!next.start && end && end < start)
      next.end = "Akhir kontrak tidak boleh lebih awal dari awal kontrak.";

    if (note.trim().length > 255) next.note = "Catatan maksimal 255 karakter.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: employeeId,
          contractId: contract.id,
          data: {
            start_date: start,
            end_date: end || null,
            note: note.trim() || null,
          },
        });
        notify.success("Kontrak diperbarui.");
      } else {
        await createMutation.mutateAsync({
          id: employeeId,
          data: {
            start_date: start,
            ...(end && { end_date: end }),
            ...(note.trim() && { note: note.trim() }),
          },
        });
        notify.success("Kontrak ditambahkan.");
      }
      onClose();
    } catch (err) {
      setFormError(describeError(err));
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
        aria-labelledby="contract-dialog-title"
        onSubmit={handleSubmit}
        noValidate
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
            <FiCalendar size={16} aria-hidden="true" />
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
          id="contract-dialog-title"
          className="mt-4 text-lg font-bold text-second"
        >
          {isEdit ? `Ubah kontrak ${contract.contract_number}` : defaults.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-second/60">
          Periode kontrak tidak boleh bertabrakan dengan kontrak lain. Hari
          akhir kontrak masih dihitung berjalan.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <div className="min-w-0">
            <label htmlFor="contract-start" className={labelClass}>
              Awal kontrak
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="contract-start"
              ref={startRef}
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={start}
              disabled={busy}
              onChange={(event) => {
                setStart(event.target.value);
                setErrors((current) => ({ ...current, start: "", end: "" }));
              }}
              aria-invalid={errors.start ? "true" : undefined}
              className={inputClass(Boolean(errors.start))}
            />
            {errors.start && <FieldError>{errors.start}</FieldError>}
          </div>

          <div className="min-w-0">
            <label htmlFor="contract-end" className={labelClass}>
              Akhir kontrak
              <span className="ml-2 text-xs font-normal text-second/50">
                Opsional
              </span>
            </label>
            <input
              id="contract-end"
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={end}
              disabled={busy}
              onChange={(event) => {
                setEnd(event.target.value);
                setErrors((current) => ({ ...current, end: "" }));
              }}
              aria-invalid={errors.end ? "true" : undefined}
              className={inputClass(Boolean(errors.end))}
            />
            {errors.end ? (
              <FieldError>{errors.end}</FieldError>
            ) : (
              <p className="mt-2 text-xs text-second/60">
                Kosongkan untuk kontrak tanpa batas waktu.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="contract-note" className={labelClass}>
              Catatan
              <span className="ml-2 text-xs font-normal text-second/50">
                Opsional
              </span>
            </label>
            <input
              id="contract-note"
              type="text"
              maxLength={255}
              autoComplete="off"
              value={note}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Contoh: Perpanjangan 1 tahun"
              aria-invalid={errors.note ? "true" : undefined}
              className={`${inputClass(Boolean(errors.note))} tabular-nums-none`}
            />
            {errors.note && <FieldError>{errors.note}</FieldError>}
          </div>
        </div>

        {formError && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
          >
            <FiAlertCircle
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
                Menyimpan…
              </>
            ) : isEdit ? (
              "Simpan kontrak"
            ) : (
              "Tambah kontrak"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldError({ children }) {
  return (
    <p
      role="alert"
      className="mt-2 flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/* --------------------------------- Panel ---------------------------------- */

export default function EmployeeContracts({ employee }) {
  const query = useGetEmployeeContracts(employee.id);
  const deleteMutation = useDeleteEmployeeContract();

  const [dialog, setDialog] = useState(null); // { contract?, defaults }
  const [confirmId, setConfirmId] = useState(null);

  const contracts = query.data ?? [];
  const last = contracts.at(-1);

  // Perpanjangan hanya bisa kalau kontrak terakhir punya tanggal akhir.
  const canAdd = !last || Boolean(last.end_date);

  function openAdd() {
    setDialog({
      defaults: last
        ? {
            title: `Perpanjang: kontrak ${last.contract_number + 1}`,
            start: addDays(last.end_date, 1),
            end: "",
          }
        : { title: "Tambah kontrak 1", start: todayWib(), end: "" },
    });
  }

  async function handleDelete(contract) {
    try {
      await deleteMutation.mutateAsync({
        id: employee.id,
        contractId: contract.id,
      });
      notify.success("Kontrak dihapus.");
      setConfirmId(null);
    } catch (err) {
      setConfirmId(null);
      notify.error(describeError(err));
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
        >
          <FiCalendar size={16} />
        </div>
        <h2 className="text-lg font-bold text-second">Kontrak</h2>
      </div>

      {query.isPending ? (
        <p role="status" className="text-sm text-second/60">
          Memuat kontrak…
        </p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-second2">
          Gagal memuat kontrak.{" "}
          <button
            type="button"
            onClick={() => query.refetch()}
            className="font-semibold underline"
          >
            Coba lagi
          </button>
        </p>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-second/60">
          Belum ada kontrak. Kosong berarti karyawan tetap atau belum dicatat.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contracts.map((contract) => {
            const info =
              CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.NONE;
            const hint = contract.end_date
              ? daysLeftLabel(contract.days_left)
              : "Tanpa batas waktu";
            const confirming = confirmId === contract.id;

            return (
              <li
                key={contract.id}
                className="flex flex-col gap-2 rounded-xl border border-second/30 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-second">
                    Kontrak {contract.contract_number}
                    {contract.contract_number > 1 && (
                      <span className="ml-2 text-xs font-normal text-second/60">
                        Perpanjangan
                      </span>
                    )}
                  </p>
                  <Tag tone={info.tone}>{info.label}</Tag>
                </div>

                <p className="text-sm tabular-nums text-second">
                  {formatDateOnly(contract.start_date)}
                  {" – "}
                  {contract.end_date
                    ? formatDateOnly(contract.end_date)
                    : "Seterusnya"}
                </p>
                <p className="text-xs tabular-nums text-second/60">{hint}</p>
                {contract.note && (
                  <p className="break-words text-xs text-second/60">
                    {contract.note}
                  </p>
                )}

                {confirming ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2">
                    <span className="text-xs text-second2">
                      Hapus kontrak ini?
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        disabled={deleteMutation.isPending}
                        className={`${BTN_BASE} border border-second/30 !px-2 !py-1 text-xs text-second ${FOCUS_RING}`}
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(contract)}
                        disabled={deleteMutation.isPending}
                        className={`${BTN_BASE} bg-second2 !px-2 !py-1 text-xs text-primary disabled:opacity-60 ${FOCUS_RING}`}
                      >
                        {deleteMutation.isPending ? "Menghapus…" : "Hapus"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDialog({
                          contract,
                          defaults: { title: "", start: "", end: "" },
                        })
                      }
                      className={`${BTN_BASE} border border-second/30 !px-2 !py-1 text-xs text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                    >
                      <FiEdit2 size={14} aria-hidden="true" />
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(contract.id)}
                      className={`${BTN_BASE} border border-second2/30 !px-2 !py-1 text-xs text-second2 hover:bg-second2/5 ${FOCUS_RING}`}
                    >
                      <FiTrash2 size={14} aria-hidden="true" />
                      Hapus
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!query.isPending && !query.isError && (
        <>
          <button
            type="button"
            onClick={openAdd}
            disabled={!canAdd}
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
          >
            <FiPlus size={16} aria-hidden="true" />
            {last ? "Perpanjang kontrak" : "Tambah kontrak"}
          </button>
          {!canAdd && (
            <p className="text-xs text-second/60">
              Kontrak terakhir tidak punya tanggal akhir. Isi akhir kontrak itu
              dulu lewat tombol Ubah sebelum menambah perpanjangan.
            </p>
          )}
        </>
      )}

      {dialog && (
        <ContractDialog
          employeeId={employee.id}
          contract={dialog.contract}
          defaults={dialog.defaults}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
