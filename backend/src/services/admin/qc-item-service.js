import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  createQcItemValidation,
  getAllQcItemValidation,
  qcItemIdValidation,
  updateQcItemValidation,
} from "../../validation/admin/qc-validation.js";
import { validate } from "../../validation/validation.js";

const SELECT = {
  id: true,
  section: true,
  name: true,
  is_active: true,
  sort_order: true,
};

const sameName = (section, name, excludeId) => ({
  section,
  name: { equals: name, mode: "insensitive" },
  ...(excludeId ? { id: { not: excludeId } } : {}),
});

const getItems = async (request) => {
  const req = validate(getAllQcItemValidation, request);

  const where = {};
  if (req.section) where.section = req.section;
  if (req.is_active !== undefined) where.is_active = req.is_active;

  const data = await prisma.qcItem.findMany({
    where,
    select: SELECT,
    orderBy: [{ section: "asc" }, { sort_order: "asc" }, { name: "asc" }],
  });

  return { data };
};

const createItem = async (request) => {
  const req = validate(createQcItemValidation, request);

  if (
    await prisma.qcItem.findFirst({ where: sameName(req.section, req.name) })
  ) {
    throw new ResponseError(409, "QC_ITEM_ALREADY_EXISTS");
  }

  let sortOrder = req.sort_order;
  if (sortOrder === undefined) {
    const last = await prisma.qcItem.aggregate({
      where: { section: req.section },
      _max: { sort_order: true },
    });
    sortOrder = (last._max.sort_order ?? 0) + 1;
  }

  try {
    return await prisma.qcItem.create({
      data: { section: req.section, name: req.name, sort_order: sortOrder },
      select: SELECT,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "QC_ITEM_ALREADY_EXISTS");
    }
    throw error;
  }
};

const updateItem = async (request) => {
  const req = validate(updateQcItemValidation, request);

  const item = await prisma.qcItem.findUnique({
    where: { id: req.id },
    select: { id: true, section: true },
  });
  if (!item) throw new ResponseError(404, "QC_ITEM_NOT_FOUND");

  if (
    req.name !== undefined &&
    (await prisma.qcItem.findFirst({
      where: sameName(item.section, req.name, req.id),
    }))
  ) {
    throw new ResponseError(409, "QC_ITEM_ALREADY_EXISTS");
  }

  const data = {};
  if (req.name !== undefined) data.name = req.name;
  if (req.is_active !== undefined) data.is_active = req.is_active;
  if (req.sort_order !== undefined) data.sort_order = req.sort_order;

  try {
    return await prisma.qcItem.update({
      where: { id: req.id },
      data,
      select: SELECT,
    });
  } catch (error) {
    if (error.code === "P2025")
      throw new ResponseError(404, "QC_ITEM_NOT_FOUND");
    if (error.code === "P2002") {
      throw new ResponseError(409, "QC_ITEM_ALREADY_EXISTS");
    }
    throw error;
  }
};

const deleteItem = async (request) => {
  const req = validate(qcItemIdValidation, request);

  try {
    await prisma.qcItem.delete({ where: { id: req.id } });
  } catch (error) {
    if (error.code === "P2025")
      throw new ResponseError(404, "QC_ITEM_NOT_FOUND");
    throw error;
  }

  return { message: "QC_ITEM_DELETED" };
};

export default { getItems, createItem, updateItem, deleteItem };
