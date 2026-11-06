import Joi from "joi";

export const updateCameraImagesValidation = Joi.object({
  id: Joi.string().uuid().required(),
  // id gambar lama yang dipertahankan. [] = hapus semua gambar lama
  keep_image_ids: Joi.array().items(Joi.string().uuid()).unique().required(),
  // id gambar lama yang dipertahankan, atau "new:N" (file ke-N di request, mulai 0)
  primary: Joi.alternatives().try(
    Joi.string().uuid(),
    Joi.string().pattern(/^new:(0|[1-9]\d*)$/),
  ),
});
