import Joi from "joi";

const DAY_MS = 24 * 60 * 60 * 1000;

const wibDate = Joi.string()
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
  })
  .messages({ "string.pattern.base": "Tanggal harus berformat YYYY-MM-DD" });

const MAX_DAYS = { day: 366, week: 1100, month: 3700 };

const ordered = (value, helpers) => {
  if (value.from > value.to)
    return helpers.message("from tidak boleh setelah to");

  return value;
};

export const summaryReportValidation = Joi.object({
  from: wibDate,
  to: wibDate,
})
  .and("from", "to")
  .custom(ordered);

export const trendReportValidation = Joi.object({
  group: Joi.string().valid("day", "week", "month").required(),
  from: wibDate.required(),
  to: wibDate.required(),
}).custom((value, helpers) => {
  const checked = ordered(value, helpers);
  if (checked !== value) return checked;

  const days =
    (Date.parse(`${value.to}T00:00:00Z`) -
      Date.parse(`${value.from}T00:00:00Z`)) /
      DAY_MS +
    1;

  if (days > MAX_DAYS[value.group]) {
    return helpers.message(
      `Rentang terlalu panjang untuk group ${value.group} (maksimum ${MAX_DAYS[value.group]} hari)`,
    );
  }

  return value;
});

const SORT = Joi.string().valid("units", "revenue", "profit").default("units");

export const productsReportValidation = Joi.object({
  from: wibDate,
  to: wibDate,
  sort: SORT,
  limit: Joi.number().integer().min(1).max(1000).default(20),
  page: Joi.number().integer().min(1).default(1),
})
  .and("from", "to")
  .custom(ordered);

export const categoriesReportValidation = Joi.object({
  from: wibDate,
  to: wibDate,
  sort: SORT,
})
  .and("from", "to")
  .custom(ordered);

export const customersReportValidation = Joi.object({
  from: wibDate,
  to: wibDate,
  sort: Joi.string().valid("revenue", "orders", "profit").default("revenue"),
  limit: Joi.number().integer().min(1).max(1000).default(20),
  page: Joi.number().integer().min(1).default(1),
})
  .and("from", "to")
  .custom(ordered);

export const customerSegmentsValidation = Joi.object({
  from: wibDate.required(),
  to: wibDate.required(),
}).custom(ordered);

export const transactionsReportValidation = Joi.object({
  from: wibDate,
  to: wibDate,
  type: Joi.string().valid("SALE", "REFUND"),
  search: Joi.string().trim().max(100).allow("").empty("").optional(),
  limit: Joi.number().integer().min(1).max(1000).default(20),
  page: Joi.number().integer().min(1).default(1),
})
  .and("from", "to")
  .custom(ordered);
