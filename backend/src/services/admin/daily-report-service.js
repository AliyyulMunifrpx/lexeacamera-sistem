import crypto from "node:crypto";

import { supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  createEntryValidation,
  createReportValidation,
  entryIdValidation,
  getAllReportValidation,
  proofRegisterValidation,
  proofUploadUrlValidation,
  reportIdValidation,
  updateEntryValidation,
  updateReportValidation,
} from "../../validation/admin/daily-report-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;
const MAX_ENTRIES = 500;
const BUCKET = process.env.SUPABASE_DAILY_REPORT_BUCKET;
const SIGNED_URL_SECONDS = 3600;
const MB = 1024 * 1024;

const PROOF_RULE = {
  max_size: 10 * MB,
  types: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heic",
    "application/pdf": "pdf",
  },
};

const EXT_TYPE = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

const REPORT_SELECT = {
  id: true,
  date: true,
  cashier_id: true,
  cashier_name: true,
  opening_balance: true,
  transferred: true,
  transferred_at: true,
  proof_path: true,
  proof_content_type: true,
  proof_size: true,
  proof_uploaded_at: true,
  created_at: true,
  updated_at: true,
};

const DETAIL_SELECT = {
  ...REPORT_SELECT,
  entries: {
    orderBy: [{ seq: "asc" }],
    select: {
      id: true,
      name: true,
      note: true,
      income: true,
      expense: true,
      created_at: true,
      updated_at: true,
    },
  },
};

const dateOut = (value) => value.toISOString().slice(0, 10);
const toDate = (value) => new Date(`${value}T00:00:00Z`);
const todayWib = () =>
  new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const blankToNull = (value) =>
  value === undefined
    ? undefined
    : value === null || value === ""
      ? null
      : value;

const isOwner = (user) => user?.role === "OWNER";

const actorOf = (user) => {
  if (!user?.id) throw new ResponseError(401, "UNAUTHORIZED");
  return user;
};

const adminOf = (user) => {
  const actor = actorOf(user);
  if (actor.role !== "ADMIN") throw new ResponseError(403, "FORBIDDEN");
  return actor;
};

const scope = (actor) => (isOwner(actor) ? {} : { cashier_id: actor.id });

const assertBucket = () => {
  if (!BUCKET) throw new ResponseError(500, "REPORT_BUCKET_NOT_CONFIGURED");
};

const removeFiles = async (paths) => {
  if (!paths.length || !BUCKET) return;

  try {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to remove daily report file:", { paths, error });
  }
};

const signPath = async (path) => {
  if (!path || !BUCKET) return null;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls([path], SIGNED_URL_SECONDS);
    if (error) throw error;

    return data?.[0]?.signedUrl ?? null;
  } catch (error) {
    console.error("Failed to sign daily report proof:", error);
    return null;
  }
};

const lockReport = async (tx, id, actor) => {
  const rows = await tx.$queryRaw`
    SELECT id, cashier_id, transferred, proof_path
    FROM "DailyReport"
    WHERE id = ${id}
    FOR UPDATE
  `;

  if (!rows.length || rows[0].cashier_id !== actor.id) {
    throw new ResponseError(404, "REPORT_NOT_FOUND");
  }

  return rows[0];
};

const assertUnlocked = (report) => {
  if (report.transferred) throw new ResponseError(409, "REPORT_LOCKED");
};

const assertAmounts = (income, expense) => {
  if (income > 0 === expense > 0) {
    throw new ResponseError(400, "INVALID_ENTRY_AMOUNT");
  }
};

const header = (report, stat) => ({
  id: report.id,
  date: dateOut(report.date),
  cashier_id: report.cashier_id,
  cashier_name: report.cashier_name,
  opening_balance: report.opening_balance,
  total_in: stat.income,
  total_out: stat.expense,
  closing_balance: report.opening_balance + stat.income - stat.expense,
  entry_count: stat.count,
  transferred: report.transferred,
  transferred_at: report.transferred_at,
  has_proof: Boolean(report.proof_path),
});

const serializeProof = async (report) =>
  report.proof_path
    ? {
        url: await signPath(report.proof_path),
        content_type: report.proof_content_type,
        size: report.proof_size,
        uploaded_at: report.proof_uploaded_at,
      }
    : null;

const serializeDetail = async (report) => {
  const date = dateOut(report.date);
  let balance = report.opening_balance;
  let income = 0;
  let expense = 0;

  const entries = report.entries.map((entry) => {
    balance += entry.income - entry.expense;
    income += entry.income;
    expense += entry.expense;

    return {
      id: entry.id,
      date,
      name: entry.name,
      note: entry.note,
      income: entry.income,
      expense: entry.expense,
      balance,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  });

  return {
    ...header(report, { income, expense, count: entries.length }),
    proof: await serializeProof(report),
    entries,
    created_at: report.created_at,
    updated_at: report.updated_at,
  };
};

const fetchDetail = async (id, actor) => {
  const report = await prisma.dailyReport.findFirst({
    where: { id, ...scope(actor) },
    select: DETAIL_SELECT,
  });
  if (!report) throw new ResponseError(404, "REPORT_NOT_FOUND");

  return serializeDetail(report);
};

const getAllReports = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(getAllReportValidation, request);

  if (req.date_from && req.date_to && req.date_from > req.date_to) {
    throw new ResponseError(400, "INVALID_DATE_RANGE");
  }

  const where = { ...scope(actor) };
  if (req.transferred !== undefined) where.transferred = req.transferred;
  if (req.cashier) {
    where.cashier_name = { contains: req.cashier, mode: "insensitive" };
  }
  if (req.date_from || req.date_to) {
    where.date = {};
    if (req.date_from) where.date.gte = toDate(req.date_from);
    if (req.date_to) where.date.lte = toDate(req.date_to);
  }

  const [rows, total] = await prisma.$transaction([
    prisma.dailyReport.findMany({
      where,
      select: REPORT_SELECT,
      orderBy: [{ date: "desc" }, { created_at: "desc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.dailyReport.count({ where }),
  ]);

  const groups = rows.length
    ? await prisma.dailyReportEntry.groupBy({
        by: ["report_id"],
        where: { report_id: { in: rows.map((row) => row.id) } },
        _sum: { income: true, expense: true },
        _count: { _all: true },
      })
    : [];
  const stats = new Map(
    groups.map((group) => [
      group.report_id,
      {
        income: group._sum.income ?? 0,
        expense: group._sum.expense ?? 0,
        count: group._count._all,
      },
    ]),
  );

  return {
    data: rows.map((row) =>
      header(row, stats.get(row.id) ?? { income: 0, expense: 0, count: 0 }),
    ),
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const getReport = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(reportIdValidation, request);

  return fetchDetail(req.id, actor);
};

const createReport = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(createReportValidation, request);

  const date = req.date ?? todayWib();
  if (date > todayWib()) throw new ResponseError(400, "DATE_IN_FUTURE");

  const exists = await prisma.dailyReport.findFirst({
    where: { date: toDate(date), cashier_id: actor.id },
    select: { id: true },
  });
  if (exists) throw new ResponseError(409, "REPORT_ALREADY_EXISTS");

  let created;
  try {
    created = await prisma.dailyReport.create({
      data: {
        date: toDate(date),
        cashier_id: actor.id,
        cashier_name: actor.name,
        opening_balance: req.opening_balance,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "REPORT_ALREADY_EXISTS");
    }
    throw error;
  }

  return fetchDetail(created.id, actor);
};

const updateReport = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(updateReportValidation, request);

  await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id, actor);
    const data = { updated_at: new Date() };

    if (req.opening_balance !== undefined) {
      if (current.transferred && req.transferred !== false) {
        throw new ResponseError(409, "REPORT_LOCKED");
      }
      data.opening_balance = req.opening_balance;
    }

    if (
      req.transferred !== undefined &&
      req.transferred !== current.transferred
    ) {
      data.transferred = req.transferred;
      data.transferred_at = req.transferred ? new Date() : null;
    }

    await tx.dailyReport.update({ where: { id: req.id }, data });
  });

  return fetchDetail(req.id, actor);
};

const deleteReport = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(reportIdValidation, request);

  const proofPath = await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id, actor);
    assertUnlocked(current);

    await tx.dailyReport.delete({ where: { id: req.id } });
    return current.proof_path;
  });

  await removeFiles(proofPath ? [proofPath] : []);
  return { message: "REPORT_DELETED" };
};

const createEntry = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(createEntryValidation, request);
  assertAmounts(req.income, req.expense);

  await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id, actor);
    assertUnlocked(current);

    const count = await tx.dailyReportEntry.count({
      where: { report_id: req.id },
    });
    if (count >= MAX_ENTRIES) {
      throw new ResponseError(409, "ENTRY_LIMIT_REACHED", {
        max_count: MAX_ENTRIES,
      });
    }

    await tx.dailyReportEntry.create({
      data: {
        report_id: req.id,
        name: req.name,
        note: blankToNull(req.note) ?? null,
        income: req.income,
        expense: req.expense,
      },
    });
    await tx.dailyReport.update({
      where: { id: req.id },
      data: { updated_at: new Date() },
    });
  });

  return fetchDetail(req.id, actor);
};

const updateEntry = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(updateEntryValidation, request);

  await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id, actor);
    assertUnlocked(current);

    const entry = await tx.dailyReportEntry.findFirst({
      where: { id: req.entry_id, report_id: req.id },
      select: { id: true, income: true, expense: true },
    });
    if (!entry) throw new ResponseError(404, "ENTRY_NOT_FOUND");

    const income = req.income ?? entry.income;
    const expense = req.expense ?? entry.expense;
    assertAmounts(income, expense);

    const data = { income, expense, updated_at: new Date() };
    if (req.name !== undefined) data.name = req.name;
    if (req.note !== undefined) data.note = blankToNull(req.note);

    await tx.dailyReportEntry.update({ where: { id: entry.id }, data });
    await tx.dailyReport.update({
      where: { id: req.id },
      data: { updated_at: new Date() },
    });
  });

  return fetchDetail(req.id, actor);
};

const deleteEntry = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(entryIdValidation, request);

  await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id, actor);
    assertUnlocked(current);

    const { count } = await tx.dailyReportEntry.deleteMany({
      where: { id: req.entry_id, report_id: req.id },
    });
    if (!count) throw new ResponseError(404, "ENTRY_NOT_FOUND");

    await tx.dailyReport.update({
      where: { id: req.id },
      data: { updated_at: new Date() },
    });
  });

  return fetchDetail(req.id, actor);
};

const createProofUploadUrl = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(proofUploadUrlValidation, request);
  assertBucket();

  const ext = PROOF_RULE.types[req.content_type.toLowerCase()];
  if (!ext) {
    throw new ResponseError(400, "UNSUPPORTED_MEDIA_TYPE", {
      allowed: Object.keys(PROOF_RULE.types),
    });
  }

  const report = await prisma.dailyReport.findFirst({
    where: { id: req.id, cashier_id: actor.id },
    select: { id: true },
  });
  if (!report) throw new ResponseError(404, "REPORT_NOT_FOUND");

  const path = `daily-reports/${req.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Daily report signed upload url failed:", error);
    throw new ResponseError(500, "REPORT_UPLOAD_URL_FAILED");
  }

  return {
    bucket: BUCKET,
    path,
    token: data.token,
    signed_url: data.signedUrl,
    max_size: PROOF_RULE.max_size,
  };
};

const findUploaded = async (id, path) => {
  const name = path.split("/").pop();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`daily-reports/${id}`, { limit: 10, search: name });
  if (error) {
    console.error("Daily report upload check failed:", error);
    throw new ResponseError(500, "REPORT_UPLOAD_CHECK_FAILED");
  }

  return (data ?? []).find((file) => file.name === name) ?? null;
};

const setProof = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(proofRegisterValidation, request);
  assertBucket();

  const match = new RegExp(
    `^daily-reports/${req.id}/[0-9a-f-]{36}\\.(jpg|png|webp|heic|pdf)$`,
  ).exec(req.path);
  if (!match) throw new ResponseError(400, "INVALID_PROOF_PATH");

  const owned = await prisma.dailyReport.findFirst({
    where: { id: req.id, cashier_id: actor.id },
    select: { id: true },
  });
  if (!owned) throw new ResponseError(404, "REPORT_NOT_FOUND");

  const file = await findUploaded(req.id, req.path);
  if (!file) throw new ResponseError(400, "PROOF_NOT_UPLOADED");

  const size = file.metadata?.size ?? 0;
  const contentType = file.metadata?.mimetype ?? null;

  if (contentType && !PROOF_RULE.types[contentType.toLowerCase()]) {
    await removeFiles([req.path]);
    throw new ResponseError(400, "PROOF_TYPE_MISMATCH");
  }
  if (size > PROOF_RULE.max_size) {
    await removeFiles([req.path]);
    throw new ResponseError(400, "PROOF_TOO_LARGE", {
      max_size: PROOF_RULE.max_size,
    });
  }

  let oldPath;
  try {
    oldPath = await prisma.$transaction(async (tx) => {
      const current = await lockReport(tx, req.id, actor);
      if (current.proof_path === req.path) return null;

      await tx.dailyReport.update({
        where: { id: req.id },
        data: {
          proof_path: req.path,
          proof_content_type: contentType ?? EXT_TYPE[match[1]],
          proof_size: size,
          proof_uploaded_at: new Date(),
          updated_at: new Date(),
        },
      });

      return current.proof_path;
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "PROOF_ALREADY_ADDED");
    }
    if (error instanceof ResponseError && error.status === 404) {
      await removeFiles([req.path]);
    }
    throw error;
  }

  if (oldPath) await removeFiles([oldPath]);

  const report = await prisma.dailyReport.findFirst({
    where: { id: req.id, cashier_id: actor.id },
    select: REPORT_SELECT,
  });
  if (!report) throw new ResponseError(404, "REPORT_NOT_FOUND");

  return { proof: await serializeProof(report) };
};

const deleteProof = async (request, user) => {
  const actor = adminOf(user);
  const req = validate(reportIdValidation, request);

  const oldPath = await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id, actor);
    if (!current.proof_path) throw new ResponseError(404, "PROOF_NOT_FOUND");

    await tx.dailyReport.update({
      where: { id: req.id },
      data: {
        proof_path: null,
        proof_content_type: null,
        proof_size: null,
        proof_uploaded_at: null,
        updated_at: new Date(),
      },
    });

    return current.proof_path;
  });

  await removeFiles([oldPath]);
  return { message: "PROOF_DELETED" };
};

export default {
  getAllReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  createEntry,
  updateEntry,
  deleteEntry,
  createProofUploadUrl,
  setProof,
  deleteProof,
};
