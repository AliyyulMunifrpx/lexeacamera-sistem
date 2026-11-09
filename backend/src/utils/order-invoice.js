import crypto from "node:crypto";

import { Prisma } from "@prisma/client";

import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
import {
  blankToNull,
  generateCustomerId,
  normalizeWhatsapp,
} from "./customer.js";

export { blankToNull };

const INVOICE_PREFIX = "WAV";
const MAX_ATTEMPTS = 5;
const MAX_INT = 2147483647;
const NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const INVOICE_INCLUDE = {
  order: {
    select: {
      type: true,
      customer_id: true,
      payment_status: true,
      paid_at: true,
      total_amount: true,
      order_items: {
        orderBy: [{ camera_name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          camera_id: true,
          camera_name: true,
          camera_price: true,
          camera_modal: true,
          quantity: true,
          restocked: true,
          camera: {
            select: {
              sku: true,
              serial_number: true,
              color: true,
              strikethrough_price: true,
            },
          },
        },
      },
    },
  },
};

export const toMoney = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_INT) {
    throw new ResponseError(400, "AMOUNT_TOO_LARGE");
  }

  return amount;
};

export const calculateTotal = (subtotal, storeDiscount, customerDiscount) => {
  if (subtotal > MAX_INT) {
    throw new ResponseError(400, "AMOUNT_TOO_LARGE");
  }

  const total =
    subtotal - Number(storeDiscount ?? 0) - Number(customerDiscount ?? 0);

  if (total < 0) {
    throw new ResponseError(400, "DISCOUNT_EXCEEDS_TOTAL");
  }

  return total;
};

export const generateInvoiceNumber = () => {
  const date = new Date(Date.now() + WIB_OFFSET_MS)
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += NUMBER_ALPHABET[crypto.randomInt(NUMBER_ALPHABET.length)];
  }

  return `${INVOICE_PREFIX}-${date}-${suffix}`;
};

const buildLines = async (tx, items, checkStock) => {
  const ids = items.map((item) => item.camera_id);

  await tx.$queryRaw`
    SELECT id
    FROM "Camera"
    WHERE id IN (${Prisma.join(ids)}) AND is_deleted = false
    ORDER BY id
    FOR SHARE
  `;

  const cameras = await tx.camera.findMany({
    where: { id: { in: ids }, is_deleted: false },
    select: { id: true, name: true, price: true, capital: true, stock: true },
  });
  const byId = new Map(cameras.map((camera) => [camera.id, camera]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new ResponseError(404, "CAMERA_NOT_FOUND", { camera_ids: missing });
  }

  if (checkStock) {
    const short = items
      .filter((item) => item.quantity > byId.get(item.camera_id).stock)
      .map((item) => ({
        camera_id: item.camera_id,
        name: byId.get(item.camera_id).name,
        requested: item.quantity,
        stock: byId.get(item.camera_id).stock,
      }));

    if (short.length) {
      throw new ResponseError(400, "INSUFFICIENT_STOCK", { cameras: short });
    }
  }

  return items.map((item) => {
    const camera = byId.get(item.camera_id);
    const lineTotal = camera.price * item.quantity;

    if (
      !Number.isSafeInteger(camera.price) ||
      camera.price < 0 ||
      !Number.isSafeInteger(camera.capital) ||
      camera.capital < 0 ||
      !Number.isSafeInteger(lineTotal)
    ) {
      throw new ResponseError(500, "CAMERA_PRICE_INVALID");
    }

    return {
      camera_id: camera.id,
      camera_name: camera.name,
      camera_price: camera.price,
      camera_modal: camera.capital,
      quantity: item.quantity,
      line_total: lineTotal,
    };
  });
};

const findOrCreateCustomerId = async (tx, customer) => {
  const existing = await tx.customer.findUnique({
    where: { whatsapp: customer.whatsapp },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await tx.customer.create({
    data: {
      id: generateCustomerId(),
      name: customer.name,
      whatsapp: customer.whatsapp,
      instagram: customer.instagram,
      address: customer.address,
    },
    select: { id: true },
  });

  return created.id;
};

export const createOrderWithInvoice = async ({
  customer: rawCustomer,
  items,
  checkStock,
  extras = {},
}) => {
  const customer = {
    ...rawCustomer,
    whatsapp: normalizeWhatsapp(rawCustomer.whatsapp),
  };

  const store = await prisma.store.findFirst({ orderBy: { id: "asc" } });
  if (!store) {
    throw new ResponseError(503, "STORE_NOT_READY");
  }

  const termsSnapshot =
    extras.terms_and_condition !== undefined
      ? blankToNull(extras.terms_and_condition)
      : blankToNull(
          (await prisma.termsandcondition.findFirst({ orderBy: { id: "asc" } }))
            ?.value,
        );

  const storeDiscount = toMoney(extras.store_discount);
  const customerDiscount = toMoney(extras.customer_discount);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const lines = await buildLines(tx, items, checkStock);
          const subtotal = lines.reduce(
            (sum, line) => sum + line.line_total,
            0,
          );
          const total = calculateTotal(
            subtotal,
            storeDiscount,
            customerDiscount,
          );
          const customerId = await findOrCreateCustomerId(tx, customer);

          return await tx.invoice.create({
            data: {
              no_invoice: generateInvoiceNumber(),
              store_name: store.name,
              store_address: store.address,
              whatsapp_store: store.whatsapp,
              instagram_store: store.instagram,
              payment_method: extras.payment_method ?? null,
              ship: extras.ship ?? null,
              customer_name: customer.name,
              customer_address: customer.address,
              customer_whatsapp: customer.whatsapp,
              customer_instagram: customer.instagram,
              total_amount: total,
              store_discount: storeDiscount,
              customer_discount: customerDiscount,
              is_final: extras.is_final ?? false,
              terms_and_condition: termsSnapshot,
              order: {
                create: {
                  customer_id: customerId,
                  customer_name: customer.name,
                  address: customer.address,
                  whatsapp: customer.whatsapp,
                  instagram: customer.instagram,
                  total_amount: total,
                  order_items: {
                    create: lines.map((line) => ({
                      camera_id: line.camera_id,
                      camera_name: line.camera_name,
                      camera_price: line.camera_price,
                      camera_modal: line.camera_modal,
                      quantity: line.quantity,
                    })),
                  },
                },
              },
            },
            include: INVOICE_INCLUDE,
          });
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (error.code === "P2002" || error.code === "P2003") continue;

      throw error;
    }
  }

  throw new ResponseError(500, "INVOICE_NUMBER_GENERATION_FAILED");
};

const toItems = (order) =>
  order.order_items.map((item) => ({
    camera_name: item.camera_name,
    camera_price: item.camera_price,
    quantity: item.quantity,
    line_total: item.camera_price * item.quantity,
  }));

export const toPublicOrder = ({ order, ...invoice }) => ({
  no_invoice: invoice.no_invoice,
  customer_name: invoice.customer_name,
  total_amount: invoice.total_amount,
  created_at: invoice.created_at,
  items: toItems(order),
});

const invoiceItems = (order) =>
  order.order_items.map((item) => ({
    id: item.id,
    camera_id: item.camera_id,
    camera_name: item.camera_name,
    camera_price: item.camera_price,
    quantity: item.quantity,
    restocked: item.restocked,
    sku: item.camera?.sku ?? null,
    serial_number: item.camera?.serial_number ?? null,
    strikethrough_price: item.camera?.strikethrough_price ?? null,
    line_total: item.camera_price * item.quantity,
  }));

export const toInvoiceResponse = ({ order, ...invoice }) => {
  const items = invoiceItems(order);

  return {
    ...invoice,
    type: order.type,
    customer_id: order.customer_id,
    payment_status: order.payment_status,
    paid_at: order.paid_at,
    subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
    items,
  };
};

// Versi owner: ditambah modal (HPP) dan laba. Invoice REFUND tidak punya laba.
export const toOwnerInvoiceResponse = ({ order, ...invoice }) => {
  const base = toInvoiceResponse({ order, ...invoice });
  const isSale = order.type === "SALE";

  const items = base.items.map((item, i) => {
    const modal = order.order_items[i].camera_modal;

    return {
      ...item,
      camera_modal: modal,
      modal_line_total: modal * item.quantity,
    };
  });
  const capital = items.reduce((sum, item) => sum + item.modal_line_total, 0);

  return {
    ...base,
    items,
    capital_total: isSale ? capital : null,
    profit: isSale ? base.total_amount - capital : null,
  };
};
