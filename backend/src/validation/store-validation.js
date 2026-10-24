import Joi from "joi";

const name = Joi.string().trim().max(100);
const termsAndCondition = Joi.string().trim().max(3000);

// Link lokasi (Google Maps dan sejenisnya). Hanya http/https: skema lain seperti
// javascript: ditolak supaya aman dipakai sebagai href di frontend.
const mapUrl = Joi.string()
  .trim()
  .max(2048)
  .uri({ scheme: ["http", "https"] })
  .allow("");

// Teks opsional: "" berarti kosong (disimpan sebagai null)
const optionalFields = {
  instagram: Joi.string().trim().max(100).allow(""),
  whatsapp: Joi.string().trim().max(100).allow(""),
  tiktok: Joi.string().trim().max(100).allow(""),
  facebook: Joi.string().trim().max(100).allow(""),
  map_url: mapUrl,
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
