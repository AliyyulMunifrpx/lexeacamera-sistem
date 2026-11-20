"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiEdit2,
  FiInfo,
  FiLoader,
  FiMonitor,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiWifi,
  FiX,
} from "react-icons/fi";

import {
  useCreateAttendanceDevice,
  useCreateAttendanceNetwork,
  useDeleteAttendanceDevice,
  useDeleteAttendanceNetwork,
  useGetAttendanceDevices,
  useGetAttendanceNetworks,
  useGetAttendanceSettings,
  useGetMyIp,
  useUpdateAttendanceDevice,
  useUpdateAttendanceNetwork,
  useUpdateAttendanceSettings,
} from "../../../../features/attendances/hooks.js";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const MAX_NETWORKS = 20;
const MAX_DEVICES = 3;
// last_seen_at yang lebih lama dari ini ditandai. PC toko bisa mati saat toko
// tutup, jadi batasnya sengaja longgar.
const STALE_MS = 24 * 60 * 60 * 1000;
const BACK_PATH = "/owner/attendances";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const BTN_OUTLINE = `${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

const BTN_OUTLINE_DANGER = `${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

const BTN_PRIMARY = `${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

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

const DEVICE_ERRORS = {
  DEVICE_LIMIT_REACHED: [
    "form",
    `Jumlah perangkat sudah mencapai batas (${MAX_DEVICES}). Hapus yang tidak terpakai dulu.`,
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

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

function timeAgo(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff) || diff < 0) return "";

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  return `${Math.floor(hours / 24)} hari lalu`;
}

function isStale(value) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && Date.now() - time > STALE_MS;
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

function FieldError({ children }) {
  return (
    <p
      role="alert"
      className="mt-2 flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function FormError({ children }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
    >
      <FiAlertTriangle
        size={16}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      {children}
    </p>
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

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-second">{title}</h3>
      <p className="mt-2 max-w-xs text-sm text-second/60">{description}</p>
    </div>
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
          className={`${BTN_OUTLINE} w-full sm:w-auto`}
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
            {errors.label && <FieldError>{errors.label}</FieldError>}
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
              <FieldError>{cidrError}</FieldError>
            ) : (
              <p className="mt-2 text-xs text-second/60">
                {describeCidr(cidr)}
              </p>
            )}
          </div>
        </div>

        {error?.form && (
          <div className="mt-4">
            <FormError>{error.form}</FormError>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_OUTLINE} w-full sm:w-auto`}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className={`${BTN_PRIMARY} w-full sm:w-auto`}
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

function EditDeviceDialog({ device, busy, error, onClose, onSubmit }) {
  const [label, setLabel] = useState(device.label ?? "");
  const [localError, setLocalError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!label.trim()) {
      setLocalError("Nama perangkat tidak boleh kosong.");
      return;
    }

    if (label.trim() === (device.label ?? "")) {
      onClose();
      return;
    }

    onSubmit({ label: label.trim() });
  }

  return (
    <Modal titleId="edit-device-title" onClose={onClose} busy={busy}>
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
          id="edit-device-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Ubah nama perangkat
        </h2>

        <div className="mt-8">
          <label htmlFor="edit-device-label" className={labelClass}>
            Nama perangkat
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="edit-device-label"
            value={label}
            maxLength={100}
            disabled={busy}
            autoFocus
            autoComplete="off"
            onChange={(event) => {
              setLabel(event.target.value);
              setLocalError("");
            }}
            aria-invalid={localError ? "true" : undefined}
            className={inputClass(Boolean(localError))}
          />
          {localError && <FieldError>{localError}</FieldError>}
        </div>

        {error && (
          <div className="mt-4">
            <FormError>{error}</FormError>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_OUTLINE} w-full sm:w-auto`}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className={`${BTN_PRIMARY} w-full sm:w-auto`}
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

/* Token hanya muncul sekali. Dialog ini sengaja tidak bisa ditutup lewat Escape
   atau klik di luar, supaya token tidak hilang sebelum disalin. */
function TokenDialog({ device, onDone }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(device.token);
      setCopied(true);
      notify.success("Token disalin.");
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Gagal menyalin. Salin token secara manual.");
    }
  }

  return (
    <Modal titleId="token-title" onClose={() => {}} busy>
      <div className="flex items-start gap-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second4 text-primary shadow-lg shadow-second4/25">
          <FiAlertTriangle size={16} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="token-title" className="text-lg font-bold text-second">
            Salin token sekarang
          </h2>
          <p className="mt-2 break-words text-sm text-second/60">
            Perangkat <span className="font-semibold">{device.label}</span>{" "}
            sudah dibuat.
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-sm leading-relaxed text-second4">
        Token ini hanya tampil sekali dan tidak bisa dilihat lagi. Kalau hilang
        atau bocor, hapus perangkatnya lalu buat yang baru. Siapa pun yang
        memegang token bisa menentukan IP yang dipercaya untuk absen, jadi jaga
        kerahasiaannya.
      </p>

      <div className="mt-4">
        <p className={labelClass}>Token perangkat</p>
        <p className="break-all rounded-xl border border-second/30 bg-second/[0.03] p-4 font-mono text-xs text-second">
          {device.token}
        </p>

        <button
          type="button"
          onClick={handleCopy}
          className={`${BTN_OUTLINE} mt-4 w-full`}
        >
          {copied ? (
            <>
              <FiCheck size={16} aria-hidden="true" />
              Tersalin
            </>
          ) : (
            <>
              <FiCopy size={16} aria-hidden="true" />
              Salin token
            </>
          )}
        </button>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-second/60">
        Pasang token ini di PC toko mengikuti panduan{" "}
        <span className="font-mono">perangkat-toko-windows.md</span>.
      </p>

      <div className="mt-8 flex justify-end border-t border-second/30 pt-4">
        <button
          type="button"
          onClick={onDone}
          className={`${BTN_PRIMARY} w-full sm:w-auto`}
        >
          Sudah saya salin
        </button>
      </div>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
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
  const devicesQuery = useGetAttendanceDevices();
  const myIpQuery = useGetMyIp();

  const createMutation = useCreateAttendanceNetwork();
  const updateMutation = useUpdateAttendanceNetwork();
  const deleteMutation = useDeleteAttendanceNetwork();
  const settingsMutation = useUpdateAttendanceSettings();

  const createDeviceMutation = useCreateAttendanceDevice();
  const updateDeviceMutation = useUpdateAttendanceDevice();
  const deleteDeviceMutation = useDeleteAttendanceDevice();

  // Jaringan
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

  // Perangkat toko
  const [deviceLabel, setDeviceLabel] = useState("");
  const [deviceErrors, setDeviceErrors] = useState({});
  const [newDevice, setNewDevice] = useState(null);
  const [deviceToEdit, setDeviceToEdit] = useState(null);
  const [deviceEditError, setDeviceEditError] = useState("");
  const [deviceToDelete, setDeviceToDelete] = useState(null);
  const [deviceDeleteError, setDeviceDeleteError] = useState("");
  const [togglingDeviceId, setTogglingDeviceId] = useState(null);

  const networks = networksQuery.data ?? [];
  const devices = devicesQuery.data ?? [];
  const settings = settingsQuery.data;

  const activeNetworks =
    settings?.active_networks ?? networks.filter((n) => n.is_active).length;
  const activeDevices =
    settings?.active_devices ?? devices.filter((d) => d.is_active).length;
  const requireNetwork = settings?.require_network ?? false;

  // Perangkat aktif yang sudah pernah melapor IP juga membuat absen bisa jalan.
  const reportingDevices = devices.filter(
    (d) => d.is_active && (d.ip_v4 || d.ip_v6),
  ).length;
  const devicesKnown = Boolean(devicesQuery.data);
  const nobodyCanAttend =
    requireNetwork &&
    activeNetworks === 0 &&
    devicesKnown &&
    reportingDevices === 0;

  const limitReached = networks.length >= MAX_NETWORKS;
  const deviceLimitReached = devices.length >= MAX_DEVICES;

  const isLoading = networksQuery.isLoading || settingsQuery.isLoading;
  const isFetching =
    networksQuery.isFetching ||
    settingsQuery.isFetching ||
    devicesQuery.isFetching;
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
    devicesQuery.refetch();
  }

  /* ------------------------------- Jaringan ------------------------------ */
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      notify.success("Perintah berhasil disalin");
    } catch (error) {
      console.error("Gagal menyalin:", error);
      notify.error("Gagal menyalin perintah");
    }
  };
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

  /* ----------------------------- Perangkat toko --------------------------- */

  async function handleCreateDevice(event) {
    event.preventDefault();

    if (!deviceLabel.trim()) {
      setDeviceErrors({ label: "Nama perangkat tidak boleh kosong." });
      return;
    }

    setDeviceErrors({});

    try {
      const created = await createDeviceMutation.mutateAsync({
        label: deviceLabel.trim(),
      });

      setDeviceLabel("");
      // Token hanya ada di respons ini. Tampilkan sebelum hal lain.
      setNewDevice({ label: created.label, token: created.token });
    } catch (err) {
      const code = err?.response?.data?.errors;
      const mapped = DEVICE_ERRORS[code];

      setDeviceErrors({
        [mapped ? mapped[0] : "form"]: mapped
          ? mapped[1]
          : normalizeApiError(err).message,
      });
    }
  }

  async function handleEditDevice(data) {
    setDeviceEditError("");

    try {
      await updateDeviceMutation.mutateAsync({ id: deviceToEdit.id, data });
      notify.success("Perangkat diperbarui.");
      setDeviceToEdit(null);
    } catch (err) {
      if (err?.response?.data?.errors === "DEVICE_NOT_FOUND") {
        notify.error("Perangkat tidak ditemukan.");
        setDeviceToEdit(null);
        devicesQuery.refetch();
        return;
      }
      setDeviceEditError(normalizeApiError(err).message);
    }
  }

  async function handleToggleDevice(device, isActive) {
    setTogglingDeviceId(device.id);

    try {
      await updateDeviceMutation.mutateAsync({
        id: device.id,
        data: { is_active: isActive },
      });
      notify.success(
        isActive
          ? "Perangkat diaktifkan."
          : "Perangkat dinonaktifkan. Token ditolak dan IP-nya tidak dipercaya lagi.",
      );
    } catch (err) {
      if (err?.response?.data?.errors === "DEVICE_NOT_FOUND") {
        notify.error("Perangkat tidak ditemukan.");
        devicesQuery.refetch();
        return;
      }
      notify.error(normalizeApiError(err).message);
    } finally {
      setTogglingDeviceId(null);
    }
  }

  async function handleDeleteDevice() {
    if (!deviceToDelete) return;
    setDeviceDeleteError("");

    try {
      await deleteDeviceMutation.mutateAsync(deviceToDelete.id);
      notify.success("Perangkat dihapus dan token dicabut.");
      setDeviceToDelete(null);
    } catch (err) {
      if (err?.response?.data?.errors === "DEVICE_NOT_FOUND") {
        notify.error("Perangkat sudah tidak ada.");
        setDeviceToDelete(null);
        devicesQuery.refetch();
        return;
      }
      setDeviceDeleteError(normalizeApiError(err).message);
    }
  }

  /* --------------------------------- Render -------------------------------- */

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
            <Link href={BACK_PATH} className={BTN_OUTLINE}>
              Kembali
            </Link>
            <button
              type="button"
              onClick={refreshAll}
              disabled={isFetching}
              className={BTN_PRIMARY}
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
  const isCreatingDevice = createDeviceMutation.isPending;
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
                Atur jaringan wifi dan perangkat toko yang boleh dipakai
                karyawan untuk absen.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={refreshAll}
              disabled={isFetching}
              aria-label="Perbarui data wifi"
              className={`${BTN_OUTLINE} w-full sm:w-auto`}
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
              Absen diwajibkan lewat wifi toko, tetapi belum ada jaringan aktif
              dan belum ada perangkat toko aktif yang pernah melaporkan IP.
              Daftarkan jaringan atau pasang perangkat toko di bawah, atau
              matikan kewajiban wifi sementara.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <section
        aria-label="Ringkasan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
          icon={FiMonitor}
          label="Perangkat toko aktif"
          value={`${activeDevices} dari ${devices.length}`}
          hint={
            devicesKnown
              ? `${reportingDevices} sudah melaporkan IP`
              : "Memuat perangkat…"
          }
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
            description="Kalau menyala, absen hanya diterima dari jaringan aktif atau IP terakhir perangkat toko aktif di bawah."
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

          {/* Perangkat toko */}
          <SectionCard
            icon={FiMonitor}
            title="Perangkat toko"
            description="Satu PC di toko yang hampir selalu menyala melaporkan IP wifi toko secara otomatis. Kalau ISP mengganti IP, laporan berikutnya memperbaruinya tanpa input Anda."
            aside={<Tag tone="strong">{devices.length} perangkat</Tag>}
          >
            <form
              onSubmit={handleCreateDevice}
              noValidate
              className="flex flex-col gap-4"
            >
              <div className="min-w-0">
                <label htmlFor="device-label" className={labelClass}>
                  Nama perangkat
                  <span className="ml-2 text-second2" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="device-label"
                  value={deviceLabel}
                  maxLength={100}
                  disabled={isCreatingDevice || deviceLimitReached}
                  autoComplete="off"
                  placeholder="Contoh: PC kasir"
                  onChange={(event) => {
                    setDeviceLabel(event.target.value);
                    setDeviceErrors({});
                  }}
                  aria-invalid={deviceErrors.label ? "true" : undefined}
                  className={inputClass(Boolean(deviceErrors.label))}
                />
                {deviceErrors.label && (
                  <FieldError>{deviceErrors.label}</FieldError>
                )}
                <p className="mt-2 text-xs text-second/60">
                  Maksimal {MAX_DEVICES} perangkat. Jaringan manual di bawah
                  tetap berlaku bersamaan.
                </p>
              </div>

              {deviceErrors.form && <FormError>{deviceErrors.form}</FormError>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isCreatingDevice || deviceLimitReached}
                  aria-busy={isCreatingDevice}
                  className={BTN_PRIMARY}
                >
                  {isCreatingDevice ? (
                    <>
                      <FiLoader
                        className="animate-spin motion-reduce:animate-none"
                        size={16}
                        aria-hidden="true"
                      />
                      Membuat…
                    </>
                  ) : (
                    <>
                      <FiPlus size={16} aria-hidden="true" />
                      Buat perangkat
                    </>
                  )}
                </button>
              </div>
            </form>

            {devicesQuery.isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-second/10" />
            ) : devicesQuery.isError && !devicesQuery.data ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FormError>
                  {normalizeApiError(devicesQuery.error).message}
                </FormError>
                <button
                  type="button"
                  onClick={() => devicesQuery.refetch()}
                  disabled={devicesQuery.isFetching}
                  className={BTN_OUTLINE}
                >
                  Coba lagi
                </button>
              </div>
            ) : devices.length === 0 ? (
              <EmptyState
                icon={FiMonitor}
                title="Belum ada perangkat toko"
                description="Buat perangkat, salin tokennya, lalu pasang di PC toko supaya IP wifi diperbarui otomatis."
              />
            ) : (
              <ul className="divide-y divide-second/10 border-t border-second/30">
                {devices.map((device) => {
                  const neverReported = !device.last_seen_at;
                  const stale = isStale(device.last_seen_at);
                  const isHere =
                    Boolean(detectedIp) && device.ip_v4 === detectedIp;

                  return (
                    <li key={device.id} className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-second">
                            {device.label}
                          </p>

                          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                            <div className="min-w-0">
                              <dt className="text-second/60">IPv4</dt>
                              <dd className="mt-2 break-all font-mono text-second">
                                {device.ip_v4 ?? "—"}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-second/60">IPv6</dt>
                              <dd className="mt-2 break-all font-mono text-second">
                                {device.ip_v6 ?? "—"}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-second/60">
                                Terakhir melapor
                              </dt>
                              <dd className="mt-2 tabular-nums text-second">
                                {neverReported
                                  ? "Belum pernah"
                                  : `${formatDateTime(device.last_seen_at)} (${timeAgo(device.last_seen_at)})`}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-second/60">
                                IP terakhir berubah
                              </dt>
                              <dd className="mt-2 tabular-nums text-second">
                                {device.ip_changed_at
                                  ? formatDateTime(device.ip_changed_at)
                                  : "—"}
                              </dd>
                            </div>
                          </dl>

                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            Dibuat {formatDate(device.created_at)}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Tag tone={device.is_active ? "blue" : "muted"}>
                              {device.is_active ? "Aktif" : "Nonaktif"}
                            </Tag>
                            {neverReported && (
                              <Tag tone="violet">Belum pernah melapor</Tag>
                            )}
                            {stale && (
                              <Tag tone="red" icon={FiAlertTriangle}>
                                Sudah lama tidak melapor
                              </Tag>
                            )}
                            {isHere && (
                              <Tag tone="violet" icon={FiCheck}>
                                IP sama dengan perangkat ini
                              </Tag>
                            )}
                          </div>
                        </div>

                        <Switch
                          checked={device.is_active}
                          disabled={togglingDeviceId === device.id}
                          onChange={(next) => handleToggleDevice(device, next)}
                          label={`${device.is_active ? "Nonaktifkan" : "Aktifkan"} ${device.label}`}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDeviceEditError("");
                            setDeviceToEdit(device);
                          }}
                          className={BTN_OUTLINE}
                        >
                          <FiEdit2 size={16} aria-hidden="true" />
                          Ubah nama
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeviceDeleteError("");
                            setDeviceToDelete(device);
                          }}
                          className={BTN_OUTLINE_DANGER}
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

            <p className="flex items-start gap-2 rounded-xl bg-second/[0.03] p-4 text-xs leading-relaxed text-second/60">
              <FiInfo
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                IP terakhir tetap berlaku sampai ada laporan baru, termasuk saat
                PC dimatikan, supaya absen pulang setelah toko tutup tetap bisa.
                Pantau “Terakhir melapor” dan “IP terakhir berubah”: IP yang
                berubah tanpa alasan, atau laporan yang berhenti, patut
                dicurigai.
              </span>
            </p>
          </SectionCard>

          {/* Tambah jaringan */}
          <SectionCard
            icon={FiPlus}
            title="Daftarkan wifi toko secara manual"
            description="Buka halaman ini dari perangkat yang tersambung ke wifi toko, lalu ambil IP-nya. IP manual tidak berubah sendiri, jadi untuk IP yang sering berganti lebih baik pakai perangkat toko di atas."
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
                    className={BTN_OUTLINE}
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
                    <FieldError>{formErrors.label}</FieldError>
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

              {formErrors.form && <FormError>{formErrors.form}</FormError>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isCreating || limitReached}
                  aria-busy={isCreating}
                  className={BTN_PRIMARY}
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
              <EmptyState
                icon={FiWifi}
                title="Belum ada jaringan"
                description="Daftarkan wifi toko di atas, atau pasang perangkat toko, supaya absen bisa dibatasi dari jaringan itu saja."
              />
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
                          className={BTN_OUTLINE}
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
                          className={BTN_OUTLINE_DANGER}
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
          <section className="flex min-w-0 flex-col gap-6 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-grad text-primary">
                <FiMonitor size={21} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-second">
                  Panduan pemasangan komputer toko
                </h2>
                <p className="text-xs text-second/50">
                  Windows 10 dan Windows 11
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-second/20 bg-second/5 p-4">
              <p className="text-sm font-semibold text-second">
                Apa fungsi perangkat ini?
              </p>
              <p className="mt-2 text-xs leading-relaxed text-second/60">
                Komputer toko akan mengirimkan IP WiFi secara otomatis ke sistem
                absensi setiap 5 menit. Dengan begitu, ketika IP WiFi toko
                berubah, Anda tidak perlu memperbaruinya secara manual.
              </p>
              <p className="mt-3 text-xs font-medium text-second/70">
                Pemasangan hanya dilakukan satu kali.
              </p>
            </div>

            {/* Persiapan */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-second">Sebelum memulai</h3>

              <div className="flex items-start gap-3">
                <FiCheckCircle
                  className="mt-0.5 shrink-0 text-green-500"
                  size={17}
                />
                <p className="text-xs leading-relaxed text-second/70">
                  Komputer menggunakan Windows 10 versi terbaru atau Windows 11.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <FiCheckCircle
                  className="mt-0.5 shrink-0 text-green-500"
                  size={17}
                />
                <p className="text-xs leading-relaxed text-second/70">
                  Komputer terhubung ke WiFi atau kabel internet toko.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <FiCheckCircle
                  className="mt-0.5 shrink-0 text-green-500"
                  size={17}
                />
                <p className="text-xs leading-relaxed text-second/70">
                  Komputer biasanya tetap menyala selama toko beroperasi.
                </p>
              </div>
            </div>

            <div className="h-px bg-second/10" />

            {/* Langkah 1 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-grad text-xs font-bold text-primary">
                  01
                </span>
                <h3 className="text-sm font-bold text-second">
                  Buat perangkat di halaman ini
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Buat perangkat baru dan berikan nama yang mudah dikenali,
                misalnya <strong className="text-second">PC Kasir</strong>.
                Setelah dibuat, sistem akan memberikan kode khusus untuk
                menghubungkan komputer toko.
              </p>

              <div className="rounded-xl bg-second/5 p-3">
                <p className="text-xs text-second/50">Contoh nama perangkat</p>
                <p className="mt-1 text-sm font-semibold text-second">
                  PC Kasir
                </p>
              </div>
            </div>

            {/* Langkah 2 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-grad text-xs font-bold text-primary">
                  02
                </span>
                <h3 className="text-sm font-bold text-second">
                  Salin kode perangkat
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Setelah perangkat berhasil dibuat, salin kode yang muncul. Kode
                ini akan digunakan saat mengatur komputer toko.
              </p>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-xs leading-relaxed text-red-600">
                  <strong>Perhatian:</strong> Kode hanya ditampilkan satu kali.
                  Simpan dengan baik dan jangan membagikannya kepada orang lain.
                </p>
              </div>
            </div>

            {/* Langkah 3 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-grad text-xs font-bold text-primary">
                  03
                </span>
                <h3 className="text-sm font-bold text-second">
                  Siapkan folder pemasangan
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Buka File Explorer di komputer toko, kemudian ikuti langkah
                berikut:
              </p>

              <ol className="flex flex-col gap-2 text-xs leading-relaxed text-second/70">
                <li>1. Buka Local Disk (C:).</li>
                <li>2. Klik kanan pada area kosong, pilih New lalu Folder.</li>
                <li>
                  3. Beri nama folder tersebut{" "}
                  <strong className="text-second">absen</strong>.
                </li>
              </ol>

              <div className="rounded-xl bg-second/5 p-3">
                <p className="text-[11px] text-second/50">
                  Nama folder yang harus dibuat
                </p>
                <code className="mt-1 text-xs font-semibold text-second">
                  C:\absen
                </code>
              </div>
            </div>

            {/* Langkah 4 */}

            {/* Langkah 4 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-grad text-xs font-bold text-primary">
                  04
                </span>
                <h3 className="text-sm font-bold text-second">
                  Siapkan file pemasangan
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Anda akan menerima file ZIP pemasangan secara pribadi melalui
                WhatsApp. Setelah menerima file tersebut, ikuti langkah berikut:
              </p>

              <ol className="flex flex-col gap-2 text-xs leading-relaxed text-second/70">
                <li>1. Download file ZIP yang dikirimkan melalui WhatsApp.</li>
                <li>2. Buka folder Downloads di komputer.</li>
                <li>
                  3. Klik kanan file ZIP, lalu pilih Extract All atau Ekstrak
                  Semua.
                </li>
                <li>4. Buka folder hasil ekstraksi.</li>
                <li>
                  5. Cari file bernama{" "}
                  <strong className="text-second">heartbeat.bat</strong>.
                </li>
                <li>6. Pindahkan file tersebut ke folder C:\absen.</li>
                <li>7. Buka folder C:\absen.</li>
                <li>
                  8. Klik kanan file heartbeat.bat, lalu pilih Edit atau Open
                  with Notepad.
                </li>
              </ol>

              <div className="rounded-xl border border-second/20 bg-second/5 p-3">
                <p className="text-xs font-semibold text-second">
                  Masukkan kode perangkat
                </p>
                <p className="mt-2 text-xs leading-relaxed text-second/60">
                  Cari tulisan GANTI_DENGAN_TOKEN di dalam file. Ganti tulisan
                  tersebut dengan kode perangkat yang sudah disalin dari halaman
                  ini.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-second/60">
                  URL server sudah disiapkan di dalam file. Anda tidak perlu
                  mengubah bagian lainnya.
                </p>
              </div>

              <ol className="flex flex-col gap-2 text-xs leading-relaxed text-second/70">
                <li>9. Tekan Ctrl + S untuk menyimpan perubahan.</li>
                <li>10. Tutup Notepad.</li>
                <li>
                  11. Pastikan file heartbeat.bat berada langsung di dalam
                  folder C:\absen, bukan di dalam folder lain.
                </li>
              </ol>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-xs leading-relaxed text-red-600">
                  <strong>Penting:</strong> Jangan membagikan file yang sudah
                  diisi kode perangkat kepada orang lain.
                </p>
              </div>
            </div>

            {/* Langkah 5 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-grad text-xs font-bold text-primary">
                  05
                </span>
                <h3 className="text-sm font-bold text-second">
                  Jalankan dan periksa hasilnya
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Buka folder C:\absen, kemudian klik dua kali file heartbeat.bat.
                Tunggu hingga proses selesai.
              </p>

              <p className="text-xs leading-relaxed text-second/60">
                Setelah itu, periksa file hasil pemeriksaan di folder yang sama:
              </p>

              <div className="rounded-xl bg-second/5 p-3">
                <p className="text-xs font-semibold text-second">last-v4.txt</p>
                <p className="mt-1 text-[11px] text-second/50">
                  Hasil pemeriksaan koneksi IPv4.
                </p>
              </div>

              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                <p className="text-sm font-bold text-green-600">
                  Jika berisi 200
                </p>
                <p className="mt-1 text-xs leading-relaxed text-second/60">
                  Berarti komputer berhasil terhubung dengan sistem. Anda bisa
                  melanjutkan ke langkah berikutnya.
                </p>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-xs font-semibold text-red-500">
                  Jika hasilnya 401, 000, atau kosong
                </p>
                <p className="mt-2 text-xs leading-relaxed text-second/60">
                  401 berarti kode perangkat perlu diperiksa. 000 berarti
                  komputer belum berhasil terhubung ke server. Jika kosong,
                  periksa kembali file dan koneksi internet.
                </p>
              </div>

              <p className="text-[11px] leading-relaxed text-second/50">
                Jika last-v6.txt berisi 000, tidak masalah apabila jaringan toko
                tidak mendukung IPv6. Pastikan last-v4.txt menunjukkan 200.
              </p>
            </div>

            {/* Langkah 6 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-grad text-xs font-bold text-primary">
                  06
                </span>
                <h3 className="text-sm font-bold text-second">
                  Aktifkan pengiriman otomatis
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Agar komputer mengirimkan IP WiFi secara otomatis setiap 5
                menit, ikuti petunjuk berikut:
              </p>

              <ol className="flex flex-col gap-2 text-xs leading-relaxed text-second/70">
                <li>1. Klik tombol Start di Windows.</li>
                <li>2. Ketik Command Prompt atau CMD.</li>
                <li>3. Klik kanan Command Prompt.</li>
                <li>4. Pilih Run as administrator.</li>
                <li>5. Jika muncul permintaan izin, pilih Yes.</li>
                <li>
                  6. Salin perintah berikut, tempel di jendela yang terbuka,
                  lalu tekan Enter.
                </li>
              </ol>

              <div className="rounded-xl bg-second/5 p-3">
                <code className="block break-all text-xs leading-relaxed text-second">
                  schtasks /create /tn "Heartbeat Absen" /tr
                  "C:\absen\heartbeat.bat" /sc minute /mo 5 /ru SYSTEM /f
                </code>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'schtasks /create /tn "Heartbeat Absen" /tr "C:\\absen\\heartbeat.bat" /sc minute /mo 5 /ru SYSTEM /f',
                    )
                  }
                  className="mt-3 flex items-center gap-2 rounded-lg bg-second px-3 py-2 text-xs font-semibold text-primary"
                >
                  <FiCopy size={14} />
                  Salin perintah
                </button>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Jika muncul pesan bahwa tugas berhasil dibuat, pengiriman
                otomatis sudah berhasil diatur.
              </p>
            </div>

            {/* Langkah 7 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-grad text-xs font-bold text-primary">
                  07
                </span>
                <h3 className="text-sm font-bold text-second">
                  Periksa apakah perangkat sudah aktif
                </h3>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Kembali ke Command Prompt sebagai Administrator, kemudian
                jalankan perintah berikut:
              </p>

              <div className="rounded-xl bg-second/5 p-3">
                <code className="block text-xs text-second">
                  schtasks /run /tn "Heartbeat Absen"
                </code>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy('schtasks /run /tn "Heartbeat Absen"')
                  }
                  className="mt-3 flex items-center gap-2 rounded-lg bg-second px-3 py-2 text-xs font-semibold text-primary"
                >
                  <FiCopy size={14} />
                  Salin perintah
                </button>
              </div>

              <p className="text-xs leading-relaxed text-second/60">
                Setelah itu, periksa daftar perangkat melalui website. Pastikan
                waktu terakhir melapor sudah diperbarui dan IP WiFi sudah
                terisi.
              </p>

              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                <p className="text-sm font-bold text-green-600">
                  Pemasangan selesai!
                </p>
                <p className="mt-1 text-xs leading-relaxed text-second/60">
                  Komputer akan mengirimkan IP WiFi setiap 5 menit secara
                  otomatis, termasuk setelah komputer dinyalakan kembali.
                </p>
              </div>
            </div>
          </section>

          {/* Informasi tambahan */}
          <section className="flex flex-col gap-4 rounded-2xl border border-second/20 bg-primary p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-second">
              <FiInfo size={18} />
              Informasi tambahan
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold text-second">
                  Jika IP WiFi toko berubah
                </p>
                <p className="mt-1 text-xs leading-relaxed text-second/50">
                  Tidak perlu melakukan pemasangan ulang. Komputer akan
                  melaporkan IP WiFi terbaru secara otomatis.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-second">
                  Jika komputer dimatikan
                </p>
                <p className="mt-1 text-xs leading-relaxed text-second/50">
                  Komputer tidak dapat mengirimkan laporan selama mati. Setelah
                  dinyalakan kembali dan terhubung ke internet, laporan akan
                  berjalan kembali.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-second">
                  Jika menggunakan komputer baru
                </p>
                <p className="mt-1 text-xs leading-relaxed text-second/50">
                  Buat perangkat baru melalui halaman pengaturan, lakukan
                  pemasangan ulang, kemudian hapus perangkat lama. Maksimal 3
                  perangkat dapat dibuat.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-second">
                  Jika ingin menghentikan laporan otomatis
                </p>
                <p className="mt-1 text-xs leading-relaxed text-second/50">
                  Buka Command Prompt sebagai Administrator, kemudian jalankan
                  perintah berikut:
                </p>
                <code className="mt-2 block break-all rounded-lg bg-second/5 p-3 text-xs text-second">
                  schtasks /delete /tn "Heartbeat Absen" /f
                </code>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {newDevice && (
        <TokenDialog device={newDevice} onDone={() => setNewDevice(null)} />
      )}

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

      {deviceToEdit && (
        <EditDeviceDialog
          device={deviceToEdit}
          busy={updateDeviceMutation.isPending}
          error={deviceEditError}
          onClose={() => {
            if (!updateDeviceMutation.isPending) setDeviceToEdit(null);
          }}
          onSubmit={handleEditDevice}
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
              reportingDevices === 0 &&
              " Ini jaringan aktif terakhir, jadi setelah dihapus tidak ada yang bisa absen sampai Anda mendaftarkan yang baru."}
          </p>
        </ConfirmDialog>
      )}

      {deviceToDelete && (
        <ConfirmDialog
          title="Hapus perangkat ini?"
          confirmLabel="Ya, hapus"
          busyLabel="Menghapus…"
          busy={deleteDeviceMutation.isPending}
          error={deviceDeleteError}
          onClose={() => {
            if (!deleteDeviceMutation.isPending) setDeviceToDelete(null);
          }}
          onConfirm={handleDeleteDevice}
        >
          <p>
            <span className="font-semibold text-second">
              {deviceToDelete.label}
            </span>{" "}
            akan dihapus dan tokennya dicabut permanen. PC yang memakai token
            itu tidak bisa melapor lagi, dan IP terakhirnya tidak dipercaya
            lagi. Untuk memasangnya kembali, buat perangkat baru dan pakai token
            yang baru.
            {requireNetwork &&
              activeNetworks === 0 &&
              deviceToDelete.is_active &&
              reportingDevices <= 1 &&
              " Ini satu-satunya sumber IP yang dipercaya, jadi setelah dihapus tidak ada yang bisa absen sampai Anda menambahkan yang baru."}
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
