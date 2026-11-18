import crypto from "node:crypto";

import { supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  createEntryValidation,
  createReportValidation,
  entryIdValidation,
  getAllReportValidation,
  historyValidation,
  nextOpeningValidation,
  proofRegisterValidation,
  proofUploadUrlValidation,
  reportIdValidation,
  updateEntryValidation,
  updateReportValidation,
} from "../../validation/admin/daily-report-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;
const MAX_INT = 2147483647;
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
  opening_cash: true,
  opening_noncash: true,
  remit_cash: true,
  remit_transfer: true,
  remitted: true,
  remitted_at: true,
  proof_path: true,
  proof_content_type: true,
  proof_size: true,
  proof_uploaded_at: true,
  created_at: true,
  updated_at: true,
};

const ENTRY_SELECT = {
  id: true,
  method: true,
  name: true,
  note: true,
  income: true,
  expense: true,
  created_at: true,
  updated_at: true,
};

const DETAIL_SELECT = {
  ...REPORT_SELECT,
  entries: { orderBy: [{ seq: "asc" }], select: ENTRY_SELECT },
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

const assertCanSettle = (actor) => {
  if (isOwner(actor)) throw new ResponseError(403, "REMIT_ADMIN_ONLY");
};

const assertCanLock = (actor) => {
  if (!isOwner(actor)) throw new ResponseError(403, "LOCK_OWNER_ONLY");
};

const paging = (page, total) => ({
  page,
  per_page: PER_PAGE,
  total,
  total_pages: Math.ceil(total / PER_PAGE),
});

const diffOf = (before, after, keys) => {
  const from = {};
  const to = {};

  for (const key of keys) {
    if (before[key] !== after[key]) {
      from[key] = before[key];
      to[key] = after[key];
    }
  }

  return Object.keys(to).length ? { before: from, after: to } : null;
};

const entryView = (entry) => ({
  id: entry.id,
  method: entry.method,
  name: entry.name,
  note: entry.note,
  income: entry.income,
  expense: entry.expense,
});

const ENTRY_FIELDS = ["method", "name", "note", "income", "expense"];

const writeLog = (tx, reportId, actor, action, detail) =>
  tx.dailyReportLog.create({
    data: {
      report_id: reportId,
      user_id: actor.id,
      user_name: actor.name ?? "",
      user_role: actor.role ?? "",
      action,
      detail: detail ?? undefined,
    },
  });

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

const lockReport = async (tx, id) => {
  const rows = await tx.$queryRaw`
    SELECT id, opening_cash, opening_noncash, remit_cash, remit_transfer, remitted, proof_path
    FROM "DailyReport"
    WHERE id = ${id}
    FOR UPDATE
  `;

  if (!rows[0]) throw new ResponseError(404, "REPORT_NOT_FOUND");

  return rows[0];
};

const assertUnlocked = (report) => {
  if (report.remitted) throw new ResponseError(409, "REPORT_LOCKED");
};

const emptyStat = () => ({
  cash_in: 0,
  cash_out: 0,
  noncash_in: 0,
  noncash_out: 0,
  count: 0,
});

const addAmount = (stat, method, income, expense) => {
  if (method === "CASH") {
    stat.cash_in += income;
    stat.cash_out += expense;
  } else {
    stat.noncash_in += income;
    stat.noncash_out += expense;
  }
};

const sumEntries = async (db, reportId) => {
  const rows = await db.dailyReportEntry.groupBy({
    by: ["method"],
    where: { report_id: reportId },
    _sum: { income: true, expense: true },
    _count: { _all: true },
  });
  const stat = emptyStat();

  for (const row of rows) {
    addAmount(stat, row.method, row._sum.income ?? 0, row._sum.expense ?? 0);
    stat.count += row._count._all;
  }

  return stat;
};

const closings = (report, stat) => {
  const cash = report.opening_cash + stat.cash_in - stat.cash_out;
  const noncash = report.opening_noncash + stat.noncash_in - stat.noncash_out;

  return { cash, noncash, total: cash + noncash };
};

const hasRemitAmounts = (report) =>
  report.remit_cash !== null &&
  report.remit_cash !== undefined &&
  report.remit_transfer !== null &&
  report.remit_transfer !== undefined;

const remainingOf = (report, closing) => {
  const filled = hasRemitAmounts(report);

  return {
    cash: closing.cash - (filled ? report.remit_cash : 0),
    noncash: closing.noncash - (filled ? report.remit_transfer : 0),
  };
};
const assertAmounts = (income, expense) => {
  if (income > 0 === expense > 0) {
    throw new ResponseError(400, "INVALID_ENTRY_AMOUNT");
  }
};

const header = (report, stat) => {
  const closing = closings(report, stat);
  const left = remainingOf(report, closing);

  return {
    id: report.id,
    date: dateOut(report.date),
    opening_cash: report.opening_cash,
    opening_noncash: report.opening_noncash,
    opening_balance: report.opening_cash + report.opening_noncash,
    total_in: stat.cash_in + stat.noncash_in,
    total_out: stat.cash_out + stat.noncash_out,
    cash_in: stat.cash_in,
    cash_out: stat.cash_out,
    noncash_in: stat.noncash_in,
    noncash_out: stat.noncash_out,
    closing_cash: closing.cash,
    closing_noncash: closing.noncash,
    closing_balance: closing.total,
    remit_cash: report.remit_cash,
    remit_transfer: report.remit_transfer,
    remaining_cash: left.cash,
    remaining_noncash: left.noncash,
    remaining_balance: left.cash + left.noncash,
    entry_count: stat.count,
    remitted: report.remitted,
    remitted_at: report.remitted_at,
    has_proof: Boolean(report.proof_path),
  };
};

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
  let balance = report.opening_cash + report.opening_noncash;
  const stat = emptyStat();

  const entries = report.entries.map((entry) => {
    balance += entry.income - entry.expense;
    addAmount(stat, entry.method, entry.income, entry.expense);
    stat.count += 1;

    return {
      id: entry.id,
      date,
      method: entry.method,
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
    ...header(report, stat),
    proof: await serializeProof(report),
    entries,
    created_at: report.created_at,
    updated_at: report.updated_at,
  };
};

const fetchDetail = async (id) => {
  const report = await prisma.dailyReport.findUnique({
    where: { id },
    select: DETAIL_SELECT,
  });
  if (!report) throw new ResponseError(404, "REPORT_NOT_FOUND");

  return serializeDetail(report);
};

const getAllReports = async (request, user) => {
  actorOf(user);
  const req = validate(getAllReportValidation, request);

  if (req.date_from && req.date_to && req.date_from > req.date_to) {
    throw new ResponseError(400, "INVALID_DATE_RANGE");
  }

  const where = {};
  if (req.remitted !== undefined) where.remitted = req.remitted;
  if (req.date_from || req.date_to) {
    where.date = {};
    if (req.date_from) where.date.gte = toDate(req.date_from);
    if (req.date_to) where.date.lte = toDate(req.date_to);
  }

  const [rows, total] = await prisma.$transaction([
    prisma.dailyReport.findMany({
      where,
      select: REPORT_SELECT,
      orderBy: [{ date: "desc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.dailyReport.count({ where }),
  ]);

  const groups = rows.length
    ? await prisma.dailyReportEntry.groupBy({
        by: ["report_id", "method"],
        where: { report_id: { in: rows.map((row) => row.id) } },
        _sum: { income: true, expense: true },
        _count: { _all: true },
      })
    : [];
  const stats = new Map();
  for (const group of groups) {
    const stat = stats.get(group.report_id) ?? emptyStat();
    addAmount(
      stat,
      group.method,
      group._sum.income ?? 0,
      group._sum.expense ?? 0,
    );
    stat.count += group._count._all;
    stats.set(group.report_id, stat);
  }

  return {
    data: rows.map((row) => header(row, stats.get(row.id) ?? emptyStat())),
    paging: paging(req.page, total),
  };
};

const getReport = async (request, user) => {
  actorOf(user);
  const req = validate(reportIdValidation, request);

  return fetchDetail(req.id);
};

const getHistory = async (request, user) => {
  actorOf(user);
  const req = validate(historyValidation, request);

  const report = await prisma.dailyReport.findUnique({
    where: { id: req.id },
    select: { id: true },
  });
  if (!report) throw new ResponseError(404, "REPORT_NOT_FOUND");

  const where = { report_id: req.id };
  const [rows, total] = await prisma.$transaction([
    prisma.dailyReportLog.findMany({
      where,
      select: {
        id: true,
        user_id: true,
        user_name: true,
        user_role: true,
        action: true,
        detail: true,
        created_at: true,
      },
      orderBy: [{ seq: "desc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.dailyReportLog.count({ where }),
  ]);

  return { data: rows, paging: paging(req.page, total) };
};

const resolveOpening = async (db, date) => {
  const previous = await db.dailyReport.findFirst({
    where: { date: { lt: toDate(date) } },
    orderBy: [{ date: "desc" }],
    select: {
      id: true,
      date: true,
      opening_cash: true,
      opening_noncash: true,
      remit_cash: true,
      remit_transfer: true,
      remitted: true,
    },
  });

  if (!previous) {
    return { opening_cash: 0, opening_noncash: 0, source: null, pending: null };
  }

  if (!previous.remitted) {
    return {
      opening_cash: null,
      opening_noncash: null,
      source: null,
      pending: { id: previous.id, date: dateOut(previous.date) },
    };
  }

  const closing = closings(previous, await sumEntries(db, previous.id));
  const left = remainingOf(previous, closing);
  const cash = Math.max(left.cash, 0);
  const noncash = Math.max(left.noncash, 0);
  if (cash > MAX_INT || noncash > MAX_INT) {
    throw new ResponseError(409, "OPENING_BALANCE_TOO_LARGE");
  }

  return {
    opening_cash: cash,
    opening_noncash: noncash,
    source: {
      id: previous.id,
      date: dateOut(previous.date),
      closing_balance: closing.total,
      remit_cash: previous.remit_cash,
      remit_transfer: previous.remit_transfer,
    },
    pending: null,
  };
};

const getNextOpening = async (request, user) => {
  actorOf(user);
  const req = validate(nextOpeningValidation, request);

  const date = req.date ?? todayWib();
  if (date > todayWib()) throw new ResponseError(400, "DATE_IN_FUTURE");

  const result = await resolveOpening(prisma, date);

  return {
    date,
    opening_cash: result.opening_cash,
    opening_noncash: result.opening_noncash,
    opening_balance:
      result.pending === null
        ? result.opening_cash + result.opening_noncash
        : null,
    source: result.source,
    pending: result.pending,
  };
};

const createReport = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(createReportValidation, request);

  const date = req.date ?? todayWib();
  if (date > todayWib()) throw new ResponseError(400, "DATE_IN_FUTURE");

  const manual =
    req.opening_cash !== undefined || req.opening_noncash !== undefined;

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const exists = await tx.dailyReport.findUnique({
        where: { date: toDate(date) },
        select: { id: true },
      });
      if (exists) {
        throw new ResponseError(409, "REPORT_ALREADY_EXISTS", {
          report_id: exists.id,
        });
      }

      let cash = req.opening_cash ?? 0;
      let noncash = req.opening_noncash ?? 0;

      if (!manual) {
        const resolved = await resolveOpening(tx, date);
        if (resolved.pending) {
          throw new ResponseError(409, "PREVIOUS_REPORT_NOT_REMITTED", {
            report_id: resolved.pending.id,
            date: resolved.pending.date,
          });
        }
        cash = resolved.opening_cash;
        noncash = resolved.opening_noncash;
      }

      const report = await tx.dailyReport.create({
        data: {
          date: toDate(date),
          opening_cash: cash,
          opening_noncash: noncash,
        },
        select: { id: true },
      });
      await writeLog(tx, report.id, actor, "REPORT_CREATED", {
        opening_cash: cash,
        opening_noncash: noncash,
        carried: !manual,
      });

      return report;
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "REPORT_ALREADY_EXISTS");
    }
    throw error;
  }

  return fetchDetail(created.id);
};

const assertCanRemit = async (tx, id, next, proofPath) => {
  const missing = ["remit_cash", "remit_transfer"].filter(
    (key) => next[key] === null || next[key] === undefined,
  );
  if (missing.length) {
    throw new ResponseError(400, "REMIT_AMOUNT_REQUIRED", { fields: missing });
  }

  const closing = closings(next, await sumEntries(tx, id));

  if (closing.cash < 0 || closing.noncash < 0) {
    throw new ResponseError(400, "NEGATIVE_BALANCE", {
      closing_cash: closing.cash,
      closing_noncash: closing.noncash,
    });
  }
  if (next.remit_cash > closing.cash) {
    throw new ResponseError(400, "REMIT_CASH_EXCEEDS_BALANCE", {
      closing_cash: closing.cash,
    });
  }
  if (next.remit_transfer > closing.noncash) {
    throw new ResponseError(400, "REMIT_TRANSFER_EXCEEDS_BALANCE", {
      closing_noncash: closing.noncash,
    });
  }
  if (next.remit_transfer > 0 && !proofPath) {
    throw new ResponseError(400, "PROOF_REQUIRED");
  }
};

const updateReport = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(updateReportValidation, request);

  if (req.remitted !== undefined) assertCanLock(actor);
  if ([req.remit_cash, req.remit_transfer].some((v) => v !== undefined)) {
    assertCanSettle(actor);
  }

  await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id);
    const nextRemitted = req.remitted ?? current.remitted;

    const touchesSettlement = [
      req.opening_cash,
      req.opening_noncash,
      req.remit_cash,
      req.remit_transfer,
    ].some((value) => value !== undefined);
    if (current.remitted && nextRemitted && touchesSettlement) {
      throw new ResponseError(409, "REPORT_LOCKED");
    }

    const next = {
      opening_cash: req.opening_cash ?? current.opening_cash,
      opening_noncash: req.opening_noncash ?? current.opening_noncash,
      remit_cash:
        req.remit_cash !== undefined ? req.remit_cash : current.remit_cash,
      remit_transfer:
        req.remit_transfer !== undefined
          ? req.remit_transfer
          : current.remit_transfer,
    };

    if (nextRemitted && !current.remitted) {
      await assertCanRemit(tx, req.id, next, current.proof_path);
    }

    const data = { updated_at: new Date() };
    if (req.opening_cash !== undefined) data.opening_cash = req.opening_cash;
    if (req.opening_noncash !== undefined) {
      data.opening_noncash = req.opening_noncash;
    }
    if (req.remit_cash !== undefined) data.remit_cash = req.remit_cash;
    if (req.remit_transfer !== undefined) {
      data.remit_transfer = req.remit_transfer;
    }
    if (nextRemitted !== current.remitted) {
      data.remitted = nextRemitted;
      data.remitted_at = nextRemitted ? new Date() : null;
    }

    await tx.dailyReport.update({ where: { id: req.id }, data });

    const opening = diffOf(current, next, ["opening_cash", "opening_noncash"]);
    if (opening) await writeLog(tx, req.id, actor, "OPENING_UPDATED", opening);

    const remit = diffOf(current, next, ["remit_cash", "remit_transfer"]);
    if (nextRemitted && !current.remitted) {
      await writeLog(tx, req.id, actor, "REMITTED", {
        remit_cash: next.remit_cash,
        remit_transfer: next.remit_transfer,
      });
    } else {
      if (!nextRemitted && current.remitted) {
        await writeLog(tx, req.id, actor, "REMIT_REOPENED");
      }
      if (remit) await writeLog(tx, req.id, actor, "REMIT_UPDATED", remit);
    }
  });

  return fetchDetail(req.id);
};

const deleteReport = async (request, user) => {
  actorOf(user);
  const req = validate(reportIdValidation, request);

  const proofPath = await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id);
    assertUnlocked(current);

    await tx.dailyReport.delete({ where: { id: req.id } });
    return current.proof_path;
  });

  await removeFiles(proofPath ? [proofPath] : []);
  return { message: "REPORT_DELETED" };
};

const createEntry = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(createEntryValidation, request);
  assertAmounts(req.income, req.expense);

  await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id);
    assertUnlocked(current);

    const count = await tx.dailyReportEntry.count({
      where: { report_id: req.id },
    });
    if (count >= MAX_ENTRIES) {
      throw new ResponseError(409, "ENTRY_LIMIT_REACHED", {
        max_count: MAX_ENTRIES,
      });
    }

    const entry = await tx.dailyReportEntry.create({
      data: {
        report_id: req.id,
        method: req.method,
        name: req.name,
        note: blankToNull(req.note) ?? null,
        income: req.income,
        expense: req.expense,
      },
      select: ENTRY_SELECT,
    });
    await tx.dailyReport.update({
      where: { id: req.id },
      data: { updated_at: new Date() },
    });
    await writeLog(tx, req.id, actor, "ENTRY_CREATED", {
      entry: entryView(entry),
    });
  });

  return fetchDetail(req.id);
};

const updateEntry = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(updateEntryValidation, request);

  await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id);
    assertUnlocked(current);

    const entry = await tx.dailyReportEntry.findFirst({
      where: { id: req.entry_id, report_id: req.id },
      select: ENTRY_SELECT,
    });
    if (!entry) throw new ResponseError(404, "ENTRY_NOT_FOUND");

    const income = req.income ?? entry.income;
    const expense = req.expense ?? entry.expense;
    assertAmounts(income, expense);

    const data = { income, expense, updated_at: new Date() };
    if (req.method !== undefined) data.method = req.method;
    if (req.name !== undefined) data.name = req.name;
    if (req.note !== undefined) data.note = blankToNull(req.note);

    await tx.dailyReportEntry.update({ where: { id: entry.id }, data });
    await tx.dailyReport.update({
      where: { id: req.id },
      data: { updated_at: new Date() },
    });

    const changes = diffOf(entry, { ...entry, ...data }, ENTRY_FIELDS);
    if (changes) {
      await writeLog(tx, req.id, actor, "ENTRY_UPDATED", {
        entry_id: entry.id,
        ...changes,
      });
    }
  });

  return fetchDetail(req.id);
};

const deleteEntry = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(entryIdValidation, request);

  await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id);
    assertUnlocked(current);

    const entry = await tx.dailyReportEntry.findFirst({
      where: { id: req.entry_id, report_id: req.id },
      select: ENTRY_SELECT,
    });
    if (!entry) throw new ResponseError(404, "ENTRY_NOT_FOUND");

    await tx.dailyReportEntry.delete({ where: { id: entry.id } });
    await tx.dailyReport.update({
      where: { id: req.id },
      data: { updated_at: new Date() },
    });
    await writeLog(tx, req.id, actor, "ENTRY_DELETED", {
      entry: entryView(entry),
    });
  });

  return fetchDetail(req.id);
};

const createProofUploadUrl = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(proofUploadUrlValidation, request);
  assertCanSettle(actor);
  assertBucket();

  const ext = PROOF_RULE.types[req.content_type.toLowerCase()];
  if (!ext) {
    throw new ResponseError(400, "UNSUPPORTED_MEDIA_TYPE", {
      allowed: Object.keys(PROOF_RULE.types),
    });
  }

  const report = await prisma.dailyReport.findUnique({
    where: { id: req.id },
    select: { id: true, remitted: true },
  });
  if (!report) throw new ResponseError(404, "REPORT_NOT_FOUND");
  if (report.remitted) throw new ResponseError(409, "PROOF_LOCKED");

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
  const actor = actorOf(user);
  const req = validate(proofRegisterValidation, request);
  assertCanSettle(actor);
  assertBucket();

  const match = new RegExp(
    `^daily-reports/${req.id}/[0-9a-f-]{36}\\.(jpg|png|webp|heic|pdf)$`,
  ).exec(req.path);
  if (!match) throw new ResponseError(400, "INVALID_PROOF_PATH");

  const owned = await prisma.dailyReport.findUnique({
    where: { id: req.id },
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
      const current = await lockReport(tx, req.id);
      if (current.remitted) throw new ResponseError(409, "PROOF_LOCKED");
      if (current.proof_path === req.path) return null;

      const proofType = contentType ?? EXT_TYPE[match[1]];
      await tx.dailyReport.update({
        where: { id: req.id },
        data: {
          proof_path: req.path,
          proof_content_type: proofType,
          proof_size: size,
          proof_uploaded_at: new Date(),
          updated_at: new Date(),
        },
      });
      await writeLog(tx, req.id, actor, "PROOF_SET", {
        content_type: proofType,
        size,
        replaced: Boolean(current.proof_path),
      });

      return current.proof_path;
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "PROOF_ALREADY_ADDED");
    }
    if (
      error instanceof ResponseError &&
      (error.status === 404 || error.message === "PROOF_LOCKED")
    ) {
      await removeFiles([req.path]);
    }
    throw error;
  }

  if (oldPath) await removeFiles([oldPath]);

  const report = await prisma.dailyReport.findUnique({
    where: { id: req.id },
    select: REPORT_SELECT,
  });
  if (!report) throw new ResponseError(404, "REPORT_NOT_FOUND");

  return { proof: await serializeProof(report) };
};

const deleteProof = async (request, user) => {
  const actor = actorOf(user);
  const req = validate(reportIdValidation, request);
  assertCanSettle(actor);

  const oldPath = await prisma.$transaction(async (tx) => {
    const current = await lockReport(tx, req.id);
    if (!current.proof_path) throw new ResponseError(404, "PROOF_NOT_FOUND");
    if (current.remitted) throw new ResponseError(409, "PROOF_LOCKED");

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
    await writeLog(tx, req.id, actor, "PROOF_DELETED");

    return current.proof_path;
  });

  await removeFiles([oldPath]);
  return { message: "PROOF_DELETED" };
};

export default {
  getAllReports,
  getReport,
  getNextOpening,
  getHistory,
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
