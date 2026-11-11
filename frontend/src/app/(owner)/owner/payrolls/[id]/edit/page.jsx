"use client";

import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiDollarSign,
  FiLock,
  FiRefreshCw,
} from "react-icons/fi";

import {
  useGetPayroll,
  useUpdatePayroll,
} from "../../../../../features/payrolls/hooks.js";
import notify from "../../../../../../lib/notify.js";
import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import PayrollForm from "../../../../../../components/owner/payroll-form.jsx";
import {
  BTN_PRIMARY,
  FOCUS_RING,
  PAYROLL_PATH,
  describePayrollError,
} from "../../../../../../components/owner/payroll-shared.jsx";

function Shell({ children }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {children}
    </div>
  );
}

function BackLink({ href, children }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
    >
      <FiArrowLeft size={16} aria-hidden="true" />
      {children}
    </Link>
  );
}

export default function EditPayrollPage() {
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
  const updateMutation = useUpdatePayroll();

  if (isPending) {
    return (
      <Shell>
        <div className="h-16 animate-pulse rounded-2xl bg-second/10" />
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl bg-second/10 xl:col-span-2" />
          <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
        </div>
      </Shell>
    );
  }

  if (isError || !slip) {
    const notFound = error?.response?.status === 404;
    return (
      <Shell>
        <BackLink href={PAYROLL_PATH}>Kembali ke gaji karyawan</BackLink>
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
            {describePayrollError(error, normalizeApiError)}
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

  // Slip yang sudah cair terkunci sampai dikembalikan ke "Belum cair".
  if (slip.status === "PAID") {
    return (
      <Shell>
        <BackLink href={`${PAYROLL_PATH}/${id}`}>
          Kembali ke detail slip
        </BackLink>
        <section className="flex flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-second/5 text-second/40"
          >
            <FiLock size={24} />
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-second">
            Slip sudah <span className="text-grad">cair</span>
          </h1>
          <p className="text-pretty text-sm text-second/60">
            Slip yang sudah cair tidak bisa diedit. Kembalikan ke “Belum cair”
            dari halaman detail kalau ada yang perlu diubah.
          </p>
          <Link
            href={`${PAYROLL_PATH}/${id}`}
            className={`${BTN_PRIMARY} w-fit`}
          >
            Lihat slip
          </Link>
        </section>
      </Shell>
    );
  }

  async function handleSubmit(data) {
    try {
      await updateMutation.mutateAsync({ id, data });
      notify.success("Slip gaji diperbarui.");
      router.replace(`${PAYROLL_PATH}/${id}`);
    } catch (err) {
      notify.error(describePayrollError(err, normalizeApiError));
    }
  }

  return (
    <Shell>
      <header className="flex flex-col gap-4">
        <BackLink href={`${PAYROLL_PATH}/${id}`}>
          Kembali ke detail slip
        </BackLink>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiDollarSign size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Edit <span className="text-grad">slip gaji</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Slip {slip.employee_name}. Hanya perubahan yang akan disimpan.
            </p>
          </div>
        </div>
      </header>

      <PayrollForm
        key={slip.updated_at}
        mode="edit"
        slip={slip}
        submitting={updateMutation.isPending}
        submitLabel="Simpan perubahan"
        cancelHref={`${PAYROLL_PATH}/${id}`}
        onSubmit={handleSubmit}
      />
    </Shell>
  );
}
