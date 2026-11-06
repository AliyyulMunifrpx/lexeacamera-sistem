import { createInvoiceOps } from "../../utils/invoice-ops.js";
import { toOwnerInvoiceResponse } from "../../utils/order-invoice.js";

export default createInvoiceOps({
  toResponse: toOwnerInvoiceResponse,
  withCost: true,
});
