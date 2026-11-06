import Joi from "joi";

const id = Joi.string().uuid().required();
const name = Joi.string().trim().max(100);

// Logo bukan field Joi: file-nya datang lewat multer
export const createMarketplaceValidation = Joi.object({
  name: name.required(),
  is_active: Joi.boolean(), // tanpa default, database yang mengisi (true)
});

export const getAllMarketplaceValidation = Joi.object({
  is_active: Joi.boolean(),
});

export const getMarketplaceValidation = Joi.object({ id });

export const updateMarketplaceValidation = Joi.object({
  id,
  name,
  is_active: Joi.boolean(),
});
export const deleteMarketplaceValidation = Joi.object({ id });
