export function formatDigitsInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // formatCurrency("1500000") = "Rp 1.500.000"
  // buang "Rp" + spasi di depan
  return formatCurrency(Number(digits)).replace(/^Rp\s?/, "");
}
export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "Rp0";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}
