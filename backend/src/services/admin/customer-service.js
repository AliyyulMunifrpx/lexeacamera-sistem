import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  blankToNull,
  generateCustomerId,
  normalizeWhatsapp,
} from "../../utils/customer.js";
import {
  createCustomerValidation,
  customerIdValidation,
  getAllCustomerValidation,
  updateCustomerValidation,
} from "../../validation/admin/customer-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;
const MAX_ID_ATTEMPTS = 5;
const DETAIL_ORDER_LIMIT = 50;

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  whatsapp: true,
  instagram: true,
  address: true,
  created_at: true,
};

const ORDER_SELECT = {
  id: true,
  type: true,
  refund_of_id: true,
  payment_status: true,
  paid_at: true,
  total_amount: true,
  created_at: true,
  invoice: { select: { no_invoice: true, id: true } },
};

// Ganti fungsi buildSearch di customer service dengan ini.
const buildSearch = (search) => {
  const conditions = [
    { name: { contains: search, mode: "insensitive" } },
    { id: { contains: search, mode: "insensitive" } },
    { instagram: { contains: search, mode: "insensitive" } },
    { address: { contains: search, mode: "insensitive" } },
  ];

  if (/^\+?[\d\s-]+$/.test(search)) {
    const digits = search.replace(/\D/g, "");

    if (digits.length >= 3) {
      const normalized = digits.startsWith("0")
        ? `62${digits.slice(1)}`
        : digits.startsWith("62")
          ? digits
          : `62${digits}`;

      // Cocokkan angka apa adanya (potongan nomor) dan bentuk kanonik 62...
      conditions.push({ whatsapp: { contains: digits } });
      conditions.push({ whatsapp: { contains: normalized } });
    }
  }

  return conditions;
};
// Aturan total belanja: hanya order PAID yang dihitung, untuk SALE (+) maupun REFUND (-).
// order_count: semua order SALE, termasuk yang belum lunas.
const statsQueries = (ids) => [
  prisma.order.groupBy({
    by: ["customer_id"],
    where: { customer_id: { in: ids }, type: "SALE" },
    _count: { _all: true },
  }),
  prisma.order.groupBy({
    by: ["customer_id"],
    where: { customer_id: { in: ids }, type: "SALE", payment_status: "PAID" },
    _sum: { total_amount: true },
  }),
  prisma.order.groupBy({
    by: ["customer_id"],
    where: { customer_id: { in: ids }, type: "REFUND", payment_status: "PAID" },
    _sum: { total_amount: true },
  }),
];

const buildStats = ([sales, paid, refunds]) => {
  const stats = new Map();
  const entry = (id) => {
    if (!stats.has(id)) stats.set(id, { order_count: 0, paid: 0, refunded: 0 });
    return stats.get(id);
  };

  for (const row of sales) entry(row.customer_id).order_count = row._count._all;
  for (const row of paid)
    entry(row.customer_id).paid = row._sum.total_amount ?? 0;
  for (const row of refunds) {
    entry(row.customer_id).refunded = row._sum.total_amount ?? 0;
  }

  return (id) => {
    const found = stats.get(id) ?? { order_count: 0, paid: 0, refunded: 0 };

    return {
      order_count: found.order_count,
      total_spent: found.paid - found.refunded,
    };
  };
};

const getAllCustomer = async (request) => {
  const req = validate(getAllCustomerValidation, request);

  const where = req.search ? { OR: buildSearch(req.search) } : {};

  const [customers, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      select: CUSTOMER_SELECT,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.customer.count({ where }),
  ]);

  const statsOf = buildStats(
    customers.length
      ? await prisma.$transaction(statsQueries(customers.map((c) => c.id)))
      : [[], [], []],
  );

  return {
    data: customers.map((customer) => ({
      ...customer,
      ...statsOf(customer.id),
    })),
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

// Ringkasan untuk 3 stat card: dihitung dari SELURUH pelanggan, bukan satu halaman.
const getCustomerSummary = async () => {
  const [total_customers, [row]] = await Promise.all([
    prisma.customer.count(),
    prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT o.customer_id) FILTER (WHERE o.type = 'SALE')
          AS customers_with_orders,
        COALESCE(
          SUM(o.total_amount::bigint)
            FILTER (WHERE o.type = 'SALE' AND o.payment_status = 'PAID'),
          0
        )
        - COALESCE(
          SUM(o.total_amount::bigint)
            FILTER (WHERE o.type = 'REFUND' AND o.payment_status = 'PAID'),
          0
        ) AS total_spent
      FROM "Order" o
      WHERE o.customer_id IS NOT NULL
    `,
  ]);

  return {
    total_customers,
    customers_with_orders: Number(row?.customers_with_orders ?? 0),
    total_spent: Number(row?.total_spent ?? 0),
  };
};

const getCustomer = async (request) => {
  const req = validate(customerIdValidation, request);

  const [customer, orders, ...stats] = await prisma.$transaction([
    prisma.customer.findUnique({
      where: { id: req.id },
      select: CUSTOMER_SELECT,
    }),
    prisma.order.findMany({
      where: { customer_id: req.id },
      select: ORDER_SELECT,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      take: DETAIL_ORDER_LIMIT,
    }),
    ...statsQueries([req.id]),
  ]);

  if (!customer) {
    throw new ResponseError(404, "CUSTOMER_NOT_FOUND");
  }

  return { ...customer, ...buildStats(stats)(req.id), orders };
};

const createCustomer = async (request) => {
  const req = validate(createCustomerValidation, request);

  const data = {
    name: req.name,
    address: req.address,
    whatsapp: normalizeWhatsapp(req.whatsapp),
    instagram: blankToNull(req.instagram),
  };

  const whatsappTaken = async () =>
    (await prisma.customer.findUnique({
      where: { whatsapp: data.whatsapp },
      select: { id: true },
    })) !== null;

  if (await whatsappTaken()) {
    throw new ResponseError(409, "WHATSAPP_ALREADY_USED");
  }

  for (let attempt = 1; attempt <= MAX_ID_ATTEMPTS; attempt++) {
    try {
      const customer = await prisma.customer.create({
        data: { id: generateCustomerId(), ...data },
        select: CUSTOMER_SELECT,
      });

      return { ...customer, order_count: 0, total_spent: 0 };
    } catch (error) {
      if (error.code !== "P2002") throw error;

      if (await whatsappTaken()) {
        throw new ResponseError(409, "WHATSAPP_ALREADY_USED");
      }
    }
  }

  throw new ResponseError(500, "CUSTOMER_ID_GENERATION_FAILED");
};

const updateCustomer = async (request) => {
  const { id, ...fields } = validate(updateCustomerValidation, request);

  const data = {};
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.address !== undefined) data.address = fields.address;
  if (fields.instagram !== undefined) {
    data.instagram = blankToNull(fields.instagram);
  }
  if (fields.whatsapp !== undefined) {
    data.whatsapp = normalizeWhatsapp(fields.whatsapp);

    const owner = await prisma.customer.findUnique({
      where: { whatsapp: data.whatsapp },
      select: { id: true },
    });

    if (owner && owner.id !== id) {
      throw new ResponseError(409, "WHATSAPP_ALREADY_USED");
    }
  }

  try {
    const customer = await prisma.customer.update({
      where: { id },
      data,
      select: CUSTOMER_SELECT,
    });

    const stats = buildStats(await prisma.$transaction(statsQueries([id])));

    return { ...customer, ...stats(id) };
  } catch (error) {
    if (error.code === "P2025") {
      throw new ResponseError(404, "CUSTOMER_NOT_FOUND");
    }
    if (error.code === "P2002") {
      throw new ResponseError(409, "WHATSAPP_ALREADY_USED");
    }

    throw error;
  }
};

const deleteCustomer = async (request) => {
  const req = validate(customerIdValidation, request);

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id FROM "Customer" WHERE id = ${req.id} FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new ResponseError(404, "CUSTOMER_NOT_FOUND");
    }

    const orders = await tx.order.count({ where: { customer_id: req.id } });

    if (orders > 0) {
      throw new ResponseError(409, "CUSTOMER_HAS_ORDERS");
    }

    await tx.customer.delete({ where: { id: req.id } });
  });
};

export default {
  getAllCustomer,
  getCustomerSummary,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
