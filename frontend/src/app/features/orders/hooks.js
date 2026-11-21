import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteOwnerOrder,
  getOwnerOrder,
  getOwnerOrders,
  updateOrderItems,
  updateOrderPaymentStatus,
} from "./api.js";

export function useGetOwnerOrders(filters) {
  return useQuery({
    queryKey: ["owner-orders", filters],
    queryFn: () => getOwnerOrders(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useGetOwnerOrder(id) {
  return useQuery({
    queryKey: ["owner-order", id],
    queryFn: () => getOwnerOrder(id),
    enabled: Boolean(id),
  });
}

const isInvoiceOrDashboardKey = (query) => {
  const root = query.queryKey?.[0];
  return typeof root === "string" && /invoice|dashboard/i.test(root);
};

export function useUpdateOrderPaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["owner-orders", "update-payment-status"],
    mutationFn: ({ id, data }) => updateOrderPaymentStatus(id, data),
    onSuccess: async (_, variables) => {
      // Status bayar mengubah stok, jatah edit invoice, sisa tagihan, dan dashboard.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["owner-order", variables.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["owner-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["cameras"] }),
        queryClient.invalidateQueries({ predicate: isInvoiceOrDashboardKey }),
      ]);
    },
  });
}
export function useUpdateOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["owner-orders", "update-items"],
    mutationFn: ({ id, data }) => updateOrderItems(id, data),
    onSuccess: async (_, variables) => {
      // Isi pesanan mengubah total di order DAN invoice-nya (stok tidak berubah).
      // Sesuaikan key invoice dengan yang dipakai features/invoices/hooks.js.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["owner-order", variables.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["owner-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice"] }),
      ]);
    },
  });
}
export function useDeleteOwnerOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteOwnerOrder(id),
    onSuccess: (_result, id) =>
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey.map((part) => String(part).toLowerCase());
          const related =
            key[0]?.includes("order") || key[0]?.includes("invoice");
          // Jangan refetch detail order yang baru dihapus.
          return related && !query.queryKey.includes(id);
        },
      }),
  });
}
