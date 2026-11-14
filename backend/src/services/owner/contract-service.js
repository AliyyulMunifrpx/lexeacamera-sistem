import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  assertContractPeriod,
  dateOut,
  periodsOverlap,
  serializeContracts,
  toDate,
} from "../../utils/contract.js";
import {
  contractIdValidation,
  contractListValidation,
  createContractValidation,
  updateContractValidation,
} from "../../validation/owner/contract-validation.js";
import { validate } from "../../validation/validation.js";

const SELECT = {
  id: true,
  employee_id: true,
  start_date: true,
  end_date: true,
  note: true,
  created_at: true,
};

/* Kunci baris karyawan supaya dua request bersamaan tidak lolos cek tabrakan. */
const lockEmployee = async (tx, id) => {
  const locked = await tx.$queryRaw`
    SELECT id
    FROM "Employee"
    WHERE id = ${id}
    FOR UPDATE
  `;

  if (locked.length === 0) {
    throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
  }
};

const assertNoOverlap = async (tx, employeeId, start, end, excludeId) => {
  const others = await tx.employeeContract.findMany({
    where: {
      employee_id: employeeId,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { start_date: true, end_date: true },
  });

  for (const other of others) {
    if (
      periodsOverlap(
        start,
        end,
        dateOut(other.start_date),
        dateOut(other.end_date),
      )
    ) {
      throw new ResponseError(409, "CONTRACT_OVERLAP");
    }
  }
};

/* Ambil satu kontrak lengkap dengan nomornya (nomor bergantung pada kontrak lain). */
const findWithNumber = async (db, employeeId, contractId) => {
  const rows = await db.employeeContract.findMany({
    where: { employee_id: employeeId },
    select: SELECT,
  });

  return serializeContracts(rows).find((item) => item.id === contractId);
};

const getContracts = async (request) => {
  const req = validate(contractListValidation, request);

  const employee = await prisma.employee.findUnique({
    where: { id: req.employee_id },
    select: { id: true },
  });
  if (!employee) {
    throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
  }

  const rows = await prisma.employeeContract.findMany({
    where: { employee_id: req.employee_id },
    select: SELECT,
  });

  return serializeContracts(rows);
};

const createContract = async (request) => {
  const req = validate(createContractValidation, request);
  const end = req.end_date ?? null;
  assertContractPeriod(req.start_date, end);

  return prisma.$transaction(async (tx) => {
    await lockEmployee(tx, req.employee_id);
    await assertNoOverlap(tx, req.employee_id, req.start_date, end);

    const created = await tx.employeeContract.create({
      data: {
        employee_id: req.employee_id,
        start_date: toDate(req.start_date),
        end_date: end ? toDate(end) : null,
        note: req.note || null,
      },
      select: { id: true },
    });

    return findWithNumber(tx, req.employee_id, created.id);
  });
};

const updateContract = async (request) => {
  const { employee_id, contract_id, ...fields } = validate(
    updateContractValidation,
    request,
  );

  return prisma.$transaction(async (tx) => {
    await lockEmployee(tx, employee_id);

    const current = await tx.employeeContract.findFirst({
      where: { id: contract_id, employee_id },
      select: SELECT,
    });
    if (!current) {
      throw new ResponseError(404, "CONTRACT_NOT_FOUND");
    }

    const start = fields.start_date ?? dateOut(current.start_date);
    const end =
      fields.end_date !== undefined
        ? fields.end_date
        : dateOut(current.end_date);

    assertContractPeriod(start, end);
    await assertNoOverlap(tx, employee_id, start, end, contract_id);

    const data = {};
    if (fields.start_date !== undefined) data.start_date = toDate(start);
    if (fields.end_date !== undefined) data.end_date = end ? toDate(end) : null;
    if (fields.note !== undefined) data.note = fields.note || null;

    await tx.employeeContract.update({ where: { id: contract_id }, data });

    return findWithNumber(tx, employee_id, contract_id);
  });
};

const deleteContract = async (request) => {
  const req = validate(contractIdValidation, request);

  const { count } = await prisma.employeeContract.deleteMany({
    where: { id: req.contract_id, employee_id: req.employee_id },
  });

  if (count === 0) {
    throw new ResponseError(404, "CONTRACT_NOT_FOUND");
  }

  return { message: "CONTRACT_DELETED" };
};

export default { getContracts, createContract, updateContract, deleteContract };
