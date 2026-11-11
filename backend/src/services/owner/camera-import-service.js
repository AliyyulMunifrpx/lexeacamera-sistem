import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  ROW_MESSAGES,
  importCameraRowSchema,
  importCamerasValidation,
} from "../../validation/owner/camera-import-validation.js";
import { validate } from "../../validation/validation.js";

const CONDITION = {
  new: "NEW",
  baru: "NEW",
  second: "SECOND",
  bekas: "SECOND",
};

const pairKey = (row) =>
  `${row.sku.toLowerCase()}\u0000${row.serial_number.toLowerCase()}`;

const validateRows = (rows) => {
  const cleaned = [];
  const rowErrors = [];

  rows.forEach((raw, index) => {
    const { value, error } = importCameraRowSchema.validate(raw, {
      abortEarly: false,
      messages: ROW_MESSAGES,
    });

    if (error) {
      for (const detail of error.details) {
        rowErrors.push({
          row: index + 1,
          field: String(detail.path[0] ?? ""),
          message: detail.message,
        });
      }
      cleaned.push(null);
      return;
    }

    cleaned.push(value);
  });

  return { cleaned, rowErrors };
};

const importCameras = async (request) => {
  const req = validate(importCamerasValidation, request);
  const { cleaned, rowErrors } = validateRows(req.rows);

  const [categories, existing] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    (() => {
      const pairs = cleaned.filter(Boolean).map((row) => ({
        sku: { equals: row.sku, mode: "insensitive" },
        serial_number: { equals: row.serial_number, mode: "insensitive" },
      }));

      return pairs.length
        ? prisma.camera.findMany({
            where: { is_deleted: false, OR: pairs },
            select: { sku: true, serial_number: true },
          })
        : [];
    })(),
  ]);

  const categoryByName = new Map(
    categories.map((category) => [
      category.name.trim().toLowerCase(),
      category.id,
    ]),
  );
  const newCategories = new Map();
  const existingKeys = new Set(
    existing.map((camera) =>
      pairKey({ sku: camera.sku, serial_number: camera.serial_number }),
    ),
  );
  const seen = new Map();

  cleaned.forEach((row, index) => {
    if (!row) return;

    const categoryKey = row.category.toLowerCase();
    if (!categoryByName.has(categoryKey) && !newCategories.has(categoryKey)) {
      newCategories.set(categoryKey, row.category);
    }

    const key = pairKey(row);
    if (existingKeys.has(key)) {
      rowErrors.push({
        row: index + 1,
        field: "sku",
        message: "SKU dan serial number ini sudah ada di sistem",
      });
    }
    if (seen.has(key)) {
      rowErrors.push({
        row: index + 1,
        field: "sku",
        message: `SKU dan serial number sama dengan baris ${seen.get(key)}`,
      });
    } else {
      seen.set(key, index + 1);
    }
  });

  rowErrors.sort((a, b) => a.row - b.row);

  const errorRows = new Set(rowErrors.map((item) => item.row)).size;
  const summary = {
    total: req.rows.length,
    valid_rows: req.rows.length - errorRows,
    error_rows: errorRows,
  };

  const newCategoryNames = [...newCategories.values()];

  if (req.dry_run) {
    return {
      dry_run: true,
      valid: rowErrors.length === 0,
      ...summary,
      new_categories: newCategoryNames,
      row_errors: rowErrors,
    };
  }

  if (rowErrors.length > 0) {
    throw new ResponseError(400, "IMPORT_INVALID", {
      ...summary,
      row_errors: rowErrors,
    });
  }

  const created = await prisma.$transaction(
    async (tx) => {
      const idByName = new Map(categoryByName);

      if (newCategoryNames.length) {
        await tx.category.createMany({
          data: newCategoryNames.map((name) => ({ name })),
          skipDuplicates: true,
        });

        const all = await tx.category.findMany({
          select: { id: true, name: true },
        });
        for (const category of all) {
          idByName.set(category.name.trim().toLowerCase(), category.id);
        }
      }

      const { count } = await tx.camera.createMany({
        data: cleaned.map((row) => ({
          name: row.name,
          price: row.price,
          capital: row.capital,
          strikethrough_price: row.strikethrough_price,
          condition: CONDITION[row.condition],
          stock: row.stock,
          description: row.description,
          inclusions: row.inclusions,
          category_id: idByName.get(row.category.toLowerCase()),
          promo: row.promo,
          best_selling: row.best_selling,
          sku: row.sku,
          serial_number: row.serial_number,
          color: row.color,
          shutter_count: row.shutter_count,
        })),
      });

      return count;
    },
    { timeout: 15000 },
  );

  return {
    dry_run: false,
    created,
    categories_created: newCategoryNames,
  };
};

export default { importCameras };
