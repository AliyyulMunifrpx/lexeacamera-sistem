import Joi from "joi";

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

const ANCHORED = ["day", "week", "month", "year"];

export const salesValidation = Joi.object({
  period: Joi.string()
    .valid(...ANCHORED, "range", "all")
    .default("day"),
  date: wibDate.when("period", {
    is: Joi.string().valid(...ANCHORED),
    otherwise: Joi.forbidden(),
  }),
  from: wibDate.when("period", {
    is: "range",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  to: wibDate.when("period", {
    is: "range",
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
}).custom((value, helpers) => {
  if (value.from && value.from > value.to)
    return helpers.message("from tidak boleh setelah to");

  return value;
});
