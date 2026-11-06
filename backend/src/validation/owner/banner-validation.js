import Joi from "joi";

const id = Joi.string().uuid().required();

// Gambar datang lewat multer, bukan field Joi. Flag datang sebagai teks
// multipart ("true" / "false") atau boolean JSON; Joi mengubahnya jadi boolean.
// Get-all nggak punya field, jadi nggak butuh schema.
const flags = {
  is_promo: Joi.boolean(),
  is_best_seller: Joi.boolean(),
};

export const createBannerValidation = Joi.object({ ...flags });

export const getBannerValidation = Joi.object({ id });

export const updateBannerValidation = Joi.object({ id, ...flags });

export const deleteBannerValidation = Joi.object({ id });
