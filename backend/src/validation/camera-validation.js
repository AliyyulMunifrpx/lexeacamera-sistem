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
  marketplace: marketplaceSchema,
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
  "marketplace",
);
export const deleteCameraValidation = Joi.object({
  id: Joi.string().uuid().required(),
});
export const updateCameraImagesValidation = Joi.object({
  id: Joi.string().uuid().required(),
  // id gambar lama yang dipertahankan. [] = hapus semua gambar lama
  keep_image_ids: Joi.array().items(Joi.string().uuid()).unique().required(),
  // id gambar lama yang dipertahankan, atau "new:N" (file ke-N di request, mulai 0)
  primary: Joi.alternatives().try(
    Joi.string().uuid(),
    Joi.string().pattern(/^new:(0|[1-9]\d*)$/),
  ),
});
