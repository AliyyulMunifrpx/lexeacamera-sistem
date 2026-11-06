import Joi from "joi";

export const MAX_ITEMS = 10;
export const MAX_QUANTITY = 10;

// Digit dengan atau tanpa "+" di depan: 081234567890, 6281234567890, +6281234567890
const PHONE = /^\+?[0-9]{8,15}$/;

export const customerName = Joi.string().trim().max(100);
export const customerAddress = Joi.string().trim().max(500);
export const customerWhatsapp = Joi.string().trim().pattern(PHONE);

// Teks opsional: "" dan null berarti kosong (disimpan null)
export const nullableText = (max) =>
  Joi.string().trim().max(max).allow("", null);

// Nominal rupiah: bilangan bulat >= 0, boleh angka atau string digit tanpa nol di depan
export const money = Joi.alternatives().try(
  Joi.number().strict().integer().min(0).max(999999999999),
  Joi.string().pattern(/^(0|[1-9][0-9]{0,11})$/),
);

// Harga TIDAK ada di sini: harga selalu diambil dari kamera
export const items = Joi.array()
  .items(
    Joi.object({
      camera_id: Joi.string().uuid().required(),
      quantity: Joi.number().integer().min(1).max(MAX_QUANTITY).default(1),
    }),
  )
  .min(1)
  .max(MAX_ITEMS)
  .unique("camera_id")
  .required();

export const createOrderValidation = Joi.object({
  customer_name: customerName.required(),
  address: customerAddress.required(),
  whatsapp: customerWhatsapp.required(),
  instagram: nullableText(100),
  items,
});
