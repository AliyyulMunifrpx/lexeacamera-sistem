import Joi from "joi";
import { dateOnly } from "./employee-validation.js";

const note = Joi.string().trim().max(255).allow("", null);

export const contractListValidation = Joi.object({
  employee_id: Joi.string().uuid().required(),
});

export const contractIdValidation = Joi.object({
  employee_id: Joi.string().uuid().required(),
  contract_id: Joi.string().uuid().required(),
});

export const createContractValidation = Joi.object({
  employee_id: Joi.string().uuid().required(),
  start_date: dateOnly.required(),
  end_date: dateOnly.allow(null),
  note,
});

export const updateContractValidation = Joi.object({
  employee_id: Joi.string().uuid().required(),
  contract_id: Joi.string().uuid().required(),
  start_date: dateOnly,
  end_date: dateOnly.allow(null),
  note,
}).or("start_date", "end_date", "note");
