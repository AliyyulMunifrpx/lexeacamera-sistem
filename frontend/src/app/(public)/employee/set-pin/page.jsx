"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiLock,
} from "react-icons/fi";

import {
  useGetEmployeeTokenInfo,
  useSetEmployeePin,
} from "../../../features/public-attendances/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
const PIN_PATTERN = /^\d{4,6}$/;

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

/* --------------------------------- Shell --------------------------------- */

function Shell({ children }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary px-4 py-10 text-second">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-sm font-bold uppercase tracking-[0.2em] text-second/60">
          lexea camera
        </p>
        <div className="rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

function StateMessage({ icon: Icon, tone = "muted", title, children }) {
  const tones = {
    muted: "bg-second/10 text-second",
    red: "bg-second2/10 text-second2",
    blue: "bg-second3/10 text-second3",
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`flex size-16 items-center justify-center rounded-full ${tones[tone]}`}
      >
        <Icon size={24} aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-balance text-lg font-bold text-second">
        {title}
      </h1>
      <div className="mt-2 text-sm leading-relaxed text-second/60">
        {children}
      </div>
    </div>
  );
}

function InvalidLink({ message }) {
  return (
    <Shell>
      <div role="alert">
        <StateMessage
          icon={FiAlertTriangle}
          tone="red"
          title="Tautan tidak berlaku"
        >
          <p>{message}</p>
          <p className="mt-2">
            Minta pemilik toko mengirim ulang tautan baru. Tautan hanya berlaku
            24 jam dan hanya bisa dipakai sekali.
          </p>
        </StateMessage>
      </div>
    </Shell>
  );
}

/* -------------------------------- Pin Field ------------------------------ */

function PinField({
  id,
  label,
  value,
  onChange,
  show,
  error,
  disabled,
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
      <input
        id={id}
        name={id}
        type={show ? "text" : "password"}
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        placeholder="••••"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={`${inputClass(Boolean(error))} text-center text-lg font-semibold tracking-[0.5em] tabular-nums`}
      />
    </div>
  );
}

/* ------------------------------ Set PIN Flow ----------------------------- */

function SetPinFlow({ token }) {
  const info = useGetEmployeeTokenInfo(token);
  const setPinMutation = useSetEmployeePin();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);

  const busy = setPinMutation.isPending;

  if (info.isPending) {
    return (
      <Shell>
        <div
          className="flex items-center justify-center gap-4 py-8"
          role="status"
          aria-live="polite"
        >
          <FiLoader
            className="animate-spin motion-reduce:animate-none text-second4"
            size={24}
            aria-hidden="true"
          />
          <span className="text-sm text-second/60">Memeriksa tautan…</span>
        </div>
      </Shell>
    );
  }

  if (info.isError) {
    const code = info.error?.response?.data?.errors;
    const isInvalid =
      code === "INVALID_OR_EXPIRED_TOKEN" ||
      info.error?.response?.status === 400;

    if (isInvalid) {
      return (
        <InvalidLink message="Tautan ini kedaluwarsa, sudah dipakai, atau sudah diganti dengan tautan yang lebih baru." />
      );
    }

    return (
      <Shell>
        <div role="alert">
          <StateMessage
            icon={FiAlertTriangle}
            tone="red"
            title="Gagal memeriksa tautan"
          >
            <p>{normalizeApiError(info.error).message}</p>
          </StateMessage>
          <button
            type="button"
            onClick={() => info.refetch()}
            disabled={info.isFetching}
            aria-busy={info.isFetching}
            className={`${BTN_BASE} mt-6 w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {info.isFetching ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Memuat…
              </>
            ) : (
              "Coba lagi"
            )}
          </button>
        </div>
      </Shell>
    );
  }

  if (expired) {
    return <InvalidLink message="Tautan ini sudah tidak berlaku." />;
  }

  const { name, pin_set: isChange } = info.data;

  if (done) {
    return (
      <Shell>
        <div role="status">
          <StateMessage
            icon={FiCheckCircle}
            tone="blue"
            title={isChange ? "PIN berhasil diganti" : "PIN berhasil dibuat"}
          >
            <p>
              Terima kasih, {name}. Email Anda sudah terverifikasi dan PIN siap
              dipakai untuk absen di toko.
            </p>
            <p className="mt-2">
              Ingat PIN Anda. Pemilik toko tidak dapat melihatnya.
            </p>
          </StateMessage>
        </div>
      </Shell>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!PIN_PATTERN.test(pin)) {
      setError("PIN harus 4 sampai 6 digit angka.");
      return;
    }
    if (pin !== confirmPin) {
      setError("Konfirmasi PIN tidak sama.");
      return;
    }

    try {
      await setPinMutation.mutateAsync({ token, pin });
      setPin("");
      setConfirmPin("");
      setDone(true);
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "INVALID_OR_EXPIRED_TOKEN") {
        setExpired(true);
        return;
      }

      setError(normalizeApiError(err).message);
    }
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex size-8 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
          <FiLock size={16} aria-hidden="true" />
        </div>

        <h1 className="mt-4 text-balance text-lg font-bold text-second">
          {isChange ? "Ganti PIN" : "Buat PIN"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-second/60">
          Halo, <span className="font-semibold text-second">{name}</span>.{" "}
          {isChange
            ? "Buat PIN baru untuk absen."
            : "Buat PIN untuk absen. Email Anda otomatis terverifikasi setelah PIN dibuat."}
        </p>

        <div className="mt-8 space-y-4">
          <PinField
            id="pin"
            label="PIN baru"
            value={pin}
            onChange={setPin}
            show={show}
            disabled={busy}
            error={error}
            describedBy="pin-hint"
          />
          <PinField
            id="confirm-pin"
            label="Ulangi PIN"
            value={confirmPin}
            onChange={setConfirmPin}
            show={show}
            disabled={busy}
            error={error}
            describedBy="pin-hint"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="pin-hint" className="text-xs text-second/60">
              4 sampai 6 digit angka.
            </p>

            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              aria-pressed={show}
              className={`inline-flex items-center gap-2 rounded-xl px-2 py-1 text-xs font-semibold text-second/70 transition-colors hover:bg-second/10 hover:text-second ${FOCUS_RING}`}
            >
              {show ? (
                <FiEyeOff size={14} aria-hidden="true" />
              ) : (
                <FiEye size={14} aria-hidden="true" />
              )}
              {show ? "Sembunyikan PIN" : "Tampilkan PIN"}
            </button>
          </div>
        </div>

        {error && <ErrorText id="pin-error">{error}</ErrorText>}

        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className={`${BTN_BASE} mt-6 w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
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
          ) : isChange ? (
            "Simpan PIN baru"
          ) : (
            "Simpan PIN"
          )}
        </button>
      </form>
    </Shell>
  );
}

/* ------------------------------ Page Wrapper ----------------------------- */

function PageContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  if (!TOKEN_PATTERN.test(token)) {
    return (
      <InvalidLink
        message={
          token
            ? "Format tautan tidak valid. Pastikan Anda membuka tautan lengkap dari email."
            : "Tautan tidak lengkap. Buka tautan dari email yang Anda terima."
        }
      />
    );
  }

  return <SetPinFlow token={token} />;
}

export default function EmployeeSetPinPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <div
            className="flex items-center justify-center gap-4 py-8"
            role="status"
            aria-live="polite"
          >
            <FiLoader
              className="animate-spin motion-reduce:animate-none text-second4"
              size={24}
              aria-hidden="true"
            />
            <span className="text-sm text-second/60">Memuat…</span>
          </div>
        </Shell>
      }
    >
      <PageContent />
    </Suspense>
  );
}
