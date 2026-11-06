"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../app/features/auth/hooks.js";

const HOME = { OWNER: "/owner", ADMIN: "/admin" };

// role: "OWNER" atau "ADMIN" = area yang dijaga. User dengan role lain
// dikirim ke area miliknya sendiri.
export default function AuthGuard({ role, children }) {
  const router = useRouter();

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
  const isWrongRole = Boolean(user && role && user.role !== role);

  useEffect(() => {
    if (isUnauthorized) {
      router.replace("/auth/login");
    } else if (isWrongRole) {
      router.replace(HOME[user.role] ?? "/auth/login");
    }
  }, [isUnauthorized, isWrongRole, user, router]);

  if (isUnauthorized || isWrongRole || (!user && (isPending || isFetching))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary text-sm text-second">
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
