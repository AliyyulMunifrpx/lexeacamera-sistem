import crypto from "node:crypto";

const ID_PREFIX = "cust-";
const ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ID_LENGTH = 5;

export const CUSTOMER_ID_PATTERN = /^cust-[2-9A-HJ-NP-Z]{5}$/;

export const generateCustomerId = () => {
  let suffix = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    suffix += ID_ALPHABET[crypto.randomInt(ID_ALPHABET.length)];
  }

  return `${ID_PREFIX}${suffix}`;
};

export const normalizeWhatsapp = (value) => {
  const raw = String(value).trim();
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;

  return `62${digits}`;
};

export const blankToNull = (value) =>
  value === undefined || value === null || value === "" ? null : value;
