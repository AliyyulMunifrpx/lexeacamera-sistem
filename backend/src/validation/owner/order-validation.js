import Joi from "joi";

const calendarDate = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error("any.invalid");
    }

    return value;
  });

export const orderIdValidation = Joi.object({
  id: Joi.string().uuid().required(),
});

export const getAllOrderValidation = Joi.object({
  search: Joi.string().trim().max(100).allow("").optional(),
  type: Joi.string().valid("SALE", "REFUND").optional(),
  payment_status: Joi.string().valid("PAID", "UNPAID").optional(),
  date_field: Joi.string().valid("created_at", "paid_at").default("created_at"),
  date_from: calendarDate.optional(),
  date_to: calendarDate.optional(),
  page: Joi.number().integer().min(1).default(1),
});

export const setPaymentStatusValidation = Joi.object({
  id: Joi.string().uuid().required(),
  payment_status: Joi.string().valid("PAID", "UNPAID").required(),
  paid_at: Joi.when("payment_status", {
    is: "PAID",
    then: Joi.date().iso().max("now").optional(),
    otherwise: Joi.forbidden(),
  }),
});
export const updateOrderItemsValidation = Joi.object({
  id: Joi.string().uuid().required(),
  items: Joi.array()
    .items(
      Joi.object({
        camera_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).max(1000).required(),
      }),
    )
    .min(1)
    .max(50)
    .unique("camera_id")
    .required(),
});
