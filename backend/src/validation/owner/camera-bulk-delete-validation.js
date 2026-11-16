import Joi from "joi";

export const MAX_BULK_DELETE = 50;

export const bulkDeleteCameraValidation = Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(MAX_BULK_DELETE)
    .required(),
});
