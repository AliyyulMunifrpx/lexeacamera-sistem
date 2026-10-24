"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import notify from "../../../../lib/notify.js";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isUpdating) return;

    if (password !== confirmPassword) {
      notify.error("Konfirmasi kata sandi tidak sesuai.");
      return;
    }

    setIsUpdating(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      notify.success("Kata sandi berhasil diperbarui.");

      await supabase.auth.signOut();

      router.replace("/auth/login");
    } catch (err) {
      const apiError = normalizeApiError(err);
      notify.error(apiError.message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-primary px-5 py-10 text-second">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-second/15 p-8">
        <div>
          <h1 className="text-3xl font-bold">Atur ulang kata sandi</h1>
          <p className="mt-2 text-sm leading-6 text-second/60">
            Buat kata sandi baru untuk akun Anda. Gunakan kata sandi yang kuat
            dan mudah Anda ingat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              Kata sandi baru
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan kata sandi baru"
              className="w-full rounded-xl border border-second/15 bg-transparent px-4 py-3 outline-none transition-colors placeholder:text-second/35 focus:border-second/50"
            />
            <p className="text-xs text-second/50">
              Minimal 6 karakter atau sesuai ketentuan backend Anda.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium"
            >
              Konfirmasi kata sandi
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Masukkan kembali kata sandi"
              className="w-full rounded-xl border border-second/15 bg-transparent px-4 py-3 outline-none transition-colors placeholder:text-second/35 focus:border-second/50"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdating}
            className="w-full rounded-full bg-grad px-4 py-3 font-semibold text-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUpdating ? "Memperbarui..." : "Simpan kata sandi baru"}
          </button>
        </form>

        <p className="text-center text-sm text-second/70">
          Ingin kembali?{" "}
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
