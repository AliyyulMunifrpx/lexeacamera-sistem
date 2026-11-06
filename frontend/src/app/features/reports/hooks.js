import { useQuery } from "@tanstack/react-query";

import {
  getReportCategories,
  getReportCustomers,
  getReportCustomersSummary,
  getReportProducts,
  getReportStockValue,
  getReportSummary,
  getReportTransactions,
  getReportTrend,
} from "./api.js";

/* Data laporan hanya dibaca; placeholderData menjaga tampilan lama saat filter berganti. */
const keepPrevious = (previousData) => previousData;

export function useGetReportSummary(filters) {
  return useQuery({
    queryKey: ["report-summary", filters],
    queryFn: () => getReportSummary(filters),
    placeholderData: keepPrevious,
  });
}

export function useGetReportTrend(filters) {
  return useQuery({
    queryKey: ["report-trend", filters],
    queryFn: () => getReportTrend(filters),
    placeholderData: keepPrevious,
  });
}

export function useGetReportProducts(filters) {
  return useQuery({
    queryKey: ["report-products", filters],
    queryFn: () => getReportProducts(filters),
    placeholderData: keepPrevious,
  });
}

export function useGetReportCategories(filters) {
  return useQuery({
    queryKey: ["report-categories", filters],
    queryFn: () => getReportCategories(filters),
    placeholderData: keepPrevious,
  });
}

export function useGetReportCustomers(filters) {
  return useQuery({
    queryKey: ["report-customers", filters],
    queryFn: () => getReportCustomers(filters),
    placeholderData: keepPrevious,
  });
}

export function useGetReportCustomersSummary(filters) {
  return useQuery({
    queryKey: ["report-customers-summary", filters],
    queryFn: () => getReportCustomersSummary(filters),
    placeholderData: keepPrevious,
  });
}

export function useGetReportTransactions(filters) {
  return useQuery({
    queryKey: ["report-transactions", filters],
    queryFn: () => getReportTransactions(filters),
    placeholderData: keepPrevious,
  });
}

export function useGetReportStockValue() {
  return useQuery({
    queryKey: ["report-stock-value"],
    queryFn: getReportStockValue,
    placeholderData: keepPrevious,
  });
}
