"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "../../lib/auth/token-storage.js";
import { useCurrentUser } from "../../app/features/auth/hooks.js";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const hasToken = Boolean(getAccessToken());

  const { data: user, isPending, isError } = useCurrentUser();

  useEffect(() => {
    if (!hasToken) {
      router.replace("/auth/login");
      return;
    }

    if (isError) {
      router.replace("/auth/login");
    }
  }, [hasToken, isError, router]);

  if (!hasToken || isPending || isError || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-400">
        Memeriksa sesi...
      </div>
    );
  }

  return children;
}
