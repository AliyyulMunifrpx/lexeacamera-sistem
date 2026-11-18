import Joi from "joi";

const MAX_INT = 2147483647;

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

const uuid = Joi.string().uuid();
const money = Joi.number().integer().min(0).max(MAX_INT);
const method = Joi.string().valid("CASH", "NON_CASH");
const optionalText = (max) =>
  Joi.string().trim().max(max).allow("", null).optional();

export const reportIdValidation = Joi.object({
  id: uuid.required(),
});

export const getAllReportValidation = Joi.object({
  date_from: calendarDate.optional(),
  date_to: calendarDate.optional(),
  remitted: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
});

export const historyValidation = Joi.object({
  id: uuid.required(),
  page: Joi.number().integer().min(1).default(1),
});

export const createReportValidation = Joi.object({
  date: calendarDate.optional(),
  opening_cash: money.optional(),
  opening_noncash: money.optional(),
});

export const nextOpeningValidation = Joi.object({
  date: calendarDate.optional(),
});

export const updateReportValidation = Joi.object({
  id: uuid.required(),
  opening_cash: money.optional(),
  opening_noncash: money.optional(),
  remit_cash: money.allow(null).optional(),
  remit_transfer: money.allow(null).optional(),
  remitted: Joi.boolean().optional(),
}).or(
  "opening_cash",
  "opening_noncash",
  "remit_cash",
  "remit_transfer",
  "remitted",
);

export const createEntryValidation = Joi.object({
  id: uuid.required(),
  method: method.required(),
  name: Joi.string().trim().min(1).max(100).required(),
  note: optionalText(255),
  income: money.default(0),
  expense: money.default(0),
});

export const updateEntryValidation = Joi.object({
  id: uuid.required(),
  entry_id: uuid.required(),
  method: method.optional(),
  name: Joi.string().trim().min(1).max(100).optional(),
  note: optionalText(255),
  income: money.optional(),
  expense: money.optional(),
}).or("method", "name", "note", "income", "expense");

export const entryIdValidation = Joi.object({
  id: uuid.required(),
  entry_id: uuid.required(),
});

export const proofUploadUrlValidation = Joi.object({
  id: uuid.required(),
  content_type: Joi.string().trim().max(100).required(),
});

export const proofRegisterValidation = Joi.object({
  id: uuid.required(),
  path: Joi.string().trim().max(300).required(),
});
