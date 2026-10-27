import crypto from "node:crypto";

import { Prisma } from "@prisma/client"; // sesuaikan kalau client Prisma-mu punya output custom

import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";

const INVOICE_PREFIX = "WAV";
const MAX_NUMBER_ATTEMPTS = 5;
// Tanpa karakter yang mirip (I, O, 0, 1) supaya mudah dibaca dan diketik
const NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const INVOICE_INCLUDE = {
  order: {
    select: {
      total_amount: true,
      order_items: { orderBy: [{ camera_name: "asc" }, { id: "asc" }] },
    },
  },
};

export const blankToNull = (value) =>
  value === undefined || value === null || value === "" ? null : value;

// Nominal selalu disimpan sebagai string digit murni ("5500000")
export const toMoney = (value) =>
  value === undefined || value === null || value === "" ? null : String(value);

export const calculateTotal = (subtotal, storeDiscount, customerDiscount) => {
  const total =
    subtotal - Number(storeDiscount ?? 0) - Number(customerDiscount ?? 0);

  if (total < 0) {
    throw new ResponseError(400, "DISCOUNT_EXCEEDS_TOTAL");
  }

  return total;
};

// WAV-20261021-K7M2QX (tanggal WIB)
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

  // FOR SHARE: kamera dikunci sampai transaksi order selesai. Edit atau hapus
  // dari admin menunggu, dan order yang mulai setelah admin commit sudah
  // melihat is_deleted = true. ORDER BY id supaya urutan kunci selalu sama.
  const cameras = await tx.$queryRaw`
    SELECT id, name, price, stock
    FROM "Camera"
    WHERE id IN (${Prisma.join(ids)}) AND is_deleted = false
    ORDER BY id
    FOR SHARE
  `;
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

    // Rupiah harus bulat, dan hasil kali harus aman dihitung sebagai angka
    if (
      !Number.isSafeInteger(camera.price) ||
      camera.price < 0 ||
      !Number.isSafeInteger(lineTotal)
    ) {
      throw new ResponseError(500, "CAMERA_PRICE_INVALID");
    }

    return {
      camera_id: camera.id,
      camera_name: camera.name, // snapshot
      camera_price: camera.price, // snapshot
      quantity: item.quantity,
      line_total: lineTotal,
    };
  });
};

// Membuat Order + OrderItem + Invoice dalam satu transaksi
export const createOrderWithInvoice = async ({
  customer,
  items,
  checkStock,
  extras = {},
}) => {
  const store = await prisma.store.findFirst({ orderBy: { id: "asc" } });
  if (!store) {
    throw new ResponseError(503, "STORE_NOT_READY");
  }

  // Terms pembayaran disalin ke invoice (snapshot): kalau terms diubah kemudian,
  // invoice yang sudah ada tidak ikut berubah. Admin boleh menimpa lewat extras;
  // undefined = pakai terms saat ini, null atau "" = invoice tanpa terms.
  const termsSnapshot =
    extras.terms_and_condition !== undefined
      ? blankToNull(extras.terms_and_condition)
      : blankToNull(
          (await prisma.termsandcondition.findFirst({ orderBy: { id: "asc" } }))
            ?.value,
        );

  const storeDiscount = toMoney(extras.store_discount);
  const customerDiscount = toMoney(extras.customer_discount);

  for (let attempt = 1; attempt <= MAX_NUMBER_ATTEMPTS; attempt++) {
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

          return await tx.invoice.create({
            data: {
              no_invoice: generateInvoiceNumber(),
              // Snapshot toko
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
              total_amount: String(total),
              store_discount: storeDiscount,
              customer_discount: customerDiscount,
              is_final: extras.is_final ?? false,
              terms_and_condition: termsSnapshot,
              order: {
                create: {
                  customer_name: customer.name,
                  address: customer.address,
                  whatsapp: customer.whatsapp,
                  instagram: customer.instagram,
                  total_amount: String(subtotal),
                  order_items: {
                    create: lines.map((line) => ({
                      camera_id: line.camera_id,
                      camera_name: line.camera_name,
                      camera_price: String(line.camera_price),
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
      // Satu-satunya unique yang bisa bentrok di sini adalah no_invoice.
      // Transaksi sudah di-rollback seluruhnya, jadi aman diulang dengan nomor baru.
      if (error.code === "P2002") continue;

      // Kamera terhapus permanen di tengah proses (hard delete lewat database)
      if (error.code === "P2003") {
        throw new ResponseError(404, "CAMERA_NOT_FOUND");
      }

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
    line_total: String(Number(item.camera_price) * item.quantity),
  }));

// Untuk pembeli publik: tanpa id internal
export const toPublicOrder = ({ order, ...invoice }) => ({
  no_invoice: invoice.no_invoice,
  customer_name: invoice.customer_name,
  total_amount: invoice.total_amount,
  created_at: invoice.created_at,
  items: toItems(order),
});

// Untuk admin: semua kolom invoice + subtotal + item
export const toInvoiceResponse = ({ order, ...invoice }) => ({
  ...invoice,
  subtotal: order.total_amount,
  items: order.order_items.map((item) => ({
    id: item.id,
    camera_id: item.camera_id,
    camera_name: item.camera_name,
    camera_price: item.camera_price,
    quantity: item.quantity,
    line_total: String(Number(item.camera_price) * item.quantity),
  })),
});
