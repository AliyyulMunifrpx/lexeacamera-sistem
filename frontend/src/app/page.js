"use client";
import Image from "next/image";
import { useGetHome } from "./features/public/hooks.js";
import { useEffect } from "react";

export default function Home() {
  const { data, isLoading, isError, error } = useGetHome();
  useEffect(() => {
    if (!isError || !error) return;

    const apiError = normalizeApiError(error);
    notify.error(apiError.message);
  }, [isError, error]);
  return <div></div>;
}
