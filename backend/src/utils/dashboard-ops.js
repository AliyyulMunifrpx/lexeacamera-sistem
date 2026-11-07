import { prisma } from "../lib/database.js";
import { getDashboardValidation } from "../validation/owner/dashboard-validation.js";
import { validate } from "../validation/validation.js";

const LIST_SIZE = 3;
const TOP_PRODUCTS_SIZE = 5;
// Stok sampai angka ini dianggap menipis (termasuk yang sudah habis)
const LOW_STOCK_THRESHOLD = 3;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const ACTIVE = { is_deleted: false };

const CAMERA_INCLUDE = {
  images: { where: { is_primary: true }, take: 1 },
  category: true,
};

const NEWEST_FIRST = [{ created_at: "desc" }, { id: "asc" }];

// Hanya penjualan: invoice milik refund tidak ikut dihitung
const SALE = { type: "SALE" };

export const getWibBoundaries = (now = Date.now()) => {
  const wib = new Date(now + WIB_OFFSET_MS);
  const year = wib.getUTCFullYear();
  const month = wib.getUTCMonth();
  const day = wib.getUTCDate();

  return {
    dayStart: new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS),
    monthStart: new Date(Date.UTC(year, month, 1) - WIB_OFFSET_MS),
    nextMonthStart: new Date(Date.UTC(year, month + 1, 1) - WIB_OFFSET_MS),
  };
};

const INVOICE_ROW_INCLUDE = {
  order: {
    select: {
      type: true,
      payment_status: true,
      order_items: { select: { camera_price: true, quantity: true } },
    },
  },
};

// Bentuknya sama dengan satu baris GET /invoices (versi admin, tanpa modal)
const toInvoiceRow = ({ order, terms_and_condition: _terms, ...invoice }) => ({
  ...invoice,
  type: order.type,
  payment_status: order.payment_status,
  subtotal: order.order_items.reduce(
    (sum, item) => sum + item.camera_price * item.quantity,
    0,
  ),
  item_count: order.order_items.length,
});

// Modal (capital) hanya untuk owner
const withoutCapital = ({ capital: _capital, ...camera }) => camera;

const pad = (n) => String(n).padStart(2, "0");

// Satu titik per hari sejak tanggal 1 sampai hari ini (WIB), hari tanpa
// penjualan diisi 0 supaya grafik tidak bolong.
// Owner: revenue = gross (penjualan lunas) - refund (refund lunas), per tanggal lunas.
const buildTrend = ({ trendRows, monthStart, dayStart, isOwner }) => {
  const first = new Date(monthStart.getTime() + WIB_OFFSET_MS);
  const year = first.getUTCFullYear();
  const month = pad(first.getUTCMonth() + 1);
  const today = new Date(dayStart.getTime() + WIB_OFFSET_MS).getUTCDate();

  const byDay = new Map(trendRows.map((row) => [row.day, row]));
  const days = [];

  for (let day = 1; day <= today; day++) {
    const date = `${year}-${month}-${pad(day)}`;
    const row = byDay.get(date);
    const point = { date, orders: row?.orders ?? 0 };

    if (isOwner) {
      const gross = Number(row?.gross ?? 0);
      const refund = Number(row?.refund ?? 0);

      point.gross = gross;
      point.refund = refund;
      point.refund_orders = row?.refund_orders ?? 0;
      point.revenue = gross - refund;
    }

    days.push(point);
  }

  return days;
};

// isOwner = true: ditambah pendapatan bulan ini, rincian refund, dan modal kamera.
export const createDashboardOps = ({ isOwner }) => {
  const getDashboard = async (query = {}) => {
    validate(getDashboardValidation, query);

    const { dayStart, monthStart, nextMonthStart } = getWibBoundaries();

    const bestSellingWhere = { ...ACTIVE, best_selling: true };
    const promoWhere = { ...ACTIVE, promo: true };
    const lowStockWhere = { ...ACTIVE, stock: { lte: LOW_STOCK_THRESHOLD } };
    const unpaidWhere = { order: { ...SALE, payment_status: "UNPAID" } };

    // Order lunas per hari (WIB) bulan ini, menurut tanggal lunas. Pendapatan
    // bersih = penjualan lunas dikurangi refund lunas (dihitung di buildTrend).
    // Refund belum lunas tidak mengurangi pendapatan, dihitung terpisah.
    // Versi admin tidak membaca nominal sama sekali, hanya jumlah order.
    const trendQuery = () =>
      isOwner
        ? prisma.$queryRaw`
      SELECT to_char(("paid_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day,
        (COUNT(*) FILTER (WHERE "type" = 'SALE'))::int AS orders,
        (COUNT(*) FILTER (WHERE "type" = 'REFUND'))::int AS refund_orders,
        COALESCE(SUM("total_amount") FILTER (WHERE "type" = 'SALE'), 0)::text AS gross,
        COALESCE(SUM("total_amount") FILTER (WHERE "type" = 'REFUND'), 0)::text AS refund
      FROM "Order"
      WHERE "payment_status" = 'PAID'
        AND "paid_at" >= ${monthStart.toISOString()}::timestamp
        AND "paid_at" < ${nextMonthStart.toISOString()}::timestamp
      GROUP BY 1
      ORDER BY 1
    `
        : prisma.$queryRaw`
      SELECT to_char(("paid_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day,
        (COUNT(*) FILTER (WHERE "type" = 'SALE'))::int AS orders
      FROM "Order"
      WHERE "payment_status" = 'PAID'
        AND "paid_at" >= ${monthStart.toISOString()}::timestamp
        AND "paid_at" < ${nextMonthStart.toISOString()}::timestamp
      GROUP BY 1
      ORDER BY 1
    `;

    // Kamera paling laku bulan ini: jumlah unit terjual dikurangi unit refund
    const topProductsQuery = () => prisma.$queryRaw`
      SELECT oi."camera_id" AS camera_id,
        MAX(oi."camera_name") AS name,
        (SUM(CASE WHEN o."type" = 'SALE' THEN oi."quantity" ELSE -oi."quantity" END))::int AS units
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."order_id"
      WHERE o."payment_status" = 'PAID'
        AND o."paid_at" >= ${monthStart.toISOString()}::timestamp
        AND o."paid_at" < ${nextMonthStart.toISOString()}::timestamp
      GROUP BY oi."camera_id"
      HAVING SUM(CASE WHEN o."type" = 'SALE' THEN oi."quantity" ELSE -oi."quantity" END) > 0
      ORDER BY units DESC, name ASC, camera_id ASC
      LIMIT ${TOP_PRODUCTS_SIZE}
    `;

    // Satu transaksi: semua angka dibaca lewat satu koneksi
    const [
      totalCameras,
      outOfStock,
      pendingInvoices,
      finalInvoices,
      invoicesToday,
      unpaidInvoices,
      paidInvoices,
      bestSellingTotal,
      bestSelling,
      promoTotal,
      promo,
      lowStockTotal,
      lowStock,
      pendingRows,
      unpaidRows,
      trendRows,
      topRows,
      // Hanya owner: refund yang belum dikembalikan (kewajiban yang menggantung,
      // tidak dibatasi bulan). Untuk admin elemen ini tidak ada (undefined).
      unpaidRefund,
    ] = await prisma.$transaction([
      prisma.camera.count({ where: ACTIVE }),
      prisma.camera.count({ where: { ...ACTIVE, stock: 0 } }),

      prisma.invoice.count({ where: { is_final: false, order: SALE } }),
      prisma.invoice.count({ where: { is_final: true, order: SALE } }),
      prisma.invoice.count({
        where: { created_at: { gte: dayStart }, order: SALE },
      }),
      prisma.invoice.count({ where: unpaidWhere }),
      prisma.invoice.count({
        where: { order: { ...SALE, payment_status: "PAID" } },
      }),

      prisma.camera.count({ where: bestSellingWhere }),
      prisma.camera.findMany({
        where: bestSellingWhere,
        include: CAMERA_INCLUDE,
        orderBy: NEWEST_FIRST,
        take: LIST_SIZE,
      }),

      prisma.camera.count({ where: promoWhere }),
      prisma.camera.findMany({
        where: promoWhere,
        include: CAMERA_INCLUDE,
        orderBy: NEWEST_FIRST,
        take: LIST_SIZE,
      }),

      prisma.camera.count({ where: lowStockWhere }),
      prisma.camera.findMany({
        where: lowStockWhere,
        include: CAMERA_INCLUDE,
        // Paling kritis dulu: stok habis, lalu sisa 1, dst
        orderBy: [{ stock: "asc" }, ...NEWEST_FIRST],
        take: LIST_SIZE,
      }),

      prisma.invoice.findMany({
        where: { is_final: false, order: SALE },
        include: INVOICE_ROW_INCLUDE,
        orderBy: NEWEST_FIRST,
        take: LIST_SIZE,
      }),
      prisma.invoice.findMany({
        where: unpaidWhere,
        include: INVOICE_ROW_INCLUDE,
        orderBy: NEWEST_FIRST,
        take: LIST_SIZE,
      }),

      trendQuery(),
      topProductsQuery(),

      ...(isOwner
        ? [
            prisma.order.aggregate({
              where: { type: "REFUND", payment_status: "UNPAID" },
              _count: { _all: true },
              _sum: { total_amount: true },
            }),
          ]
        : []),
    ]);

    const cameras = (rows) => (isOwner ? rows : rows.map(withoutCapital));

    const summary = {
      cameras: { total: totalCameras, out_of_stock: outOfStock },
      invoices: {
        total: pendingInvoices + finalInvoices,
        pending: pendingInvoices,
        final: finalInvoices,
        today: invoicesToday,
        unpaid: unpaidInvoices,
        paid: paidInvoices,
      },
    };

    const trend = buildTrend({ trendRows, monthStart, dayStart, isOwner });

    if (isOwner) {
      // Bersih: penjualan lunas - refund lunas (per tanggal lunas)
      summary.revenue_this_month = trend.reduce(
        (sum, day) => sum + day.revenue,
        0,
      );
      // Rincian untuk kartu pendapatan
      summary.revenue_gross_this_month = trend.reduce(
        (sum, day) => sum + day.gross,
        0,
      );
      summary.refund_this_month = {
        count: trend.reduce((sum, day) => sum + day.refund_orders, 0),
        amount: trend.reduce((sum, day) => sum + day.refund, 0),
      };
      summary.refund_unpaid = {
        count: unpaidRefund?._count?._all ?? 0,
        amount: Number(unpaidRefund?._sum?.total_amount ?? 0),
      };
    }

    return {
      summary,
      best_selling_cameras: {
        total: bestSellingTotal,
        items: cameras(bestSelling),
      },
      promo_cameras: { total: promoTotal, items: cameras(promo) },
      low_stock_cameras: { total: lowStockTotal, items: cameras(lowStock) },
      pending_invoices: {
        total: pendingInvoices,
        items: pendingRows.map(toInvoiceRow),
      },
      unpaid_invoices: {
        total: unpaidInvoices,
        items: unpaidRows.map(toInvoiceRow),
      },
      charts: {
        sales_trend: trend,
        top_products: topRows.map(({ camera_id, name, units }) => ({
          camera_id,
          name,
          units,
        })),
      },
    };
  };

  return { getDashboard };
};
