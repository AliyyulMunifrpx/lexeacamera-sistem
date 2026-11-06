import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAdmin,
  getAdmin,
  getAdmins,
  resendAdminInvite,
  updateAdmin,
} from "./api.js";

export function useGetAdmins(filters) {
  return useQuery({
    queryKey: ["admins", filters],
    queryFn: () => getAdmins(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useGetAdmin(id) {
  return useQuery({
    queryKey: ["admin", id],
    queryFn: () => getAdmin(id),
    enabled: Boolean(id),
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admins", "create"],
    mutationFn: createAdmin,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admins"] }),
        // admin dengan absen aktif ikut jadi karyawan
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
      ]),
  });
}

export function useUpdateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admins", "update"],
    mutationFn: ({ id, data }) => updateAdmin(id, data),
    onSuccess: (_result, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", id] }),
        queryClient.invalidateQueries({ queryKey: ["admins"] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
        queryClient.invalidateQueries({ queryKey: ["attendances"] }),
      ]),
  });
}

export function useResendAdminInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admins", "resend-invite"],
    mutationFn: (id) => resendAdminInvite(id),
    onSuccess: (_result, id) =>
      queryClient.invalidateQueries({ queryKey: ["admin", id] }),
  });
}
