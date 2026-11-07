"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiChevronLeft,
  FiChevronRight,
  FiInfo,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserPlus,
  FiX,
} from "react-icons/fi";

import {
  useCreateAdmin,
  useGetAdmins,
} from "../../../features/admins/hooks.js";
import { useFindEmployeeByEmail } from "../../../features/employees/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import PrimaryButton from "./../../../../components/primary-button";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const ADMIN_PATH = (id) => `/owner/admins/${id}`;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

function inputClass(hasError) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

const STATUS_FILTERS = [
  { value: "ALL", label: "Semua" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Nonaktif" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------------------- Formatters ------------------------------ */

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

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

function AdminTags({ admin }) {
  const attendance = admin.attendance ?? {};

  return (
    <div className="flex flex-wrap gap-2">
      <Tag tone={admin.is_active ? "blue" : "muted"}>
        {admin.is_active ? "Aktif" : "Nonaktif"}
      </Tag>

      {attendance.enabled ? (
        <Tag tone={attendance.pin_set ? "blue" : "violet"}>
          {attendance.pin_set ? "Absen aktif" : "PIN absen belum dibuat"}
        </Tag>
      ) : (
        <Tag tone="muted">Tanpa absen</Tag>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, featured = false }) {
  return (
    <article
      className={`flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:p-8 ${
        featured
          ? "bg-grad text-primary shadow-lg shadow-second4/25"
          : "border border-second/30 bg-primary text-second shadow-xl shadow-second/5"
      }`}
    >
      <h3 className="text-sm font-semibold">{label}</h3>
      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {value}
        </p>
        {hint && (
          <p
            className={`mt-2 text-xs tabular-nums ${featured ? "text-primary/90" : "text-second/60"}`}
          >
            {hint}
          </p>
        )}
      </div>
    </article>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
        <div className="h-8 w-40 animate-pulse rounded-xl bg-second/10" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

/* ------------------------- Invite Admin Dialog ---------------------------- */

function InviteAdminDialog({ onClose }) {
  const createMutation = useCreateAdmin();
  const busy = createMutation.isPending;

  const nameRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attendance, setAttendance] = useState(true);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  const normalizedEmail = email.trim().toLowerCase();
  const emailLooksValid = EMAIL_PATTERN.test(normalizedEmail);

  useEffect(() => {
    const timer = setTimeout(
      () => setLookupEmail(emailLooksValid ? normalizedEmail : ""),
      400,
    );

    return () => clearTimeout(timer);
  }, [normalizedEmail, emailLooksValid]);

  const lookup = useFindEmployeeByEmail(lookupEmail);
  const lookupPending =
    emailLooksValid && (lookupEmail !== normalizedEmail || lookup.isFetching);
  const existingEmployee =
    lookupEmail === normalizedEmail ? (lookup.data ?? null) : null;
  const lookupFailed = lookupEmail === normalizedEmail && lookup.isError;

  const attendanceForced = Boolean(existingEmployee);
  const effectiveAttendance = attendanceForced ? true : attendance;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nameRef.current?.focus();

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

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nextErrors = {};

    if (!trimmedName) nextErrors.name = "Nama wajib diisi.";
    else if (trimmedName.length > 100)
      nextErrors.name = "Nama maksimal 100 karakter.";

    if (!trimmedEmail) nextErrors.email = "Email wajib diisi.";
    else if (!EMAIL_PATTERN.test(trimmedEmail) || trimmedEmail.length > 254)
      nextErrors.email = "Format email tidak valid.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (lookupPending) {
      setFormError("Sedang memeriksa email. Coba lagi sebentar.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: trimmedName,
        email: trimmedEmail,
        attendance: effectiveAttendance,
      });

      notify.success(
        "Undangan dikirim. Admin membuat password lewat tautan di email.",
      );
      onClose();
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "EMAIL_ALREADY_USED") {
        setErrors({ email: "Email ini sudah dipakai." });
        return;
      }
      if (code === "INVITE_RATE_LIMITED") {
        setFormError(
          "Batas pengiriman email tercapai. Coba lagi beberapa saat lagi.",
        );
        return;
      }
      if (code === "INVITE_FAILED") {
        setFormError("Undangan gagal dikirim. Coba lagi sebentar lagi.");
        return;
      }
      if (code === "FRONTEND_URL_NOT_CONFIGURED") {
        setFormError("FRONTEND_URL belum dikonfigurasi di server.");
        return;
      }

      setFormError(normalizeApiError(err).message);
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
        aria-labelledby="invite-admin-title"
        onSubmit={handleSubmit}
        noValidate
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
            <FiUserPlus size={16} aria-hidden="true" />
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
          id="invite-admin-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Undang admin
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-second/60">
          Admin menerima email berisi tautan untuk membuat password, lalu login
          seperti biasa.
        </p>

        <div className="mt-8 space-y-4">
          <div className="min-w-0">
            <label htmlFor="admin-name" className={labelClass}>
              Nama
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="admin-name"
              ref={nameRef}
              type="text"
              name="name"
              autoComplete="off"
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Sari…"
              aria-invalid={errors.name ? "true" : undefined}
              aria-describedby={
                errors.name ? "admin-name-error" : "admin-name-note"
              }
              className={inputClass(Boolean(errors.name))}
            />
            {errors.name ? (
              <p
                id="admin-name-error"
                role="alert"
                className="mt-2 flex items-start gap-2 text-sm text-second2"
              >
                <FiAlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {errors.name}
              </p>
            ) : (
              <p id="admin-name-note" className="mt-2 text-xs text-second/60">
                Setelah diundang, nama hanya bisa diubah oleh admin sendiri.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="admin-email" className={labelClass}>
              Email
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="admin-email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              maxLength={254}
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="sari@example.com"
              aria-invalid={errors.email ? "true" : undefined}
              aria-describedby={
                errors.email ? "admin-email-error" : "admin-email-note"
              }
              className={inputClass(Boolean(errors.email))}
            />
            {errors.email ? (
              <p
                id="admin-email-error"
                role="alert"
                className="mt-2 flex items-start gap-2 text-sm text-second2"
              >
                <FiAlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {errors.email}
              </p>
            ) : (
              <p id="admin-email-note" className="mt-2 text-xs text-second/60">
                Email tidak bisa diubah setelah admin dibuat.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label
              className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
                attendanceForced
                  ? "border-second4/30 bg-second4/5"
                  : "border-second/30 hover:border-second/30"
              } ${attendanceForced ? "" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={effectiveAttendance}
                disabled={busy || attendanceForced}
                onChange={(event) => setAttendance(event.target.checked)}
                aria-describedby="admin-attendance-note"
                className={`mt-0.5 size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-second">
                  Ikut absen
                </span>
                <span
                  id="admin-attendance-note"
                  className="mt-2 block text-xs leading-relaxed text-second/60"
                >
                  {attendanceForced
                    ? "Wajib aktif karena email ini sudah terdaftar sebagai karyawan."
                    : "Admin juga tercatat sebagai karyawan dan membuat PIN absennya sendiri. Bisa diubah nanti."}
                </span>
              </span>
            </label>

            <div aria-live="polite" className="mt-2 space-y-2">
              {lookupPending && (
                <p className="flex items-center gap-2 text-xs text-second/60">
                  <FiLoader
                    size={12}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Memeriksa apakah email sudah terdaftar sebagai karyawan…
                </p>
              )}

              {attendanceForced && (
                <p className="flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-xs leading-relaxed text-second4">
                  <FiInfo
                    size={14}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Email ini sudah menjadi karyawan
                    {existingEmployee?.name
                      ? ` (${existingEmployee.name})`
                      : ""}
                    . Data karyawan itu akan dihubungkan ke akun admin ini, jadi
                    PIN dan riwayat absennya tetap dipakai.
                  </span>
                </p>
              )}

              {lookupFailed && (
                <p className="text-xs text-second2">
                  Gagal memeriksa data karyawan. Jika email ini sudah terdaftar
                  sebagai karyawan, pastikan “Ikut absen” dicentang.
                </p>
              )}
            </div>
          </div>
        </div>

        {formError && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
          >
            <FiAlertTriangle
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
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={busy}
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
                Mengirim…
              </>
            ) : (
              "Kirim undangan"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function AdminsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isPending, isError, isFetching, error, refetch } = useGetAdmins(
    {
      search,
      status,
      page: currentPage,
    },
  );

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const admins = data?.data ?? [];
  const paging = data?.paging;

  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? currentPage;
  const perPage = paging?.per_page ?? admins.length;
  const startItem = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, total);

  const activeCount = admins.filter((a) => a.is_active).length;
  const attendanceCount = admins.filter((a) => a.attendance?.enabled).length;

  const hasFilters = search !== "" || status !== "ALL";

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("ALL");
    setCurrentPage(1);
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiShield size={16} />
            </div>
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                <span className="text-grad">Admin</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Undang dan kelola admin toko.
              </p>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat admin
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi Anda, lalu coba kembali.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
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
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiShield size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              <span className="text-grad">Admin</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Undang dan kelola admin toko. Admin tidak dihapus, cukup
              dinonaktifkan.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui daftar"
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </button>

          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 sm:w-auto ${FOCUS_RING}`}
          >
            <FiPlus size={16} aria-hidden="true" />
            Undang admin
          </button>
        </div>
      </header>

      {isError && data && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <FiAlertTriangle size={16} aria-hidden="true" />
            Gagal memperbarui data. Menampilkan data terakhir.
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className={`${BTN_BASE} w-fit border border-second2/40 text-second2 hover:bg-second2/10 ${FOCUS_RING}`}
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Stat cards */}
      <section
        aria-label="Ringkasan admin"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          featured
          label="Total admin"
          value={formatNumber(total)}
          hint={hasFilters ? "Sesuai filter" : "Semua admin"}
        />
        <StatCard
          label="Aktif"
          value={formatNumber(activeCount)}
          hint="Pada halaman ini"
        />
        <StatCard
          label="Ikut absen"
          value={formatNumber(attendanceCount)}
          hint="Pada halaman ini"
        />
      </section>

      {/* Filter */}
      <section
        aria-label="Filter admin"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Filter</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Cari admin berdasarkan nama atau email, atau filter berdasarkan
            status.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="admin-search" className={labelClass}>
              Cari admin
            </label>
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                id="admin-search"
                type="search"
                name="search"
                autoComplete="off"
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari nama atau email…"
                className={`${inputClass(false)} pl-8`}
              />
            </div>
          </div>

          <div role="group" aria-label="Filter status" className="flex gap-2">
            {STATUS_FILTERS.map((item) => {
              const active = status === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStatus(item.value);
                    setCurrentPage(1);
                  }}
                  className={`${BTN_BASE} ${
                    active
                      ? "bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90"
                      : "border border-second/30 text-second hover:border-second4 hover:text-second4"
                  } ${FOCUS_RING}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* List header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar admin</h2>
          <p
            className="mt-2 text-sm tabular-nums text-second/60"
            aria-live="polite"
          >
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(total)} admin
          </p>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="strong">Filter aktif</Tag>
            <button
              type="button"
              onClick={resetFilters}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
            >
              <FiX size={16} aria-hidden="true" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="relative min-h-40">
        {isFetching && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px]"
          >
            <div className="flex items-center gap-2 rounded-xl border border-second/30 bg-primary px-4 py-2 shadow-xl shadow-second/5">
              <FiLoader
                className="animate-spin motion-reduce:animate-none text-second4"
                size={16}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-second">
                Memperbarui data…
              </span>
            </div>
          </div>
        )}

        {admins.length > 0 ? (
          <div
            className={`transition-opacity duration-200 ${isFetching ? "opacity-40" : "opacity-100"}`}
          >
            {/* Tabel desktop */}
            <div className="hidden overflow-hidden rounded-2xl bg-primary shadow-xl shadow-second/5 md:block">
              <table className="min-w-full text-left">
                <thead className="bg-grad text-sm text-primary">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Nama
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold"
                    >
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-second/10">
                  {admins.map((admin, i) => (
                    <tr
                      key={admin.id}
                      className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                    >
                      <td className="px-4 py-4 text-sm font-semibold text-second">
                        {admin.name}
                      </td>
                      <td className="max-w-72 truncate px-4 py-4 text-sm text-second/70">
                        {admin.email}
                      </td>
                      <td className="px-4 py-4">
                        <AdminTags admin={admin} />
                      </td>

                      <td className="px-4 py-4 text-right">
                        <PrimaryButton href={ADMIN_PATH(admin.id)}>
                          Detail
                          <FiChevronRight size={16} aria-hidden="true" />
                        </PrimaryButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card mobile */}
            <ul className="flex flex-col gap-4 md:hidden">
              {admins.map((admin) => (
                <li key={admin.id}>
                  <Link
                    href={ADMIN_PATH(admin.id)}
                    className={`group block min-w-0 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-second group-hover:text-second4">
                          {admin.name}
                        </p>
                        <p className="mt-2 break-all text-xs text-second/60">
                          {admin.email}
                        </p>
                      </div>
                      <FiChevronRight
                        size={18}
                        className="mt-0.5 shrink-0 text-second/40"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-4">
                      <AdminTags admin={admin} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiShield size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters ? "Admin tidak ditemukan" : "Belum ada admin"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada admin yang sesuai dengan pencarian atau filter."
                : "Undang admin pertama untuk membantu mengelola toko."}
            </p>
            <button
              type="button"
              onClick={hasFilters ? resetFilters : () => setShowInvite(true)}
              className={`${BTN_BASE} mt-4 ${
                hasFilters
                  ? "border border-second/30 text-second hover:border-second2 hover:text-second2"
                  : "bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90"
              } ${FOCUS_RING}`}
            >
              {hasFilters ? (
                "Reset filter"
              ) : (
                <>
                  <FiPlus size={16} aria-hidden="true" />
                  Undang admin
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Paginasi */}
      {total > 0 && (
        <nav
          aria-label="Paginasi admin"
          className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm tabular-nums text-second/60">
            Halaman {formatNumber(safePage)} dari {formatNumber(totalPages)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className={`${BTN_BASE} flex-1 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>

            <button
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className={`${BTN_BASE} flex-1 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              Berikutnya
              <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}

      {showInvite && <InviteAdminDialog onClose={() => setShowInvite(false)} />}
    </div>
  );
}
