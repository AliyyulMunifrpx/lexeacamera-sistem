import { ResponseError } from "../error/response-error.js";

// DP sudah dibayar atau belum: true / false, null kalau order tidak punya DP.
export const isDpPaid = (order) =>
  order.dp_amount === null || order.dp_amount === undefined
    ? null
    : order.dp_paid_at !== null && order.dp_paid_at !== undefined;

const toResult = (order) => ({
  id: order.id,
  payment_status: order.payment_status,
  paid_at: order.paid_at,
  dp_amount: order.dp_amount ?? null,
  dp_paid: isDpPaid(order),
  dp_paid_at: order.dp_paid_at ?? null,
});

const RESULT_SELECT = {
  id: true,
  payment_status: true,
  paid_at: true,
  dp_amount: true,
  dp_paid_at: true,
};

// Sisa tagihan untuk penjualan: lunas 0, DP yang SUDAH dibayar mengurangi total,
// DP yang belum dibayar belum mengurangi apa pun (sisa = total), belum bayar total.
// Order refund tidak punya sisa tagihan.
export const remainingAmount = (order) => {
  if (order.type !== "SALE") return null;
  if (order.payment_status === "PAID") return 0;

  const received = isDpPaid(order) ? order.dp_amount : 0;

  return order.total_amount - received;
};

// Total invoice yang diedit tidak boleh jatuh di bawah DP yang sudah diterima:
// order DP harus tetap punya sisa (total > DP), order lunas minimal sama (total >= DP).
export const assertTotalCoversDp = (order, total) => {
  if (order.dp_amount === null || order.dp_amount === undefined) return;

  const covered =
    order.payment_status === "DP"
      ? total > order.dp_amount
      : total >= order.dp_amount;

  if (!covered) {
    throw new ResponseError(409, "TOTAL_BELOW_DP", {
      dp_amount: order.dp_amount,
    });
  }
};

// Stok kamera ditahan sejak order keluar dari UNPAID (DP atau PAID) dan kembali
// saat order kembali ke UNPAID. Pengurangan atomik (stock >= jumlah dicek di UPDATE
// yang sama), tidak ada jendela untuk dua order yang dibayar bersamaan menjual
// unit terakhir dua kali.
const stockByCamera = (items) => {
  const totals = new Map();

  for (const item of items) {
    totals.set(
      item.camera_id,
      (totals.get(item.camera_id) ?? 0) + item.quantity,
    );
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

export const setPaymentStatus = async (
  tx,
  { orderId, status, paidAt, dpAmount, dpPaid },
) => {
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
      dp_amount: true,
      dp_paid_at: true,
      total_amount: true,
      created_at: true,
      order_items: {
        select: { camera_id: true, quantity: true, restocked: true },
      },
    },
  });

  const isSale = order.type === "SALE";

  // Data DP yang akan disimpan kalau status tujuannya DP.
  let dp = null;

  if (status === "DP") {
    if (!isSale) {
      throw new ResponseError(409, "ORDER_NOT_SALE");
    }

    const isDp = order.payment_status === "DP";

    // Order yang sudah DP boleh dikirim tanpa dp_amount (misalnya hanya menandai
    // DP sudah dibayar): nominal lama dipakai.
    const amount = dpAmount ?? (isDp ? order.dp_amount : undefined);

    if (amount === undefined) {
      throw new ResponseError(400, "DP_AMOUNT_REQUIRED");
    }

    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount >= order.total_amount
    ) {
      throw new ResponseError(400, "DP_AMOUNT_OUT_OF_RANGE", {
        total_amount: order.total_amount,
      });
    }

    // Tidak dikirim: order yang sudah DP mempertahankan statusnya, perpindahan
    // dari status lain dianggap DP sudah dibayar (perilaku lama).
    const wasPaid = order.dp_paid_at !== null && order.dp_paid_at !== undefined;
    const paid = dpPaid ?? (isDp ? wasPaid : true);

    // Koreksi nominal atau status bayar DP pada order yang sudah DP: stok dan
    // kuota edit tidak berubah.
    if (isDp) {
      if (order.dp_amount === amount && wasPaid === paid)
        return toResult(order);

      return toResult(
        await tx.order.update({
          where: { id: orderId },
          data: {
            dp_amount: amount,
            dp_paid_at: paid ? (order.dp_paid_at ?? new Date()) : null,
          },
          select: RESULT_SELECT,
        }),
      );
    }

    dp = { amount, paidAt: paid ? new Date() : null };
  }

  let nextPaidAt = null;

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
    if (order.payment_status === status) return toResult(order);

    const refunds = await tx.order.count({ where: { refund_of_id: orderId } });

    if (refunds > 0) {
      throw new ResponseError(409, "ORDER_HAS_REFUNDS");
    }
  }

  // Penjualan: stok berkurang saat order mulai ditahan (UNPAID ke DP/PAID) dan
  // kembali saat ditahan dilepas (DP/PAID ke UNPAID). Refund: lunas menambah stok,
  // hanya untuk item yang ditandai restocked.
  const wasHeld = order.payment_status !== "UNPAID";
  const willHold = status !== "UNPAID";
  const stockItems = isSale
    ? order.order_items
    : order.order_items.filter((item) => item.restocked);

  if (!wasHeld && willHold) {
    await (isSale ? takeStock : returnStock)(tx, stockItems);
  } else if (wasHeld && !willHold) {
    await (isSale ? returnStock : takeStock)(tx, stockItems);
  }

  // DP belum dibayar lalu order langsung lunas: tidak ada DP yang pernah diterima
  // terpisah, jadi nominal DP dihapus (DP yang sudah dibayar tetap tersimpan).
  const dropUnpaidDp =
    status === "PAID" &&
    order.payment_status === "DP" &&
    order.dp_paid_at === null;

  const updated = toResult(
    await tx.order.update({
      where: { id: orderId },
      data: {
        payment_status: status,
        paid_at: nextPaidAt,
        ...(status === "DP" && { dp_amount: dp.amount, dp_paid_at: dp.paidAt }),
        ...(status === "UNPAID" && { dp_amount: null, dp_paid_at: null }),
        ...(dropUnpaidDp && { dp_amount: null }),
      },
      select: RESULT_SELECT,
    }),
  );

  // Kuota edit invoice per status: pindah status membuka kuota baru (1 kali edit)
  // untuk status tujuan. Koreksi paid_at pada order yang sudah PAID tidak menghitung.
  if (isSale && order.payment_status !== status) {
    await tx.invoice.updateMany({
      where: { order_id: orderId },
      data: { is_final: false },
    });
  }

  return updated;
};
