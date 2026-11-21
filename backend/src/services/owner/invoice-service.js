import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { setPaymentStatus } from "../../utils/payment-status.js";
import { createInvoiceOps } from "../../utils/invoice-ops.js";
import { toOwnerInvoiceResponse } from "../../utils/order-invoice.js";
import { ownerDeleteInvoiceValidation } from "../../validation/owner/invoice-validation.js";
import { validate } from "../../validation/validation.js";

const ops = createInvoiceOps({
  toResponse: toOwnerInvoiceResponse,
  withCost: true,
});

// CLEAN: hanya invoice yang dihapus, order, stok, dan laporan tidak berubah.
// VOID: order ikut dihapus. Order DP atau lunas dibatalkan dulu (stok kembali),
// lalu dihapus. Order yang sudah punya refund ditolak.
const deleteInvoice = async (request) => {
  const req = validate(ownerDeleteInvoiceValidation, request);

  return prisma.$transaction(
    async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: req.id },
        select: { order_id: true },
      });

      if (!invoice) {
        throw new ResponseError(404, "INVOICE_NOT_FOUND");
      }

      if (req.mode === "CLEAN") {
        const { count } = await tx.invoice.deleteMany({
          where: { id: req.id },
        });

        if (count === 0) {
          throw new ResponseError(404, "INVOICE_NOT_FOUND");
        }

        return {
          message: "INVOICE_DELETED",
          mode: "CLEAN",
          order_deleted: false,
        };
      }

      await tx.$queryRaw`
        SELECT id FROM "Order" WHERE id = ${invoice.order_id} FOR UPDATE
      `;

      const order = await tx.order.findUnique({
        where: { id: invoice.order_id },
        select: { id: true, payment_status: true },
      });

      if (!order) {
        throw new ResponseError(404, "INVOICE_NOT_FOUND");
      }

      const refunds = await tx.order.count({
        where: { refund_of_id: order.id },
      });

      if (refunds > 0) {
        throw new ResponseError(409, "ORDER_HAS_REFUNDS");
      }

      const wasHeld = order.payment_status !== "UNPAID";

      if (wasHeld) {
        await setPaymentStatus(tx, { orderId: order.id, status: "UNPAID" });
      }

      await tx.order.delete({ where: { id: order.id }, select: { id: true } });

      return {
        message: "INVOICE_DELETED",
        mode: "VOID",
        order_deleted: true,
        stock_adjusted: wasHeld,
      };
    },
    { timeout: 15000 },
  );
};

export default { ...ops, deleteInvoice };
