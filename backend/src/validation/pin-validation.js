import Joi from "joi";

export const setPinValidation = Joi.object({
  id: Joi.string().uuid().required(),
  pin: Joi.string()
    .pattern(/^\d{4,6}$/)
    .required(),
  current_password: Joi.string().min(1).max(200).required(),
});
