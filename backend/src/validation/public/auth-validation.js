import Joi from "joi";

export const setPasswordValidation = Joi.object({
  access_token: Joi.string().trim().min(20).max(4096).required(),
  password: Joi.string().min(8).max(72).required(),
});

export const forgotPasswordValidation = Joi.object({
  email: Joi.string().trim().lowercase().email().max(254).required(),
});
