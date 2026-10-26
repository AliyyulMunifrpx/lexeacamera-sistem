"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";

  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const normalizedEmail = email.toLowerCase();
  const storageKey = `verify-email-cooldown:${normalizedEmail}`;

  useEffect(() => {
    if (!normalizedEmail) return;

    function updateCountdown() {
      const expiresAt = Number(sessionStorage.getItem(storageKey) || 0);

      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

      setCountdown(remaining);

      if (expiresAt && remaining === 0) {
        sessionStorage.removeItem(storageKey);
      }
    }

    updateCountdown();

    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [normalizedEmail, storageKey]);

  function startCooldown(seconds) {
    const expiresAt = Date.now() + seconds * 1000;

    sessionStorage.setItem(storageKey, String(expiresAt));
    setCountdown(seconds);
  }

  async function handleResend() {
    if (!email || isSending || countdown > 0) return;

    setIsSending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/admin`,
        },
      });

      if (error) throw error;

      setIsSent(true);
      startCooldown(65);

      notify.success("Email verifikasi berhasil dikirim.");
    } catch (err) {
      const rawMessage = String(err?.message || "");

      const match = rawMessage.match(/after\s+(\d+)\s+seconds?/i);

      if (match) {
        const seconds = Number(match[1]);

        startCooldown(seconds);

        notify.error(
          `Silakan tunggu ${seconds} detik sebelum meminta email kembali.`,
        );
      } else {
        const apiError = normalizeApiError(err);
        notify.error(apiError.message);
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary px-5 py-10 text-second">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-second/15 p-8">
        <div>
          <h1 className="text-3xl font-bold">Verifikasi email</h1>

          <p className="mt-2 text-sm text-second/60">
            Silakan periksa email Anda dan klik tautan verifikasi yang kami
            kirimkan untuk mengaktifkan akun.
          </p>
        </div>

        <div className="rounded-xl border border-second/15 p-4">
          <p className="text-sm text-second/60">Email tujuan</p>

          <p className="mt-1 break-all font-medium">
            {email || "Alamat email tidak tersedia"}
          </p>
        </div>

        <p className="text-sm leading-6 text-second/70">
          Jika email belum diterima, periksa folder spam. Anda dapat meminta
          email verifikasi kembali setelah waktu tunggu selesai.
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={!email || isSending || countdown > 0}
          className="w-full rounded-full bg-grad px-4 py-3 font-semibold text-primary disabled:opacity-50 cursor-pointer"
        >
          {isSending
            ? "Mengirim email..."
            : countdown > 0
              ? `Kirim ulang dalam ${countdown} detik`
              : isSent
                ? "Kirim ulang email"
                : "Kirim email verifikasi"}
        </button>

        <p className="text-center text-sm text-second/70">
          Sudah melakukan verifikasi?{" "}
          <Link
            href="/auth/login"
            className="font-semibold underline text-second3"
          >
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-primary px-5 text-second">
          Memuat halaman...
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
