import Joi from "joi";

export const MAX_IMPORT_ROWS = 200;
const MAX_INT = 2147483647;

const money = Joi.number().integer().min(0).max(MAX_INT);
const flag = Joi.boolean()
  .truthy("ya", "y", "yes", "1")
  .falsy("tidak", "t", "no", "0")
  .empty("", null)
  .default(false);

export const importCameraRowSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  category: Joi.string().trim().max(100).required(),
  price: money.required(),
  modal: money.required(),
  strikethrough_price: money.empty("", null).default(null),
  stock: money.required(),
  condition: Joi.string()
    .trim()
    .lowercase()
    .valid("new", "baru", "second", "bekas")
    .empty("")
    .default("new"),
  sku: Joi.string().trim().max(100).required(),
  serial_number: Joi.string().trim().max(100).required(),
  color: Joi.string().trim().max(50).required(),
  shutter_count: Joi.string().trim().max(50).required(),
  description: Joi.string().max(1000).allow("").empty(null).default(""),
  inclusions: Joi.string().max(1000).allow("").empty(null).default(""),
  promo: flag,
  best_selling: flag,
});

export const importCamerasValidation = Joi.object({
  dry_run: Joi.boolean().default(false),
  rows: Joi.array()
    .items(Joi.object().unknown(true))
    .min(1)
    .max(MAX_IMPORT_ROWS)
    .required(),
});

export const ROW_MESSAGES = {
  "any.required": "wajib diisi",
  "string.empty": "wajib diisi",
  "string.base": "harus berupa teks",
  "string.max": "terlalu panjang (maksimal {#limit} karakter)",
  "number.base": "harus berupa angka",
  "number.integer": "harus bilangan bulat",
  "number.min": "minimal {#limit}",
  "number.max": "terlalu besar",
  "number.unsafe": "terlalu besar",
  "boolean.base": "isi dengan Ya atau Tidak",
  "any.only": "nilai tidak dikenal",
  "object.unknown": "kolom tidak dikenal",
};
