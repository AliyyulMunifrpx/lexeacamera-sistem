"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "../../lib/auth/token-storage.js";
import { useCurrentUser } from "../../app/features/auth/hooks.js";

export default function AuthGuard({ children }) {
  const router = useRouter();

  // null = belum dicek. Token dibaca setelah mount, bukan saat render pertama.
  const [hasToken, setHasToken] = useState(null);

  useEffect(() => {
    setHasToken(Boolean(getAccessToken()));
  }, []);

  const {
    data: user,
    error,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useCurrentUser();

  const isUnauthorized =
    isError && !isFetching && error?.response?.status === 401;

  useEffect(() => {
    if (hasToken === false || isUnauthorized) {
      router.replace("/auth/login");
    }
  }, [hasToken, isUnauthorized, router]);

  if (
    hasToken === null ||
    hasToken === false ||
    isUnauthorized ||
    (!user && (isPending || isFetching))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-400">
        Memeriksa sesi...
      </div>
    );
  }

  // Error selain 401 (server error, timeout, cold start): jangan logout.
  if (isError && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 text-sm text-neutral-400">
        <p>Server sedang tidak merespons. Sesi Anda masih tersimpan.</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-full border border-neutral-600 px-4 py-2 text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {isFetching ? "Memuat..." : "Coba lagi"}
        </button>
      </div>
    );
  }

  return children;
}
