"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiEdit2,
  FiLoader,
  FiLock,
  FiRefreshCw,
  FiTrash2,
  FiXCircle,
  FiDownload,
} from "react-icons/fi";

import {
  useDeleteQualityControl,
  useGetQualityControl,
  useUpdateQcStatus,
} from "../../../../features/qc/hooks.js";
import QcMedia from "../../../../../components/owner/qc-media.jsx";
import {
  BTN_BASE,
  BTN_DANGER,
  BTN_OUTLINE,
  BTN_PRIMARY,
  CLASS_LABEL,
  FOCUS_RING,
  ORIGIN_LABEL,
  SECTIONS,
  STATUS_LABEL_ADMIN,
  Tag,
  TYPE_LABEL,
  describeQcError,
  formatDate,
  formatRupiah,
} from "../../../../../components/owner/qc-shared.jsx";
import notify from "../../../../../lib/notify.js";
import { useGetStore } from "../../../../features/store/hooks.js";
const SECTION_FIELD = {
  PHYSICAL: "physical",
  FUNCTION: "functions",
  ACCESSORY: "accessories",
  COMPLETENESS: "completeness",
};
const QC_PATH = "/admin/quality-controls";

function Card({ title, aside, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-second">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-second/60">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-second">
        {children || "—"}
      </dd>
    </div>
  );
}

const VALUE_HEADER = {
  PHYSICAL: "Kerusakan",
  FUNCTION: "Kondisi",
  ACCESSORY: "Kondisi",
  COMPLETENESS: "Kelengkapan",
};

/* Tabel: gaya sama dengan tabel daftar (header gradien, baris selang-seling). */
function TableShell({ headers, children }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-primary shadow-xl shadow-second/5">
      <table className="min-w-full text-left">
        <thead className="bg-grad text-sm text-primary">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-second/10">{children}</tbody>
      </table>
    </div>
  );
}

function rowClass(index) {
  return `align-top transition-colors hover:bg-second/20 ${
    index % 2 === 0 ? "" : "bg-second3/20"
  }`;
}

function EntryValue({ section, entry }) {
  if (section === "PHYSICAL") {
    return entry.checked ? (
      <Tag tone="red">Minor</Tag>
    ) : (
      <Tag tone="muted">Tidak ada</Tag>
    );
  }
  if (section === "COMPLETENESS") {
    return entry.checked ? (
      <Tag tone="blue">
        Ada{entry.origin ? ` · ${ORIGIN_LABEL[entry.origin]}` : ""}
      </Tag>
    ) : (
      <Tag tone="muted">Tidak ada</Tag>
    );
  }
  const info = CLASS_LABEL[entry.classification] ?? CLASS_LABEL.NORMAL;
  return <Tag tone={info.tone}>{info.label}</Tag>;
}

function DeleteModal({ qc, busy, onClose, onConfirm }) {
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
      aria-labelledby="delete-qc-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-second/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl sm:p-8">
        <h2 id="delete-qc-title" className="text-lg font-bold text-second">
          Hapus QC?
        </h2>
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-second/60">
          <p>
            QC{" "}
            <span className="break-words font-semibold text-second">
              {qc.product_name}
            </span>{" "}
            dihapus <span className="font-semibold">permanen</span> beserta
            checklist, tambahan, dan semua foto/video-nya. Tindakan ini tidak
            bisa dibatalkan.
          </p>
          <p>
            Kalau QC ini cuma batal, ubah statusnya jadi “Batal” saja supaya
            catatannya tetap ada.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
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
            disabled={busy}
            aria-busy={busy}
            className={`${BTN_BASE} w-full bg-second2 text-primary hover:opacity-90 disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
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

export default function QcDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const {
    data: qc,
    isPending,
    isError,
    isFetching,
    error,
    refetch,
  } = useGetQualityControl(id);
  const statusMutation = useUpdateQcStatus();
  const deleteMutation = useDeleteQualityControl();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const storeQuery = useGetStore();
  const [exporting, setExporting] = useState(false);
  if (isPending) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <div className="h-16 animate-pulse rounded-2xl bg-second/10" />
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl bg-second/10 xl:col-span-2" />
          <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
        </div>
      </div>
    );
  }

  if (isError || !qc) {
    const notFound = error?.response?.data?.errors === "QC_NOT_FOUND";
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <Link
          href={QC_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 text-sm font-medium text-second/60 hover:text-second4 ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar QC
        </Link>
        <div className="flex flex-col items-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertCircle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            {notFound ? "QC tidak ditemukan" : "Gagal memuat QC"}
          </h2>
          {!notFound && (
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={`${BTN_PRIMARY} mt-4`}
            >
              <FiRefreshCw size={16} aria-hidden="true" />
              {isFetching ? "Memuat…" : "Coba lagi"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const isDeal = qc.status === "DEAL";
  const statusInfo = STATUS_LABEL_ADMIN[qc.status] ?? STATUS_LABEL_ADMIN.CANCEL;

  async function toggleStatus() {
    // QC yang sudah deal tidak bisa dibatalkan lagi.
    if (isDeal) return;

    try {
      await statusMutation.mutateAsync({
        id,
        status: "DEAL",
      });
      notify.success("Status: deal.");
    } catch (err) {
      notify.error(describeQcError(err));
    }
  }

  async function handleDelete() {
    // QC yang sudah deal tidak bisa dihapus.
    if (isDeal) return;

    try {
      await deleteMutation.mutateAsync(id);
      notify.success("QC dihapus.");
      router.replace(QC_PATH);
    } catch (err) {
      setConfirmDelete(false);
      notify.error(describeQcError(err));
    }
  }
  async function handleExportPdf() {
    if (exporting) return;
    setExporting(true);

    try {
      const fresh = await storeQuery.refetch();
      const storeData = fresh.data ?? storeQuery.data;

      // Di-import saat diklik supaya library PDF tidak ikut bundle awal halaman.
      const { downloadQcPdf } =
        await import("../../../../../components/owner/qc-pdf.jsx");
      await downloadQcPdf({ qc, store: storeData });
    } catch (err) {
      console.error("Gagal membuat PDF:", err);
      notify.error("Gagal membuat PDF.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={QC_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar QC
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-second/60">Quality control</p>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-second sm:text-3xl">
              {qc.product_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Tag tone="strong">{TYPE_LABEL[qc.type]}</Tag>
              <Tag tone={statusInfo.tone}>{statusInfo.label}</Tag>
              <Tag>{formatDate(qc.date)}</Tag>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className={BTN_OUTLINE}
            >
              <FiDownload size={16} aria-hidden="true" />
              {exporting ? "Membuat PDF…" : "Export PDF"}
            </button>

            <button
              type="button"
              onClick={toggleStatus}
              disabled={isDeal || statusMutation.isPending}
              title={
                isDeal ? "QC yang sudah deal tidak bisa dibatalkan." : undefined
              }
              className={isDeal ? BTN_OUTLINE : BTN_PRIMARY}
            >
              {isDeal ? (
                <>
                  <FiXCircle size={16} aria-hidden="true" />
                  Tandai batal
                </>
              ) : (
                <>
                  <FiCheckCircle size={16} aria-hidden="true" />
                  Tandai deal
                </>
              )}
            </button>

            {isDeal ? (
              <button
                type="button"
                disabled
                title="QC yang sudah deal tidak bisa diubah."
                className={BTN_OUTLINE}
              >
                <FiLock size={16} aria-hidden="true" />
                Ubah
              </button>
            ) : (
              <Link href={`${QC_PATH}/${id}/edit`} className={BTN_OUTLINE}>
                <FiEdit2 size={16} aria-hidden="true" />
                Ubah
              </Link>
            )}

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeal}
              title={
                isDeal ? "QC yang sudah deal tidak bisa dihapus." : undefined
              }
              className={BTN_DANGER}
            >
              {isDeal ? (
                <FiLock size={16} aria-hidden="true" />
              ) : (
                <FiTrash2 size={16} aria-hidden="true" />
              )}
              Hapus
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
          {SECTIONS.map((section) => {
            const entries = qc[SECTION_FIELD[section.value]] ?? [];
            return (
              <Card
                key={section.value}
                title={section.label}
                aside={<Tag tone="soft">{entries.length} item</Tag>}
              >
                {entries.length === 0 ? (
                  <p className="text-sm text-second/60">Tidak ada isian.</p>
                ) : (
                  <TableShell headers={["Item", VALUE_HEADER[section.value]]}>
                    {entries.map((entry, index) => (
                      <tr key={entry.id} className={rowClass(index)}>
                        <td className="px-4 py-4">
                          <p className="break-words text-sm font-semibold text-second">
                            {entry.name}
                          </p>
                          {entry.note && (
                            <p className="mt-2 break-words text-xs text-second/60">
                              {entry.note}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <EntryValue section={section.value} entry={entry} />
                        </td>
                      </tr>
                    ))}
                  </TableShell>
                )}
              </Card>
            );
          })}

          <Card
            title="Tambahan"
            aside={<Tag tone="soft">{qc.extras?.length ?? 0} barang</Tag>}
          >
            {(qc.extras ?? []).length === 0 ? (
              <p className="text-sm text-second/60">Tidak ada tambahan.</p>
            ) : (
              <TableShell headers={["No", "Nama barang"]}>
                {qc.extras.map((extra, index) => (
                  <tr key={extra.id} className={rowClass(index)}>
                    <td className="w-16 px-4 py-4 text-sm tabular-nums text-second/70">
                      {index + 1}
                    </td>
                    <td className="break-words px-4 py-4 text-sm font-semibold text-second">
                      {extra.name}
                    </td>
                  </tr>
                ))}
              </TableShell>
            )}
          </Card>

          <QcMedia qc={qc} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16">
          <Card title="Info unit">
            <dl className="divide-y divide-second/10">
              <InfoRow label="Harga">
                {qc.price == null ? "" : formatRupiah(qc.price)}
              </InfoRow>
              <InfoRow label="Serial number">{qc.serial_number}</InfoRow>
              <InfoRow label="Pengirim">{qc.sender_name}</InfoRow>
              <InfoRow label="Nomor resi">{qc.tracking_number}</InfoRow>
              <InfoRow label="PIC">{qc.pic}</InfoRow>
              <InfoRow label="Kerusakan fisik">
                {String(qc.defect_count)}
              </InfoRow>
              <InfoRow label="Minor">{String(qc.minor_count)}</InfoRow>
            </dl>
          </Card>
        </aside>
      </div>

      {confirmDelete && (
        <DeleteModal
          qc={qc}
          busy={deleteMutation.isPending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
