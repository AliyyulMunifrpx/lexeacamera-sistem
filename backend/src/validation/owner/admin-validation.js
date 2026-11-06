import Joi from "joi";

const name = Joi.string().trim().min(1).max(100);
const email = Joi.string().trim().lowercase().email().max(254);

export const adminIdValidation = Joi.object({
  id: Joi.string().uuid().required(),
});

export const getAllAdminValidation = Joi.object({
  search: Joi.string().trim().max(100).allow("").optional(),
  status: Joi.string().valid("ALL", "ACTIVE", "INACTIVE").default("ALL"),
  page: Joi.number().integer().min(1).default(1),
});

export const createAdminValidation = Joi.object({
  name: name.required(),
  email: email.required(),
  attendance: Joi.boolean().strict().default(true),
});

export const updateAdminValidation = Joi.object({
  id: Joi.string().uuid().required(),
  name,
  is_active: Joi.boolean().strict(),
  attendance: Joi.boolean().strict(),
}).or("name", "is_active", "attendance");
