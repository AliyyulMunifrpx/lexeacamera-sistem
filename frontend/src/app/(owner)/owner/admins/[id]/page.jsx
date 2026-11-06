"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useParams } from "next/navigation.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiInfo,
  FiLoader,
  FiMail,
  FiRefreshCw,
  FiSave,
  FiShield,
} from "react-icons/fi";

import {
  useGetAdmin,
  useResendAdminInvite,
  useUpdateAdmin,
} from "../../../../features/admins/hooks.js";
import notify from "../../../../../lib/notify.js";
import { normalizeApiError } from "../../../../../lib/api/errors.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const ADMINS_PATH = "/owner/admins";
const RESEND_COOLDOWN_SECONDS = 60;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

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

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-second/60">{label}</dt>
      <dd className="min-w-0 text-right font-semibold tabular-nums text-second">
        {children}
      </dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href={ADMINS_PATH}
      className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
    >
      <FiArrowLeft size={16} aria-hidden="true" />
      Semua admin
    </Link>
  );
}

/* -------------------------------- Switch --------------------------------- */

function Switch({ id, label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-second/30 p-4">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-semibold text-second">
          {label}
        </p>
        <p
          id={`${id}-desc`}
          className="mt-2 text-xs leading-relaxed text-second/60"
        >
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? "bg-grad" : "bg-second/20"
        } ${FOCUS_RING}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-5 rounded-full bg-primary shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-12 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
      </div>
    </div>
  );
}

/* ------------------------------- Form edit ------------------------------- */

function AdminForm({ admin }) {
  const updateMutation = useUpdateAdmin();
  const busy = updateMutation.isPending;

  const originalActive = Boolean(admin.is_active);
  const originalAttendance = Boolean(admin.attendance?.enabled);

  const [isActive, setIsActive] = useState(originalActive);
  const [attendance, setAttendance] = useState(originalAttendance);
  const [formError, setFormError] = useState("");

  const activeChanged = isActive !== originalActive;
  const attendanceChanged = isActive && attendance !== originalAttendance;
  const dirty = activeChanged || attendanceChanged;

  function toggleActive() {
    setIsActive((value) => {
      const next = !value;
      if (!next) setAttendance(false);
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!dirty) return;

    const data = {
      ...(activeChanged && { is_active: isActive }),
      ...(attendanceChanged && { attendance }),
    };

    try {
      await updateMutation.mutateAsync({ id: admin.id, data });
      notify.success("Perubahan disimpan.");
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "ADMIN_NOT_FOUND") {
        notify.error("Admin tidak ditemukan.");
        return;
      }
      if (code === "ADMIN_INACTIVE") {
        setFormError(
          "Aktifkan admin terlebih dahulu sebelum menyalakan absen.",
        );
        return;
      }
      if (code === "EMAIL_ALREADY_USED") {
        setFormError(
          "Email karyawan lama admin ini sudah terhubung ke akun lain.",
        );
        return;
      }

      setFormError(normalizeApiError(err).message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
    >
      <div>
        <h2 className="text-lg font-bold text-second">Akses & absen</h2>
        <p className="mt-2 text-pretty text-sm text-second/60">
          Hanya perubahan yang akan dikirim.
        </p>
      </div>

      <dl className="divide-y divide-second/10 rounded-xl bg-second/[0.03] px-4">
        <InfoRow label="Nama">{admin.name}</InfoRow>
        <InfoRow label="Email">
          <span className="break-all">{admin.email}</span>
        </InfoRow>
      </dl>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-second/60">
        <FiInfo size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Nama diubah oleh admin sendiri lewat pengaturan akunnya, dan email tidak
        bisa diubah.
      </p>

      <Switch
        id="admin-active"
        label="Akun aktif"
        description="Jika dinonaktifkan, admin tidak bisa login, semua sesinya langsung ditolak, dan absennya ikut mati. Mengaktifkan lagi tidak otomatis menyalakan absen."
        checked={isActive}
        onChange={toggleActive}
        disabled={busy}
      />

      <Switch
        id="admin-attendance"
        label="Ikut absen"
        description={
          isActive
            ? "Admin tercatat sebagai karyawan. Mematikannya tidak menghapus PIN dan riwayat absen."
            : "Aktifkan akun terlebih dahulu untuk mengatur absen."
        }
        checked={attendance}
        onChange={() => setAttendance((value) => !value)}
        disabled={busy || !isActive}
      />

      {!isActive && originalActive && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-xs text-second2"
        >
          <FiAlertTriangle
            size={14}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          Saat disimpan, {admin.name} langsung tidak bisa login dan absennya
          dimatikan.
        </p>
      )}

      {formError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
        >
          <FiAlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
        <Link
          href={ADMINS_PATH}
          className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 sm:w-auto ${FOCUS_RING}`}
        >
          Kembali
        </Link>

        <button
          type="submit"
          disabled={busy || !dirty}
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
              Menyimpan…
            </>
          ) : (
            <>
              <FiSave size={16} aria-hidden="true" />
              Simpan perubahan
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ Invite Panel ----------------------------- */

function InvitePanel({ admin }) {
  const resendMutation = useResendAdminInvite();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const busy = resendMutation.isPending;
  const accepted = admin.invite_accepted;
  const canResend = accepted === false && admin.is_active;

  async function handleResend() {
    try {
      const result = await resendMutation.mutateAsync(admin.id);
      setCooldown(RESEND_COOLDOWN_SECONDS);

      if (result?.email_sent === false) {
        notify.error("Email gagal terkirim. Coba lagi sebentar lagi.");
      } else {
        notify.success("Undangan dikirim ulang.");
      }
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "INVITE_ALREADY_ACCEPTED") {
        notify.error("Admin sudah membuat password.");
        resendMutation.reset();
        return;
      }
      if (code === "ADMIN_INACTIVE") {
        notify.error(
          "Admin nonaktif. Aktifkan dulu sebelum mengirim undangan.",
        );
        return;
      }
      if (code === "INVITE_RATE_LIMITED") {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        notify.error(
          "Batas pengiriman email tercapai. Coba lagi beberapa saat lagi.",
        );
        return;
      }
      if (code === "INVITE_FAILED") {
        notify.error("Undangan gagal dikirim. Coba lagi sebentar lagi.");
        return;
      }

      notify.error(normalizeApiError(err).message);
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
          <FiMail size={16} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-second">Undangan</h2>
      </div>

      <div>
        {accepted === true && <Tag tone="blue">Password sudah dibuat</Tag>}
        {accepted === false && <Tag tone="violet">Belum membuat password</Tag>}
        {accepted === null && <Tag tone="muted">Status tidak terbaca</Tag>}
      </div>

      <p className="text-sm leading-relaxed text-second/60">
        {accepted === true
          ? "Admin sudah bisa login seperti biasa."
          : accepted === false
            ? "Kirim ulang jika email tidak sampai atau tautannya kedaluwarsa."
            : "Status undangan tidak bisa dibaca saat ini, jadi pengiriman ulang tidak tersedia."}
      </p>

      {accepted === false && (
        <>
          <button
            type="button"
            onClick={handleResend}
            disabled={busy || cooldown > 0 || !canResend}
            aria-busy={busy}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
          >
            {busy ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Mengirim…
              </>
            ) : cooldown > 0 ? (
              <span className="tabular-nums">
                Kirim ulang dalam {cooldown} dtk
              </span>
            ) : (
              <>
                <FiMail size={16} aria-hidden="true" />
                Kirim ulang undangan
              </>
            )}
          </button>

          {!admin.is_active && (
            <p className="text-xs text-second/60">
              Aktifkan admin terlebih dahulu untuk mengirim undangan.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function AdminDetailPage() {
  const { id } = useParams();
  const {
    data: admin,
    isPending,
    isError,
    isFetching,
    error,
    refetch,
  } = useGetAdmin(id);

  const code = error?.response?.data?.errors;
  const notFound =
    isError && (code === "ADMIN_NOT_FOUND" || error?.response?.status === 404);

  if (isPending) {
    return <LoadingState />;
  }

  if (isError || !admin) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <BackLink />
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            {notFound ? "Admin tidak ditemukan" : "Gagal memuat admin"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            {notFound
              ? "Data admin mungkin sudah tidak ada."
              : normalizeApiError(error).message}
          </p>
          {!notFound && (
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              <FiRefreshCw
                size={16}
                className={
                  isFetching
                    ? "animate-spin motion-reduce:animate-none"
                    : "hidden"
                }
                aria-hidden="true"
              />
              {isFetching ? "Memuat…" : "Coba lagi"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const attendance = admin.attendance ?? {};

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <BackLink />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiShield size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-second/60">Detail admin</p>
              <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-second sm:text-3xl">
                {admin.name}
              </h1>
              <p className="mt-2 break-all text-sm text-second/60">
                {admin.email}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Tag tone={admin.is_active ? "blue" : "muted"}>
                  {admin.is_active ? "Aktif" : "Nonaktif"}
                </Tag>
                {attendance.enabled ? (
                  <Tag tone={attendance.pin_set ? "blue" : "violet"}>
                    {attendance.pin_set
                      ? "Absen aktif"
                      : "PIN absen belum dibuat"}
                  </Tag>
                ) : (
                  <Tag tone="muted">Tanpa absen</Tag>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <AdminForm
          key={`${admin.id}-${admin.is_active}-${attendance.enabled}`}
          admin={admin}
        />

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-16">
          <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
            <h2 className="text-lg font-bold text-second">Absen</h2>

            <dl className="divide-y divide-second/10">
              <InfoRow label="Ikut absen">
                {attendance.enabled ? "Ya" : "Tidak"}
              </InfoRow>
              <InfoRow label="PIN absen">
                {attendance.pin_set ? (
                  <Tag tone="blue">Sudah dibuat</Tag>
                ) : (
                  <Tag tone="violet">Belum dibuat</Tag>
                )}
              </InfoRow>
            </dl>

            <p className="text-xs leading-relaxed text-second/60">
              Admin membuat PIN absennya sendiri. Pemilik toko tidak dapat
              melihat atau mengatur PIN.
            </p>
          </section>

          <InvitePanel admin={admin} />
        </aside>
      </div>
    </div>
  );
}
