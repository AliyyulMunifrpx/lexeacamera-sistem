import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { calculateTotal } from "../../utils/order-invoice.js";
import { setPaymentStatus } from "../../utils/payment-status.js";
import {
  getAllOrderValidation,
  orderIdValidation,
  setPaymentStatusValidation,
  updateOrderItemsValidation,
} from "../../validation/owner/order-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const LIST_SELECT = {
  id: true,
  type: true,
  payment_status: true,
  paid_at: true,
  created_at: true,
  total_amount: true,
  customer_id: true,
  customer_name: true,
  whatsapp: true,
  invoice: { select: { no_invoice: true } },
  order_items: { select: { quantity: true, camera_modal: true } },
};

const DETAIL_SELECT = {
  id: true,
  type: true,
  refund_of_id: true,
  payment_status: true,
  paid_at: true,
  created_at: true,
  total_amount: true,
  customer_name: true,
  address: true,
  whatsapp: true,
  instagram: true,
  customer: {
    select: { id: true, name: true, whatsapp: true, instagram: true },
  },
  invoice: {
    select: {
      id: true,
      no_invoice: true,
      payment_method: true,
      ship: true,
      store_discount: true,
      customer_discount: true,
      is_final: true,
    },
  },
  refunds: {
    select: { id: true, total_amount: true, created_at: true },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  },
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
      camera: { select: { sku: true } },
    },
  },
};

const wibStart = (date) => new Date(`${date}T00:00:00+07:00`);

const buildSearch = (search) => {
  const conditions = [
    { customer_name: { contains: search, mode: "insensitive" } },
    { customer_id: { contains: search, mode: "insensitive" } },
    {
      invoice: {
        is: { no_invoice: { contains: search, mode: "insensitive" } },
      },
    },
  ];

  if (/^\+?[\d\s-]+$/.test(search)) {
    const digits = search.replace(/\D/g, "");

    if (digits.length >= 3) {
      conditions.push({
        whatsapp: {
          contains: digits.startsWith("0") ? `62${digits.slice(1)}` : digits,
        },
      });
    }
  }

  return conditions;
};

const sumCapital = (items) =>
  items.reduce((sum, item) => sum + item.camera_modal * item.quantity, 0);

const getAllOrder = async (request) => {
  const req = validate(getAllOrderValidation, request);

  if (req.date_from && req.date_to && req.date_from > req.date_to) {
    throw new ResponseError(400, "INVALID_DATE_RANGE");
  }

  const base = {};
  if (req.search) base.OR = buildSearch(req.search);
  if (req.date_from || req.date_to) {
    base[req.date_field] = {};
    if (req.date_from) base[req.date_field].gte = wibStart(req.date_from);
    if (req.date_to) {
      base[req.date_field].lt = new Date(
        wibStart(req.date_to).getTime() + DAY_MS,
      );
    }
  }

  const listWhere = { ...base };
  if (req.type) listWhere.type = req.type;
  if (req.payment_status) listWhere.payment_status = req.payment_status;

  const queries = [
    prisma.order.findMany({
      where: listWhere,
      select: LIST_SELECT,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.order.count({ where: listWhere }),
  ];

  const summarize = req.type !== "REFUND";
  if (summarize) {
    queries.push(
      prisma.order.groupBy({
        by: ["payment_status"],
        where: { ...base, type: "SALE" },
        _count: { _all: true },
        _sum: { total_amount: true },
      }),
    );
  }

  const [orders, total, groups = []] = await prisma.$transaction(queries);

  const summary = {
    paid: { count: 0, amount: 0 },
    unpaid: { count: 0, amount: 0 },
  };
  for (const group of groups) {
    const key = group.payment_status === "PAID" ? "paid" : "unpaid";
    summary[key] = {
      count: group._count._all,
      amount: group._sum.total_amount ?? 0,
    };
  }

  return {
    data: orders.map(({ order_items, invoice, ...order }) => {
      const isSale = order.type === "SALE";
      const capital = sumCapital(order_items);

      return {
        ...order,
        no_invoice: invoice?.no_invoice ?? null,
        item_count: order_items.reduce((sum, item) => sum + item.quantity, 0),
        capital_total: isSale ? capital : null,
        profit: isSale ? order.total_amount - capital : null,
      };
    }),
    summary,
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const getOrder = async (request) => {
  const req = validate(orderIdValidation, request);

  const order = await prisma.order.findUnique({
    where: { id: req.id },
    select: DETAIL_SELECT,
  });

  if (!order) {
    throw new ResponseError(404, "ORDER_NOT_FOUND");
  }

  const { order_items, invoice, ...rest } = order;
  const isSale = order.type === "SALE";

  const items = order_items.map(({ camera, ...item }) => ({
    ...item,
    sku: camera?.sku ?? null,
    line_total: item.camera_price * item.quantity,
    line_capital: item.camera_modal * item.quantity,
  }));
  const capital = items.reduce((sum, item) => sum + item.line_capital, 0);

  return {
    ...rest,
    subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
    store_discount: invoice?.store_discount ?? 0,
    customer_discount: invoice?.customer_discount ?? 0,
    capital_total: isSale ? capital : null,
    profit: isSale ? order.total_amount - capital : null,
    invoice,
    items,
  };
};

const updatePaymentStatus = async (request) => {
  const req = validate(setPaymentStatusValidation, request);

  return prisma.$transaction((tx) =>
    setPaymentStatus(tx, {
      orderId: req.id,
      status: req.payment_status,
      paidAt: req.paid_at,
    }),
  );
};

const sum = (lines, fn) => lines.reduce((total, line) => total + fn(line), 0);

const updateOrderItems = async (request) => {
  const req = validate(updateOrderItemsValidation, request);

  await prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw`
        SELECT id FROM "Order" WHERE id = ${req.id} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new ResponseError(404, "ORDER_NOT_FOUND");
      }

      const order = await tx.order.findUnique({
        where: { id: req.id },
        select: {
          type: true,
          payment_status: true,
          order_items: {
            select: {
              id: true,
              camera_id: true,
              camera_price: true,
              quantity: true,
            },
          },
          invoice: {
            select: { store_discount: true, customer_discount: true },
          },
        },
      });

      if (order.type !== "SALE") {
        throw new ResponseError(409, "ORDER_NOT_SALE");
      }

      if (order.payment_status === "PAID") {
        throw new ResponseError(409, "ORDER_ALREADY_PAID");
      }

      const existing = new Map();
      const duplicates = [];

      for (const item of order.order_items) {
        if (existing.has(item.camera_id)) duplicates.push(item.id);
        else existing.set(item.camera_id, item);
      }

      const wanted = new Map(req.items.map((item) => [item.camera_id, item]));
      const newIds = req.items
        .map((item) => item.camera_id)
        .filter((cameraId) => !existing.has(cameraId));

      let fresh = new Map();

      if (newIds.length > 0) {
        await tx.$queryRaw`
          SELECT id
          FROM "Camera"
          WHERE id IN (${Prisma.join(newIds)}) AND is_deleted = false
          ORDER BY id
          FOR SHARE
        `;

        const cameras = await tx.camera.findMany({
          where: { id: { in: newIds }, is_deleted: false },
          select: { id: true, name: true, price: true, capital: true },
        });
        fresh = new Map(cameras.map((camera) => [camera.id, camera]));

        const missing = newIds.filter((cameraId) => !fresh.has(cameraId));
        if (missing.length > 0) {
          throw new ResponseError(404, "CAMERA_NOT_FOUND", {
            camera_ids: missing,
          });
        }

        for (const camera of cameras) {
          if (
            !Number.isSafeInteger(camera.price) ||
            camera.price < 0 ||
            !Number.isSafeInteger(camera.capital) ||
            camera.capital < 0
          ) {
            throw new ResponseError(500, "CAMERA_PRICE_INVALID");
          }
        }
      }

      // Barang yang sudah ada tetap memakai harga dan modal saat order dibuat.
      const lines = req.items.map((item) => {
        const current = existing.get(item.camera_id);
        const price = current
          ? current.camera_price
          : fresh.get(item.camera_id).price;

        return { camera_id: item.camera_id, quantity: item.quantity, price };
      });

      const subtotal = sum(lines, (line) => line.price * line.quantity);
      const total = calculateTotal(
        subtotal,
        order.invoice?.store_discount,
        order.invoice?.customer_discount,
      );

      const removeIds = [
        ...duplicates,
        ...[...existing.values()]
          .filter((item) => !wanted.has(item.camera_id))
          .map((item) => item.id),
      ];

      if (removeIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: { order_id: req.id, id: { in: removeIds } },
        });
      }

      for (const item of req.items) {
        const current = existing.get(item.camera_id);

        if (current && current.quantity !== item.quantity) {
          await tx.orderItem.update({
            where: { id: current.id },
            data: { quantity: item.quantity },
            select: { id: true },
          });
        }
      }

      if (newIds.length > 0) {
        await tx.orderItem.createMany({
          data: newIds.map((cameraId) => {
            const camera = fresh.get(cameraId);

            return {
              order_id: req.id,
              camera_id: cameraId,
              camera_name: camera.name,
              camera_price: camera.price,
              camera_modal: camera.capital,
              quantity: wanted.get(cameraId).quantity,
            };
          }),
        });
      }

      await tx.order.update({
        where: { id: req.id },
        data: { total_amount: total },
        select: { id: true },
      });

      if (order.invoice) {
        await tx.invoice.update({
          where: { order_id: req.id },
          data: { total_amount: total },
          select: { id: true },
        });
      }
    },
    { timeout: 15000 },
  );

  return getOrder({ id: req.id });
};

export default { getAllOrder, getOrder, updatePaymentStatus, updateOrderItems };
