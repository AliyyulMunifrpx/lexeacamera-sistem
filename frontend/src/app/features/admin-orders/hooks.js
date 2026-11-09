import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateOrderPaymentStatus } from "./api.js";

// Status dan tanggal lunas mempengaruhi invoice, stok kamera, statistik pelanggan,
// dan laporan, jadi semuanya disegarkan. Sesuaikan daftar key dengan queryKey
// yang benar-benar kamu pakai di hooks lain.
const INVALIDATE_KEYS = [
  "invoices",
  "admin-invoices",
  "customers",
  "reports",
  "cameras",
  "admin-cameras",
  "dashboard",
];

export function useUpdateOrderPaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderPaymentStatus,
    onSuccess: () => {
      for (const key of INVALIDATE_KEYS) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
