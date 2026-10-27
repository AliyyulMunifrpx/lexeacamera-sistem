"use client";

import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiRefreshCw,
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
import EmailConfirmationModal from "../../../../components/admin/email-confirmation-modal.jsx";
import { useRouter } from "next/navigation.js";

const INPUT_CLASS =
  "w-full rounded-xl border border-second/20 bg-primary px-4 py-3 text-sm text-second outline-none transition placeholder:text-second/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

function LoadingState() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-36 rounded-2xl bg-second/10" />
      <div className="h-64 rounded-2xl bg-second/10" />
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 px-5 py-12 text-center">
      <FiAlertCircle size={32} className="text-red-400" />

      <h2 className="mt-4 font-semibold">Gagal Memuat Informasi Akun</h2>

      <p className="mt-2 max-w-md text-sm leading-relaxed text-second/65">
        Periksa koneksi atau sesi Anda, lalu coba kembali.
      </p>

      <button
        type="button"
        onClick={onRetry}
        disabled={isFetching}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-second/25 px-4 py-2.5 text-sm font-medium transition hover:bg-second/10 disabled:opacity-50"
      >
        <FiRefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
        {isFetching ? "Memuat..." : "Coba Lagi"}
      </button>
    </div>
  );
}

function AccountField({ icon: Icon, label, value, onEdit, masked = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
        <Icon size={19} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-second/60">{label}</p>

        <p className="mt-1 break-words text-sm font-medium">
          {masked ? (
            <span aria-label="Password tidak ditampilkan">••••••••</span>
          ) : (
            value || "-"
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-second px-3 py-2 text-sm text-primary font-medium transition hover:bg-second/80"
      >
        <FiEdit2 size={15} />
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
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
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
          className={`${INPUT_CLASS} pr-12`}
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
          className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-second/50 transition-colors hover:text-second"
        >
          {showPassword ? <FiEyeOff size={19} /> : <FiEye size={19} />}
        </button>
      </div>
    </div>
  );
}

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

  if (!type) return null;

  const config = {
    name: {
      title: "Ubah Nama",
      description: "Perbarui nama yang ditampilkan pada akun dan sidebar.",
      submitLabel: "Simpan Nama",
    },
    email: {
      title: "Ubah Email",
      description:
        "Link verifikasi akan dikirim sesuai konfigurasi autentikasi. Email baru tidak langsung aktif sebelum verifikasi selesai.",
      submitLabel: "Ajukan Perubahan Email",
    },
    password: {
      title: "Ubah Password",
      description:
        "Masukkan password saat ini untuk memverifikasi identitas sebelum menggantinya.",
      submitLabel: "Simpan Password Baru",
    },
  }[type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-account-title"
        className="my-auto w-full max-w-md rounded-2xl border border-second/20 bg-primary text-second shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-second/15 p-5">
          <div>
            <h2 id="edit-account-title" className="text-lg font-semibold">
              {config.title}
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-second/65">
              {config.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup modal"
            className="rounded-lg p-2 transition hover:bg-second/10 disabled:opacity-50"
          >
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-5">
          {type === "name" && (
            <div>
              <label
                htmlFor="account-name"
                className="mb-2 block text-sm font-medium"
              >
                Nama
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
                placeholder="Masukkan nama"
                className={INPUT_CLASS}
              />
            </div>
          )}

          {type === "email" && (
            <div>
              <label
                htmlFor="account-email"
                className="mb-2 block text-sm font-medium"
              >
                Email baru
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
                className={INPUT_CLASS}
              />

              <p className="mt-2 text-xs text-second/55">
                Email saat ini: {currentUser?.email || "-"}
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

          <div className="flex flex-col-reverse gap-3 border-t border-second/15 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-second/25 px-5 py-2.5 text-sm font-medium transition hover:bg-second/10 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-second px-5 py-2.5 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Memproses..." : config.submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

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

  const router = useRouter();
  const [editType, setEditType] = useState(null);

  const [values, setValues] = useState({
    name: "",
    email: "",
    current_password: "",
    new_password: "",
  });

  const isSaving =
    updateNameMutation.isPending ||
    updateEmailMutation.isPending ||
    updatePasswordMutation.isPending;

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

        const result = await updateEmailMutation.mutateAsync({
          email,
        });

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
        });

        router.push("/auth/login");
        return;
      }

      setEditType(null);
      setValues({
        name: "",
        email: "",
        current_password: "",
        new_password: "",
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
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
  }

  if (!currentUser) return null;

  return (
    <div className="space-y-7 pb-8 text-second">
      <div>
        <h1 className="text-2xl font-bold">Akun Saya</h1>

        <p className="mt-1 text-sm text-second/65">
          Kelola nama, email, dan password akun Anda.
        </p>
      </div>

      <section className="rounded-2xl border border-second/15 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
            <FiUser size={30} />
          </div>

          <div className="min-w-0">
            <p className="text-sm text-second/60">Akun aktif</p>

            <h2 className="mt-1 break-words text-xl font-bold">
              {currentUser.name || "Nama belum tersedia"}
            </h2>

            <p className="mt-1 break-words text-sm text-second/60">
              {currentUser.email || "-"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-2xl border border-second/15 p-5 sm:p-6">
        <h2 className="text-base font-semibold">Informasi Akun</h2>

        <div className="space-y-6 border-t border-second/15 pt-5">
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
        </div>
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
