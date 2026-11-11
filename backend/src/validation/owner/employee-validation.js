import Joi from "joi";

const name = Joi.string().trim().min(1).max(100);
const email = Joi.string().trim().lowercase().email().max(254);
const display_id = Joi.string().trim().uppercase().max(10);
const job_title = Joi.string().trim().min(1).max(100);
const bank_name = Joi.string().trim().min(1).max(100);
const account_number = Joi.string().trim().min(1).max(100);
const account_holder = Joi.string().trim().min(1).max(100);
export const employeeIdValidation = Joi.object({
  id: Joi.string().uuid().required(),
});

export const getAllEmployeeValidation = Joi.object({
  search: Joi.string().trim().max(100).allow("").optional(),
  status: Joi.string().valid("ALL", "ACTIVE", "INACTIVE").default("ALL"),
  page: Joi.number().integer().min(1).default(1),
});

export const createEmployeeValidation = Joi.object({
  name: name.required(),
  email: email.required(),
  display_id: display_id.required(),
  job_title: job_title.required(),
  bank_name: bank_name.required(),
  account_number: account_number.required(),
  account_holder: account_holder.required(),
});

export const updateEmployeeValidation = Joi.object({
  id: Joi.string().uuid().required(),
  name,
  email,
  display_id,
  job_title,
  bank_name,
  account_number,
  account_holder,
  is_active: Joi.boolean().strict(),
}).or(
  "name",
  "email",
  "is_active",
  "display_id",
  "job_title",
  "bank_name",
  "account_number",
  "account_holder",
);
