"use client";

import { useState } from "react";
import Link from "next/link";
import { useLogin } from "../../../features/auth/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";
import { useRouter } from "next/navigation";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await login.mutateAsync({
        email: email.trim(),
        password,
      });

      notify.success("Login berhasil");

      // Hard navigation: semua state client (cache query, Router Cache,
      // nilai token basi) dibuang, lalu /owner dirender ulang dengan token baru.
      window.location.assign("/owner");
    } catch (err) {
      const apiError = normalizeApiError(err);
      notify.error(apiError.message);

      // Jika email belum diverifikasi, arahkan ke halaman verifikasi.
      if (apiError.code === "EMAIL_NOT_VERIVIED") {
        router.push(
          `/auth/verify-email?email=${encodeURIComponent(email.trim())}`,
        );
      }
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary px-5 py-10 text-second">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-second/30 p-8"
      >
        <div>
          <h1 className="text-3xl font-bold">Selamat datang kembali</h1>
          <p className="mt-2 text-sm text-second/60">
            Masuk ke akun Anda untuk melanjutkan.
          </p>
        </div>

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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-sm font-medium">
              Kata sandi
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-sm text-second/60 underline underline-offset-4 transition-colors hover:text-second"
            >
              Lupa kata sandi?
            </Link>
          </div>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan kata sandi"
              className="w-full rounded-xl border border-second/30 bg-transparent px-4 py-3 pr-12 outline-none transition-colors placeholder:text-second/35 focus:border-second/50"
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={
                showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
              }
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-second/50 transition-colors hover:text-second focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-second"
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded-full bg-grad px-4 py-3 font-semibold text-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {login.isPending ? "Memproses..." : "Masuk"}
        </button>

        <p className="text-center text-sm text-second/70">
          Belum punya akun?{" "}
          <Link
            href="/auth/register"
            className="font-semibold text-second3 underline underline-offset-4"
          >
            Daftar
          </Link>
        </p>
      </form>
    </main>
  );
}
