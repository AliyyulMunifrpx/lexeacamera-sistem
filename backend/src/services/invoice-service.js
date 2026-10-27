import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
import {
  INVOICE_INCLUDE,
  blankToNull,
  calculateTotal,
  createOrderWithInvoice,
  toInvoiceResponse,
  toMoney,
} from "../utils/order-invoice.js";
import {
  createInvoiceValidation,
  deleteInvoiceValidation,
  getAllInvoiceValidation,
  getInvoiceValidation,
  updateInvoiceValidation,
} from "../validation/invoice-validation.js";
import { validate } from "../validation/validation.js";

const PER_PAGE = 20;
const WIB = "+07:00";
const DAY_MS = 24 * 60 * 60 * 1000;

const REQUIRED_TEXT_FIELDS = [
  "store_name",
  "customer_name",
  "customer_address",
  "customer_whatsapp",
];
const NULLABLE_TEXT_FIELDS = [
  "store_address",
  "whatsapp_store",
  "instagram_store",
  "payment_method",
  "ship",
  "customer_instagram",
  "terms_and_condition",
];

const createInvoice = async (request) => {
  const req = validate(createInvoiceValidation, request);

  const invoice = await createOrderWithInvoice({
    customer: {
      name: req.customer_name,
      address: req.customer_address,
      whatsapp: req.customer_whatsapp,
      instagram: blankToNull(req.customer_instagram),
    },
    items: req.items,
    // Admin mengatur stok sendiri (toko offline), jadi nggak diblokir stok
    checkStock: false,
    extras: {
      payment_method: blankToNull(req.payment_method),
      ship: blankToNull(req.ship),
      store_discount: req.store_discount,
      customer_discount: req.customer_discount,
      // Sengaja tanpa blankToNull: undefined berarti "pakai terms saat ini"
      terms_and_condition: req.terms_and_condition,
      is_final: req.is_final ?? false,
    },
  });

  return toInvoiceResponse(invoice);
};

const getAllInvoice = async (query) => {
  const req = validate(getAllInvoiceValidation, query);

  // Format YYYY-MM-DD, jadi perbandingan string sudah benar
  if (req.created_from && req.created_to && req.created_from > req.created_to) {
    throw new ResponseError(400, "INVALID_DATE_RANGE");
  }

  const where = {};

  if (req.is_final !== undefined) where.is_final = req.is_final;

  // Tanggal dibaca sebagai hari penuh zona WIB, kedua ujung inklusif
  if (req.created_from || req.created_to) {
    where.created_at = {};
    if (req.created_from) {
      where.created_at.gte = new Date(`${req.created_from}T00:00:00${WIB}`);
    }
    if (req.created_to) {
      where.created_at.lt = new Date(
        new Date(`${req.created_to}T00:00:00${WIB}`).getTime() + DAY_MS,
      );
    }
  }

  if (req.search) {
    const contains = { contains: req.search, mode: "insensitive" };

    where.OR = [
      { customer_name: contains },
      { no_invoice: contains },
      // Nama kamera dari snapshot item, bukan data kamera sekarang
      { order: { order_items: { some: { camera_name: contains } } } },
    ];
  }

  const [rows, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: {
        order: {
          select: {
            total_amount: true,
            _count: { select: { order_items: true } },
          },
        },
      },
      // id sebagai tiebreaker supaya urutan antar halaman stabil
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    // Teks terms panjang dan tidak dibutuhkan di daftar: tersedia di GET /invoices/:id
    data: rows.map(({ order, terms_and_condition: _terms, ...invoice }) => ({
      ...invoice,
      subtotal: order.total_amount,
      item_count: order._count.order_items,
    })),
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const getInvoice = async (request) => {
  const req = validate(getInvoiceValidation, request);

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.id },
    include: INVOICE_INCLUDE,
  });

  if (!invoice) {
    throw new ResponseError(404, "INVOICE_NOT_FOUND");
  }

  return toInvoiceResponse(invoice);
};

// Edit hanya bisa SEKALI (satu request, boleh banyak field). Setelah berhasil,
// is_final = true dan invoice terkunci. Request yang gagal nggak menghabiskan jatah.
const updateInvoice = async (request) => {
  const req = validate(updateInvoiceValidation, request);

  const data = {};
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (req[field] !== undefined) data[field] = req[field];
  }
  for (const field of NULLABLE_TEXT_FIELDS) {
    if (req[field] !== undefined) data[field] = blankToNull(req[field]);
  }

  const updated = await prisma.$transaction(
    async (tx) => {
      // Kunci baris (khusus PostgreSQL): edit bersamaan jadi antre,
      // yang kedua akan melihat is_final = true
      const locked = await tx.$queryRaw`
        SELECT id FROM "Invoice" WHERE id = ${req.id} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new ResponseError(404, "INVOICE_NOT_FOUND");
      }

      const invoice = await tx.invoice.findUnique({
        where: { id: req.id },
        include: { order: { select: { total_amount: true } } },
      });

      if (invoice.is_final) {
        throw new ResponseError(409, "INVOICE_ALREADY_FINAL");
      }

      // Diskon yang nggak dikirim tetap memakai nilai lama
      let storeDiscount = invoice.store_discount;
      let customerDiscount = invoice.customer_discount;

      if (req.store_discount !== undefined) {
        storeDiscount = toMoney(req.store_discount);
        data.store_discount = storeDiscount;
      }
      if (req.customer_discount !== undefined) {
        customerDiscount = toMoney(req.customer_discount);
        data.customer_discount = customerDiscount;
      }

      // Total selalu dihitung ulang dari subtotal order
      data.total_amount = String(
        calculateTotal(
          Number(invoice.order.total_amount),
          storeDiscount,
          customerDiscount,
        ),
      );
      data.is_final = true;

      return await tx.invoice.update({
        where: { id: req.id },
        data,
        include: INVOICE_INCLUDE,
      });
    },
    { timeout: 15000 },
  );

  return toInvoiceResponse(updated);
};

const deleteInvoice = async (request) => {
  const req = validate(deleteInvoiceValidation, request);

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.id },
    select: { order_id: true },
  });

  if (!invoice) {
    throw new ResponseError(404, "INVOICE_NOT_FOUND");
  }

  try {
    // Order ikut terhapus bersama invoice dan item-nya lewat Cascade
    await prisma.order.delete({ where: { id: invoice.order_id } });
  } catch (error) {
    // Terhapus di antara pengecekan dan delete (dua admin klik bersamaan)
    if (error.code === "P2025") {
      throw new ResponseError(404, "INVOICE_NOT_FOUND");
    }
    throw error;
  }

  return { message: "INVOICE_DELETED" };
};

export default {
  createInvoice,
  getAllInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
};
