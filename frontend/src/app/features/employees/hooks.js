import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createEmployee,
  getEmployee,
  getEmployees,
  resendEmployeeVerification,
  updateEmployee,
} from "./api.js";

export function useGetEmployees(filters) {
  return useQuery({
    queryKey: ["employees", filters],
    queryFn: () => getEmployees(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useGetEmployee(id) {
  return useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployee(id),
    enabled: Boolean(id),
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["employees", "create"],
    mutationFn: createEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["employees", "update"],
    mutationFn: ({ id, data }) => updateEmployee(id, data),
    onSuccess: (_result, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee", id] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
        // nama/status karyawan tampil di rekap absen
        queryClient.invalidateQueries({ queryKey: ["attendances"] }),
      ]),
  });
}

export function useResendEmployeeVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["employees", "resend"],
    mutationFn: (id) => resendEmployeeVerification(id),
    onSuccess: (_result, id) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee", id] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
      ]),
  });
}

/**
 * Mencari karyawan dengan email persis sama (tidak membedakan huruf besar kecil).
 * Dipakai saat mengundang admin: kalau emailnya sudah jadi karyawan, absen wajib aktif.
 * Mengembalikan objek karyawan atau null.
 */
export function useFindEmployeeByEmail(email) {
  return useQuery({
    queryKey: ["employees", "by-email", email],
    enabled: Boolean(email),
    retry: false,
    queryFn: async () => {
      const result = await getEmployees({
        search: email,
        status: "ALL",
        page: 1,
      });

      return (
        (result?.data ?? []).find(
          (employee) => employee.email?.toLowerCase() === email,
        ) ?? null
      );
    },
  });
}
