import Joi from "joi";
import {
  customerAddress,
  customerName,
  customerWhatsapp,
  items,
  money,
  nullableText,
} from "./order-validation.js";

const id = Joi.string().uuid().required();

// YYYY-MM-DD yang benar-benar ada di kalender (2026-02-30 ditolak)
const dateOnly = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error("any.invalid");
    }
    return value;
  });

export const createInvoiceValidation = Joi.object({
  customer_name: customerName.required(),
  customer_address: customerAddress.required(),
  customer_whatsapp: customerWhatsapp.required(),
  customer_instagram: nullableText(100),
  items,
  payment_method: nullableText(100),
  ship: nullableText(100),
  store_discount: money.allow(null),
  customer_discount: money.allow(null),
  is_final: Joi.boolean(), // true = langsung final, kosong/false = masih bisa diedit sekali
});

export const getAllInvoiceValidation = Joi.object({
  search: Joi.string().trim().max(100).allow(""),
  created_from: dateOnly,
  created_to: dateOnly,
  is_final: Joi.boolean(),
  page: Joi.number().integer().min(1).default(1),
});

export const getInvoiceValidation = Joi.object({ id });
export const deleteInvoiceValidation = Joi.object({ id });

// Item dan field turunan (no_invoice, total_amount, is_final, dst) sengaja tidak ada
const EDITABLE_FIELDS = [
  "store_name",
  "store_address",
  "whatsapp_store",
  "instagram_store",
  "payment_method",
  "ship",
  "customer_name",
  "customer_address",
  "customer_whatsapp",
  "customer_instagram",
  "store_discount",
  "customer_discount",
];

export const updateInvoiceValidation = Joi.object({
  id,
  store_name: Joi.string().trim().max(100),
  store_address: nullableText(500),
  whatsapp_store: nullableText(100),
  instagram_store: nullableText(100),
  payment_method: nullableText(100),
  ship: nullableText(100),
  customer_name: customerName,
  customer_address: customerAddress,
  customer_whatsapp: customerWhatsapp,
  customer_instagram: nullableText(100),
  store_discount: money.allow(null),
  customer_discount: money.allow(null),
}).or(...EDITABLE_FIELDS);
