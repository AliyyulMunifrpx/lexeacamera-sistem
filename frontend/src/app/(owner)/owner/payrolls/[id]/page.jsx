"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiEdit2,
  FiLock,
  FiRefreshCw,
  FiRotateCcw,
  FiTrash2,
  FiUser,
} from "react-icons/fi";

import {
  useDeletePayroll,
  useGetPayroll,
  useTogglePayrollItem,
  useUpdatePayrollStatus,
} from "../../../../features/payrolls/hooks.js";
// Sesuaikan path dua hook ini dengan yang dipakai di InvoiceDetailPage
import { useGetStore } from "../../../../features/store/hooks.js";
import notify from "../../../../../lib/notify.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";
import {
  BTN_DANGER,
  BTN_OUTLINE,
  BTN_PRIMARY,
  ConfirmModal,
  FOCUS_RING,
  PAYROLL_PATH,
  STATUS,
  SummaryRow,
  Tag,
  describePayrollError,
  formatCurrency,
  formatDate,
  formatDateTime,
  inputClass,
  labelClass,
  todayWib,
} from "../../../../../components/owner/payroll-shared.jsx";
import { useGetCurrentUser } from "../../../../features/users/hooks.js";

function Shell({ children }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href={PAYROLL_PATH}
      className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
    >
      <FiArrowLeft size={16} aria-hidden="true" />
      Kembali ke gaji karyawan
    </Link>
  );
}

function Card({ icon: Icon, title, children, aside }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-4 text-lg font-bold text-second">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary"
          >
            <Icon size={16} />
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, hint, featured = false }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-4 rounded-2xl p-4 sm:p-8 ${
        featured
          ? "bg-grad text-primary shadow-lg shadow-second4/25"
          : "border border-second/30"
      }`}
    >
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
          featured ? "bg-primary text-second" : "bg-grad text-primary"
        }`}
      >
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p
          className={`text-xs ${featured ? "text-primary/80" : "text-second/60"}`}
        >
          {label}
        </p>
        <p className="mt-2 truncate text-lg font-bold tabular-nums sm:text-2xl">
          {value}
        </p>
        {hint && (
          <p
            className={`mt-2 truncate text-xs ${
              featured ? "text-primary/80" : "text-second/60"
            }`}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PayrollDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const {
    data: slip,
    isPending,
    isError,
    isFetching,
    error,
    refetch,
  } = useGetPayroll(id);
  const statusMutation = useUpdatePayrollStatus();
  const toggleMutation = useTogglePayrollItem();
  const deleteMutation = useDeletePayroll();

  // Untuk PDF: data toko dan nama owner
  const storeQuery = useGetStore();
  const store = storeQuery.data;
  const { data: currentUser } = useGetCurrentUser();

  const [modal, setModal] = useState(null); // "pay" | "unpay" | "delete"
  const [paidDate, setPaidDate] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isError && error) {
      notify.error(describePayrollError(error, normalizeApiError));
    }
  }, [isError, error]);

  if (isPending) {
    return (
      <Shell>
        <div className="h-16 animate-pulse rounded-2xl bg-second/10" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl bg-second/10"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
      </Shell>
    );
  }

  if (isError || !slip) {
    const notFound = error?.response?.status === 404;
    return (
      <Shell>
        <BackLink />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertCircle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            {notFound ? "Slip gaji tidak ditemukan" : "Gagal memuat slip gaji"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            {notFound
              ? "Slip mungkin sudah dihapus."
              : "Periksa koneksi Anda, lalu coba kembali."}
          </p>
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
      </Shell>
    );
  }

  const isPaid = slip.status === "PAID";
  const state = STATUS[slip.status] ?? STATUS.PENDING;
  const items = slip.items ?? [];
  const checkedCount = items.filter((item) => item.checked).length;
  const today = todayWib();
  const dateInFuture = paidDate > today;

  function openPay() {
    // Tanggal cair tidak boleh di masa depan untuk slip yang sudah cair.
    const stored = slip.disbursement_date?.slice(0, 10) ?? today;
    setPaidDate(stored > today ? today : stored);
    setModal("pay");
  }

  async function handleStatus(nextStatus) {
    try {
      await statusMutation.mutateAsync({
        id,
        data:
          nextStatus === "PAID"
            ? { status: "PAID", disbursement_date: paidDate }
            : { status: "PENDING" },
      });
      setModal(null);
      notify.success(
        nextStatus === "PAID"
          ? "Slip ditandai sudah cair."
          : "Slip dikembalikan ke belum cair.",
      );
    } catch (err) {
      notify.error(describePayrollError(err, normalizeApiError));
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(id);
      setModal(null);
      notify.success("Slip gaji dihapus.");
      router.replace(PAYROLL_PATH);
    } catch (err) {
      setModal(null);
      if (err?.response?.data?.errors === "PAYROLL_NOT_FOUND") {
        router.replace(PAYROLL_PATH);
      }
      notify.error(describePayrollError(err, normalizeApiError));
    }
  }

  async function handleToggle(item) {
    try {
      await toggleMutation.mutateAsync({
        id,
        itemId: item.id,
        checked: !item.checked,
      });
    } catch (err) {
      notify.error(describePayrollError(err, normalizeApiError));
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(slip.account_number);
      setCopied(true);
      notify.success("Nomor rekening disalin.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Gagal menyalin ke clipboard.");
    }
  }

  async function handleExportPdf() {
    if (exporting) return;
    setExporting(true);

    try {
      // Ambil data toko terbaru, bukan dari cache yang mungkin tidak lengkap.
      const fresh = await storeQuery.refetch();
      const storeData = fresh.data ?? store;
      console.log("store untuk PDF:", storeData);

      // Di-import saat diklik supaya library PDF tidak ikut bundle awal halaman.
      const { downloadPayrollPdf } =
        await import("../../../../../components/owner/payroll-pdf.js");
      await downloadPayrollPdf({
        slip,
        store: storeData,
        ownerName: currentUser?.name,
      });
    } catch (err) {
      console.error("Gagal membuat PDF:", err);
      notify.error("Gagal membuat PDF.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Shell>
      {/* Header */}
      <header className="flex flex-col gap-4">
        <BackLink />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-second/60">Slip gaji</p>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-second sm:text-3xl">
              {slip.employee_name}
            </h1>
            <p className="mt-2 text-sm text-second/60">{slip.job_title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Tag tone={state.tone}>{state.label}</Tag>
              {!slip.employee_id && <Tag>Karyawan sudah dihapus</Tag>}
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

            {isPaid ? (
              <button
                type="button"
                onClick={() => setModal("unpay")}
                className={BTN_OUTLINE}
              >
                <FiRotateCcw size={16} aria-hidden="true" />
                Kembalikan ke belum cair
              </button>
            ) : (
              <button type="button" onClick={openPay} className={BTN_PRIMARY}>
                <FiCheckCircle size={16} aria-hidden="true" />
                Tandai sudah cair
              </button>
            )}

            {isPaid ? (
              <button
                type="button"
                disabled
                title="Kembalikan ke belum cair dulu untuk mengedit."
                className={BTN_OUTLINE}
              >
                <FiLock size={16} aria-hidden="true" />
                Edit
              </button>
            ) : (
              <Link href={`${PAYROLL_PATH}/${id}/edit`} className={BTN_OUTLINE}>
                <FiEdit2 size={16} aria-hidden="true" />
                Edit
              </Link>
            )}

            <button
              type="button"
              onClick={() => setModal("delete")}
              disabled={isPaid}
              title={
                isPaid
                  ? "Kembalikan ke belum cair dulu untuk menghapus."
                  : undefined
              }
              className={BTN_DANGER}
            >
              {isPaid ? (
                <FiLock size={16} aria-hidden="true" />
              ) : (
                <FiTrash2 size={16} aria-hidden="true" />
              )}
              Hapus
            </button>
          </div>
        </div>

        {isPaid && (
          <p className="flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 p-4 text-sm text-second4">
            <FiLock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Slip ini sudah cair dan dihitung sebagai pengeluaran gaji di
            laporan. Untuk mengedit atau menghapus, kembalikan dulu ke “Belum
            cair”.
          </p>
        )}
      </header>

      {/* Angka utama */}
      <section
        aria-label="Ringkasan slip"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          featured
          icon={FiDollarSign}
          label="Total gaji"
          value={formatCurrency(slip.total_amount)}
          hint={`${items.length} penerimaan`}
        />
        <StatCard
          icon={FiCalendar}
          label="Tanggal cair"
          value={formatDate(slip.disbursement_date)}
        />
        <StatCard
          icon={isPaid ? FiCheckCircle : FiClock}
          label="Status"
          value={state.label}
          hint={`${checkedCount} dari ${items.length} penerimaan dicentang`}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Penerimaan */}
        <Card
          icon={FiDollarSign}
          title="Penerimaan"
          aside={<Tag tone="soft">{items.length} item</Tag>}
        >
          <p className="text-sm text-second/60">
            Centang untuk menandai penerimaan yang sudah dicek. Centang hanya
            penanda dan tidak mengubah total. Bisa diubah walau slip sudah cair.
          </p>

          <ul className="flex flex-col divide-y divide-second/10 rounded-xl border border-second/30">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-4 p-4">
                <input
                  id={`item-${item.id}`}
                  type="checkbox"
                  checked={Boolean(item.checked)}
                  onChange={() => handleToggle(item)}
                  disabled={toggleMutation.isPending}
                  className={`mt-2 size-4 shrink-0 cursor-pointer accent-second4 disabled:cursor-not-allowed ${FOCUS_RING}`}
                />
                <label
                  htmlFor={`item-${item.id}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <span
                    className={`block break-words text-sm font-semibold ${
                      item.checked
                        ? "text-second/60 line-through"
                        : "text-second"
                    }`}
                  >
                    {item.name}
                  </span>
                  {item.note && (
                    <span className="mt-2 block break-words text-xs text-second/60">
                      {item.note}
                    </span>
                  )}
                </label>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-second">
                  {formatCurrency(item.amount)}
                </p>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-4 border-t border-second/30 pt-4">
            <p className="font-semibold text-second">Total</p>
            <p className="text-2xl font-bold tabular-nums text-second">
              {formatCurrency(slip.total_amount)}
            </p>
          </div>
        </Card>

        {/* Samping */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16">
          <Card icon={FiCreditCard} title="Rekening">
            <dl className="divide-y divide-second/10">
              <SummaryRow label="Bank">{slip.bank_name}</SummaryRow>
              <SummaryRow label="Nomor rekening">
                <span className="inline-flex items-center gap-2">
                  <span className="break-all">{slip.account_number}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Salin nomor rekening"
                    className={`shrink-0 rounded-md p-2 text-second/40 transition-colors hover:bg-second/5 hover:text-second ${FOCUS_RING}`}
                  >
                    <FiCopy size={14} aria-hidden="true" />
                    <span className="sr-only">{copied ? "Disalin" : ""}</span>
                  </button>
                </span>
              </SummaryRow>
              <SummaryRow label="Atas nama">{slip.account_holder}</SummaryRow>
            </dl>
          </Card>

          <Card icon={FiUser} title="Informasi">
            <dl className="divide-y divide-second/10">
              <SummaryRow label="Karyawan">
                {slip.employee_id ? (
                  <Link
                    href={`/owner/employees/${slip.employee_id}`}
                    className={`rounded font-semibold text-second4 underline ${FOCUS_RING}`}
                  >
                    {slip.employee_name}
                  </Link>
                ) : (
                  slip.employee_name
                )}
              </SummaryRow>
              <SummaryRow label="Jabatan">{slip.job_title}</SummaryRow>
              <SummaryRow label="Dibuat">
                {formatDateTime(slip.created_at)}
              </SummaryRow>
              <SummaryRow label="Terakhir diubah">
                {formatDateTime(slip.updated_at)}
              </SummaryRow>
            </dl>
          </Card>
        </aside>
      </div>

      {/* Modal */}
      {modal === "pay" && (
        <ConfirmModal
          title="Tandai sudah cair?"
          icon={FiCheckCircle}
          busy={statusMutation.isPending}
          confirmLabel="Tandai sudah cair"
          busyLabel="Menyimpan…"
          confirmDisabled={!paidDate || dateInFuture}
          onClose={() => setModal(null)}
          onConfirm={() => handleStatus("PAID")}
        >
          <p>
            Gaji{" "}
            <span className="font-semibold text-second">
              {formatCurrency(slip.total_amount)}
            </span>{" "}
            untuk{" "}
            <span className="break-words font-semibold text-second">
              {slip.employee_name}
            </span>{" "}
            akan dihitung sebagai pengeluaran gaji di laporan, berdasarkan
            tanggal cair di bawah.
          </p>
          <div>
            <label htmlFor="paid-date" className={labelClass}>
              Tanggal cair
            </label>
            <input
              id="paid-date"
              type="date"
              value={paidDate}
              max={today}
              onChange={(event) => setPaidDate(event.target.value)}
              aria-invalid={dateInFuture ? true : undefined}
              className={`${inputClass(dateInFuture)} tabular-nums`}
            />
            {dateInFuture && (
              <p role="alert" className="mt-2 text-sm text-second2">
                Tanggal cair tidak boleh di masa depan.
              </p>
            )}
          </div>
        </ConfirmModal>
      )}

      {modal === "unpay" && (
        <ConfirmModal
          title="Kembalikan ke belum cair?"
          icon={FiRotateCcw}
          busy={statusMutation.isPending}
          confirmLabel="Kembalikan"
          busyLabel="Menyimpan…"
          onClose={() => setModal(null)}
          onConfirm={() => handleStatus("PENDING")}
        >
          <p>
            Slip ini tidak lagi dihitung sebagai pengeluaran gaji di laporan,
            dan bisa diedit atau dihapus lagi.
          </p>
        </ConfirmModal>
      )}

      {modal === "delete" && (
        <ConfirmModal
          title="Hapus slip gaji?"
          icon={FiTrash2}
          tone="danger"
          busy={deleteMutation.isPending}
          confirmLabel="Hapus slip"
          busyLabel="Menghapus…"
          onClose={() => setModal(null)}
          onConfirm={handleDelete}
        >
          <p>
            Slip gaji{" "}
            <span className="break-words font-semibold text-second">
              {slip.employee_name}
            </span>{" "}
            ({formatCurrency(slip.total_amount)}) beserta seluruh penerimaannya
            akan dihapus. Tindakan ini tidak bisa dibatalkan.
          </p>
        </ConfirmModal>
      )}
    </Shell>
  );
}
