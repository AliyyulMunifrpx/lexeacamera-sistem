import { prisma } from "../lib/database.js";
import { getDashboardValidation } from "../validation/dashboard-validation.js";
import { validate } from "../validation/validation.js";

const LIST_SIZE = 3;
// Stok sampai angka ini dianggap menipis (termasuk yang sudah habis)
const LOW_STOCK_THRESHOLD = 3;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Kamera yang di-soft-delete nggak pernah muncul di dashboard
const ACTIVE = { is_deleted: false };

// Bentuknya sama dengan GET /cameras supaya frontend bisa memakai tipe yang sama
const CAMERA_INCLUDE = {
  images: { where: { is_primary: true }, take: 1 },
  category: true,
};

// id sebagai tiebreaker supaya urutan selalu stabil
const NEWEST_FIRST = [{ created_at: "desc" }, { id: "asc" }];

// Batas hari ini dan bulan ini menurut WIB, dinyatakan dalam UTC
const getWibBoundaries = (now = Date.now()) => {
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

// Bentuknya sama dengan satu baris GET /invoices
const toInvoiceRow = ({ order, ...invoice }) => ({
  ...invoice,
  subtotal: order.total_amount,
  item_count: order._count.order_items,
});

const getDashboard = async (query = {}) => {
  validate(getDashboardValidation, query);

  const { dayStart, monthStart, nextMonthStart } = getWibBoundaries();

  const bestSellingWhere = { ...ACTIVE, best_selling: true };
  const promoWhere = { ...ACTIVE, promo: true };
  const lowStockWhere = { ...ACTIVE, stock: { lte: LOW_STOCK_THRESHOLD } };

  // Satu transaksi: semua angka dibaca lewat satu koneksi, tanpa menghabiskan pool
  const [
    totalCameras,
    outOfStock,
    pendingInvoices,
    finalInvoices,
    invoicesToday,
    revenue,
    bestSellingTotal,
    bestSelling,
    promoTotal,
    promo,
    lowStockTotal,
    lowStock,
    pendingRows,
  ] = await prisma.$transaction([
    prisma.camera.count({ where: ACTIVE }),
    prisma.camera.count({ where: { ...ACTIVE, stock: 0 } }),

    prisma.invoice.count({ where: { is_final: false } }),
    prisma.invoice.count({ where: { is_final: true } }),
    prisma.invoice.count({ where: { created_at: { gte: dayStart } } }),

    // Pendapatan = invoice FINAL bulan ini (WIB). total_amount berupa string,
    // jadi dijumlahkan di SQL. Nilai yang bukan digit diabaikan, bukan merusak
    // seluruh dashboard. Batas waktu dikirim sebagai teks UTC supaya hasilnya
    // nggak tergantung timezone sesi database.
    prisma.$queryRaw`
      SELECT COALESCE(
        SUM(
          CASE WHEN "total_amount" ~ '^[0-9]{1,15}$'
            THEN "total_amount"::bigint
            ELSE 0
          END
        ),
        0
      )::text AS total
      FROM "Invoice"
      WHERE "is_final" = true
        AND "created_at" >= ${monthStart.toISOString()}::timestamp
        AND "created_at" < ${nextMonthStart.toISOString()}::timestamp
    `,

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
      where: { is_final: false },
      include: {
        order: {
          select: {
            total_amount: true,
            _count: { select: { order_items: true } },
          },
        },
      },
      orderBy: NEWEST_FIRST,
      take: LIST_SIZE,
    }),
  ]);

  return {
    summary: {
      cameras: { total: totalCameras, out_of_stock: outOfStock },
      invoices: {
        total: pendingInvoices + finalInvoices,
        pending: pendingInvoices,
        final: finalInvoices,
        today: invoicesToday,
      },
      revenue_this_month: revenue[0]?.total ?? "0",
    },
    best_selling_cameras: { total: bestSellingTotal, items: bestSelling },
    promo_cameras: { total: promoTotal, items: promo },
    low_stock_cameras: { total: lowStockTotal, items: lowStock },
    pending_invoices: {
      total: pendingInvoices,
      items: pendingRows.map(toInvoiceRow),
    },
  };
};

export default { getDashboard };
export { getWibBoundaries };
