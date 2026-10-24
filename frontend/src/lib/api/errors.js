import axios from "axios";
import { getErrorMessage, getValidationMessage } from "./error-messages";

export function normalizeApiError(error) {
  const response = error?.response;
  const body = response?.data;
  const errors = body?.errors;

  const code =
    typeof errors === "string" && /^[A-Z][A-Z_]+$/.test(errors)
      ? errors
      : errors?.code || body?.code || null;

  const backendMessage =
    typeof errors === "string"
      ? errors
      : errors?.message || errors?.detail || body?.message || null;

  const message =
    getErrorMessage(code, null) !== "Terjadi kesalahan. Silakan coba lagi."
      ? getErrorMessage(code)
      : getValidationMessage(backendMessage) ||
        backendMessage ||
        (axios.isAxiosError(error) ? error.message : error?.message) ||
        "Terjadi kesalahan. Silakan coba lagi.";

  return {
    code,
    message,
    status: response?.status ?? null,
    detail:
      typeof errors === "object" && errors !== null
        ? (errors.detail ?? null)
        : null,
  };
}

export function isUnauthorizedError(error) {
  return error?.response?.status === 401;
}
