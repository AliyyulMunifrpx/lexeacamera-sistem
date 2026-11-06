"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiKey,
  FiLock,
  FiLoader,
  FiMail,
  FiRefreshCw,
  FiShield,
  FiUser,
  FiX,
} from "react-icons/fi";

import {
  useGetCurrentUser,
  useUpdateCurrentName,
  useUpdateCurrentEmail,
  useUpdateCurrentPassword,
} from "../../../features/users/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import EmailConfirmationModal from "../../../../components/owner/email-confirmation-modal.jsx";
import { useUpdateCurrentPin } from "../../../features/admin-pin/hooks.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------- Formatters ----------------------------- */

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline", icon: Icon }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

function ErrorText({ id, children }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      notify.success(`${label} disalin.`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Gagal menyalin ke clipboard.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Salin ${label}`}
      className={`shrink-0 rounded-xl p-2 text-second/60 transition-colors hover:bg-second/10 hover:text-second ${FOCUS_RING}`}
    >
      {copied ? (
        <FiCheck size={14} aria-hidden="true" />
      ) : (
        <FiCopy size={14} aria-hidden="true" />
      )}
    </button>
  );
}

function DetailItem({ label, children, mono = false, copyable = false }) {
  const hasValue =
    children !== undefined && children !== null && children !== "";

  return (
    <div className="min-w-0 space-y-2">
      <dt className="text-xs text-second/60">{label}</dt>
      <dd
        className={`flex min-w-0 items-center gap-2 text-sm font-semibold text-second ${
          mono ? "font-mono" : ""
        }`}
      >
        <span className="min-w-0 break-words">{hasValue ? children : "—"}</span>
        {copyable && hasValue && <CopyButton value={children} label={label} />}
      </dd>
    </div>
  );
}

function AccountField({ icon: Icon, label, value, onEdit, masked = false }) {
  return (
    <div className="flex min-w-0 items-start gap-4">
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
      >
        <Icon size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-second/60">{label}</p>
        <p className="mt-2 break-words text-sm font-semibold text-second">
          {masked ? (
            <span aria-label={`${label} tidak ditampilkan`}>••••••••</span>
          ) : (
            value || "—"
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className={`${BTN_BASE} shrink-0 border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
      >
        <FiEdit2 size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Edit</span>
      </button>
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  showPassword,
  onToggleVisibility,
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
        <span className="ml-2 text-second2" aria-hidden="true">
          *
        </span>
      </label>

      <div className="relative">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`${inputClass(false)} pr-12`}
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={
            showPassword
              ? `Sembunyikan ${label.toLowerCase()}`
              : `Tampilkan ${label.toLowerCase()}`
          }
          aria-pressed={showPassword}
          className={`absolute inset-y-0 right-0 flex items-center justify-center px-4 text-second/50 transition-colors hover:text-second4 ${FOCUS_RING}`}
        >
          {showPassword ? (
            <FiEyeOff size={16} aria-hidden="true" />
          ) : (
            <FiEye size={16} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

function PinInput({
  id,
  label,
  value,
  onChange,
  showPin,
  onToggleVisibility,
  disabled,
  hasError,
  describedBy,
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
        <span className="ml-2 text-second2" aria-hidden="true">
          *
        </span>
      </label>

      <div className="relative">
        <input
          id={id}
          type={showPin ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={onChange}
          required
          maxLength={6}
          placeholder="••••"
          disabled={disabled}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={describedBy}
          className={`${inputClass(hasError)} pr-12 text-center text-lg font-semibold tracking-[0.5em] tabular-nums`}
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={showPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
          aria-pressed={showPin}
          disabled={disabled}
          className={`absolute inset-y-0 right-0 flex items-center justify-center px-4 text-second/50 transition-colors hover:text-second4 disabled:opacity-50 ${FOCUS_RING}`}
        >
          {showPin ? (
            <FiEyeOff size={16} aria-hidden="true" />
          ) : (
            <FiEye size={16} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Skeleton -------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="min-w-0 space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-second/10" />
        <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
      </header>
      <div className="h-32 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-48 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

/* ----------------------------- Edit Modal -------------------------------- */

function EditAccountModal({
  type,
  currentUser,
  values,
  setValues,
  isSaving,
  onClose,
  onSubmit,
}) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (!type) return;
    function handleKey(event) {
      if (event.key === "Escape" && !isSaving) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [type, isSaving, onClose]);

  if (!type) return null;

  const isPinSet = Boolean(currentUser?.attendance?.pin_set);

  const config = {
    name: {
      title: "Ubah Nama",
      description: "Perbarui nama yang ditampilkan pada akun dan sidebar.",
      submitLabel: "Simpan Nama",
      icon: FiUser,
    },
    email: {
      title: "Ubah Email",
      description:
        "Link verifikasi akan dikirim sesuai konfigurasi autentikasi. Email baru tidak langsung aktif sebelum verifikasi selesai.",
      submitLabel: "Ajukan Perubahan Email",
      icon: FiMail,
    },
    password: {
      title: "Ubah Password",
      description:
        "Masukkan password saat ini untuk memverifikasi identitas sebelum menggantinya.",
      submitLabel: "Simpan Password Baru",
      icon: FiLock,
    },
    pin: {
      title: isPinSet ? "Ganti PIN Absen" : "Buat PIN Absen",
      description:
        "PIN dipakai untuk absen di toko. Masukkan password akun untuk verifikasi. PIN lama (jika ada) akan diganti.",
      submitLabel: "Simpan PIN",
      icon: FiKey,
    },
  }[type];

  const Icon = config.icon;

  const pinIsInvalid =
    type === "pin" && values.pin !== "" && !/^\d{4,6}$/.test(values.pin);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-account-title"
        className="w-full max-w-md rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <Icon size={16} />
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup modal"
            className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="edit-account-title"
          className="mt-4 text-lg font-bold text-second"
        >
          {config.title}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-second/60">
          {config.description}
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          {type === "name" && (
            <div className="min-w-0">
              <label htmlFor="account-name" className={labelClass}>
                Nama
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </label>

              <input
                id="account-name"
                type="text"
                value={values.name}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                maxLength={100}
                autoComplete="name"
                placeholder="Masukkan nama…"
                className={inputClass(false)}
                disabled={isSaving}
              />
            </div>
          )}

          {type === "email" && (
            <div className="min-w-0">
              <label htmlFor="account-email" className={labelClass}>
                Email baru
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </label>

              <input
                id="account-email"
                type="email"
                value={values.email}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                required
                maxLength={254}
                autoComplete="email"
                placeholder="nama@email.com"
                className={inputClass(false)}
                disabled={isSaving}
              />

              <p className="mt-2 text-xs text-second/60">
                Email saat ini:{" "}
                <span className="font-semibold text-second">
                  {currentUser?.email || "—"}
                </span>
              </p>
            </div>
          )}

          {type === "password" && (
            <>
              <PasswordInput
                id="current-password"
                label="Password Saat Ini"
                value={values.current_password}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    current_password: event.target.value,
                  }))
                }
                autoComplete="current-password"
                placeholder="Masukkan password saat ini"
                showPassword={showCurrentPassword}
                onToggleVisibility={() =>
                  setShowCurrentPassword((prev) => !prev)
                }
              />

              <PasswordInput
                id="new-password"
                label="Password Baru"
                value={values.new_password}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    new_password: event.target.value,
                  }))
                }
                autoComplete="new-password"
                placeholder="Masukkan password baru"
                showPassword={showNewPassword}
                onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
              />
            </>
          )}

          {type === "pin" && (
            <>
              <PinInput
                id="account-pin"
                label="PIN Absen"
                value={values.pin}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    pin: event.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
                showPin={showPin}
                onToggleVisibility={() => setShowPin((prev) => !prev)}
                disabled={isSaving}
                hasError={pinIsInvalid}
                describedBy="account-pin-hint"
              />

              {pinIsInvalid ? (
                <ErrorText id="account-pin-error">
                  PIN harus 4 sampai 6 digit angka.
                </ErrorText>
              ) : (
                <p id="account-pin-hint" className="text-xs text-second/60">
                  4 sampai 6 digit angka. Jangan bagikan PIN ke siapa pun.
                </p>
              )}

              <div className="min-w-0">
                <label htmlFor="pin-current-password" className={labelClass}>
                  Password Akun
                  <span className="ml-2 text-second2" aria-hidden="true">
                    *
                  </span>
                </label>

                <div className="relative">
                  <input
                    id="pin-current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={values.current_password}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        current_password: event.target.value,
                      }))
                    }
                    required
                    autoComplete="current-password"
                    placeholder="Masukkan password akun"
                    className={`${inputClass(false)} pr-12`}
                    disabled={isSaving}
                  />

                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={
                      showCurrentPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    aria-pressed={showCurrentPassword}
                    className={`absolute inset-y-0 right-0 flex items-center justify-center px-4 text-second/50 transition-colors hover:text-second4 ${FOCUS_RING}`}
                  >
                    {showCurrentPassword ? (
                      <FiEyeOff size={16} aria-hidden="true" />
                    ) : (
                      <FiEye size={16} aria-hidden="true" />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-xs text-second/60">
                  Password login akun ini, untuk memastikan yang mengganti PIN
                  benar pemilik akun.
                </p>
              </div>
            </>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
            >
              {isSaving ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Memproses…
                </>
              ) : (
                config.submitLabel
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function AccountPage() {
  const {
    data: currentUser,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useGetCurrentUser();

  const [emailConfirmation, setEmailConfirmation] = useState(null);

  const updateNameMutation = useUpdateCurrentName();
  const updateEmailMutation = useUpdateCurrentEmail();
  const updatePasswordMutation = useUpdateCurrentPassword();
  const updatePinMutation = useUpdateCurrentPin();

  const router = useRouter();
  const [editType, setEditType] = useState(null);

  const [values, setValues] = useState({
    name: "",
    email: "",
    current_password: "",
    new_password: "",
    pin: "",
  });

  const isSaving =
    updateNameMutation.isPending ||
    updateEmailMutation.isPending ||
    updatePasswordMutation.isPending ||
    updatePinMutation.isPending;

  useEffect(() => {
    if (isError) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }, [isError, error]);

  function openEditor(type) {
    setValues({
      name: currentUser?.name || "",
      email: "",
      current_password: "",
      new_password: "",
      pin: "",
    });
    setEditType(type);
  }

  function closeEditor() {
    if (isSaving) return;
    setEditType(null);
    setValues({
      name: "",
      email: "",
      current_password: "",
      new_password: "",
      pin: "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      if (editType === "name") {
        const name = values.name.trim();
        if (!name) {
          notify.error("Nama wajib diisi.");
          return;
        }
        await updateNameMutation.mutateAsync({ name });
        notify.success("Nama akun berhasil diperbarui.");
      }

      if (editType === "email") {
        const email = values.email.trim();
        if (!email) {
          notify.error("Email baru wajib diisi.");
          return;
        }
        const result = await updateEmailMutation.mutateAsync({ email });
        if (result?.message === "EMAIL_UNCHANGED") {
          notify.success("Email yang dimasukkan sama dengan email saat ini.");
        } else {
          setEmailConfirmation(email);
        }
      }

      if (editType === "password") {
        if (!values.current_password || !values.new_password) {
          notify.error("Password saat ini dan password baru wajib diisi.");
          return;
        }
        await updatePasswordMutation.mutateAsync({
          current_password: values.current_password,
          new_password: values.new_password,
        });
        notify.success("Password berhasil diperbarui.");
        setEditType(null);
        setValues({
          name: "",
          email: "",
          current_password: "",
          new_password: "",
          pin: "",
        });
        router.push("/auth/login");
        return;
      }

      if (editType === "pin") {
        const pin = values.pin.trim();
        const currentPassword = values.current_password;

        if (!/^\d{4,6}$/.test(pin)) {
          notify.error("PIN harus 4 sampai 6 digit angka.");
          return;
        }
        if (!currentPassword) {
          notify.error("Masukkan password akun untuk verifikasi.");
          return;
        }

        try {
          await updatePinMutation.mutateAsync({
            pin,
            current_password: currentPassword,
          });
          notify.success("PIN absen berhasil disimpan.");
          setEditType(null);
          setValues({
            name: "",
            email: "",
            current_password: "",
            new_password: "",
            pin: "",
          });
        } catch (err) {
          const code = err?.response?.data?.errors;

          if (code === "CURRENT_PASSWORD_INVALID") {
            notify.error("Password akun salah. Periksa kembali.");
            return;
          }
          if (code === "ATTENDANCE_NOT_ENABLED") {
            notify.error(
              "Absen belum dinyalakan owner untuk akun ini. Hubungi owner.",
            );
            return;
          }

          notify.error(normalizeApiError(err).message);
        }
        return;
      }

      setEditType(null);
      setValues({
        name: "",
        email: "",
        current_password: "",
        new_password: "",
        pin: "",
      });
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Akun <span className="text-grad">Saya</span>
          </h1>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Kelola nama, email, dan password akun Anda.
          </p>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat informasi akun
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau sesi Anda, lalu coba kembali.
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

  if (!currentUser) return null;

  const roleLabel = currentUser.role ?? "Owner";
  const isOwner = String(roleLabel).toLowerCase() === "owner";
  const statusLabel = currentUser.is_active === false ? "Nonaktif" : "Aktif";
  const statusTone = currentUser.is_active === false ? "failure" : "success";

  const attendance = currentUser.attendance ?? {};
  const attendanceEnabled = Boolean(attendance.enabled);
  const pinSet = Boolean(attendance.pin_set);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiUser size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Akun <span className="text-grad">Saya</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Kelola nama, email, password, dan PIN absen akun Anda.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data akun"
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
        </div>
      </header>

      {/* Kartu profil */}
      <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiUser size={24} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={isOwner ? "strong" : "outline"} icon={FiShield}>
                {isOwner ? "Owner" : roleLabel}
              </Tag>
              <Tag tone={statusTone}>{statusLabel}</Tag>
              {attendanceEnabled && (
                <Tag tone={pinSet ? "success" : "pending"}>
                  {pinSet ? "PIN absen aktif" : "PIN absen belum dibuat"}
                </Tag>
              )}
            </div>
            <h2 className="mt-2 break-words text-xl font-bold text-second">
              {currentUser.name || "Nama belum tersedia"}
            </h2>
            <p className="mt-2 break-all text-sm text-second/60">
              {currentUser.email || "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Kartu informasi akun (editable) */}
      <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
        <div>
          <h2 className="text-lg font-bold text-second">Informasi akun</h2>
          <p className="mt-2 text-sm text-second/60">
            Perbarui nama, email, password, atau PIN absen akun Anda.
          </p>
        </div>

        <div className="flex flex-col gap-4 border-t border-second/30 pt-4">
          <AccountField
            icon={FiUser}
            label="Nama"
            value={currentUser.name}
            onEdit={() => openEditor("name")}
          />

          <AccountField
            icon={FiMail}
            label="Email"
            value={currentUser.email}
            onEdit={() => openEditor("email")}
          />

          <AccountField
            icon={FiLock}
            label="Password"
            masked
            onEdit={() => openEditor("password")}
          />

          {attendanceEnabled && (
            <AccountField
              icon={FiKey}
              label="PIN Absen"
              masked={pinSet}
              value={pinSet ? undefined : "PIN belum dibuat"}
              onEdit={() => openEditor("pin")}
            />
          )}
        </div>

        {!attendanceEnabled && (
          <p className="rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-xs leading-relaxed text-second4">
            Absen belum dinyalakan owner untuk akun ini. PIN absen hanya bisa
            dibuat setelah owner menyalakan absen.
          </p>
        )}
      </section>

      <EditAccountModal
        type={editType}
        currentUser={currentUser}
        values={values}
        setValues={setValues}
        isSaving={isSaving}
        onClose={closeEditor}
        onSubmit={handleSubmit}
      />

      <EmailConfirmationModal
        email={emailConfirmation}
        email_before={currentUser.email}
        onClose={() => setEmailConfirmation(null)}
      />
    </div>
  );
}
