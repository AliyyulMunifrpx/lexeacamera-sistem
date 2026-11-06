import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createRefund, deleteRefund, getOrderRefunds } from "./api.js";

export function useGetOrderRefunds(orderId) {
  return useQuery({
    queryKey: ["order-refunds", orderId],
    queryFn: () => getOrderRefunds(orderId),
    enabled: Boolean(orderId),
  });
}

/* Refund memengaruhi: ringkasan refund, detail & daftar order, dan stok kamera
   (kalau dibuat langsung lunas). */
function invalidateRefundRelated(queryClient, orderId) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["order-refunds", orderId] }),
    queryClient.invalidateQueries({ queryKey: ["owner-order", orderId] }),
    queryClient.invalidateQueries({ queryKey: ["owner-orders"] }),
    queryClient.invalidateQueries({ queryKey: ["cameras"] }),
  ]);
}

export function useCreateRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["refunds", "create-refund"],
    mutationFn: ({ orderId, data }) => createRefund(orderId, data),
    onSuccess: (_, variables) =>
      invalidateRefundRelated(queryClient, variables.orderId),
  });
}

export function useDeleteRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["refunds", "delete-refund"],
    // orderId dipakai hanya untuk menyegarkan data order yang bersangkutan.
    mutationFn: ({ refundId }) => deleteRefund(refundId),
    onSuccess: (_, variables) =>
      invalidateRefundRelated(queryClient, variables.orderId),
  });
}
