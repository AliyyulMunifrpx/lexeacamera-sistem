import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 32;

export const hashPin = async (pin) => {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pin, salt, KEY_LENGTH);

  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
};

export const verifyPin = async (pin, stored) => {
  const [scheme, saltHex, keyHex] = String(stored).split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(pin, Buffer.from(saltHex, "hex"), expected.length);

  return crypto.timingSafeEqual(actual, expected);
};

export const generateToken = () => crypto.randomBytes(32).toString("hex");

export const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
