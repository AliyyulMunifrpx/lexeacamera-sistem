import Joi from "joi";

const name = Joi.string().trim().max(100);
const termsAndCondition = Joi.string().trim().max(3000);

// Teks opsional: "" berarti kosong (disimpan sebagai null)
const optionalFields = {
  instagram: Joi.string().trim().max(100).allow(""),
  whatsapp: Joi.string().trim().max(100).allow(""),
  tiktok: Joi.string().trim().max(100).allow(""),
  facebook: Joi.string().trim().max(100).allow(""),
  address: Joi.string().trim().max(255).allow(""),
};

// Logo dan banner bukan field Joi: file-nya datang lewat multer
export const createStoreValidation = Joi.object({
  name: name.required(),
  terms_and_condition: termsAndCondition.required(),
  ...optionalFields,
});

export const updateStoreValidation = Joi.object({
  name,
  terms_and_condition: termsAndCondition,
  ...optionalFields,
  remove_main_banner: Joi.boolean(),
});
