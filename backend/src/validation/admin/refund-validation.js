import Joi from "joi";

const MAX_INT = 2147483647;

export const orderRefundsValidation = Joi.object({
  id: Joi.string().uuid().required(),
});

export const refundIdValidation = Joi.object({
  id: Joi.string().uuid().required(),
});

export const createRefundValidation = Joi.object({
  id: Joi.string().uuid().required(),
  items: Joi.array()
    .items(
      Joi.object({
        camera_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().strict().min(1).max(100000).required(),
        restocked: Joi.boolean().strict().required(),
      }),
    )
    .min(1)
    .max(100)
    .unique("camera_id")
    .required(),
  amount: Joi.number().integer().strict().min(0).max(MAX_INT).optional(),
  payment_method: Joi.string().trim().max(100).allow("").optional(),
  payment_status: Joi.string().valid("PAID", "UNPAID").default("UNPAID"),
  paid_at: Joi.when("payment_status", {
    is: "PAID",
    then: Joi.date().iso().max("now").optional(),
    otherwise: Joi.forbidden(),
  }),
});
