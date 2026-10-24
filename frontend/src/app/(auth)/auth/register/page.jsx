"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRegister } from "../../../features/auth/hooks.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

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
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-2 w-full rounded-xl border border-second/20 bg-transparent px-4 py-3 outline-none focus:border-second"
          />
        </div>

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full rounded-full bg-grad px-4 py-3 font-semibold text-primary disabled:opacity-50"
        >
          {register.isPending ? "Mendaftarkan..." : "Daftar"}
        </button>

        <p className="text-center text-sm text-second/70">
          Sudah punya akun?{" "}
          <Link
            href="/auth/login"
            className="font-semibold underline text-second3"
          >
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}
