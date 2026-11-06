import { ResponseError } from "../error/response-error.js";

const toResult = (order) => ({
  id: order.id,
  payment_status: order.payment_status,
  paid_at: order.paid_at,
});

// Stok kamera berkurang saat order jadi PAID dan kembali saat PAID dibatalkan.
// Pengurangan atomik (stock >= jumlah dicek di UPDATE yang sama), tidak ada jendela
// untuk dua order yang dilunasi bersamaan menjual unit terakhir dua kali.
const stockByCamera = (items) => {
  const totals = new Map();

  for (const item of items) {
    totals.set(item.camera_id, (totals.get(item.camera_id) ?? 0) + item.quantity);
  }

  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));
};

const takeStock = async (tx, items) => {
  const short = [];

  for (const [cameraId, quantity] of stockByCamera(items)) {
    const { count } = await tx.camera.updateMany({
      where: { id: cameraId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });

    if (count === 0) {
      const camera = await tx.camera.findUnique({
        where: { id: cameraId },
        select: { name: true, stock: true },
      });

      short.push({
        camera_id: cameraId,
        name: camera?.name ?? null,
        requested: quantity,
        stock: camera?.stock ?? 0,
      });
    }
  }

  if (short.length > 0) {
    throw new ResponseError(409, "INSUFFICIENT_STOCK", { cameras: short });
  }
};

export const returnStock = async (tx, items) => {
  for (const [cameraId, quantity] of stockByCamera(items)) {
    await tx.camera.updateMany({
      where: { id: cameraId },
      data: { stock: { increment: quantity } },
    });
  }
};

export const setPaymentStatus = async (tx, { orderId, status, paidAt }) => {
  const locked = await tx.$queryRaw`
    SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
  `;

  if (locked.length === 0) {
    throw new ResponseError(404, "ORDER_NOT_FOUND");
  }

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      type: true,
      payment_status: true,
      paid_at: true,
      created_at: true,
      order_items: { select: { camera_id: true, quantity: true, restocked: true } },
    },
  });

  let nextPaidAt;

  if (status === "PAID") {
    if (order.payment_status === "PAID" && !paidAt) return toResult(order);

    nextPaidAt = paidAt ?? new Date();

    if (nextPaidAt < order.created_at) {
      throw new ResponseError(400, "PAID_AT_BEFORE_ORDER");
    }

    if (
      order.payment_status === "PAID" &&
      nextPaidAt.getTime() === order.paid_at.getTime()
    ) {
      return toResult(order);
    }
  } else {
    if (order.payment_status === "UNPAID") return toResult(order);

    const refunds = await tx.order.count({ where: { refund_of_id: orderId } });

    if (refunds > 0) {
      throw new ResponseError(409, "ORDER_HAS_REFUNDS");
    }

    nextPaidAt = null;
  }

  // Penjualan: lunas mengurangi stok. Refund: lunas menambah stok, hanya untuk
  // item yang ditandai restocked.
  const isSale = order.type === "SALE";
  const stockItems = isSale
    ? order.order_items
    : order.order_items.filter((item) => item.restocked);

  if (status === "PAID" && order.payment_status === "UNPAID") {
    await (isSale ? takeStock : returnStock)(tx, stockItems);
  } else if (status === "UNPAID") {
    await (isSale ? returnStock : takeStock)(tx, stockItems);
  }

  return tx.order.update({
    where: { id: orderId },
    data: { payment_status: status, paid_at: nextPaidAt },
    select: { id: true, payment_status: true, paid_at: true },
  });
};
