import Joi from "joi";

export const registerUserValidation = Joi.object({
  email: Joi.string().email().required().max(100),
  password: Joi.string().max(100).required().min(8),
  name: Joi.string().max(100).required(),
});
export const loginUserValidation = Joi.object({
  email: Joi.string().email().required().max(100),
  password: Joi.string().max(100).required().min(8),
});
export const getUserValidation = Joi.object({
  id: Joi.string().uuid().required(),
});
export const updatePasswordValidation = Joi.object({
  id: Joi.string().uuid().required(),
  new_password: Joi.string().min(8).max(100),
  current_password: Joi.string().min(8).max(100),
});
export const updateNameValidation = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().max(100).required(),
});
export const updateEmailValidation = Joi.object({
  id: Joi.string().uuid().required(),
  email: Joi.string().max(100).required(),
});
export const deleteUserValidation = Joi.object({
  id: Joi.string().uuid().required(),
});