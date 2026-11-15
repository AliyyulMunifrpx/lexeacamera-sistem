import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createQcItem,
  createQualityControl,
  deleteQcItem,
  deleteQcMedia,
  deleteQualityControl,
  getQcItems,
  getQualityControl,
  getQualityControls,
  updateQcItem,
  updateQualityControl,
  updateQualityControlStatus,
} from "./api.js";

export function useGetQualityControls(filters) {
  return useQuery({
    queryKey: ["quality controls", filters],
    queryFn: () => getQualityControls(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useGetQualityControl(id) {
  return useQuery({
    queryKey: ["quality control", id],
    queryFn: () => getQualityControl(id),
    enabled: Boolean(id),
  });
}

export function useCreateQualityControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createQualityControl,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["quality controls"] }),
  });
}

export function useUpdateQualityControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateQualityControl(id, data),
    onSuccess: (_result, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quality control", id] }),
        queryClient.invalidateQueries({ queryKey: ["quality controls"] }),
      ]),
  });
}

export function useUpdateQcStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => updateQualityControlStatus(id, status),
    onSuccess: (_result, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quality control", id] }),
        queryClient.invalidateQueries({ queryKey: ["quality controls"] }),
      ]),
  });
}

export function useDeleteQualityControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteQualityControl(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: ["quality control", id] });
      queryClient.invalidateQueries({ queryKey: ["quality controls"] });
    },
  });
}

export function useDeleteQcMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mediaId }) => deleteQcMedia(id, mediaId),
    onSuccess: (_result, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quality control", id] }),
        queryClient.invalidateQueries({ queryKey: ["quality controls"] }),
      ]),
  });
}

export function useGetQcItems(filters = {}) {
  return useQuery({
    queryKey: ["qc items", filters],
    queryFn: () => getQcItems(filters),
  });
}

function useItemMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["qc items"] }),
  });
}

export function useCreateQcItem() {
  return useItemMutation(createQcItem);
}

export function useUpdateQcItem() {
  return useItemMutation(({ id, data }) => updateQcItem(id, data));
}

export function useDeleteQcItem() {
  return useItemMutation((id) => deleteQcItem(id));
}
