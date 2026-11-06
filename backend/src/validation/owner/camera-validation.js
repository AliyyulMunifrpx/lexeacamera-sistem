import Joi from "joi";

export const createCameraValidation = Joi.object({
  name: Joi.string().trim().max(100).required(),
  price: Joi.number().min(0).required(),
  condition: Joi.string().valid("NEW", "SECOND").optional(),
  stock: Joi.number().integer().min(0).required(),
  description: Joi.string().max(1000).allow("").optional(),
  inclusions: Joi.string().max(1000).allow("").optional(),
  category_id: Joi.string().uuid().required(),
  promo: Joi.boolean().optional(),
  best_selling: Joi.boolean().optional(),
  sku: Joi.string().trim().max(50).required(),
  serial_number: Joi.string().trim().max(100).required(),
  color: Joi.string().trim().max(50).required(),
  shutter_count: Joi.string().trim().max(20).required(),
  capital: Joi.number().min(0).required(),
  strikethrough_price: Joi.number().min(0).optional(),
  marketplace: Joi.array()
    .items(
      Joi.object({
        marketplace_id: Joi.string().uuid().required(),
        product_url: Joi.string()
          .uri({ scheme: ["http", "https"] })
          .max(2048)
          .required(),
      }),
    )
    .unique("marketplace_id")
    .optional(),
});
export const getAllCameraValidation = Joi.object({
  search: Joi.string().trim().max(100).allow("").optional(),
  category_id: Joi.string().uuid().optional(),
  condition: Joi.string().valid("NEW", "SECOND").optional(),
  min_price: Joi.number().min(0).optional(),
  max_price: Joi.number().min(0).optional(),
  sku: Joi.string().trim().max(50).allow("").optional(),
  serial_number: Joi.string().trim().max(100).allow("").optional(),
  color: Joi.string().trim().max(50).allow("").optional(),
  min_stock: Joi.number().integer().min(0).optional(),
  max_stock: Joi.number().integer().min(0).optional(),
  page: Joi.number().integer().min(1).default(1),
});
export const getCameraValidation = Joi.object({
  id: Joi.string().uuid().required(),
});
const marketplaceSchema = Joi.array()
  .items(
    Joi.object({
      marketplace_id: Joi.string().uuid().required(),
      product_url: Joi.string()
        .uri({ scheme: ["http", "https"] })
        .max(2048)
        .required(),
    }),
  )
  .unique("marketplace_id");

export const updateCameraValidation = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().trim().max(100),
  price: Joi.number().min(0),
  condition: Joi.string().valid("NEW", "SECOND"),
  stock: Joi.number().integer().min(0),
  description: Joi.string().max(1000).allow(""),
  inclusions: Joi.string().max(1000).allow(""),
  category_id: Joi.string().uuid(),
  promo: Joi.boolean(),
  best_selling: Joi.boolean(),
  sku: Joi.string().trim().max(50),
  serial_number: Joi.string().trim().max(100),
  color: Joi.string().trim().max(50),
  shutter_count: Joi.string().trim().max(20),
  marketplace: marketplaceSchema,
  capital: Joi.number().min(0).optional(),
  strikethrough_price: Joi.number().min(0).optional(),
}).or(
  "name",
  "price",
  "condition",
  "stock",
  "description",
  "inclusions",
  "category_id",
  "promo",
  "best_selling",
  "sku",
  "serial_number",
  "color",
  "shutter_count",
  "marketplace",
  "capital",
  "strikethrough_price",
);
export const deleteCameraValidation = Joi.object({
  id: Joi.string().uuid().required(),
});
