import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  createPayrollValidation,
  deletePayrollValidation,
  getAllPayrollValidation,
  getEmployeePayrollValidation,
  getPayrollValidation,
  updatePayrollChecklistValidation,
  updatePayrollStatusValidation,
  updatePayrollValidation,
} from "../../validation/owner/payroll-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;
const MAX_INT = 2147483647;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const ITEM_ORDER = [{ sort_order: "asc" }, { id: "asc" }];
const DETAIL_INCLUDE = { items: { orderBy: ITEM_ORDER } };

const toDate = (value) => new Date(`${value}T00:00:00.000Z`);
const dateOut = (date) => date.toISOString().slice(0, 10);
const todayWib = () =>
  new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
const blankToNull = (value) =>
  value === undefined || value === null || value === "" ? null : value;

const sumItems = (items) => {
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  if (total > MAX_INT) {
    throw new ResponseError(400, "AMOUNT_TOO_LARGE");
  }

  return total;
};

const toItemRows = (payrollId, items) =>
  items.map((item, index) => ({
    payroll_id: payrollId,
    name: item.name,
    note: blankToNull(item.note),
    checked: item.checked ?? false,
    amount: item.amount,
    sort_order: index,
  }));

const serialize = ({ disbursement_date, items, ...payroll }) => ({
  ...payroll,
  disbursement_date: dateOut(disbursement_date),
  items: items.map(
    ({ payroll_id: _payroll, sort_order: _order, ...item }) => item,
  ),
});

const lockPayroll = async (tx, id) => {
  const rows = await tx.$queryRaw`
    SELECT id FROM "Payroll" WHERE id = ${id} FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new ResponseError(404, "PAYROLL_NOT_FOUND");
  }
};

const load = async (tx, id) =>
  serialize(
    await tx.payroll.findUnique({ where: { id }, include: DETAIL_INCLUDE }),
  );

const assertNotFuture = (status, date) => {
  if (status === "PAID" && date > todayWib()) {
    throw new ResponseError(400, "DISBURSEMENT_DATE_IN_FUTURE");
  }
};

const createPayroll = async (request) => {
  const req = validate(createPayrollValidation, request);
  const total = sumItems(req.items);

  assertNotFuture(req.status, req.disbursement_date);

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { id: req.employee_id },
      select: { name: true },
    });

    if (!employee) {
      throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
    }

    const payroll = await tx.payroll.create({
      data: {
        employee_id: req.employee_id,
        employee_name: employee.name,
        job_title: req.job_title,
        bank_name: req.bank_name,
        account_number: req.account_number,
        account_holder: req.account_holder,
        disbursement_date: toDate(req.disbursement_date),
        status: req.status,
        total_amount: total,
      },
      select: { id: true },
    });

    await tx.payrollItem.createMany({
      data: toItemRows(payroll.id, req.items),
    });

    return load(tx, payroll.id);
  });
};

const buildWhere = (req) => {
  const where = {};

  if (req.employee_id) where.employee_id = req.employee_id;
  if (req.status) where.status = req.status;

  if (req.date_from || req.date_to) {
    where.disbursement_date = {};
    if (req.date_from) where.disbursement_date.gte = toDate(req.date_from);
    if (req.date_to) where.disbursement_date.lte = toDate(req.date_to);
  }

  if (req.search) {
    where.OR = [
      { employee_name: { contains: req.search, mode: "insensitive" } },
      { job_title: { contains: req.search, mode: "insensitive" } },
    ];
  }

  return where;
};

const list = async (req) => {
  if (req.date_from && req.date_to && req.date_from > req.date_to) {
    throw new ResponseError(400, "INVALID_DATE_RANGE");
  }

  const where = buildWhere(req);

  const [rows, total, grouped] = await prisma.$transaction([
    prisma.payroll.findMany({
      where,
      select: {
        id: true,
        employee_id: true,
        employee_name: true,
        job_title: true,
        disbursement_date: true,
        status: true,
        total_amount: true,
        created_at: true,
        _count: { select: { items: true } },
      },
      orderBy: [
        { disbursement_date: "desc" },
        { created_at: "desc" },
        { id: "asc" },
      ],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.payroll.count({ where }),
    prisma.payroll.groupBy({
      by: ["status"],
      where,
      _sum: { total_amount: true },
    }),
  ]);

  const amountOf = (status) =>
    grouped.find((row) => row.status === status)?._sum.total_amount ?? 0;

  return {
    data: rows.map(({ disbursement_date, _count, ...row }) => ({
      ...row,
      disbursement_date: dateOut(disbursement_date),
      item_count: _count.items,
    })),
    summary: {
      paid_amount: Number(amountOf("PAID")),
      pending_amount: Number(amountOf("PENDING")),
    },
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const getAllPayroll = async (query) =>
  list(validate(getAllPayrollValidation, query));

const getEmployeePayroll = async (query) => {
  const { id, ...filters } = validate(getEmployeePayrollValidation, query);

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!employee) {
    throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
  }

  return list({ ...filters, employee_id: id });
};

const getPayroll = async (request) => {
  const req = validate(getPayrollValidation, request);

  const payroll = await prisma.payroll.findUnique({
    where: { id: req.id },
    include: DETAIL_INCLUDE,
  });

  if (!payroll) {
    throw new ResponseError(404, "PAYROLL_NOT_FOUND");
  }

  return serialize(payroll);
};

// Slip yang sudah cair terkunci: ubah ke PENDING dulu kalau perlu dikoreksi.
const updatePayroll = async (request) => {
  const { id, items, disbursement_date, ...rest } = validate(
    updatePayrollValidation,
    request,
  );
  const total = items ? sumItems(items) : null;

  return prisma.$transaction(async (tx) => {
    await lockPayroll(tx, id);

    const current = await tx.payroll.findUnique({
      where: { id },
      select: { status: true },
    });

    if (current.status === "PAID") {
      throw new ResponseError(409, "PAYROLL_ALREADY_PAID");
    }

    const data = { ...rest };
    if (disbursement_date) data.disbursement_date = toDate(disbursement_date);

    if (items) {
      data.total_amount = total;
      await tx.payrollItem.deleteMany({ where: { payroll_id: id } });
      await tx.payrollItem.createMany({ data: toItemRows(id, items) });
    }

    await tx.payroll.update({ where: { id }, data });

    return load(tx, id);
  });
};

const updatePayrollStatus = async (request) => {
  const req = validate(updatePayrollStatusValidation, request);

  return prisma.$transaction(async (tx) => {
    await lockPayroll(tx, req.id);

    const current = await tx.payroll.findUnique({
      where: { id: req.id },
      select: { status: true, disbursement_date: true },
    });

    const date = req.disbursement_date ?? dateOut(current.disbursement_date);

    assertNotFuture(req.status, date);

    if (
      current.status !== req.status ||
      date !== dateOut(current.disbursement_date)
    ) {
      await tx.payroll.update({
        where: { id: req.id },
        data: { status: req.status, disbursement_date: toDate(date) },
      });
    }

    return load(tx, req.id);
  });
};

// Checklist hanya penanda, boleh diubah di status apa pun
const updatePayrollChecklist = async (request) => {
  const req = validate(updatePayrollChecklistValidation, request);

  const { count } = await prisma.payrollItem.updateMany({
    where: { id: req.item_id, payroll_id: req.id },
    data: { checked: req.checked },
  });

  if (count === 0) {
    throw new ResponseError(404, "PAYROLL_ITEM_NOT_FOUND");
  }

  return getPayroll({ id: req.id });
};

const deletePayroll = async (request) => {
  const req = validate(deletePayrollValidation, request);

  await prisma.$transaction(async (tx) => {
    await lockPayroll(tx, req.id);

    const current = await tx.payroll.findUnique({
      where: { id: req.id },
      select: { status: true },
    });

    if (current.status === "PAID") {
      throw new ResponseError(409, "PAYROLL_ALREADY_PAID");
    }

    await tx.payroll.delete({ where: { id: req.id }, select: { id: true } });
  });

  return { message: "PAYROLL_DELETED" };
};

export default {
  createPayroll,
  getAllPayroll,
  getEmployeePayroll,
  getPayroll,
  updatePayroll,
  updatePayrollStatus,
  updatePayrollChecklist,
  deletePayroll,
};
