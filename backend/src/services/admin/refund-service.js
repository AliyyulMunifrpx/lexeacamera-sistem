import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  blankToNull,
  generateInvoiceNumber,
} from "../../utils/order-invoice.js";
import { returnStock } from "../../utils/payment-status.js";
import {
  createRefundValidation,
  orderRefundsValidation,
  refundIdValidation,
} from "../../validation/admin/refund-validation.js";
import { validate } from "../../validation/validation.js";

const MAX_ATTEMPTS = 5;

const REFUND_SELECT = {
  id: true,
  refund_of_id: true,
  payment_status: true,
  paid_at: true,
  total_amount: true,
  created_at: true,
  customer_id: true,
  invoice: { select: { no_invoice: true, payment_method: true } },
  order_items: {
    orderBy: [{ camera_name: "asc" }, { id: "asc" }],
    select: {
      camera_id: true,
      camera_name: true,
      camera_price: true,
      quantity: true,
      restocked: true,
    },
  },
};

const toRefund = (order) => ({
  id: order.id,
  type: "REFUND",
  refund_of_id: order.refund_of_id,
  no_invoice: order.invoice?.no_invoice ?? null,
  payment_method: order.invoice?.payment_method ?? null,
  payment_status: order.payment_status,
  paid_at: order.paid_at,
  total_amount: order.total_amount,
  customer_id: order.customer_id,
  created_at: order.created_at,
  items: order.order_items.map((item) => ({
    camera_id: item.camera_id,
    camera_name: item.camera_name,
    camera_price: item.camera_price,
    quantity: item.quantity,
    restocked: item.restocked,
  })),
});

const lockOrder = async (tx, id) => {
  const rows = await tx.$queryRaw`
    SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE
  `;

  return rows.length > 0;
};

// Jumlah yang dibeli per kamera (satu order bisa punya dua baris kamera sama),
// dan yang sudah direfund (semua refund, lunas maupun belum, supaya ajuan yang
// menunggu ikut mengunci jatah).
const tally = (original, refunds) => {
  const bought = new Map();
  for (const item of original.order_items) {
    const entry = bought.get(item.camera_id) ?? {
      camera_id: item.camera_id,
      camera_name: item.camera_name,
      camera_price: item.camera_price,
      camera_modal: item.camera_modal,
      purchased: 0,
      refunded: 0,
    };
    entry.purchased += item.quantity;
    bought.set(item.camera_id, entry);
  }

  let refundedAmount = 0;
  for (const refund of refunds) {
    refundedAmount += refund.total_amount;
    for (const item of refund.order_items) {
      const entry = bought.get(item.camera_id);
      if (entry) entry.refunded += item.quantity;
    }
  }

  return { lines: [...bought.values()], refundedAmount };
};

const share = (total, part, whole) =>
  Number((BigInt(total) * BigInt(part) * 2n + BigInt(whole)) / (2n * BigInt(whole)));

// Nominal bawaan: porsi total order (setelah diskon) sesuai harga x jumlah barang
// yang direfund. Refund yang menghabiskan semua sisa barang mendapat SISA nominal,
// jadi total semua refund tepat sama dengan total order.
const defaultAmount = (original, lines, requested, remaining) => {
  const grossAll = lines.reduce((sum, l) => sum + l.camera_price * l.purchased, 0);
  const weight = (line, quantity) =>
    grossAll > 0 ? line.camera_price * quantity : quantity;

  const completes = lines.every(
    (line) => line.purchased - line.refunded === (requested.get(line.camera_id) ?? 0),
  );
  if (completes) return remaining;

  const whole = lines.reduce((sum, l) => sum + weight(l, l.purchased), 0);
  const part = lines.reduce(
    (sum, l) => sum + weight(l, requested.get(l.camera_id) ?? 0),
    0,
  );

  return whole > 0 ? Math.min(remaining, share(original.total_amount, part, whole)) : 0;
};

const ORIGINAL_SELECT = {
  id: true,
  type: true,
  payment_status: true,
  paid_at: true,
  total_amount: true,
  customer_id: true,
  customer_name: true,
  address: true,
  whatsapp: true,
  instagram: true,
  order_items: {
    select: {
      camera_id: true,
      camera_name: true,
      camera_price: true,
      camera_modal: true,
      quantity: true,
    },
  },
};

const REFUNDS_OF = {
  select: { total_amount: true, order_items: { select: { camera_id: true, quantity: true } } },
};

const loadOriginal = async (tx, id) => {
  const original = await tx.order.findUnique({ where: { id }, select: ORIGINAL_SELECT });

  if (!original) throw new ResponseError(404, "ORDER_NOT_FOUND");
  if (original.type !== "SALE") throw new ResponseError(409, "ORDER_NOT_SALE");

  const refunds = await tx.order.findMany({
    where: { refund_of_id: id },
    ...REFUNDS_OF,
  });

  return { original, ...tally(original, refunds) };
};

const createRefund = async (request) => {
  const { id, items, amount, payment_method, payment_status, paid_at } = validate(
    createRefundValidation,
    request,
  );

  const store = await prisma.store.findFirst({ orderBy: { id: "asc" } });
  if (!store) throw new ResponseError(503, "STORE_NOT_READY");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          if (!(await lockOrder(tx, id))) {
            throw new ResponseError(404, "ORDER_NOT_FOUND");
          }

          const { original, lines, refundedAmount } = await loadOriginal(tx, id);

          if (original.payment_status !== "PAID") {
            throw new ResponseError(409, "ORDER_NOT_PAID");
          }

          const byCamera = new Map(lines.map((line) => [line.camera_id, line]));
          const missing = items.filter((item) => !byCamera.has(item.camera_id));
          if (missing.length > 0) {
            throw new ResponseError(400, "ITEM_NOT_IN_ORDER", {
              camera_ids: missing.map((item) => item.camera_id),
            });
          }

          const over = items
            .filter((item) => {
              const line = byCamera.get(item.camera_id);
              return item.quantity > line.purchased - line.refunded;
            })
            .map((item) => {
              const line = byCamera.get(item.camera_id);
              return {
                camera_id: item.camera_id,
                name: line.camera_name,
                requested: item.quantity,
                refundable: line.purchased - line.refunded,
              };
            });
          if (over.length > 0) {
            throw new ResponseError(409, "REFUND_EXCEEDS_PURCHASED", { cameras: over });
          }

          const remaining = Math.max(0, original.total_amount - refundedAmount);
          const requested = new Map(items.map((item) => [item.camera_id, item.quantity]));
          const total =
            amount ?? defaultAmount(original, lines, requested, remaining);

          if (total > remaining) {
            throw new ResponseError(409, "REFUND_AMOUNT_EXCEEDS", { max: remaining });
          }

          const paidAt = payment_status === "PAID" ? (paid_at ?? new Date()) : null;
          if (paidAt && paidAt < original.paid_at) {
            throw new ResponseError(400, "PAID_AT_BEFORE_ORDER");
          }

          const orderLines = items.map((item) => {
            const line = byCamera.get(item.camera_id);

            return {
              camera_id: line.camera_id,
              camera_name: line.camera_name,
              camera_price: line.camera_price,
              camera_modal: line.camera_modal,
              quantity: item.quantity,
              restocked: item.restocked,
            };
          });

          const invoice = await tx.invoice.create({
            data: {
              no_invoice: generateInvoiceNumber(),
              store_name: store.name,
              store_address: store.address,
              whatsapp_store: store.whatsapp,
              instagram_store: store.instagram,
              payment_method: blankToNull(payment_method),
              customer_name: original.customer_name,
              customer_address: original.address,
              customer_whatsapp: original.whatsapp,
              customer_instagram: original.instagram,
              total_amount: total,
              is_final: true,
              order: {
                create: {
                  type: "REFUND",
                  refund_of_id: original.id,
                  customer_id: original.customer_id,
                  customer_name: original.customer_name,
                  address: original.address,
                  whatsapp: original.whatsapp,
                  instagram: original.instagram,
                  total_amount: total,
                  payment_status,
                  paid_at: paidAt,
                  order_items: { create: orderLines },
                },
              },
            },
            select: { order_id: true },
          });

          if (paidAt) {
            await returnStock(tx, orderLines.filter((line) => line.restocked));
          }

          const created = await tx.order.findUnique({
            where: { id: invoice.order_id },
            select: REFUND_SELECT,
          });

          return toRefund(created);
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (error.code === "P2002") continue;

      throw error;
    }
  }

  throw new ResponseError(500, "INVOICE_NUMBER_GENERATION_FAILED");
};

const getOrderRefunds = async (request) => {
  const req = validate(orderRefundsValidation, request);

  const { original, lines, refundedAmount } = await prisma.$transaction(async (tx) =>
    loadOriginal(tx, req.id),
  );

  const refunds = await prisma.order.findMany({
    where: { refund_of_id: req.id },
    select: REFUND_SELECT,
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });

  return {
    order: {
      id: original.id,
      payment_status: original.payment_status,
      paid_at: original.paid_at,
      total_amount: original.total_amount,
    },
    items: lines
      .map((line) => ({
        camera_id: line.camera_id,
        camera_name: line.camera_name,
        camera_price: line.camera_price,
        purchased: line.purchased,
        refunded: line.refunded,
        refundable: line.purchased - line.refunded,
      }))
      .sort((a, b) => a.camera_name.localeCompare(b.camera_name) || a.camera_id.localeCompare(b.camera_id)),
    amount: {
      total: original.total_amount,
      refunded: refundedAmount,
      refundable: Math.max(0, original.total_amount - refundedAmount),
    },
    refunds: refunds.map(toRefund),
  };
};

const removeRefund = async (request) => {
  const req = validate(refundIdValidation, request);

  await prisma.$transaction(async (tx) => {
    if (!(await lockOrder(tx, req.id))) {
      throw new ResponseError(404, "REFUND_NOT_FOUND");
    }

    const refund = await tx.order.findUnique({
      where: { id: req.id },
      select: { type: true, payment_status: true },
    });

    if (!refund || refund.type !== "REFUND") {
      throw new ResponseError(404, "REFUND_NOT_FOUND");
    }
    if (refund.payment_status === "PAID") {
      throw new ResponseError(409, "REFUND_ALREADY_PAID");
    }

    await tx.order.delete({ where: { id: req.id }, select: { id: true } });
  });

  return { message: "REFUND_DELETED" };
};

export default { createRefund, getOrderRefunds, removeRefund };
