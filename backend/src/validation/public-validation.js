import Joi from "joi";

// Store tidak menerima parameter: query apa pun ditolak dengan 400
export const getPublicStoreValidation = Joi.object({});

export const getPublicCameraValidation = Joi.object({
  id: Joi.string().uuid().required(),
});

export const SORT_OPTIONS = ["newest", "price_asc", "price_desc"];

export const getAllPublicCameraValidation = Joi.object({
  search: Joi.string().trim().max(100).allow(""),
  category_id: Joi.string().uuid(),
  condition: Joi.string().valid("NEW", "SECOND"),
  min_price: Joi.number().min(0),
  max_price: Joi.number().min(0),
  promo: Joi.boolean(),
  best_selling: Joi.boolean(),
  sort: Joi.string()
    .valid(...SORT_OPTIONS)
    .default("newest"),
  page: Joi.number().integer().min(1).default(1),
});
