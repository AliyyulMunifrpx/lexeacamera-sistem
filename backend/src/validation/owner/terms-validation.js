import Joi from "joi";
import { nullableText } from "../public/order-validation.js";

export const TERMS_MAX = 5000;

// "" dan null berarti mengosongkan terms (disimpan null). Key `value` wajib ada.
export const updateTermsValidation = Joi.object({
  value: nullableText(TERMS_MAX).required(),
});
