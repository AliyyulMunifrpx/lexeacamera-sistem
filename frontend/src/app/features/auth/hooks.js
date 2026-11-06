"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { markAuthChanged } from "../../../lib/api/client.js";
import {
  forgotPassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  setPasswordUser,
} from "./api.js";

export function useRegister() {
  return useMutation({
    mutationFn: registerUser,
  });
}
export function useSetPassword() {
  return useMutation({
    mutationFn: setPasswordUser,
  });
}
export function useForgotPassword() {
  return useMutation({
    mutationFn: forgotPassword,
  });
}

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginUser,
    onSuccess: () => {
      markAuthChanged();
      queryClient.clear();
      router.replace("/admin/");
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      markAuthChanged();
      queryClient.clear();
      router.replace("/auth/login");
    },
  });
}
