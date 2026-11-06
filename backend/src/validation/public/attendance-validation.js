import Joi from "joi";

const pin = Joi.string().pattern(/^\d{4,6}$/);

export const attendValidation = Joi.object({
  employee_id: Joi.string().uuid().required(),
  pin: pin.required(),
});

export const historyValidation = Joi.object({
  employee_id: Joi.string().uuid().required(),
  pin: pin.required(),
  month: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export const tokenInfoValidation = Joi.object({
  token: Joi.string().hex().length(64).required(),
});

export const setPinValidation = Joi.object({
  token: Joi.string().hex().length(64).required(),
  pin: pin.required(),
});
