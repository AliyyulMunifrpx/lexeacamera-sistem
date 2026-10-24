"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getCurrentUser, loginUser, logoutUser, registerUser } from "./api.js";
import { clearAuthTokens, getAccessToken, saveAuthTokens } from "../../../lib/auth/token-storage.js";

export function useRegister() {
  return useMutation({
    mutationFn: registerUser,
  });
}

export function useLogin() {
  const router = useRouter();

  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      saveAuthTokens(data);
      router.replace("/admin/");
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    enabled: Boolean(getAccessToken()),
    retry: false,
  });
}

export function useLogout() {
  const router = useRouter();

  return useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      clearAuthTokens();
      router.replace("/auth/login");
    },
  });
}
