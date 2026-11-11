import { prisma } from "../../lib/database.js";
import {
  categoriesReportValidation,
  customerSegmentsValidation,
  customersReportValidation,
  productsReportValidation,
  summaryReportValidation,
  transactionsReportValidation,
  trendReportValidation,
} from "../../validation/owner/report-validation.js";
import { validate } from "../../validation/validation.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ALL_START = "1900-01-01T00:00:00.000Z";
const ALL_END = "3000-01-01T00:00:00.000Z";
const ALL_FROM = "1900-01-01";
const ALL_TO = "3000-01-01";
const STEP = { day: "1 day", week: "1 week", month: "1 month" };

// Batas hari WIB -> waktu UTC (paid_at disimpan UTC). WIB tidak mengenal DST.
const bounds = (from, to) => {
  if (!from) return { start: ALL_START, end: ALL_END };

  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + DAY_MS);

  return { start: start.toISOString(), end: end.toISOString() };
};

const num = (value) => Number(value ?? 0);

const margin = (profit, revenue) =>
  revenue > 0 ? Math.round((profit * 10000) / revenue) / 100 : null;

const shape = (row) => {
  const salesOrders = num(row.sale_orders);
  const revenue = num(row.sale_revenue);
  const cost = num(row.sale_cost);
  const refundAmount = num(row.refund_amount);
  const refundCost = num(row.refund_cost);
  const netRevenue = revenue - refundAmount;
  const netCost = cost - refundCost;
  const netProfit = netRevenue - netCost;

  return {
    sales: {
      orders: salesOrders,
      units: num(row.sale_units),
      revenue,
      cost,
      profit: revenue - cost,
      margin_pct: margin(revenue - cost, revenue),
      avg_order_value: salesOrders > 0 ? Math.round(revenue / salesOrders) : 0,
    },
    refunds: {
      orders: num(row.refund_orders),
      units: num(row.refund_units),
      amount: refundAmount,
      cost_returned: refundCost,
    },
    net: {
      revenue: netRevenue,
      cost: netCost,
      profit: netProfit,
      margin_pct: margin(netProfit, netRevenue),
    },
  };
};

const getSummary = async (request) => {
  const req = validate(summaryReportValidation, request);
  const { start, end } = bounds(req.from, req.to);

  const [[row], [payrollRow]] = await Promise.all([
    prisma.$queryRaw`
    WITH per_order AS (
      SELECT
        o.type,
        o.total_amount,
        COALESCE(SUM(oi.quantity), 0) AS units,
        COALESCE(
          SUM(oi.camera_modal::bigint * oi.quantity)
            FILTER (WHERE o.type = 'SALE' OR oi.restocked),
          0
        ) AS cost
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON oi.order_id = o.id
      WHERE o.payment_status = 'PAID'
        AND o.paid_at >= ${start}::timestamp
        AND o.paid_at < ${end}::timestamp
      GROUP BY o.id
    )
    SELECT
      COUNT(*) FILTER (WHERE type = 'SALE') AS sale_orders,
      COALESCE(SUM(units) FILTER (WHERE type = 'SALE'), 0) AS sale_units,
      COALESCE(SUM(total_amount::bigint) FILTER (WHERE type = 'SALE'), 0) AS sale_revenue,
      COALESCE(SUM(cost) FILTER (WHERE type = 'SALE'), 0) AS sale_cost,
      COUNT(*) FILTER (WHERE type = 'REFUND') AS refund_orders,
      COALESCE(SUM(units) FILTER (WHERE type = 'REFUND'), 0) AS refund_units,
      COALESCE(SUM(total_amount::bigint) FILTER (WHERE type = 'REFUND'), 0) AS refund_amount,
      COALESCE(SUM(cost) FILTER (WHERE type = 'REFUND'), 0) AS refund_cost
    FROM per_order
  `,
    // Gaji dihitung dari slip PAID berdasarkan tanggal cair (tanggal WIB, tipe date).
    prisma.$queryRaw`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(total_amount::bigint), 0) AS amount
    FROM "Payroll"
    WHERE status = 'PAID'
      AND disbursement_date >= ${req.from ?? ALL_FROM}::date
      AND disbursement_date <= ${req.to ?? ALL_TO}::date
  `,
  ]);

  const base = shape(row);
  const payroll = {
    count: num(payrollRow.count),
    amount: num(payrollRow.amount),
  };

  return {
    period: req.from ? { from: req.from, to: req.to } : null,
    ...base,
    payroll,
    net: {
      ...base.net,
      revenue_after_payroll: base.net.revenue - payroll.amount,
      profit_after_payroll: base.net.profit - payroll.amount,
    },
  };
};

const getTrend = async (request) => {
  const req = validate(trendReportValidation, request);
  const { start, end } = bounds(req.from, req.to);
  const step = STEP[req.group];

  const rows = await prisma.$queryRaw`
    WITH series AS (
      SELECT gs::date AS bucket
      FROM generate_series(
        date_trunc(${req.group}, ${req.from}::timestamp),
        ${req.to}::timestamp,
        ${step}::interval
      ) AS gs
    ),
    per_order AS (
      SELECT
        date_trunc(
          ${req.group},
          (o.paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta'
        )::date AS bucket,
        o.type,
        o.total_amount,
        COALESCE(SUM(oi.quantity), 0) AS units,
        COALESCE(
          SUM(oi.camera_modal::bigint * oi.quantity)
            FILTER (WHERE o.type = 'SALE' OR oi.restocked),
          0
        ) AS cost
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON oi.order_id = o.id
      WHERE o.payment_status = 'PAID'
        AND o.paid_at >= ${start}::timestamp
        AND o.paid_at < ${end}::timestamp
      GROUP BY o.id
    ),
    agg AS (
      SELECT
        bucket,
        COUNT(*) FILTER (WHERE type = 'SALE') AS sale_orders,
        COALESCE(SUM(units) FILTER (WHERE type = 'SALE'), 0) AS sale_units,
        COALESCE(SUM(total_amount::bigint) FILTER (WHERE type = 'SALE'), 0) AS sale_revenue,
        COALESCE(SUM(cost) FILTER (WHERE type = 'SALE'), 0) AS sale_cost,
        COUNT(*) FILTER (WHERE type = 'REFUND') AS refund_orders,
        COALESCE(SUM(units) FILTER (WHERE type = 'REFUND'), 0) AS refund_units,
        COALESCE(SUM(total_amount::bigint) FILTER (WHERE type = 'REFUND'), 0) AS refund_amount,
        COALESCE(SUM(cost) FILTER (WHERE type = 'REFUND'), 0) AS refund_cost
      FROM per_order
      GROUP BY bucket
    )
    SELECT to_char(s.bucket, 'YYYY-MM-DD') AS date, a.*
    FROM series s
    LEFT JOIN agg a ON a.bucket = s.bucket
    ORDER BY s.bucket
  `;

  return {
    group: req.group,
    from: req.from,
    to: req.to,
    data: rows.map((row) => ({ date: row.date, ...shape(row) })),
  };
};

// Omzet per produk: total_amount order (sudah setelah diskon) dibagi ke item-item
// sesuai porsi harga x jumlah. Pembagian dengan pembulatan kumulatif, jadi jumlah
// semua item PERSIS sama dengan total_amount order.
const productRows = async (from, to) => {
  const { start, end } = bounds(from, to);

  return prisma.$queryRaw`
    WITH weighted AS (
      SELECT
        o.id AS order_id,
        o.type,
        o.total_amount,
        oi.id AS item_id,
        oi.camera_id,
        oi.quantity,
        oi.camera_modal,
        oi.restocked,
        CASE
          WHEN SUM(oi.camera_price::bigint * oi.quantity) OVER (PARTITION BY o.id) > 0
            THEN oi.camera_price::bigint * oi.quantity
          ELSE oi.quantity::bigint
        END AS w
      FROM "Order" o
      JOIN "OrderItem" oi ON oi.order_id = o.id
      WHERE o.payment_status = 'PAID'
        AND o.paid_at >= ${start}::timestamp
        AND o.paid_at < ${end}::timestamp
    ),
    running AS (
      SELECT
        *,
        SUM(w) OVER (PARTITION BY order_id) AS w_total,
        SUM(w) OVER (PARTITION BY order_id ORDER BY item_id) AS w_cum
      FROM weighted
    ),
    items AS (
      SELECT
        order_id,
        type,
        camera_id,
        quantity,
        CASE
          WHEN type = 'SALE' OR restocked THEN camera_modal::bigint * quantity
          ELSE 0
        END AS cost,
        floor((total_amount::numeric * w_cum + w_total::numeric / 2) / w_total)::bigint
          - floor((total_amount::numeric * (w_cum - w) + w_total::numeric / 2) / w_total)::bigint
          AS amount
      FROM running
    )
    SELECT
  c.id AS camera_id,
      c.name,
      c.sku,
      c.serial_number,
      c.is_deleted,
      cat.id AS category_id,
      cat.name AS category_name,
      COUNT(DISTINCT i.order_id) FILTER (WHERE i.type = 'SALE') AS sale_orders,
      COALESCE(SUM(i.quantity) FILTER (WHERE i.type = 'SALE'), 0) AS sale_units,
      COALESCE(SUM(i.amount) FILTER (WHERE i.type = 'SALE'), 0) AS sale_revenue,
      COALESCE(SUM(i.cost) FILTER (WHERE i.type = 'SALE'), 0) AS sale_cost,
      COUNT(DISTINCT i.order_id) FILTER (WHERE i.type = 'REFUND') AS refund_orders,
      COALESCE(SUM(i.quantity) FILTER (WHERE i.type = 'REFUND'), 0) AS refund_units,
      COALESCE(SUM(i.amount) FILTER (WHERE i.type = 'REFUND'), 0) AS refund_amount,
      COALESCE(SUM(i.cost) FILTER (WHERE i.type = 'REFUND'), 0) AS refund_cost
    FROM items i
    JOIN "Camera" c ON c.id = i.camera_id
    LEFT JOIN "Category" cat ON cat.id = c.category_id
    GROUP BY c.id, cat.id
  `;
};

const SORT_KEY = {
  units: (r) => r.sales.units,
  revenue: (r) => r.sales.revenue,
  profit: (r) => r.sales.profit,
};

const sortRows = (rows, sort, label) => {
  const key = SORT_KEY[sort];

  return rows.sort(
    (a, b) =>
      key(b) - key(a) ||
      String(label(a)).localeCompare(String(label(b))) ||
      String(a.id).localeCompare(String(b.id)),
  );
};

const getProducts = async (request) => {
  const req = validate(productsReportValidation, request);
  const needle = req.search?.toLowerCase();
  const raw = (await productRows(req.from, req.to)).filter(
    (row) => !needle || String(row.name).toLowerCase().includes(needle),
  );

  const products = raw.map((row) => {
    const { sales, refunds, net } = shape(row);
    const { avg_order_value, ...rest } = sales;

    return {
      id: row.camera_id,
      name: row.name,
      sku: row.sku,
      serial_number: row.serial_number,
      deleted: row.is_deleted,
      category: row.category_id
        ? { id: row.category_id, name: row.category_name }
        : null,
      sales: rest,
      refunds,
      net,
    };
  });

  sortRows(products, req.sort, (p) => p.name);

  const total = products.length;

  return {
    period: req.from ? { from: req.from, to: req.to } : null,
    sort: req.sort,
    data: products.slice((req.page - 1) * req.limit, req.page * req.limit),
    paging: {
      page: req.page,
      per_page: req.limit,
      total,
      total_pages: Math.ceil(total / req.limit),
    },
  };
};

const getCategories = async (request) => {
  const req = validate(categoriesReportValidation, request);
  const raw = await productRows(req.from, req.to);

  const groups = new Map();
  for (const row of raw) {
    const key = row.category_id ?? "none";
    const group = groups.get(key) ?? {
      category_id: row.category_id,
      category_name: row.category_name,
      products: 0,
      sale_orders: 0,
      sale_units: 0,
      sale_revenue: 0,
      sale_cost: 0,
      refund_orders: 0,
      refund_units: 0,
      refund_amount: 0,
      refund_cost: 0,
    };

    group.products += 1;
    for (const field of [
      "sale_orders",
      "sale_units",
      "sale_revenue",
      "sale_cost",
      "refund_orders",
      "refund_units",
      "refund_amount",
      "refund_cost",
    ]) {
      group[field] += num(row[field]);
    }

    groups.set(key, group);
  }

  const categories = [...groups.values()].map((group) => {
    const { sales, refunds, net } = shape(group);
    const { avg_order_value, ...rest } = sales;

    return {
      id: group.category_id,
      name: group.category_name,
      products: group.products,
      sales: rest,
      refunds,
      net,
    };
  });

  sortRows(categories, req.sort, (c) => c.name ?? "\uffff");

  return {
    period: req.from ? { from: req.from, to: req.to } : null,
    sort: req.sort,
    data: categories,
  };
};

const iso = (value) => (value ? value : null);

const getCustomers = async (request) => {
  const req = validate(customersReportValidation, request);
  const { start, end } = bounds(req.from, req.to);

  const rows = await prisma.$queryRaw`
    WITH per_order AS (
      SELECT
        o.customer_id,
        o.type,
        o.total_amount,
        o.paid_at,
        COALESCE(SUM(oi.quantity), 0) AS units,
        COALESCE(
          SUM(oi.camera_modal::bigint * oi.quantity)
            FILTER (WHERE o.type = 'SALE' OR oi.restocked),
          0
        ) AS cost
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON oi.order_id = o.id
      WHERE o.payment_status = 'PAID'
        AND o.customer_id IS NOT NULL
        AND o.paid_at >= ${start}::timestamp
        AND o.paid_at < ${end}::timestamp
      GROUP BY o.id
    ),
    first_sale AS (
      SELECT customer_id, MIN(paid_at) AS first_paid_at
      FROM "Order"
      WHERE type = 'SALE' AND payment_status = 'PAID' AND customer_id IS NOT NULL
      GROUP BY customer_id
    )
    SELECT
      c.id,
      c.name,
      c.whatsapp,
      c.instagram,
      to_char(fs.first_paid_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS first_order_at,
      to_char(MAX(p.paid_at) FILTER (WHERE p.type = 'SALE'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_order_at,
      fs.first_paid_at >= ${start}::timestamp AS is_new,
      COUNT(*) FILTER (WHERE p.type = 'SALE') AS sale_orders,
      COALESCE(SUM(p.units) FILTER (WHERE p.type = 'SALE'), 0) AS sale_units,
      COALESCE(SUM(p.total_amount::bigint) FILTER (WHERE p.type = 'SALE'), 0) AS sale_revenue,
      COALESCE(SUM(p.cost) FILTER (WHERE p.type = 'SALE'), 0) AS sale_cost,
      COUNT(*) FILTER (WHERE p.type = 'REFUND') AS refund_orders,
      COALESCE(SUM(p.units) FILTER (WHERE p.type = 'REFUND'), 0) AS refund_units,
      COALESCE(SUM(p.total_amount::bigint) FILTER (WHERE p.type = 'REFUND'), 0) AS refund_amount,
      COALESCE(SUM(p.cost) FILTER (WHERE p.type = 'REFUND'), 0) AS refund_cost
    FROM per_order p
    JOIN "Customer" c ON c.id = p.customer_id
    LEFT JOIN first_sale fs ON fs.customer_id = c.id
    GROUP BY c.id, fs.first_paid_at
  `;

  const needle = req.search?.toLowerCase();
  const matched = needle
    ? rows.filter(
        (row) =>
          String(row.name).toLowerCase().includes(needle) ||
          String(row.whatsapp ?? "")
            .toLowerCase()
            .includes(needle) ||
          String(row.instagram ?? "")
            .toLowerCase()
            .includes(needle),
      )
    : rows;

  const customers = matched.map((row) => {
    const { sales, refunds, net } = shape(row);
    const { avg_order_value, ...rest } = sales;
    const hasSale = rest.orders > 0;

    return {
      id: row.id,
      name: row.name,
      whatsapp: row.whatsapp,
      instagram: row.instagram,
      first_order_at: iso(row.first_order_at),
      last_order_at: iso(row.last_order_at),
      type: req.from && hasSale ? (row.is_new ? "NEW" : "RETURNING") : null,
      sales: rest,
      refunds,
      net,
    };
  });

  const key = {
    revenue: (c) => c.sales.revenue,
    orders: (c) => c.sales.orders,
    profit: (c) => c.sales.profit,
  }[req.sort];
  customers.sort(
    (a, b) =>
      key(b) - key(a) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );

  const total = customers.length;

  return {
    period: req.from ? { from: req.from, to: req.to } : null,
    sort: req.sort,
    data: customers.slice((req.page - 1) * req.limit, req.page * req.limit),
    paging: {
      page: req.page,
      per_page: req.limit,
      total,
      total_pages: Math.ceil(total / req.limit),
    },
  };
};

const getCustomerSegments = async (request) => {
  const req = validate(customerSegmentsValidation, request);
  const { start, end } = bounds(req.from, req.to);

  const rows = await prisma.$queryRaw`
    WITH per_order AS (
      SELECT
        o.customer_id,
        o.total_amount,
        COALESCE(SUM(oi.camera_modal::bigint * oi.quantity), 0) AS cost
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON oi.order_id = o.id
      WHERE o.type = 'SALE'
        AND o.payment_status = 'PAID'
        AND o.paid_at >= ${start}::timestamp
        AND o.paid_at < ${end}::timestamp
      GROUP BY o.id
    ),
    first_sale AS (
      SELECT customer_id, MIN(paid_at) AS first_paid_at
      FROM "Order"
      WHERE type = 'SALE' AND payment_status = 'PAID' AND customer_id IS NOT NULL
      GROUP BY customer_id
    )
    SELECT
      CASE
        WHEN p.customer_id IS NULL THEN 'unassigned'
        WHEN fs.first_paid_at >= ${start}::timestamp THEN 'new'
        ELSE 'returning'
      END AS segment,
      COUNT(DISTINCT p.customer_id) AS customers,
      COUNT(*) AS orders,
      COALESCE(SUM(p.total_amount::bigint), 0) AS revenue,
      COALESCE(SUM(p.cost), 0) AS cost
    FROM per_order p
    LEFT JOIN first_sale fs ON fs.customer_id = p.customer_id
    GROUP BY 1
  `;

  const segment = (name) => {
    const row = rows.find((r) => r.segment === name);
    const revenue = num(row?.revenue);
    const cost = num(row?.cost);

    return {
      customers: num(row?.customers),
      orders: num(row?.orders),
      revenue,
      cost,
      profit: revenue - cost,
    };
  };

  const fresh = segment("new");
  const returning = segment("returning");
  const active = fresh.customers + returning.customers;

  return {
    period: { from: req.from, to: req.to },
    active_customers: active,
    repeat_rate_pct:
      active > 0
        ? Math.round((returning.customers * 10000) / active) / 100
        : null,
    new: fresh,
    returning,
    unassigned: segment("unassigned"),
  };
};

const getTransactions = async (request) => {
  const req = validate(transactionsReportValidation, request);
  const { start, end } = bounds(req.from, req.to);
  const type = req.type ?? null;
  const search = req.search ?? null;

  const categoryId = req.category_id ?? null;
  const cameraId = req.camera_id ?? null;
  const product = req.product ?? null;
  const category = req.category ?? null;
  const filtered =
    categoryId !== null ||
    cameraId !== null ||
    product !== null ||
    category !== null;

  // Saat filter produk/kategori aktif, angka tiap order hanya dari item yang cocok.
  // total_amount dibagi ke item dengan cara yang sama seperti laporan produk,
  // jadi jumlahnya cocok dengan laporan produk/kategori.
  const rows = await prisma.$queryRaw`
    WITH weighted AS (
      SELECT
        o.id AS order_id,
        o.total_amount,
        o.type,
        oi.id AS item_id,
        oi.camera_id,
        oi.camera_name,
        oi.quantity,
        oi.camera_modal,
        oi.restocked,
        CASE
          WHEN SUM(oi.camera_price::bigint * oi.quantity) OVER (PARTITION BY o.id) > 0
            THEN oi.camera_price::bigint * oi.quantity
          ELSE oi.quantity::bigint
        END AS w
      FROM "Order" o
      JOIN "OrderItem" oi ON oi.order_id = o.id
      WHERE o.payment_status = 'PAID'
        AND o.paid_at >= ${start}::timestamp
        AND o.paid_at < ${end}::timestamp
    ),
    running AS (
      SELECT
        *,
        SUM(w) OVER (PARTITION BY order_id) AS w_total,
        SUM(w) OVER (PARTITION BY order_id ORDER BY item_id) AS w_cum
      FROM weighted
    ),
    items AS (
      SELECT
        r.order_id,
        r.quantity,
        c.category_id,
        cat.name AS category_name,
        r.camera_id,
        r.camera_name,
        CASE
          WHEN r.type = 'SALE' OR r.restocked THEN r.camera_modal::bigint * r.quantity
          ELSE 0
        END AS cost,
        floor((r.total_amount::numeric * r.w_cum + r.w_total::numeric / 2) / r.w_total)::bigint
          - floor((r.total_amount::numeric * (r.w_cum - r.w) + r.w_total::numeric / 2) / r.w_total)::bigint
          AS amount
      FROM running r
      LEFT JOIN "Camera" c ON c.id = r.camera_id
      LEFT JOIN "Category" cat ON cat.id = c.category_id
    )
    SELECT
      o.id,
      o.type,
      o.customer_id,
      o.customer_name,
      o.total_amount,
      to_char(o.paid_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS paid_at,
      inv.no_invoice,
      COALESCE(SUM(i.quantity), 0) AS units,
      COALESCE(SUM(i.cost), 0) AS cost,
      COALESCE(SUM(i.amount), 0) AS item_amount
    FROM "Order" o
    LEFT JOIN "Invoice" inv ON inv.order_id = o.id
    LEFT JOIN items i
      ON i.order_id = o.id
      AND (${categoryId}::text IS NULL OR i.category_id = ${categoryId}::text)
      AND (${cameraId}::text IS NULL OR i.camera_id = ${cameraId}::text)
      AND (${product}::text IS NULL OR strpos(lower(i.camera_name), lower(${product}::text)) > 0)
      AND (${category}::text IS NULL OR strpos(lower(COALESCE(i.category_name, '')), lower(${category}::text)) > 0)
    WHERE o.payment_status = 'PAID'
      AND o.paid_at >= ${start}::timestamp
      AND o.paid_at < ${end}::timestamp
      AND (${type}::text IS NULL OR o.type::text = ${type}::text)
      AND (${filtered}::boolean = false OR i.order_id IS NOT NULL)
      AND (
        ${search}::text IS NULL
        OR strpos(lower(o.customer_name), lower(${search}::text)) > 0
        OR strpos(lower(COALESCE(inv.no_invoice, '')), lower(${search}::text)) > 0
        OR strpos(lower(COALESCE(o.customer_id, '')), lower(${search}::text)) > 0
      )
    GROUP BY o.id, inv.no_invoice
    ORDER BY o.paid_at DESC, o.id ASC
  `;

  // Nilai refund dibuat negatif supaya jumlah kolom = angka net di ringkasan.
  const all = rows.map((row) => {
    const sign = row.type === "SALE" ? 1 : -1;
    const revenue = sign * num(filtered ? row.item_amount : row.total_amount);
    const cost = sign * num(row.cost);

    return {
      id: row.id,
      invoice_no: row.no_invoice ?? null,
      type: row.type,
      paid_at: row.paid_at,
      customer_id: row.customer_id ?? null,
      customer_name: row.customer_name,
      units: num(row.units),
      revenue,
      cost,
      profit: revenue - cost,
    };
  });

  const totals = all.reduce(
    (sum, row) => ({
      orders: sum.orders + 1,
      sales_orders: sum.sales_orders + (row.type === "SALE" ? 1 : 0),
      refund_orders: sum.refund_orders + (row.type === "REFUND" ? 1 : 0),
      revenue: sum.revenue + row.revenue,
      cost: sum.cost + row.cost,
      profit: sum.profit + row.profit,
    }),
    {
      orders: 0,
      sales_orders: 0,
      refund_orders: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
    },
  );

  const page = all.slice((req.page - 1) * req.limit, req.page * req.limit);

  if (page.length > 0) {
    const ids = page.map((row) => row.id);
    const items = await prisma.$queryRaw`
      SELECT oi.order_id, oi.camera_id, oi.camera_name, oi.quantity, oi.camera_price, oi.camera_modal, oi.restocked
      FROM "OrderItem" oi
      LEFT JOIN "Camera" c ON c.id = oi.camera_id
      LEFT JOIN "Category" cat ON cat.id = c.category_id
      WHERE oi.order_id = ANY(${ids}::text[])
        AND (${categoryId}::text IS NULL OR c.category_id = ${categoryId}::text)
        AND (${cameraId}::text IS NULL OR oi.camera_id = ${cameraId}::text)
        AND (${product}::text IS NULL OR strpos(lower(oi.camera_name), lower(${product}::text)) > 0)
        AND (${category}::text IS NULL OR strpos(lower(COALESCE(cat.name, '')), lower(${category}::text)) > 0)
      ORDER BY oi.camera_name ASC, oi.id ASC
    `;

    const byOrder = new Map();
    for (const item of items) {
      const list = byOrder.get(item.order_id) ?? [];
      list.push(item);
      byOrder.set(item.order_id, list);
    }

    for (const row of page) {
      row.items = (byOrder.get(row.id) ?? []).map((item) => ({
        camera_id: item.camera_id,
        name: item.camera_name,
        quantity: item.quantity,
        price: item.camera_price,
        modal: item.camera_modal,
        restocked: row.type === "REFUND" ? item.restocked : null,
      }));
    }
  }

  return {
    period: req.from ? { from: req.from, to: req.to } : null,
    data: page,
    totals,
    paging: {
      page: req.page,
      per_page: req.limit,
      total: all.length,
      total_pages: Math.ceil(all.length / req.limit),
    },
  };
};

const getStockValue = async () => {
  const rows = await prisma.$queryRaw`
    SELECT
      cat.id AS category_id,
      cat.name AS category_name,
      COUNT(*) FILTER (WHERE c.stock > 0) AS products,
      COALESCE(SUM(c.stock) FILTER (WHERE c.stock > 0), 0) AS units,
      COALESCE(SUM(c.capital::bigint * c.stock) FILTER (WHERE c.stock > 0), 0) AS cost_value,
      COALESCE(SUM(c.price::bigint * c.stock) FILTER (WHERE c.stock > 0), 0) AS price_value
    FROM "Camera" c
    LEFT JOIN "Category" cat ON cat.id = c.category_id
    WHERE c.is_deleted = false
    GROUP BY cat.id
  `;

  const categories = rows
    .map((row) => ({
      id: row.category_id ?? null,
      name: row.category_name ?? null,
      products: num(row.products),
      units: num(row.units),
      cost_value: num(row.cost_value),
      price_value: num(row.price_value),
    }))
    .filter((row) => row.products > 0)
    .sort(
      (a, b) =>
        b.cost_value - a.cost_value ||
        String(a.name ?? "\uffff").localeCompare(String(b.name ?? "\uffff")) ||
        String(a.id).localeCompare(String(b.id)),
    );

  const sum = (field) =>
    categories.reduce((total, row) => total + row[field], 0);
  const stockCost = sum("cost_value");
  const stockPrice = sum("price_value");
  const { net } = await getSummary({});

  return {
    as_of: new Date().toISOString(),
    stock: {
      products: sum("products"),
      units: sum("units"),
      cost_value: stockCost,
      price_value: stockPrice,
      potential_profit: stockPrice - stockCost,
    },
    by_category: categories,
    purchased: {
      sold_cost: net.cost,
      stock_cost: stockCost,
      total_cost: net.cost + stockCost,
    },
  };
};

export default {
  getSummary,
  getTrend,
  getProducts,
  getCategories,
  getCustomers,
  getCustomerSegments,
  getTransactions,
  getStockValue,
};
