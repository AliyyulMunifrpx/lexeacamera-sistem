import Joi from "joi";

const name = Joi.string().trim().min(1).max(100);
const email = Joi.string().trim().lowercase().email().max(254);

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
});

export const updateEmployeeValidation = Joi.object({
  id: Joi.string().uuid().required(),
  name,
  email,
  is_active: Joi.boolean().strict(),
}).or("name", "email", "is_active");
