import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPayroll,
  deletePayroll,
  getEmployeePayrolls,
  getPayroll,
  getPayrolls,
  togglePayrollItem,
  updatePayroll,
  updatePayrollStatus,
} from "./api.js";

export function useGetPayrolls(params) {
  return useQuery({
    queryKey: ["payrolls", params],
    queryFn: () => getPayrolls(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useGetEmployeePayrolls(employeeId, params) {
  return useQuery({
    queryKey: ["payrolls", "employee", employeeId, params],
    queryFn: () => getEmployeePayrolls(employeeId, params),
    enabled: Boolean(employeeId),
    placeholderData: (previousData) => previousData,
  });
}

export function useGetPayroll(id) {
  return useQuery({
    queryKey: ["payroll", id],
    queryFn: () => getPayroll(id),
    enabled: Boolean(id),
  });
}

/* Setelah slip berubah: perbarui detailnya, lalu segarkan semua daftar. */
function useSyncPayroll() {
  const queryClient = useQueryClient();

  return (slip) => {
    if (slip?.id) queryClient.setQueryData(["payroll", slip.id], slip);
    queryClient.invalidateQueries({ queryKey: ["payrolls"] });
  };
}

export function useCreatePayroll() {
  const sync = useSyncPayroll();
  return useMutation({ mutationFn: createPayroll, onSuccess: sync });
}

export function useUpdatePayroll() {
  const sync = useSyncPayroll();
  return useMutation({ mutationFn: updatePayroll, onSuccess: sync });
}

export function useUpdatePayrollStatus() {
  const sync = useSyncPayroll();
  return useMutation({ mutationFn: updatePayrollStatus, onSuccess: sync });
}

export function useTogglePayrollItem() {
  const sync = useSyncPayroll();
  return useMutation({ mutationFn: togglePayrollItem, onSuccess: sync });
}

export function useDeletePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePayroll,
    onSuccess: (_data, id) => {
      // Jangan segarkan detail yang baru dihapus (akan 404).
      queryClient.removeQueries({ queryKey: ["payroll", id] });
      queryClient.invalidateQueries({ queryKey: ["payrolls"] });
    },
  });
}
