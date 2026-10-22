import Joi from "joi";

const id = Joi.string().uuid().required();

// Gambar datang lewat multer, bukan field Joi.
// Create dan get-all nggak punya field, jadi nggak butuh schema.
export const getBannerValidation = Joi.object({ id });

export const updateBannerValidation = Joi.object({ id });

export const deleteBannerValidation = Joi.object({ id });