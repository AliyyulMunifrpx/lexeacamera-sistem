import Joi from "joi";

export const adminGetAllCameraValidation = Joi.object({
  // Cocok sebagian di nama ATAU sku, tidak membedakan huruf besar/kecil
  search: Joi.string().trim().max(100).allow("").optional(),
  category_id: Joi.string().uuid().optional(),
  page: Joi.number().integer().min(1).default(1),
});

// Admin hanya boleh mengubah link marketplace. Field lain (harga, stok, dll)
// ditolak karena tidak dikenal.
export const adminUpdateCameraMarketplaceValidation = Joi.object({
  id: Joi.string().uuid().required(),
  // [] = hapus semua link
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
    .required(),
});
