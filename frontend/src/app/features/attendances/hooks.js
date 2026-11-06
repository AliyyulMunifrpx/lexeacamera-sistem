import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAttendanceNetwork,
  deleteAttendanceNetwork,
  getAttendanceNetworks,
  getAttendanceSettings,
  getAttendances,
  getMyIp,
  updateAttendance,
  updateAttendanceNetwork,
  updateAttendanceSettings,
} from "./api.js";

export function useGetAttendanceNetworks() {
  return useQuery({
    queryKey: ["attendance-networks"],
    queryFn: getAttendanceNetworks,
  });
}

export function useGetAttendanceSettings() {
  return useQuery({
    queryKey: ["attendance-settings"],
    queryFn: getAttendanceSettings,
  });
}

/* Dipanggil manual lewat refetch() (tombol "Ambil IP otomatis"). */
export function useGetMyIp() {
  return useQuery({
    queryKey: ["my-ip"],
    queryFn: getMyIp,
    enabled: false,
    retry: false,
    gcTime: 0,
  });
}

/* Jumlah jaringan aktif ada di pengaturan, jadi keduanya disegarkan bersama. */
function invalidateAttendance(queryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["attendance-networks"] }),
    queryClient.invalidateQueries({ queryKey: ["attendance-settings"] }),
  ]);
}

export function useCreateAttendanceNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendance-networks", "create"],
    mutationFn: createAttendanceNetwork,
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useUpdateAttendanceNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendance-networks", "update"],
    mutationFn: ({ id, data }) => updateAttendanceNetwork(id, data),
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useDeleteAttendanceNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendance-networks", "delete"],
    mutationFn: (id) => deleteAttendanceNetwork(id),
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useUpdateAttendanceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendance-settings", "update"],
    mutationFn: updateAttendanceSettings,
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

/* ---------- Rekap absen ---------- */

export function useGetAttendances(filters) {
  return useQuery({
    queryKey: ["attendances", filters],
    queryFn: () => getAttendances(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendances", "update"],
    mutationFn: ({ id, data }) => updateAttendance(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["attendances"] }),
  });
}
