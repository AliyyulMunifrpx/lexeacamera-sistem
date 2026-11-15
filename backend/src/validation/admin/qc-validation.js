import Joi from "joi";

const MAX_INT = 2147483647;
const SECTIONS = ["PHYSICAL", "FUNCTION", "ACCESSORY", "COMPLETENESS"];

const calendarDate = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error("any.invalid");
    }

    return value;
  });

const optionalText = (max) =>
  Joi.string().trim().max(max).allow("", null).optional();

const uuid = Joi.string().uuid();

const price = Joi.number().integer().min(0).max(MAX_INT).allow(null);

export const qcItemIdValidation = Joi.object({
  id: uuid.required(),
});

export const getAllQcItemValidation = Joi.object({
  section: Joi.string()
    .valid(...SECTIONS)
    .optional(),
  is_active: Joi.boolean().optional(),
});

export const createQcItemValidation = Joi.object({
  section: Joi.string()
    .valid(...SECTIONS)
    .required(),
  name: Joi.string().trim().min(1).max(100).required(),
  sort_order: Joi.number().integer().min(0).max(100000).optional(),
});

export const updateQcItemValidation = Joi.object({
  id: uuid.required(),
  name: Joi.string().trim().min(1).max(100).optional(),
  is_active: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).max(100000).optional(),
}).or("name", "is_active", "sort_order");

const entry = Joi.object({
  item_id: uuid,
  section: Joi.string().valid(...SECTIONS),
  name: Joi.string().trim().min(1).max(100),
  checked: Joi.boolean(),
  classification: Joi.string().valid("NORMAL", "MINOR"),
  origin: Joi.string().valid("ORIGINAL", "OEM"),
  note: optionalText(500),
})
  .xor("item_id", "name")
  .with("name", "section")
  .without("item_id", "section");

const extra = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
});

const entries = Joi.array().items(entry).max(150);
const extras = Joi.array().items(extra).max(30);

export const createQcValidation = Joi.object({
  date: calendarDate.optional(),
  type: Joi.string().valid("BUY", "SELL").required(),
  status: Joi.string().valid("DEAL", "CANCEL").required(),
  product_name: Joi.string().trim().min(1).max(150).required(),
  serial_number: optionalText(100),
  sender_name: optionalText(100),
  tracking_number: optionalText(100),
  pic: optionalText(100),
  price: price.optional(),
  entries: entries.default([]),
  extras: extras.default([]),
});

export const updateQcValidation = Joi.object({
  id: uuid.required(),
  date: calendarDate.optional(),
  type: Joi.string().valid("BUY", "SELL").optional(),
  product_name: Joi.string().trim().min(1).max(150).optional(),
  serial_number: optionalText(100),
  sender_name: optionalText(100),
  tracking_number: optionalText(100),
  pic: optionalText(100),
  price: price.optional(),
  entries: entries.optional(),
  extras: extras.optional(),
}).or(
  "date",
  "type",
  "product_name",
  "serial_number",
  "sender_name",
  "tracking_number",
  "pic",
  "price",
  "entries",
  "extras",
);

export const qcIdValidation = Joi.object({
  id: uuid.required(),
});

export const getAllQcValidation = Joi.object({
  search: Joi.string().trim().max(100).allow("").optional(),
  type: Joi.string().valid("BUY", "SELL").optional(),
  status: Joi.string().valid("DEAL", "CANCEL").optional(),
  date_from: calendarDate.optional(),
  date_to: calendarDate.optional(),
  page: Joi.number().integer().min(1).default(1),
});

export const setQcStatusValidation = Joi.object({
  id: uuid.required(),
  status: Joi.string().valid("DEAL", "CANCEL").required(),
});

export const qcUploadUrlValidation = Joi.object({
  id: uuid.required(),
  kind: Joi.string().valid("PHOTO", "VIDEO").required(),
  content_type: Joi.string().trim().max(100).required(),
});

export const qcAddMediaValidation = Joi.object({
  id: uuid.required(),
  kind: Joi.string().valid("PHOTO", "VIDEO").required(),
  path: Joi.string().trim().max(300).required(),
});

export const qcMediaIdValidation = Joi.object({
  id: uuid.required(),
  media_id: uuid.required(),
});
