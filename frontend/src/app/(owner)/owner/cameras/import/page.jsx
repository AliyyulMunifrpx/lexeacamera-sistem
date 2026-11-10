"use client";

import { useRef, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiLoader,
  FiRefreshCw,
  FiUpload,
} from "react-icons/fi";

import { useImportCameras } from "../../../../features/cameras/import-hooks.js";
import { useGetCategories } from "../../../../features/categories/hooks.js";
import notify from "../../../../../lib/notify.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import {
  FIELD_LABEL,
  IMPORT_CHUNK_SIZE,
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  chunkRows,
  downloadImportTemplate,
  findFileDuplicates,
  mergeCategoryNames,
  mergeProblems,
  parseCameraFile,
  toProblems,
} from "../../../../../lib/import/camera-import.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const CAMERAS_PATH = "/owner/cameras";
const MAX_VISIBLE_PROBLEMS = 100;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const BTN_PRIMARY = `${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

const BTN_OUTLINE = `${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(value);
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
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

function StepCard({ number, title, description, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-grad text-sm font-bold text-primary"
        >
          {number}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-second">{title}</h2>
          {description && (
            <p className="mt-2 text-pretty text-sm text-second/60">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Notice({ tone = "info", children }) {
  const tones = {
    info: "border-second4/30 bg-second4/5 text-second4",
    error: "border-second2/30 bg-second2/5 text-second2",
    success: "border-second3/30 bg-second3/5 text-second3",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${tones[tone]}`}
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Spinner({ children }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-4 py-8 text-sm text-second/60"
    >
      <FiLoader
        className="animate-spin motion-reduce:animate-none"
        size={16}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

function ProblemTable({ problems }) {
  const visible = problems.slice(0, MAX_VISIBLE_PROBLEMS);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-second/30">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-grad text-primary">
            <tr>
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-2 font-semibold"
              >
                Baris di Excel
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-2 font-semibold"
              >
                Kolom
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Yang perlu diperbaiki
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-second/10">
            {visible.map((problem, index) => (
              <tr key={`${problem.excelRow}-${problem.field}-${index}`}>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-second">
                  {problem.excelRow ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-second">
                  {FIELD_LABEL[problem.field] ?? problem.field ?? "—"}
                </td>
                <td className="min-w-64 px-4 py-2 text-second/60">
                  {problem.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {problems.length > visible.length && (
        <p className="text-xs text-second/60">
          Menampilkan {formatNumber(visible.length)} dari{" "}
          {formatNumber(problems.length)} masalah. Perbaiki yang ini dulu, lalu
          unggah ulang untuk melihat sisanya.
        </p>
      )}
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function ImportCamerasPage() {
  const importMutation = useImportCameras();
  const categoriesQuery = useGetCategories();

  const inputRef = useRef(null);
  const importState = useRef({ nextChunk: 0, created: 0, categories: [] });

  // idle | reading | checking | ready | invalid | importing | paused | done
  const [phase, setPhase] = useState("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [parsed, setParsed] = useState(null);
  const [problems, setProblems] = useState([]);
  const [newCategories, setNewCategories] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importError, setImportError] = useState("");
  const [result, setResult] = useState(null);

  const totalRows = parsed?.rows.length ?? 0;
  const busy =
    phase === "reading" || phase === "checking" || phase === "importing";

  /* ------------------------------ Template ------------------------------- */

  async function handleDownloadTemplate() {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const names = (categoriesQuery.data ?? [])
        .map((category) => category?.name)
        .filter(Boolean);
      await downloadImportTemplate(names);
    } catch {
      notify.error("Template gagal dibuat. Coba lagi.");
    } finally {
      setIsDownloading(false);
    }
  }

  /* -------------------------------- Reset -------------------------------- */

  function reset() {
    importState.current = { nextChunk: 0, created: 0, categories: [] };
    setPhase("idle");
    setFileName("");
    setFileError("");
    setParsed(null);
    setProblems([]);
    setNewCategories([]);
    setProgress({ done: 0, total: 0 });
    setImportError("");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  /* ------------------------------ Pilih file ----------------------------- */

  async function handleFile(file) {
    if (!file || busy) return;
    reset();

    if (!/\.xlsx$/i.test(file.name)) {
      setFileError(
        "Gunakan file Excel berformat .xlsx. Untuk file lama (.xls), buka di Excel lalu simpan ulang sebagai .xlsx.",
      );
      return;
    }

    setFileName(file.name);
    setPhase("reading");

    let data;
    try {
      data = await parseCameraFile(file);
    } catch {
      setFileError(
        "File tidak bisa dibaca. Pastikan file tidak rusak atau diberi kata sandi.",
      );
      setPhase("idle");
      return;
    }

    if (data.error) {
      setFileError(data.error);
      setPhase("idle");
      return;
    }
    if (data.missingHeaders.length > 0) {
      setFileError(
        `Kolom berikut tidak ditemukan: ${data.missingHeaders.join(", ")}. Gunakan template dari halaman ini dan jangan menghapus judul kolomnya.`,
      );
      setPhase("idle");
      return;
    }
    if (data.rows.length === 0) {
      setFileError("File ini belum berisi data produk.");
      setPhase("idle");
      return;
    }
    if (data.rows.length > IMPORT_MAX_ROWS) {
      setFileError(
        `File berisi ${formatNumber(data.rows.length)} produk. Maksimal ${formatNumber(IMPORT_MAX_ROWS)} produk sekali import. Bagi menjadi beberapa file.`,
      );
      setPhase("idle");
      return;
    }

    setParsed(data);
    await checkRows(data);
  }

  /* ------------------------------ Pemeriksaan ---------------------------- */

  async function checkRows(data) {
    setPhase("checking");

    const chunks = chunkRows(data.rows);
    const local = findFileDuplicates(data.rows, data.excelRows);
    let server = [];
    let categories = [];

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        setProgress({ done: index, total: chunks.length });

        try {
          const check = await importMutation.mutateAsync({
            rows: chunks[index],
            dryRun: true,
          });
          categories = mergeCategoryNames(categories, check?.new_categories);
          server = server.concat(
            toProblems(check?.row_errors, index, data.excelRows),
          );
        } catch (error) {
          const body = error?.response?.data;
          if (body?.errors === "IMPORT_INVALID") {
            server = server.concat(
              toProblems(body.row_errors, index, data.excelRows),
            );
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      setFileError(normalizeApiError(error).message);
      setPhase("idle");
      return;
    }

    const all = mergeProblems(local, server);
    setNewCategories(categories);
    setProblems(all);
    setPhase(all.length > 0 ? "invalid" : "ready");
  }

  /* -------------------------------- Import ------------------------------- */

  async function runImport() {
    if (!parsed || busy) return;

    setPhase("importing");
    setImportError("");

    const chunks = chunkRows(parsed.rows);
    const state = importState.current;

    for (let index = state.nextChunk; index < chunks.length; index += 1) {
      setProgress({ done: index, total: chunks.length });

      try {
        const created = await importMutation.mutateAsync({
          rows: chunks[index],
          dryRun: false,
        });
        state.created += Number(created?.created) || 0;
        state.categories = mergeCategoryNames(
          state.categories,
          created?.categories_created,
        );
        state.nextChunk = index + 1;
      } catch (error) {
        const body = error?.response?.data;

        if (body?.errors === "IMPORT_INVALID") {
          setProblems(
            mergeProblems(
              [],
              toProblems(body.row_errors, index, parsed.excelRows),
            ),
          );
          setImportError(
            state.created > 0
              ? `${formatNumber(state.created)} produk sudah tersimpan sebelum masalah ini muncul. Perbaiki baris di bawah, lalu unggah ulang file yang sama. Produk yang sudah masuk tidak akan diimpor dua kali.`
              : "",
          );
          setPhase("invalid");
          return;
        }

        setImportError(normalizeApiError(error).message);
        setPhase("paused");
        return;
      }
    }

    setResult({
      created: state.created,
      categories: state.categories,
    });
    setPhase("done");
    notify.success(`${formatNumber(state.created)} produk berhasil diimpor.`);
  }

  /* -------------------------------- Render ------------------------------- */

  const chunkCount = Math.max(1, Math.ceil(totalRows / IMPORT_CHUNK_SIZE));
  const requiredLabels = IMPORT_COLUMNS.filter((column) => column.required).map(
    (column) => column.label,
  );
  const optionalLabels = IMPORT_COLUMNS.filter(
    (column) => !column.required,
  ).map((column) => column.label);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={CAMERAS_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke produk
        </Link>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiUpload size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Import <span className="text-grad">produk</span> dari Excel
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Tambahkan banyak produk sekaligus. Unduh template, isi datanya,
              lalu unggah kembali.
            </p>
          </div>
        </div>
      </header>

      <div className="flex max-w-3xl flex-col gap-8">
        {/* Langkah 1 */}
        <StepCard
          number="1"
          title="Unduh template"
          description="Template sudah berisi kolom yang dibutuhkan, lengkap dengan petunjuk dan daftar kategori yang sudah ada."
        >
          <div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={isDownloading || busy}
              aria-busy={isDownloading}
              className={`${BTN_OUTLINE} w-full sm:w-auto`}
            >
              {isDownloading ? (
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
              ) : (
                <FiDownload size={16} aria-hidden="true" />
              )}
              {isDownloading ? "Menyiapkan…" : "Unduh template Excel"}
            </button>
          </div>
        </StepCard>

        {/* Langkah 2 */}
        <StepCard
          number="2"
          title="Isi template"
          description="Satu baris untuk satu produk. Jangan mengubah judul kolom di baris pertama."
        >
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex flex-col gap-2">
              <dt className="font-semibold text-second">Wajib diisi</dt>
              <dd className="flex flex-wrap gap-2">
                {requiredLabels.map((label) => (
                  <Tag key={label} tone="strong">
                    {label}
                  </Tag>
                ))}
              </dd>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <dt className="font-semibold text-second">Boleh dikosongkan</dt>
              <dd className="flex flex-wrap gap-2">
                {optionalLabels.map((label) => (
                  <Tag key={label}>{label}</Tag>
                ))}
              </dd>
            </div>
          </dl>

          <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-second/60">
            <li>
              Kategori yang belum ada akan dibuat otomatis. Periksa ejaannya
              supaya tidak muncul kategori ganda.
            </li>
            <li>
              Kombinasi SKU dan serial number tidak boleh sama dengan produk
              yang sudah ada.
            </li>
            <li>
              Produk hasil import belum punya foto, jadi belum tampil di katalog
              toko sampai fotonya ditambahkan.
            </li>
          </ul>
        </StepCard>

        {/* Langkah 3 */}
        <StepCard
          number="3"
          title="Unggah file yang sudah diisi"
          description="Sistem memeriksa seluruh file dulu. Produk baru disimpan setelah Anda menekan tombol import."
        >
          {phase !== "done" && (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleFile(event.dataTransfer.files?.[0]);
              }}
              className={`flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? "border-second4 bg-second4/5"
                  : "border-second/30 bg-second/5"
              }`}
            >
              <FiFileText
                size={24}
                className="text-second/40"
                aria-hidden="true"
              />
              <p className="text-sm text-second/60">
                {fileName ? (
                  <>
                    File terpilih:{" "}
                    <span className="break-all font-semibold text-second">
                      {fileName}
                    </span>
                  </>
                ) : (
                  "Tarik file Excel (.xlsx) ke sini, atau pilih dari komputer."
                )}
              </p>

              <input
                ref={inputRef}
                id="import-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={busy}
                onChange={(event) => handleFile(event.target.files?.[0])}
                className="sr-only"
              />
              <label
                htmlFor="import-file"
                className={`${BTN_OUTLINE} cursor-pointer ${
                  busy ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <FiUpload size={16} aria-hidden="true" />
                {fileName ? "Pilih file lain" : "Pilih file"}
              </label>
            </div>
          )}

          {fileError && (
            <Notice tone="error">
              <p className="font-semibold">File belum bisa dipakai</p>
              <p className="mt-2">{fileError}</p>
            </Notice>
          )}

          {phase === "reading" && <Spinner>Membaca file…</Spinner>}

          {phase === "checking" && (
            <Spinner>
              Memeriksa {formatNumber(totalRows)} produk…
              {progress.total > 1 && (
                <span className="tabular-nums">
                  {" "}
                  ({formatNumber(progress.done + 1)} dari {progress.total})
                </span>
              )}
            </Spinner>
          )}

          {/* Ada yang perlu diperbaiki */}
          {phase === "invalid" && (
            <div className="flex flex-col gap-4">
              <Notice tone="error">
                <p className="font-semibold">
                  {formatNumber(problems.length)} masalah perlu diperbaiki
                </p>
                <p className="mt-2">
                  Belum ada produk yang tersimpan. Perbaiki di Excel, simpan,
                  lalu unggah file lagi.
                </p>
              </Notice>

              {importError && <Notice tone="error">{importError}</Notice>}

              <ProblemTable problems={problems} />

              <div>
                <button
                  type="button"
                  onClick={reset}
                  className={`${BTN_OUTLINE} w-full sm:w-auto`}
                >
                  <FiRefreshCw size={16} aria-hidden="true" />
                  Unggah file yang sudah diperbaiki
                </button>
              </div>
            </div>
          )}

          {/* Siap diimpor */}
          {(phase === "ready" ||
            phase === "importing" ||
            phase === "paused") && (
            <div className="flex flex-col gap-4">
              <Notice tone="success">
                <p className="font-semibold">
                  {formatNumber(totalRows)} produk siap diimpor
                </p>
                <p className="mt-2">
                  Semua baris sudah diperiksa dan tidak ada masalah.
                </p>
              </Notice>

              {newCategories.length > 0 && (
                <Notice tone="info">
                  <p className="font-semibold">
                    {newCategories.length} kategori baru akan dibuat
                  </p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    {newCategories.map((name) => (
                      <Tag key={name} tone="strong">
                        {name}
                      </Tag>
                    ))}
                  </p>
                  <p className="mt-2">
                    Kalau ada yang salah ketik, perbaiki di Excel dan unggah
                    ulang sebelum melanjutkan.
                  </p>
                </Notice>
              )}

              {phase === "paused" && (
                <Notice tone="error">
                  <p className="font-semibold">Import terhenti</p>
                  <p className="mt-2">
                    {formatNumber(importState.current.created)} dari{" "}
                    {formatNumber(totalRows)} produk sudah tersimpan.{" "}
                    {importError} Tekan “Lanjutkan import” untuk menyelesaikan
                    sisanya. Produk yang sudah masuk tidak akan diimpor dua
                    kali.
                  </p>
                </Notice>
              )}

              {phase === "importing" && (
                <Spinner>
                  Mengimpor produk…
                  {progress.total > 1 && (
                    <span className="tabular-nums">
                      {" "}
                      (bagian {formatNumber(progress.done + 1)} dari{" "}
                      {progress.total})
                    </span>
                  )}
                </Spinner>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={reset}
                  disabled={phase === "importing"}
                  className={`${BTN_OUTLINE} w-full sm:w-auto`}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={runImport}
                  disabled={phase === "importing"}
                  aria-busy={phase === "importing"}
                  className={`${BTN_PRIMARY} w-full sm:w-auto`}
                >
                  {phase === "importing" ? (
                    <>
                      <FiLoader
                        className="animate-spin motion-reduce:animate-none"
                        size={16}
                        aria-hidden="true"
                      />
                      Mengimpor…
                    </>
                  ) : (
                    <>
                      <FiCheck size={16} aria-hidden="true" />
                      {phase === "paused"
                        ? "Lanjutkan import"
                        : `Import ${formatNumber(totalRows)} produk`}
                    </>
                  )}
                </button>
              </div>

              {chunkCount > 1 && phase === "ready" && (
                <p className="text-xs text-second/60">
                  File besar dikirim bertahap. Kalau koneksi terputus di tengah
                  jalan, Anda bisa melanjutkan dari bagian yang tersisa.
                </p>
              )}
            </div>
          )}

          {/* Selesai */}
          {phase === "done" && result && (
            <div className="flex flex-col gap-4">
              <Notice tone="success">
                <p className="font-semibold">
                  {formatNumber(result.created)} produk berhasil diimpor
                </p>
                {result.categories.length > 0 && (
                  <p className="mt-2">
                    Kategori baru dibuat: {result.categories.join(", ")}.
                  </p>
                )}
                <p className="mt-2">
                  Produk ini belum punya foto, jadi belum tampil di katalog
                  toko. Tambahkan foto dari halaman tiap produk.
                </p>
              </Notice>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={reset}
                  className={`${BTN_OUTLINE} w-full sm:w-auto`}
                >
                  Import file lain
                </button>
                <Link
                  href={CAMERAS_PATH}
                  className={`${BTN_PRIMARY} w-full sm:w-auto`}
                >
                  <FiCheckCircle size={16} aria-hidden="true" />
                  Lihat daftar produk
                </Link>
              </div>
            </div>
          )}
        </StepCard>
      </div>
    </div>
  );
}
