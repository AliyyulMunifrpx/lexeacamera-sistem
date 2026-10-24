import { normalizeApiError } from "@/lib/api/errors";

export function reportError(error, context = "") {
  const normalized = normalizeApiError(error);

  if (process.env.NODE_ENV === "development") {
    console.error(context ? `[${context}]` : "[Application Error]", {
      code: normalized.code,
      message: normalized.message,
      status: normalized.status,
      error,
    });
  }

  return normalized;
}

export default reportError;
