"use client";

import Link from "next/link.js";
import { useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiClipboard,
  FiRefreshCw,
} from "react-icons/fi";

import {
  useCreateQualityControl,
  useGetQcItems,
} from "../../../../features/qc/hooks.js";
import QcForm from "../../../../../components/owner/qc-form.jsx";
import {
  BTN_PRIMARY,
  FOCUS_RING,
  describeQcError,
} from "../../../../../components/owner/qc-shared.jsx";
import notify from "../../../../../lib/notify.js";
const QC_PATH = "/admin/quality-controls";

export default function CreateQcPage() {
  const router = useRouter();
  const itemsQuery = useGetQcItems({ is_active: true });
  const createMutation = useCreateQualityControl();

  async function handleSubmit(payload) {
    try {
      const created = await createMutation.mutateAsync(payload);
      notify.success("QC disimpan. Tambahkan foto atau video di sini.");
      router.push(`${QC_PATH}/${created.id}`);
    } catch (err) {
      notify.error(describeQcError(err));
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
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiClipboard size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Buat <span className="text-grad">QC</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Isi data unit dan checklist. Item yang tidak diubah tercatat
              sebagai default (tidak rusak, normal, tidak ada).
            </p>
          </div>
        </div>
      </header>

      {itemsQuery.isPending ? (
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
      ) : itemsQuery.isError ? (
        <div className="flex flex-col items-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertCircle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <p className="mt-4 text-lg font-bold text-second">
            Gagal memuat item checklist
          </p>
          <button
            type="button"
            onClick={() => itemsQuery.refetch()}
            className={`${BTN_PRIMARY} mt-4`}
          >
            <FiRefreshCw size={16} aria-hidden="true" />
            Coba lagi
          </button>
        </div>
      ) : (
        <QcForm
          mode="create"
          items={itemsQuery.data ?? []}
          submitting={createMutation.isPending}
          submitLabel="Simpan QC"
          cancelHref={QC_PATH}
          isAdmin={isAdmin}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
