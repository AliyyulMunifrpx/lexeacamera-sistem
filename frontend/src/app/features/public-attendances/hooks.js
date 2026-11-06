import { useMutation, useQuery } from "@tanstack/react-query";

import {
  checkIn,
  checkOut,
  getAttendanceEmployees,
  getAttendanceHistory,
  getAttendanceToday,
  getEmployeeTokenInfo,
  setEmployeePin,
} from "./api.js";

export function useGetEmployeeTokenInfo(token) {
  return useQuery({
    queryKey: ["employee-token-info", token],
    queryFn: () => getEmployeeTokenInfo(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function useSetEmployeePin() {
  return useMutation({
    mutationKey: ["employees", "set-pin"],
    mutationFn: setEmployeePin,
  });
}

/* ---------- Absen (halaman /absen) ---------- */

export function useGetAttendanceEmployees() {
  return useQuery({
    queryKey: ["attendance-employees"],
    queryFn: getAttendanceEmployees,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCheckIn() {
  return useMutation({
    mutationKey: ["public-attendance", "check-in"],
    mutationFn: checkIn,
  });
}

export function useCheckOut() {
  return useMutation({
    mutationKey: ["public-attendance", "check-out"],
    mutationFn: checkOut,
  });
}

export function useGetAttendanceToday() {
  return useQuery({
    queryKey: ["public-attendance-today"],
    queryFn: getAttendanceToday,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });
}

export function useGetAttendanceHistory() {
  return useMutation({
    mutationFn: getAttendanceHistory,
  });
}
