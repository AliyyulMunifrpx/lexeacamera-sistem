import Joi from "joi";

export const createCategoryValidation = Joi.object({
  name: Joi.string().max(100).required(),
});
export const editCategoryValidation = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().max(100).required(),
});
export const deleteCategoryValidation = Joi.object({
  id: Joi.string().uuid().required(),
});
