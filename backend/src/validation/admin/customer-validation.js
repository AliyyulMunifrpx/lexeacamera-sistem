import Joi from "joi";

import { CUSTOMER_ID_PATTERN } from "../../utils/customer.js";

const name = Joi.string().trim().max(100);
const address = Joi.string().trim().max(500);
const whatsapp = Joi.string()
  .trim()
  .pattern(/^\+?[0-9]{8,15}$/);
const instagram = Joi.string().trim().max(100).allow("", null);

export const customerIdValidation = Joi.object({
  id: Joi.string().pattern(CUSTOMER_ID_PATTERN).required(),
});

export const getAllCustomerValidation = Joi.object({
  search: Joi.string().trim().max(100).allow("").optional(),
  page: Joi.number().integer().min(1).default(1),
});

export const createCustomerValidation = Joi.object({
  name: name.required(),
  address: address.required(),
  whatsapp: whatsapp.required(),
  instagram: instagram.optional(),
});

export const updateCustomerValidation = Joi.object({
  id: Joi.string().pattern(CUSTOMER_ID_PATTERN).required(),
  name,
  address,
  whatsapp,
  instagram,
}).or("name", "address", "whatsapp", "instagram");
