"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useRegister } from "../../../features/auth/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      notify.error("Konfirmasi password tidak cocok.");
      return;
    }

    try {
      await register.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      const normalizedEmail = email.trim().toLowerCase();

      sessionStorage.setItem(
        `verify-email-cooldown:${normalizedEmail}`,
        String(Date.now() + 65_000),
      );

      router.push(
        `/auth/verify-email?email=${encodeURIComponent(email.trim())}`,
      );
    } catch (err) {
      const apiError = normalizeApiError(err);
      notify.error(apiError.message);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary px-5 py-10 text-second">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-second/15 p-8"
      >
        <div>
          <h1 className="text-3xl font-bold">Buat akun</h1>
          <p className="mt-2 text-sm text-second/60">
            Daftar untuk melanjutkan.
          </p>
        </div>

        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Nama
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            className="mt-2 w-full rounded-xl border border-second/20 bg-transparent px-4 py-3 outline-none focus:border-second"
          />
        </div>

        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="mt-2 w-full rounded-xl border border-second/20 bg-transparent px-4 py-3 outline-none focus:border-second"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>

          <div className="relative mt-2">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded-xl border border-second/20 bg-transparent px-4 py-3 pr-12 outline-none focus:border-second"
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-second/50 transition-colors hover:text-second focus-visible:outline focus-visible:outline-2 focus-visible:outline-second"
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" className="text-sm font-medium">
            Konfirmasi password
          </label>

          <div className="relative mt-2">
            <input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              aria-invalid={
                confirmPassword.length > 0 && password !== confirmPassword
              }
              className="w-full rounded-xl border border-second/20 bg-transparent px-4 py-3 pr-12 outline-none focus:border-second aria-[invalid=true]:border-red-500"
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={
                showConfirmPassword
                  ? "Sembunyikan konfirmasi password"
                  : "Tampilkan konfirmasi password"
              }
              aria-pressed={showConfirmPassword}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-second/50 transition-colors hover:text-second focus-visible:outline focus-visible:outline-2 focus-visible:outline-second"
            >
              {showConfirmPassword ? (
                <FiEyeOff size={18} />
              ) : (
                <FiEye size={18} />
              )}
            </button>
          </div>

          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="mt-2 text-xs text-red-500" role="status">
              Password tidak cocok.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full rounded-full bg-grad px-4 py-3 font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {register.isPending ? "Mendaftarkan..." : "Daftar"}
        </button>

        <p className="text-center text-sm text-second/70">
          Sudah punya akun?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-second3 underline underline-offset-4"
          >
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}
