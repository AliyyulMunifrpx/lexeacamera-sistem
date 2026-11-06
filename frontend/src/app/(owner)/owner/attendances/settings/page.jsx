"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCheck,
  FiEdit2,
  FiInfo,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiWifi,
  FiX,
} from "react-icons/fi";

import {
  useCreateAttendanceNetwork,
  useDeleteAttendanceNetwork,
  useGetAttendanceNetworks,
  useGetAttendanceSettings,
  useGetMyIp,
  useUpdateAttendanceNetwork,
  useUpdateAttendanceSettings,
} from "../../../../features/attendances/hooks.js";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const MAX_NETWORKS = 20;
const BACK_PATH = "/owner/attendances";

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

const NETWORK_ERRORS = {
  INVALID_CIDR: [
    "cidr",
    "Alamat IP tidak valid. Contoh: 203.0.113.7 atau 203.0.113.0/24.",
  ],
  CIDR_TOO_BROAD: [
    "cidr",
    "Jangkauan terlalu luas. IPv4 minimal /16 dan IPv6 minimal /48.",
  ],
  NETWORK_ALREADY_EXISTS: ["cidr", "Jaringan ini sudah terdaftar."],
  NETWORK_LIMIT_REACHED: [
    "form",
    `Jumlah jaringan sudah mencapai batas (${MAX_NETWORKS}). Hapus yang tidak terpakai dulu.`,
  ],
  STORE_NOT_READY: [
    "form",
    "Data toko belum diisi. Lengkapi profil toko terlebih dahulu.",
  ],
};

/* -------------------------------- Formatters ------------------------------ */

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function ipv4ToInt(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

function ipv4InCidr(ip, cidr) {
  const [base, prefixText] = String(cidr).split("/");
  const prefix = Number(prefixText);
  const ipValue = ipv4ToInt(ip);
  const baseValue = ipv4ToInt(base);

  if (ipValue === null || baseValue === null) return false;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  if (prefix === 0) return true;

  const size = 2 ** (32 - prefix);
  return Math.floor(ipValue / size) === Math.floor(baseValue / size);
}

function describeCidr(cidr) {
  const value = String(cidr ?? "").trim();
  if (!value) return null;

  const isV6 = value.includes(":");
  const prefix = value.includes("/")
    ? Number(value.split("/")[1])
    : isV6
      ? 128
      : 32;

  if (Number.isNaN(prefix)) return null;

  if (!isV6) {
    if (prefix === 32) return "Satu alamat IP saja.";
    const hosts = 2 ** (32 - prefix);
    return `Mencakup sekitar ${new Intl.NumberFormat("id-ID").format(hosts)} alamat IP.`;
  }

  return prefix >= 128
    ? "Satu alamat IP saja."
    : "Mencakup satu blok alamat IPv6.";
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline", icon: Icon }) {
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
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

function Switch({ checked, onChange, disabled, label, describedBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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
  );
}

function StatCard({ icon: Icon, label, value, hint, featured = false }) {
  return (
    <article
      className={`flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:p-8 ${
        featured
          ? "bg-grad text-primary shadow-lg shadow-second4/25"
          : "border border-second/30 bg-primary text-second shadow-xl shadow-second/5"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
            featured
              ? "bg-primary text-second"
              : "bg-grad text-primary shadow-lg shadow-second4/25"
          }`}
        >
          <Icon size={16} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>
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

function SectionCard({ icon: Icon, title, description, aside, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <Icon size={16} />
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
        {aside}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Modal({ titleId, onClose, busy, children }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
      >
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  tone = "danger",
  busy,
  error,
  onClose,
  onConfirm,
}) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <Modal titleId="confirm-title" onClose={onClose} busy={busy}>
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
            tone === "danger"
              ? "bg-second2 text-primary shadow-lg shadow-second2/25"
              : "bg-second4 text-primary shadow-lg shadow-second4/25"
          }`}
        >
          {tone === "danger" ? (
            <FiTrash2 size={16} aria-hidden="true" />
          ) : (
            <FiAlertTriangle size={16} aria-hidden="true" />
          )}
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Tutup dialog"
          className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
        >
          <FiX size={16} aria-hidden="true" />
        </button>
      </div>

      <h2 id="confirm-title" className="mt-4 text-lg font-bold text-second">
        {title}
      </h2>

      <div className="mt-2 text-sm leading-relaxed text-second/60">
        {children}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
        >
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
        >
          Batal
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`${BTN_BASE} w-full sm:w-auto ${
            tone === "danger"
              ? "bg-second2 text-primary shadow-lg shadow-second2/25"
              : "bg-grad text-primary shadow-lg shadow-second4/25"
          } hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {busy ? (
            <>
              <FiLoader
                className="animate-spin motion-reduce:animate-none"
                size={16}
                aria-hidden="true"
              />
              {busyLabel}
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}

function EditNetworkDialog({ network, busy, error, onClose, onSubmit }) {
  const [label, setLabel] = useState(network.label ?? "");
  const [cidr, setCidr] = useState(network.cidr ?? "");
  const [errors, setErrors] = useState({});

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};
    if (!label.trim()) nextErrors.label = "Nama jaringan tidak boleh kosong.";
    if (!cidr.trim()) nextErrors.cidr = "Alamat IP tidak boleh kosong.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const data = {};
    if (label.trim() !== (network.label ?? "")) data.label = label.trim();
    if (cidr.trim() !== network.cidr) data.cidr = cidr.trim();

    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }

    onSubmit(data);
  }

  const cidrError = errors.cidr || error?.cidr;

  return (
    <Modal titleId="edit-network-title" onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
            <FiEdit2 size={16} aria-hidden="true" />
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
          id="edit-network-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Ubah jaringan
        </h2>

        <div className="mt-8 space-y-4">
          <div className="min-w-0">
            <label htmlFor="edit-label" className={labelClass}>
              Nama jaringan
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="edit-label"
              value={label}
              maxLength={100}
              disabled={busy}
              autoFocus
              autoComplete="off"
              onChange={(event) => {
                setLabel(event.target.value);
                setErrors((c) => ({ ...c, label: "" }));
              }}
              aria-invalid={errors.label ? "true" : undefined}
              className={inputClass(Boolean(errors.label))}
            />
            {errors.label && (
              <p
                role="alert"
                className="mt-2 flex items-start gap-2 text-sm text-second2"
              >
                <FiAlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {errors.label}
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="edit-cidr" className={labelClass}>
              Alamat IP / CIDR
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="edit-cidr"
              value={cidr}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setCidr(event.target.value);
                setErrors((c) => ({ ...c, cidr: "" }));
              }}
              aria-invalid={cidrError ? "true" : undefined}
              className={`${inputClass(Boolean(cidrError))} font-mono`}
            />
            {cidrError ? (
              <p
                role="alert"
                className="mt-2 flex items-start gap-2 text-sm text-second2"
              >
                <FiAlertCircle
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {cidrError}
              </p>
            ) : (
              <p className="mt-2 text-xs text-second/60">
                {describeCidr(cidr)}
              </p>
            )}
          </div>
        </div>

        {error?.form && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
          >
            <FiAlertTriangle
              size={16}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            {error.form}
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
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
                Menyimpan…
              </>
            ) : (
              "Simpan"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-48 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function AttendanceWifiPage() {
  const networksQuery = useGetAttendanceNetworks();
  const settingsQuery = useGetAttendanceSettings();
  const myIpQuery = useGetMyIp();

  const createMutation = useCreateAttendanceNetwork();
  const updateMutation = useUpdateAttendanceNetwork();
  const deleteMutation = useDeleteAttendanceNetwork();
  const settingsMutation = useUpdateAttendanceSettings();

  const [label, setLabel] = useState("");
  const [cidr, setCidr] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [detectedIp, setDetectedIp] = useState("");
  const [ipError, setIpError] = useState("");

  const [networkToEdit, setNetworkToEdit] = useState(null);
  const [editError, setEditError] = useState(null);
  const [networkToDelete, setNetworkToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const networks = networksQuery.data ?? [];
  const settings = settingsQuery.data;
  const activeNetworks =
    settings?.active_networks ?? networks.filter((n) => n.is_active).length;
  const requireNetwork = settings?.require_network ?? false;
  const nobodyCanAttend = requireNetwork && activeNetworks === 0;
  const limitReached = networks.length >= MAX_NETWORKS;

  const isLoading = networksQuery.isLoading || settingsQuery.isLoading;
  const isFetching = networksQuery.isFetching || settingsQuery.isFetching;
  const loadError =
    (networksQuery.isError && !networksQuery.data) ||
    (settingsQuery.isError && !settingsQuery.data);

  useEffect(() => {
    if (networksQuery.isError) {
      notify.error(normalizeApiError(networksQuery.error).message);
    }
  }, [networksQuery.isError, networksQuery.error]);

  useEffect(() => {
    if (settingsQuery.isError) {
      notify.error(normalizeApiError(settingsQuery.error).message);
    }
  }, [settingsQuery.isError, settingsQuery.error]);

  const currentNetwork =
    detectedIp &&
    networks.find((n) => n.is_active && ipv4InCidr(detectedIp, n.cidr));

  function refreshAll() {
    networksQuery.refetch();
    settingsQuery.refetch();
  }

  async function handleDetectIp() {
    setIpError("");
    const result = await myIpQuery.refetch();

    if (result.isError || !result.data) {
      setIpError(
        "Gagal mengambil IP. Pastikan koneksi internet aktif, atau isi alamat IP secara manual.",
      );
      return;
    }

    const ip = result.data.ip ?? "";
    const suggested = result.data.suggested_cidr ?? (ip ? ip : "");

    setDetectedIp(ip);
    setCidr(suggested);
    setFormErrors((current) => ({ ...current, cidr: "" }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    const errors = {};
    if (!label.trim()) errors.label = "Nama jaringan tidak boleh kosong.";
    if (!cidr.trim()) errors.cidr = "Alamat IP tidak boleh kosong.";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    try {
      await createMutation.mutateAsync({
        label: label.trim(),
        cidr: cidr.trim(),
      });

      notify.success("Jaringan wifi berhasil ditambahkan.");
      setLabel("");
      setCidr("");
      setDetectedIp("");
    } catch (err) {
      const code = err?.response?.data?.errors;
      const mapped = NETWORK_ERRORS[code];

      if (mapped) {
        setFormErrors({ [mapped[0]]: mapped[1] });
        return;
      }
      setFormErrors({ form: normalizeApiError(err).message });
    }
  }

  async function handleEdit(data) {
    setEditError(null);

    try {
      await updateMutation.mutateAsync({ id: networkToEdit.id, data });
      notify.success("Jaringan diperbarui.");
      setNetworkToEdit(null);
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "NETWORK_NOT_FOUND") {
        notify.error("Jaringan tidak ditemukan.");
        setNetworkToEdit(null);
        networksQuery.refetch();
        return;
      }

      const mapped = NETWORK_ERRORS[code];
      setEditError(
        mapped
          ? { [mapped[0]]: mapped[1] }
          : { form: normalizeApiError(err).message },
      );
    }
  }

  async function handleToggleNetwork(network, isActive) {
    setTogglingId(network.id);

    try {
      await updateMutation.mutateAsync({
        id: network.id,
        data: { is_active: isActive },
      });
      notify.success(
        isActive ? "Jaringan diaktifkan." : "Jaringan dinonaktifkan.",
      );
    } catch (err) {
      notify.error(normalizeApiError(err).message);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!networkToDelete) return;
    setDeleteError("");

    try {
      await deleteMutation.mutateAsync(networkToDelete.id);
      notify.success("Jaringan dihapus.");
      setNetworkToDelete(null);
    } catch (err) {
      if (err?.response?.data?.errors === "NETWORK_NOT_FOUND") {
        notify.error("Jaringan sudah tidak ada.");
        setNetworkToDelete(null);
        networksQuery.refetch();
        return;
      }
      setDeleteError(normalizeApiError(err).message);
    }
  }

  async function applyRequireNetwork(value) {
    try {
      await settingsMutation.mutateAsync({ require_network: value });
      notify.success(
        value
          ? "Absen kini hanya bisa dari wifi toko."
          : "Absen kini bisa dari mana saja.",
      );
      setConfirmDisable(false);
    } catch (err) {
      const code = err?.response?.data?.errors;

      notify.error(
        code === "STORE_NOT_READY"
          ? "Data toko belum diisi. Lengkapi profil toko terlebih dahulu."
          : normalizeApiError(err).message,
      );
      setConfirmDisable(false);
    }
  }

  function handleToggleRequire(next) {
    if (!next) {
      setConfirmDisable(true);
      return;
    }
    applyRequireNetwork(true);
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header className="flex flex-col gap-4">
          <Link
            href={BACK_PATH}
            className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
          >
            <FiArrowLeft size={16} aria-hidden="true" />
            Kembali ke data absensi
          </Link>

          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiWifi size={16} />
            </div>
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Wifi <span className="text-grad">Absen</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Atur jaringan wifi toko yang boleh dipakai karyawan untuk absen.
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
            Gagal memuat pengaturan wifi
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau sesi Anda, lalu coba kembali.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href={BACK_PATH}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
            >
              Kembali
            </Link>
            <button
              type="button"
              onClick={refreshAll}
              disabled={isFetching}
              className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
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
      </div>
    );
  }

  const isCreating = createMutation.isPending;
  const detecting = myIpQuery.isFetching;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <Link
          href={BACK_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke data absensi
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiWifi size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Wifi <span className="text-grad">Absen</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Atur jaringan wifi toko yang boleh dipakai karyawan untuk absen.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={refreshAll}
              disabled={isFetching}
              aria-label="Perbarui data wifi"
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
        </div>
      </header>

      {nobodyCanAttend && (
        <div
          role="alert"
          className="flex items-start gap-4 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
        >
          <FiAlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Saat ini tidak ada yang bisa absen.</p>
            <p className="mt-1 leading-relaxed">
              Absen diwajibkan lewat wifi toko, tetapi belum ada jaringan aktif.
              Daftarkan jaringan di bawah, atau matikan kewajiban wifi
              sementara.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <section
        aria-label="Ringkasan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          featured
          icon={FiShield}
          label="Kewajiban wifi"
          value={requireNetwork ? "Aktif" : "Nonaktif"}
          hint={
            requireNetwork ? "Hanya dari wifi toko" : "Absen dari mana saja"
          }
        />
        <StatCard
          icon={FiWifi}
          label="Jaringan aktif"
          value={`${activeNetworks} dari ${networks.length}`}
          hint="Jaringan yang diterima saat absen"
        />
        <StatCard
          icon={FiPlus}
          label="Kuota jaringan"
          value={`${networks.length} / ${MAX_NETWORKS}`}
          hint={
            limitReached
              ? "Kuota penuh"
              : `${MAX_NETWORKS - networks.length} slot tersisa`
          }
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* Pengaturan */}
          <SectionCard
            icon={FiShield}
            title="Wajib terhubung ke wifi toko"
            description="Kalau menyala, absen hanya diterima dari jaringan aktif di bawah."
          >
            <div className="flex items-start justify-between gap-4 rounded-xl bg-second/[0.03] p-4">
              <div className="min-w-0">
                <p
                  id="require-network-label"
                  className="text-sm font-semibold text-second"
                >
                  {requireNetwork ? "Aktif" : "Nonaktif"}
                </p>
                <p
                  id="require-network-desc"
                  className="mt-2 text-xs leading-relaxed text-second/60"
                >
                  {requireNetwork
                    ? "Karyawan harus tersambung ke wifi toko untuk bisa absen."
                    : "Siapa pun bisa absen dari mana saja. Pakai ini hanya sebagai langkah darurat, misalnya IP toko berubah dan belum sempat diperbarui."}
                </p>
              </div>

              <Switch
                checked={requireNetwork}
                disabled={settingsMutation.isPending}
                onChange={handleToggleRequire}
                label="Wajib terhubung ke wifi toko"
                describedBy="require-network-desc"
              />
            </div>
          </SectionCard>

          {/* Tambah jaringan */}
          <SectionCard
            icon={FiPlus}
            title="Daftarkan wifi toko"
            description="Buka halaman ini dari perangkat yang tersambung ke wifi toko, lalu ambil IP-nya."
          >
            <form
              onSubmit={handleCreate}
              noValidate
              className="flex flex-col gap-4"
            >
              <div className="rounded-xl border border-second/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-second">
                      Ambil IP otomatis
                    </p>
                    <p className="mt-2 text-xs text-second/60">
                      Pastikan memakai wifi toko, bukan data seluler atau VPN.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectIp}
                    disabled={detecting || isCreating}
                    className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                  >
                    {detecting ? (
                      <FiLoader
                        size={16}
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <FiWifi size={16} aria-hidden="true" />
                    )}
                    {detecting
                      ? "Mengambil…"
                      : detectedIp
                        ? "Ambil ulang"
                        : "Ambil IP"}
                  </button>
                </div>

                {detectedIp && (
                  <p
                    className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-second3/30 bg-second3/10 px-4 py-2 text-xs text-second3"
                    aria-live="polite"
                  >
                    <FiCheck size={14} aria-hidden="true" />
                    IP terdeteksi:
                    <span className="font-mono font-semibold">
                      {detectedIp}
                    </span>
                  </p>
                )}

                {ipError && (
                  <p
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-xs text-second2"
                  >
                    <FiAlertTriangle
                      size={14}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    {ipError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="network-label" className={labelClass}>
                    Nama jaringan
                    <span className="ml-2 text-second2" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="network-label"
                    value={label}
                    maxLength={100}
                    disabled={isCreating}
                    autoComplete="off"
                    placeholder="Contoh: Wifi toko"
                    onChange={(event) => {
                      setLabel(event.target.value);
                      setFormErrors((c) => ({ ...c, label: "", form: "" }));
                    }}
                    aria-invalid={formErrors.label ? "true" : undefined}
                    className={inputClass(Boolean(formErrors.label))}
                  />
                  {formErrors.label && (
                    <p
                      role="alert"
                      className="mt-2 flex items-start gap-2 text-sm text-second2"
                    >
                      <FiAlertCircle
                        size={16}
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      {formErrors.label}
                    </p>
                  )}
                </div>

                <div className="min-w-0">
                  <label htmlFor="network-cidr" className={labelClass}>
                    Alamat IP / CIDR
                    <span className="ml-2 text-second2" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="network-cidr"
                    value={cidr}
                    disabled={isCreating}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="203.0.113.7"
                    onChange={(event) => {
                      setCidr(event.target.value);
                      setFormErrors((c) => ({ ...c, cidr: "", form: "" }));
                    }}
                    aria-invalid={formErrors.cidr ? "true" : undefined}
                    aria-describedby="network-cidr-hint"
                    className={`${inputClass(Boolean(formErrors.cidr))} font-mono`}
                  />
                  <p
                    id="network-cidr-hint"
                    role={formErrors.cidr ? "alert" : undefined}
                    className={`mt-2 text-xs ${formErrors.cidr ? "text-second2" : "text-second/60"}`}
                  >
                    {formErrors.cidr ||
                      describeCidr(cidr) ||
                      "Boleh IP tunggal atau dengan /prefix. IPv4 minimal /16, IPv6 minimal /48."}
                  </p>
                </div>
              </div>

              {formErrors.form && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
                >
                  <FiAlertTriangle
                    size={16}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  {formErrors.form}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isCreating || limitReached}
                  aria-busy={isCreating}
                  className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                >
                  {isCreating ? (
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
                      <FiPlus size={16} aria-hidden="true" />
                      Simpan jaringan
                    </>
                  )}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* Daftar jaringan */}
          <section
            className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
            aria-labelledby="network-list-title"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex items-center gap-4">
                <div
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
                >
                  <FiWifi size={16} />
                </div>
                <h2
                  id="network-list-title"
                  className="text-lg font-bold text-second"
                >
                  Jaringan terdaftar
                </h2>
              </div>
              <Tag tone="strong">{networks.length} jaringan</Tag>
            </div>

            {networks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
                  <FiWifi size={24} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-second">
                  Belum ada jaringan
                </h3>
                <p className="mt-2 max-w-xs text-sm text-second/60">
                  Daftarkan wifi toko di atas supaya absen bisa dibatasi dari
                  jaringan itu saja.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-second/10 border-t border-second/30">
                {networks.map((network) => {
                  const isHere = currentNetwork?.id === network.id;

                  return (
                    <li key={network.id} className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-second">
                            {network.label}
                          </p>
                          <p className="mt-2 break-all font-mono text-xs text-second/60">
                            {network.cidr}
                          </p>
                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            Ditambahkan {formatDate(network.created_at)}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Tag tone={network.is_active ? "blue" : "muted"}>
                              {network.is_active ? "Aktif" : "Nonaktif"}
                            </Tag>
                            {isHere && (
                              <Tag tone="violet" icon={FiCheck}>
                                Anda sedang di jaringan ini
                              </Tag>
                            )}
                          </div>
                        </div>

                        <Switch
                          checked={network.is_active}
                          disabled={togglingId === network.id}
                          onChange={(next) =>
                            handleToggleNetwork(network, next)
                          }
                          label={`${network.is_active ? "Nonaktifkan" : "Aktifkan"} ${network.label}`}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditError(null);
                            setNetworkToEdit(network);
                          }}
                          className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
                        >
                          <FiEdit2 size={16} aria-hidden="true" />
                          Ubah
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("");
                            setNetworkToDelete(network);
                          }}
                          className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
                        >
                          <FiTrash2 size={16} aria-hidden="true" />
                          Hapus
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Panduan */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-16">
          <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
            <h2 className="text-lg font-bold text-second">
              Cara mendaftarkan wifi toko
            </h2>

            <ol className="flex flex-col gap-4">
              {[
                "Buka halaman ini dari HP atau laptop yang tersambung ke wifi toko.",
                "Tekan “Ambil IP”, lalu beri nama jaringan.",
                "Simpan. Karyawan yang absen dari wifi itu akan diterima.",
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-xs font-bold tabular-nums text-primary shadow-lg shadow-second4/20"
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-second/70">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second4/30 bg-second4/5 p-4 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-second4">
              <FiInfo size={16} aria-hidden="true" />
              Kalau IP toko berubah
            </h2>

            <p className="text-sm leading-relaxed text-second4">
              IP dari penyedia internet bisa berganti. Ambil IP baru dengan cara
              yang sama, lalu ubah atau hapus jaringan yang lama. Selama itu,
              matikan kewajiban wifi supaya karyawan tetap bisa absen.
            </p>
          </section>
        </aside>
      </div>

      {networkToEdit && (
        <EditNetworkDialog
          network={networkToEdit}
          busy={updateMutation.isPending}
          error={editError}
          onClose={() => {
            if (!updateMutation.isPending) setNetworkToEdit(null);
          }}
          onSubmit={handleEdit}
        />
      )}

      {networkToDelete && (
        <ConfirmDialog
          title="Hapus jaringan ini?"
          confirmLabel="Ya, hapus"
          busyLabel="Menghapus…"
          busy={deleteMutation.isPending}
          error={deleteError}
          onClose={() => {
            if (!deleteMutation.isPending) setNetworkToDelete(null);
          }}
          onConfirm={handleDelete}
        >
          <p>
            <span className="font-semibold text-second">
              {networkToDelete.label}
            </span>{" "}
            (<span className="font-mono text-xs">{networkToDelete.cidr}</span>)
            akan dihapus.
            {networkToDelete.is_active &&
              activeNetworks <= 1 &&
              requireNetwork &&
              " Ini jaringan aktif terakhir, jadi setelah dihapus tidak ada yang bisa absen sampai Anda mendaftarkan yang baru."}
          </p>
        </ConfirmDialog>
      )}

      {confirmDisable && (
        <ConfirmDialog
          title="Izinkan absen dari mana saja?"
          confirmLabel="Ya, matikan"
          busyLabel="Menyimpan…"
          tone="warning"
          busy={settingsMutation.isPending}
          onClose={() => {
            if (!settingsMutation.isPending) setConfirmDisable(false);
          }}
          onConfirm={() => applyRequireNetwork(false)}
        >
          <p>
            Setelah dimatikan, karyawan bisa absen dari lokasi mana pun, tidak
            harus di toko. Nyalakan lagi setelah IP wifi toko diperbarui.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
