import Joi from "joi";

const MAX_INT = 2147483647;
const MAX_ITEMS = 50;

const dateOnly = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    const year = date.getUTCFullYear();

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value ||
      year < 2000 ||
      year > 2100
    ) {
      return helpers.error("any.invalid");
    }

    return value;
  });

const itemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  note: Joi.string().trim().max(500).allow("", null),
  checked: Joi.boolean().default(false),
  amount: Joi.number().integer().min(0).max(MAX_INT).required(),
});

const items = Joi.array().items(itemSchema).min(1).max(MAX_ITEMS);
const id = Joi.string().uuid();
const status = Joi.string().valid("PENDING", "PAID");

const profile = {
  job_title: Joi.string().trim().min(1).max(100),
  bank_name: Joi.string().trim().min(1).max(100),
  account_number: Joi.string()
    .trim()
    .pattern(/^[0-9][0-9 -]{3,29}$/),
  account_holder: Joi.string().trim().min(1).max(100),
  disbursement_date: dateOnly,
};

export const createPayrollValidation = Joi.object({
  employee_id: id.required(),
  job_title: profile.job_title.required(),
  bank_name: profile.bank_name.required(),
  account_number: profile.account_number.required(),
  account_holder: profile.account_holder.required(),
  disbursement_date: profile.disbursement_date.required(),
  status: status.default("PENDING"),
  items: items.required(),
});

export const updatePayrollValidation = Joi.object({
  id: id.required(),
  ...profile,
  items,
}).or(
  "job_title",
  "bank_name",
  "account_number",
  "account_holder",
  "disbursement_date",
  "items",
);

export const getPayrollValidation = Joi.object({ id: id.required() });
export const deletePayrollValidation = getPayrollValidation;

export const updatePayrollStatusValidation = Joi.object({
  id: id.required(),
  status: status.required(),
  disbursement_date: dateOnly,
});

export const updatePayrollChecklistValidation = Joi.object({
  id: id.required(),
  item_id: id.required(),
  checked: Joi.boolean().required(),
});

export const getAllPayrollValidation = Joi.object({
  employee_id: id,
  status: status.empty(""),
  date_from: dateOnly.empty(""),
  date_to: dateOnly.empty(""),
  search: Joi.string().trim().max(100).allow(""),
  page: Joi.number().integer().min(1).default(1),
});

export const getEmployeePayrollValidation = getAllPayrollValidation
  .keys({ id: id.required() })
  .fork("employee_id", (schema) => schema.forbidden());
