import crypto from "node:crypto";

import { supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  createQcValidation,
  getAllQcValidation,
  qcAddMediaValidation,
  qcIdValidation,
  qcMediaIdValidation,
  qcUploadUrlValidation,
  setQcStatusValidation,
  updateQcValidation,
} from "../../validation/admin/qc-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;
const BUCKET = process.env.SUPABASE_QC_BUCKET;
const SIGNED_URL_SECONDS = 3600;
const MB = 1024 * 1024;

const MEDIA_RULES = {
  PHOTO: {
    max_size: 10 * MB,
    max_count: 20,
    types: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heic",
    },
  },
  VIDEO: {
    max_size: 50 * MB,
    max_count: 5,
    types: {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
    },
  },
};

const EXT_KIND = {
  jpg: "PHOTO",
  png: "PHOTO",
  webp: "PHOTO",
  heic: "PHOTO",
  mp4: "VIDEO",
  mov: "VIDEO",
  webm: "VIDEO",
};

const ALLOWED_FIELDS = {
  PHYSICAL: ["checked", "note"],
  FUNCTION: ["classification", "note"],
  ACCESSORY: ["classification", "note"],
  COMPLETENESS: ["checked", "origin", "note"],
};

const GROUP_KEY = {
  PHYSICAL: "physical",
  FUNCTION: "functions",
  ACCESSORY: "accessories",
  COMPLETENESS: "completeness",
};

const LIST_SELECT = {
  id: true,
  date: true,
  type: true,
  status: true,
  product_name: true,
  serial_number: true,
  sku: true,
  sender_name: true,
  tracking_number: true,
  pic: true,
  price: true,
  created_at: true,
  entries: { select: { section: true, checked: true, classification: true } },
  media: { select: { kind: true } },
};

const DETAIL_SELECT = {
  id: true,
  date: true,
  type: true,
  status: true,
  product_name: true,
  serial_number: true,
  sku: true,
  sender_name: true,
  tracking_number: true,
  pic: true,
  price: true,
  created_at: true,
  updated_at: true,
  entries: {
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    select: {
      id: true,
      item_id: true,
      section: true,
      name: true,
      checked: true,
      classification: true,
      origin: true,
      note: true,
    },
  },
  extras: {
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  },
  media: {
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      kind: true,
      path: true,
      content_type: true,
      size: true,
      created_at: true,
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

const assertBucket = () => {
  if (!BUCKET) throw new ResponseError(500, "QC_BUCKET_NOT_CONFIGURED");
};

const removeFiles = async (paths) => {
  if (!paths.length || !BUCKET) return;

  try {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to remove QC file:", { paths, error });
  }
};

const signPaths = async (paths) => {
  const urls = new Map();
  if (!paths.length || !BUCKET) return urls;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw error;

    for (const row of data ?? []) {
      if (row.signedUrl) urls.set(row.path, row.signedUrl);
    }
  } catch (error) {
    console.error("Failed to sign QC media:", error);
  }

  return urls;
};

const isOwner = (role) => role === "OWNER";

const canSeePrice = (qc, role) => isOwner(role) || qc.status !== "DEAL";

const lockQc = async (tx, id) => {
  const rows =
    await tx.$queryRaw`SELECT id, status FROM "QualityControl" WHERE id = ${id} FOR UPDATE`;
  if (!rows.length) throw new ResponseError(404, "QC_NOT_FOUND");
  return rows[0];
};

const fetchDetail = async (id) => {
  const qc = await prisma.qualityControl.findUnique({
    where: { id },
    select: DETAIL_SELECT,
  });
  if (!qc) throw new ResponseError(404, "QC_NOT_FOUND");
  return qc;
};

const serializeEntry = (entry) => {
  const base = {
    id: entry.id,
    item_id: entry.item_id,
    name: entry.name,
    note: entry.note,
  };

  if (entry.section === "FUNCTION" || entry.section === "ACCESSORY") {
    return { ...base, classification: entry.classification };
  }
  if (entry.section === "COMPLETENESS") {
    return { ...base, checked: entry.checked, origin: entry.origin };
  }
  return { ...base, checked: entry.checked };
};

const countEntries = (entries) => ({
  defect_count: entries.filter(
    (e) => e.section === "PHYSICAL" && e.checked === true,
  ).length,
  minor_count: entries.filter((e) => e.classification === "MINOR").length,
});

const header = (qc, role) => ({
  id: qc.id,
  date: dateOut(qc.date),
  type: qc.type,
  status: qc.status,
  product_name: qc.product_name,
  serial_number: qc.serial_number,
  sku: qc.sku,
  sender_name: qc.sender_name,
  tracking_number: qc.tracking_number,
  pic: qc.pic,
  ...(canSeePrice(qc, role) ? { price: qc.price } : {}),
});

const serializeDetail = async (qc, role) => {
  const urls = await signPaths(qc.media.map((m) => m.path));
  const groups = {
    physical: [],
    functions: [],
    accessories: [],
    completeness: [],
  };

  for (const entry of qc.entries) {
    groups[GROUP_KEY[entry.section]].push(serializeEntry(entry));
  }

  return {
    ...header(qc, role),
    ...countEntries(qc.entries),
    ...groups,
    extras: qc.extras,
    media: qc.media.map((m) => ({
      id: m.id,
      kind: m.kind,
      url: urls.get(m.path) ?? null,
      content_type: m.content_type,
      size: m.size,
      created_at: m.created_at,
    })),
    created_at: qc.created_at,
    updated_at: qc.updated_at,
  };
};

const buildSearch = (search) =>
  [
    "product_name",
    "serial_number",
    "sku",
    "pic",
    "sender_name",
    "tracking_number",
  ].map((field) => ({ [field]: { contains: search, mode: "insensitive" } }));

const resolveEntries = async (list) => {
  const ids = [...new Set(list.filter((e) => e.item_id).map((e) => e.item_id))];
  const items = ids.length
    ? await prisma.qcItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, section: true, name: true },
      })
    : [];
  const byId = new Map(items.map((item) => [item.id, item]));

  const seen = new Set();

  return list.map((entry, index) => {
    let section;
    let name;

    if (entry.item_id) {
      const item = byId.get(entry.item_id);
      if (!item) {
        throw new ResponseError(400, "QC_ITEM_NOT_FOUND", {
          item_id: entry.item_id,
        });
      }
      ({ section, name } = item);
    } else {
      ({ section, name } = entry);
    }

    const key = entry.item_id ?? `${section}|${name.toLowerCase()}`;
    if (seen.has(key)) {
      throw new ResponseError(400, "DUPLICATE_QC_ENTRY", { name });
    }
    seen.add(key);

    const allowed = ALLOWED_FIELDS[section];
    for (const field of ["checked", "classification", "origin"]) {
      if (entry[field] !== undefined && !allowed.includes(field)) {
        throw new ResponseError(400, "INVALID_QC_ENTRY", { name, field });
      }
    }

    const hasChecked = allowed.includes("checked");
    const hasClass = allowed.includes("classification");
    const checked = hasChecked ? (entry.checked ?? false) : null;

    if (entry.origin !== undefined && checked !== true) {
      throw new ResponseError(400, "INVALID_QC_ENTRY", {
        name,
        field: "origin",
      });
    }

    return {
      item_id: entry.item_id ?? null,
      section,
      name,
      checked,
      classification: hasClass ? (entry.classification ?? "NORMAL") : null,
      origin: entry.origin ?? null,
      note: blankToNull(entry.note) ?? null,
      sort_order: index,
    };
  });
};

const writeChildren = async (tx, id, entries, extras) => {
  if (entries) {
    await tx.qualityControlEntry.deleteMany({ where: { qc_id: id } });
    if (entries.length) {
      await tx.qualityControlEntry.createMany({
        data: entries.map((entry) => ({ ...entry, qc_id: id })),
      });
    }
  }

  if (extras) {
    await tx.qualityControlExtra.deleteMany({ where: { qc_id: id } });
    if (extras.length) {
      await tx.qualityControlExtra.createMany({
        data: extras.map((extra, index) => ({
          qc_id: id,
          name: extra.name,
          sort_order: index,
        })),
      });
    }
  }
};

const getAllQc = async (request, role) => {
  const req = validate(getAllQcValidation, request);

  if (req.date_from && req.date_to && req.date_from > req.date_to) {
    throw new ResponseError(400, "INVALID_DATE_RANGE");
  }

  const where = {};
  if (req.search) where.OR = buildSearch(req.search);
  if (req.type) where.type = req.type;
  if (req.status) where.status = req.status;
  if (req.date_from || req.date_to) {
    where.date = {};
    if (req.date_from) where.date.gte = toDate(req.date_from);
    if (req.date_to) where.date.lte = toDate(req.date_to);
  }

  const [rows, total] = await prisma.$transaction([
    prisma.qualityControl.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ date: "desc" }, { created_at: "desc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.qualityControl.count({ where }),
  ]);

  return {
    data: rows.map((qc) => ({
      ...header(qc, role),
      ...countEntries(qc.entries),
      photo_count: qc.media.filter((m) => m.kind === "PHOTO").length,
      video_count: qc.media.filter((m) => m.kind === "VIDEO").length,
      created_at: qc.created_at,
    })),
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const getQc = async (request, role) => {
  const req = validate(qcIdValidation, request);

  return serializeDetail(await fetchDetail(req.id), role);
};

const createQc = async (request, role) => {
  const req = validate(createQcValidation, request);
  const entries = await resolveEntries(req.entries);

  const id = await prisma.$transaction(async (tx) => {
    const qc = await tx.qualityControl.create({
      data: {
        date: toDate(req.date ?? todayWib()),
        type: req.type,
        status: req.status,
        product_name: req.product_name,
        serial_number: blankToNull(req.serial_number) ?? null,
        sku: blankToNull(req.sku) ?? null,
        sender_name: blankToNull(req.sender_name) ?? null,
        tracking_number: blankToNull(req.tracking_number) ?? null,
        pic: blankToNull(req.pic) ?? null,
        price: req.price ?? null,
      },
      select: { id: true },
    });

    await writeChildren(tx, qc.id, entries, req.extras);
    return qc.id;
  });

  return serializeDetail(await fetchDetail(id), role);
};

const updateQc = async (request, role) => {
  const req = validate(updateQcValidation, request);
  const entries = req.entries ? await resolveEntries(req.entries) : undefined;

  const data = { updated_at: new Date() };
  if (req.date !== undefined) data.date = toDate(req.date);
  if (req.type !== undefined) data.type = req.type;
  if (req.product_name !== undefined) data.product_name = req.product_name;
  for (const field of [
    "serial_number",
    "sku",
    "sender_name",
    "tracking_number",
    "pic",
  ]) {
    if (req[field] !== undefined) data[field] = blankToNull(req[field]);
  }
  if (req.price !== undefined) data.price = req.price;

  await prisma.$transaction(async (tx) => {
    await lockQc(tx, req.id);
    await tx.qualityControl.update({ where: { id: req.id }, data });
    await writeChildren(tx, req.id, entries, req.extras);
  });

  return serializeDetail(await fetchDetail(req.id), role);
};

const setStatus = async (request, role) => {
  const req = validate(setQcStatusValidation, request);

  return prisma.$transaction(async (tx) => {
    const current = await lockQc(tx, req.id);
    if (!isOwner(role) && current.status === "DEAL" && req.status !== "DEAL") {
      throw new ResponseError(403, "STATUS_OWNER_ONLY");
    }

    return tx.qualityControl.update({
      where: { id: req.id },
      data: { status: req.status },
      select: { id: true, status: true },
    });
  });
};

const deleteQc = async (request) => {
  const req = validate(qcIdValidation, request);

  const media = await prisma.qualityControlMedia.findMany({
    where: { qc_id: req.id },
    select: { path: true },
  });

  const { count } = await prisma.qualityControl.deleteMany({
    where: { id: req.id },
  });
  if (!count) throw new ResponseError(404, "QC_NOT_FOUND");

  await removeFiles(media.map((m) => m.path));
  return { message: "QC_DELETED" };
};

const createUploadUrl = async (request) => {
  const req = validate(qcUploadUrlValidation, request);
  assertBucket();

  const rule = MEDIA_RULES[req.kind];
  const ext = rule.types[req.content_type.toLowerCase()];
  if (!ext) {
    throw new ResponseError(400, "UNSUPPORTED_MEDIA_TYPE", {
      allowed: Object.keys(rule.types),
    });
  }

  const exists = await prisma.qualityControl.findUnique({
    where: { id: req.id },
    select: { id: true },
  });
  if (!exists) throw new ResponseError(404, "QC_NOT_FOUND");

  const used = await prisma.qualityControlMedia.count({
    where: { qc_id: req.id, kind: req.kind },
  });
  if (used >= rule.max_count) {
    throw new ResponseError(409, "MEDIA_LIMIT_REACHED", {
      kind: req.kind,
      max_count: rule.max_count,
    });
  }

  const path = `qc/${req.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("QC signed upload url failed:", error);
    throw new ResponseError(500, "QC_UPLOAD_URL_FAILED");
  }

  return {
    bucket: BUCKET,
    path,
    token: data.token,
    signed_url: data.signedUrl,
    max_size: rule.max_size,
  };
};

const findUploaded = async (id, path) => {
  const name = path.split("/").pop();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`qc/${id}`, { limit: 10, search: name });
  if (error) {
    console.error("QC upload check failed:", error);
    throw new ResponseError(500, "QC_UPLOAD_CHECK_FAILED");
  }

  return (data ?? []).find((file) => file.name === name) ?? null;
};

const addMedia = async (request) => {
  const req = validate(qcAddMediaValidation, request);
  assertBucket();

  const match = new RegExp(
    `^qc/${req.id}/[0-9a-f-]{36}\\.(jpg|png|webp|heic|mp4|mov|webm)$`,
  ).exec(req.path);
  if (!match) throw new ResponseError(400, "INVALID_MEDIA_PATH");

  const rule = MEDIA_RULES[req.kind];
  if (EXT_KIND[match[1]] !== req.kind) {
    throw new ResponseError(400, "MEDIA_TYPE_MISMATCH");
  }

  const existing = await prisma.qualityControlMedia.findUnique({
    where: { path: req.path },
    select: { id: true },
  });
  if (existing) throw new ResponseError(409, "MEDIA_ALREADY_ADDED");

  const file = await findUploaded(req.id, req.path);
  if (!file) throw new ResponseError(400, "MEDIA_NOT_UPLOADED");

  const size = file.metadata?.size ?? 0;
  const contentType = file.metadata?.mimetype ?? null;

  if (contentType && !rule.types[contentType.toLowerCase()]) {
    await removeFiles([req.path]);
    throw new ResponseError(400, "MEDIA_TYPE_MISMATCH");
  }
  if (size > rule.max_size) {
    await removeFiles([req.path]);
    throw new ResponseError(400, "MEDIA_TOO_LARGE", {
      max_size: rule.max_size,
    });
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      await lockQc(tx, req.id);

      const used = await tx.qualityControlMedia.count({
        where: { qc_id: req.id, kind: req.kind },
      });
      if (used >= rule.max_count) {
        throw new ResponseError(409, "MEDIA_LIMIT_REACHED", {
          kind: req.kind,
          max_count: rule.max_count,
        });
      }

      return tx.qualityControlMedia.create({
        data: {
          qc_id: req.id,
          kind: req.kind,
          path: req.path,
          content_type:
            contentType ??
            Object.keys(rule.types).find((t) => rule.types[t] === match[1]),
          size,
        },
        select: {
          id: true,
          kind: true,
          path: true,
          content_type: true,
          size: true,
          created_at: true,
        },
      });
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "MEDIA_ALREADY_ADDED");
    }
    if (
      error instanceof ResponseError &&
      (error.status === 404 || error.message === "MEDIA_LIMIT_REACHED")
    ) {
      await removeFiles([req.path]);
    }
    throw error;
  }

  const urls = await signPaths([created.path]);

  return {
    id: created.id,
    kind: created.kind,
    url: urls.get(created.path) ?? null,
    content_type: created.content_type,
    size: created.size,
    created_at: created.created_at,
  };
};

const deleteMedia = async (request) => {
  const req = validate(qcMediaIdValidation, request);

  const media = await prisma.qualityControlMedia.findFirst({
    where: { id: req.media_id, qc_id: req.id },
    select: { id: true, path: true },
  });
  if (!media) throw new ResponseError(404, "MEDIA_NOT_FOUND");

  await prisma.qualityControlMedia.deleteMany({
    where: { id: media.id, qc_id: req.id },
  });
  await removeFiles([media.path]);

  return { message: "MEDIA_DELETED" };
};

export default {
  getAllQc,
  getQc,
  createQc,
  updateQc,
  setStatus,
  deleteQc,
  createUploadUrl,
  addMedia,
  deleteMedia,
};
