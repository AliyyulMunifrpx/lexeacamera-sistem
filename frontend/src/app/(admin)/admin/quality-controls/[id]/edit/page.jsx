"use client";

import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiClipboard,
  FiRefreshCw,
} from "react-icons/fi";

import {
  useGetQcItems,
  useGetQualityControl,
  useUpdateQualityControl,
} from "../../../../../features/qc/hooks.js";
import QcForm from "../../../../../../components/owner/qc-form.jsx";
import {
  BTN_PRIMARY,
  FOCUS_RING,
  describeQcError,
} from "../../../../../../components/owner/qc-shared.jsx";
import notify from "../../../../../../lib/notify.js";

const QC_PATH = "/admin/quality-controls";

export default function EditQcPage() {
  const { id } = useParams();
  const router = useRouter();

  const qcQuery = useGetQualityControl(id);
  const itemsQuery = useGetQcItems({ is_active: true });
  const updateMutation = useUpdateQualityControl();

  async function handleSubmit(data) {
    try {
      await updateMutation.mutateAsync({ id, data });
      notify.success("QC diperbarui.");
      router.replace(`${QC_PATH}/${id}`);
    } catch (err) {
      notify.error(describeQcError(err));
    }
  }

  const loading = qcQuery.isPending || itemsQuery.isPending;
  const failed = qcQuery.isError || itemsQuery.isError;
  const notFound = qcQuery.error?.response?.data?.errors === "QC_NOT_FOUND";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={`${QC_PATH}/${id}`}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke detail
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
              Ubah <span className="text-grad">QC</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Checklist dan tambahan disimpan sebagai satu kesatuan: seluruh isi
              lama diganti dengan isi form ini. Status diubah dari halaman
              detail.
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
      ) : failed || !qcQuery.data ? (
        <div className="flex flex-col items-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertCircle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <p className="mt-4 text-lg font-bold text-second">
            {notFound ? "QC tidak ditemukan" : "Gagal memuat QC"}
          </p>
          {!notFound && (
            <button
              type="button"
              onClick={() => {
                qcQuery.refetch();
                itemsQuery.refetch();
              }}
              className={`${BTN_PRIMARY} mt-4`}
            >
              <FiRefreshCw size={16} aria-hidden="true" />
              Coba lagi
            </button>
          )}
        </div>
      ) : (
        <QcForm
          key={qcQuery.data.updated_at}
          mode="edit"
          qc={qcQuery.data}
          items={itemsQuery.data ?? []}
          submitting={updateMutation.isPending}
          submitLabel="Simpan perubahan"
          cancelHref={`${QC_PATH}/${id}`}
          isAdmin
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
