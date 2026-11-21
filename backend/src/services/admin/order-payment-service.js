import { prisma } from "../../lib/database.js";
import { setPaymentStatus } from "../../utils/payment-status.js";
import { setPaymentStatusValidation } from "../../validation/owner/order-validation.js";
import { validate } from "../../validation/validation.js";

const updatePaymentStatus = async (request) => {
  const req = validate(setPaymentStatusValidation, request);

  return prisma.$transaction((tx) =>
    setPaymentStatus(tx, {
      orderId: req.id,
      status: req.payment_status,
      paidAt: req.paid_at,
      dpAmount: req.dp_amount,
      dpPaid: req.dp_paid,
    }),
  );
};

export default { updatePaymentStatus };
