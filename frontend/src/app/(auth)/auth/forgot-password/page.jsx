"use client";

import { useState } from "react";
import Link from "next/link";
import api from "../../../../lib/api/client.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import { useForgotPassword } from "../../../features/auth/hooks.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const forgotPassword = useForgotPassword();
  async function handleSubmit(event) {
    event.preventDefault();

    if (isSending) return;

    setIsSending(true);
    setIsSent(false);

    try {
      await forgotPassword.mutateAsync({
        email: email.trim(),
      });

      setIsSent(true);
      notify.success("Jika email terdaftar, tautan pemulihan akan dikirimkan.");
    } catch (err) {
      const apiError = normalizeApiError(err);
      notify.error(apiError.message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary px-5 py-10 text-second">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-second/30 p-8">
        <div>
          <h1 className="text-3xl font-bold">Lupa kata sandi?</h1>
          <p className="mt-2 text-sm leading-6 text-second/60">
            Masukkan alamat email yang terhubung dengan akun Anda. Kami akan
            mengirimkan tautan untuk mengatur ulang kata sandi.
          </p>
        </div>

        {isSent ? (
          <div
            role="status"
            className="space-y-3 rounded-xl border border-second/30 p-4"
          >
            <p className="font-medium">Periksa email Anda</p>
            <p className="break-all text-sm text-second/60">{email.trim()}</p>
            <p className="text-sm leading-6 text-second/70">
              Jika alamat email tersebut terdaftar, Anda akan menerima tautan
              pemulihan. Periksa juga folder spam. Kalau belum masuk, tunggu
              sekitar 1 menit sebelum meminta lagi.
            </p>
            <button
              type="button"
              onClick={() => setIsSent(false)}
              className="text-sm font-semibold underline underline-offset-4 cursor-pointer"
            >
              Coba alamat email lain
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-xl border border-second/30 bg-transparent px-4 py-3 outline-none transition-colors placeholder:text-second/35 focus:border-second/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full rounded-full bg-grad px-4 py-3 font-semibold text-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? "Mengirim tautan..." : "Kirim tautan pemulihan"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-second/70">
          Ingat kata sandi Anda?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-second3 underline underline-offset-4"
          >
            Masuk
          </Link>
        </p>
      </section>
    </main>
  );
}
