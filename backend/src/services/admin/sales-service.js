import reportService from "../owner/report-service.js";
import { salesValidation } from "../../validation/admin/sales-validation.js";
import { validate } from "../../validation/validation.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const todayWib = () =>
  new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);

const shiftDay = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

// Minggu dihitung Senin sampai Minggu
const resolvePeriod = ({ period, date, from, to }) => {
  if (period === "all") return { type: period, from: null, to: null };
  if (period === "range") return { type: period, from, to };

  const anchor = date ?? todayWib();

  if (period === "day") return { type: period, from: anchor, to: anchor };

  if (period === "week") {
    const weekday = new Date(`${anchor}T00:00:00Z`).getUTCDay();
    const monday = shiftDay(anchor, -((weekday + 6) % 7));

    return { type: period, from: monday, to: shiftDay(monday, 6) };
  }

  const [year, month] = anchor.split("-").map(Number);

  if (period === "month") {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prefix = anchor.slice(0, 7);

    return {
      type: period,
      from: `${prefix}-01`,
      to: `${prefix}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  return { type: period, from: `${year}-01-01`, to: `${year}-12-31` };
};

// Hanya omzet dan kuantitas. Modal dan laba sengaja tidak dibawa keluar.
const getSales = async (request) => {
  const req = validate(salesValidation, request);
  const period = resolvePeriod(req);
  const summary = await reportService.getSummary(
    period.from ? { from: period.from, to: period.to } : {},
  );
  const { sales, refunds, net } = summary;

  return {
    period,
    sales: { orders: sales.orders, units: sales.units, revenue: sales.revenue },
    refunds: {
      orders: refunds.orders,
      units: refunds.units,
      amount: refunds.amount,
    },
    net: { units: sales.units - refunds.units, revenue: net.revenue },
  };
};

export default { getSales };
