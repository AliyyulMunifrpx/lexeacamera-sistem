import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCurrentUser,
  updateCurrentName,
  updateCurrentEmail,
  updateCurrentPassword,
  logoutCurrentUser,
} from "./api.js";

export function useGetCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateCurrentName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["current-user", "update-name"],
    mutationFn: ({ name }) => updateCurrentName(name),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["current-user"], (currentUser) => ({
        ...currentUser,
        ...updatedUser,
      }));
    },
  });
}

export function useUpdateCurrentEmail() {
  return useMutation({
    mutationKey: ["current-user", "update-email"],
    mutationFn: ({ email }) => updateCurrentEmail(email),
  });
}

export function useUpdateCurrentPassword() {
  return useMutation({
    mutationKey: ["current-user", "update-password"],
    mutationFn: updateCurrentPassword,
  });
}
export function useLogoutCurrentUser() {
  return useMutation({
    mutationKey: ["current-user", "logout"],
    mutationFn: logoutCurrentUser,
  });
}
