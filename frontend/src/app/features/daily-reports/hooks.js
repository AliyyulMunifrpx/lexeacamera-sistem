"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

/* -------------------------------------------------------------------------- */
/*  SESUAIKAN 2 import ini dengan project kamu:                               */
/*  - api      : instance axios yang sudah dipakai hooks cameras/categories   */
/*  - supabase : client Supabase yang sudah dipakai untuk upload foto QC      */
/* -------------------------------------------------------------------------- */
import api from "../../../lib/api/client.js";
import { supabase } from "../../../lib/supabase.js";
import { getNextOpening, getReportHistory } from "./api.js";

const BASE = "/admin/daily-reports";

const listKey = (params) => ["daily-reports", "list", params];
const detailKey = (id) => ["daily-reports", "detail", id];

/* ---------------------------------- Query --------------------------------- */

// Response: { data: [...ringkasan], paging: {...} }
export function useGetDailyReports(params) {
  return useQuery({
    queryKey: listKey(params),
    queryFn: async () => {
      const response = await api.get(BASE, { params });
      return response.data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useGetDailyReport(id) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: async () => {
      const response = await api.get(`${BASE}/${id}`);
      return response.data.data;
    },
    enabled: Boolean(id),
  });
}

/* -------------------------------- Mutations -------------------------------- */

// Semua endpoint laporan/baris mengembalikan detail terbaru,
// jadi cukup taruh langsung ke cache detail.
function useDetailMutation(mutationFn) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (detail) => {
      queryClient.setQueryData(detailKey(detail.id), detail);
      queryClient.invalidateQueries({ queryKey: ["daily-reports", "list"] });
    },
  });
}

export function useCreateDailyReport() {
  return useDetailMutation(async (data) => {
    const response = await api.post(BASE, data);
    return response.data.data;
  });
}

export function useUpdateDailyReport() {
  return useDetailMutation(async ({ id, data }) => {
    const response = await api.patch(`${BASE}/${id}`, data);
    return response.data.data;
  });
}

export function useDeleteDailyReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }) => {
      const response = await api.delete(`${BASE}/${id}`);
      return response.data.data;
    },
    onSuccess: (_result, { id }) => {
      queryClient.removeQueries({ queryKey: detailKey(id) });
      queryClient.invalidateQueries({ queryKey: ["daily-reports", "list"] });
    },
  });
}

export function useCreateEntry() {
  return useDetailMutation(async ({ id, data }) => {
    const response = await api.post(`${BASE}/${id}/entries`, data);
    return response.data.data;
  });
}

export function useUpdateEntry() {
  return useDetailMutation(async ({ id, entryId, data }) => {
    const response = await api.patch(`${BASE}/${id}/entries/${entryId}`, data);
    return response.data.data;
  });
}

export function useDeleteEntry() {
  return useDetailMutation(async ({ id, entryId }) => {
    const response = await api.delete(`${BASE}/${id}/entries/${entryId}`);
    return response.data.data;
  });
}

/* ---------------------------- Bukti transfer ------------------------------ */

// 3 langkah: minta izin upload -> upload ke Supabase -> daftarkan path.
export function useUploadProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }) => {
      const permission = await api.post(`${BASE}/${id}/proof/upload-url`, {
        content_type: file.type,
      });
      const upload = permission.data.data;

      const { error } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, file);

      if (error) {
        throw new Error("Gagal mengunggah file ke penyimpanan.");
      }

      const response = await api.put(`${BASE}/${id}/proof`, {
        path: upload.path,
      });

      return response.data.data;
    },
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: detailKey(id) });
      queryClient.invalidateQueries({ queryKey: ["daily-reports", "list"] });
    },
  });
}

export function useDeleteProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }) => {
      const response = await api.delete(`${BASE}/${id}/proof`);
      return response.data.data;
    },
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: detailKey(id) });
      queryClient.invalidateQueries({ queryKey: ["daily-reports", "list"] });
    },
  });
}
/* Dihitung dari laporan sebelumnya, jadi selalu ambil ulang saat form dibuka. */
export function useGetNextOpening(date) {
  return useQuery({
    queryKey: ["daily report next opening", date ?? "today"],
    queryFn: () => getNextOpening(date),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
/* signature: ringkasan data laporan, supaya riwayat ikut dimuat ulang setelah ada perubahan. */
export function useGetReportHistory(id, page = 1, signature = "") {
  return useQuery({
    queryKey: ["daily report history", id, page, signature],
    queryFn: () => getReportHistory(id, { page }),
    enabled: Boolean(id),
    placeholderData: (previousData) => previousData,
  });
}
