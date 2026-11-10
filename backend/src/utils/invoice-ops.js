import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
import {
  createInvoiceValidation,
  deleteInvoiceValidation,
  getAllInvoiceValidation,
  getInvoiceValidation,
  updateInvoiceValidation,
} from "../validation/owner/invoice-validation.js";
import { validate } from "../validation/validation.js";
import {
  INVOICE_INCLUDE,
  blankToNull,
  calculateTotal,
  createOrderWithInvoice,
  toMoney,
} from "./order-invoice.js";

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

const sum = (items, fn) => items.reduce((total, item) => total + fn(item), 0);

// withCost = true untuk owner: daftar dan detail ikut membawa modal dan laba.
export const createInvoiceOps = ({ toResponse, withCost }) => {
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
      checkStock: false,
      extras: {
        payment_method: blankToNull(req.payment_method),
        ship: blankToNull(req.ship),
        store_discount: req.store_discount,
        customer_discount: req.customer_discount,
        terms_and_condition: req.terms_and_condition,
        is_final: req.is_final ?? false,
      },
    });

    return toResponse(invoice);
  };

  const getAllInvoice = async (query) => {
    const req = validate(getAllInvoiceValidation, query);

    if (
      req.created_from &&
      req.created_to &&
      req.created_from > req.created_to
    ) {
      throw new ResponseError(400, "INVALID_DATE_RANGE");
    }

    const where = {};

    if (req.is_final !== undefined) where.is_final = req.is_final;

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
        { order: { order_items: { some: { camera_name: contains } } } },
      ];
    }

    const [rows, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        include: {
          order: {
            select: {
              type: true,
              payment_status: true,
              order_items: {
                select: {
                  camera_price: true,
                  camera_modal: true,
                  quantity: true,
                },
              },
            },
          },
        },
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        skip: (req.page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: rows.map(({ order, terms_and_condition: _terms, ...invoice }) => {
        const row = {
          ...invoice,
          type: order.type,
          payment_status: order.payment_status,
          subtotal: sum(order.order_items, (i) => i.camera_price * i.quantity),
          item_count: order.order_items.length,
        };

        if (withCost) {
          const isSale = order.type === "SALE";
          const capital = sum(
            order.order_items,
            (i) => i.camera_modal * i.quantity,
          );

          row.capital_total = isSale ? capital : null;
          row.profit = isSale ? invoice.total_amount - capital : null;
        }

        return row;
      }),
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

    return toResponse(invoice);
  };

  // Edit hanya bisa SEKALI. Total invoice dan Order.total_amount dihitung ulang
  // bersama dan disimpan dalam satu transaksi.
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
        const locked = await tx.$queryRaw`
          SELECT id FROM "Invoice" WHERE id = ${req.id} FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new ResponseError(404, "INVOICE_NOT_FOUND");
        }

        const invoice = await tx.invoice.findUnique({
          where: { id: req.id },
          select: {
            is_final: true,
            store_discount: true,
            customer_discount: true,
            order_id: true,
          },
        });

        if (invoice.is_final) {
          throw new ResponseError(409, "INVOICE_ALREADY_FINAL");
        }

        await tx.$queryRaw`
          SELECT id FROM "Order" WHERE id = ${invoice.order_id} FOR UPDATE
        `;

        const order = await tx.order.findUnique({
          where: { id: invoice.order_id },
          select: {
            total_amount: true,
            order_items: { select: { camera_price: true, quantity: true } },
          },
        });

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

        const subtotal = sum(
          order.order_items,
          (i) => i.camera_price * i.quantity,
        );
        const total = calculateTotal(subtotal, storeDiscount, customerDiscount);

        if (total !== order.total_amount) {
          const refunds = await tx.order.findMany({
            where: { refund_of_id: invoice.order_id },
            select: { total_amount: true },
          });
          const refunded = sum(refunds, (r) => r.total_amount);

          if (refunded > total) {
            throw new ResponseError(409, "TOTAL_BELOW_REFUNDED", { refunded });
          }
        }

        data.total_amount = total;
        data.is_final = true;

        await tx.order.update({
          where: { id: invoice.order_id },
          data: { total_amount: total },
          select: { id: true },
        });

        return tx.invoice.update({
          where: { id: req.id },
          data,
          include: INVOICE_INCLUDE,
        });
      },
      { timeout: 15000 },
    );

    return toResponse(updated);
  };

  // Order yang sudah lunas tidak bisa dihapus: stoknya sudah terpotong dan
  // laporan memakainya. Ubah ke belum lunas dulu.
  const deleteInvoice = async (request) => {
    const req = validate(deleteInvoiceValidation, request);

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: req.id },
        select: { order_id: true },
      });

      if (!invoice) {
        throw new ResponseError(404, "INVOICE_NOT_FOUND");
      }

      await tx.$queryRaw`
        SELECT id FROM "Order" WHERE id = ${invoice.order_id} FOR UPDATE
      `;

      const order = await tx.order.findUnique({
        where: { id: invoice.order_id },
        select: { payment_status: true },
      });

      if (!order) {
        throw new ResponseError(404, "INVOICE_NOT_FOUND");
      }
      if (order.payment_status === "PAID") {
        throw new ResponseError(409, "ORDER_ALREADY_PAID");
      }

      try {
        await tx.order.delete({
          where: { id: invoice.order_id },
          select: { id: true },
        });
      } catch (error) {
        if (error.code === "P2025") {
          throw new ResponseError(404, "INVOICE_NOT_FOUND");
        }
        throw error;
      }
    });

    return { message: "INVOICE_DELETED" };
  };

  return {
    createInvoice,
    getAllInvoice,
    getInvoice,
    updateInvoice,
    deleteInvoice,
  };
};
