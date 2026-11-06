import { createInvoiceOps } from "../../utils/invoice-ops.js";
import { toInvoiceResponse } from "../../utils/order-invoice.js";

export default createInvoiceOps({
  toResponse: toInvoiceResponse,
  withCost: false,
});
