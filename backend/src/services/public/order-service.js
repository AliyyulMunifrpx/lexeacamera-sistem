import {
  blankToNull,
  createOrderWithInvoice,
  toPublicOrder,
} from "../../utils/order-invoice.js";
import { createOrderValidation } from "../../validation/public/order-validation.js";
import { validate } from "../../validation/validation.js";

const createOrder = async (request) => {
  const req = validate(createOrderValidation, request);

  const invoice = await createOrderWithInvoice({
    customer: {
      name: req.customer_name,
      address: req.address,
      whatsapp: req.whatsapp,
      instagram: blankToNull(req.instagram),
    },
    items: req.items,
    checkStock: true, // stok dicek, tapi nggak pernah dikurangi
  });

  return toPublicOrder(invoice);
};

export default { createOrder };
