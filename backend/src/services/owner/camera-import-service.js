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

// Prefix SKU hasil akhir. Ganti di sini kalau prefix atau panjang kodenya berubah.
const SKU_PREFIX = "LX-";
const SKU_CODE_LENGTH = 4;

// "LX-" -> "LX", dipakai untuk mendeteksi prefix yang nempel tanpa pemisah ("LX1234").
const SKU_PREFIX_WORD = SKU_PREFIX.replace(/[\s-]+$/, "").toUpperCase();

// Prefix = huruf di awal yang diikuti pemisah (spasi, strip, atau underscore).
// Contoh: "ABC-1234", "LX 1234", "xy_1234".
const SKU_PREFIX_WITH_SEPARATOR = /^([A-Z]+)[\s\-_]+(.+)$/;

// Mengubah SKU apa pun menjadi SKU_PREFIX + KODE (huruf besar, SKU_CODE_LENGTH karakter):
// - prefix apa pun (LX atau bukan) dibuang dan diganti SKU_PREFIX
// - spasi/strip/simbol di dalam kode dibuang
// - kode lebih panjang dari SKU_CODE_LENGTH dipotong, sisakan karakter pertama
// Kalau kode kurang dari SKU_CODE_LENGTH, nilai dibiarkan apa adanya
// supaya ditangani validasi biasa.
const normalizeSku = (value) => {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string") return value;

  const upper = text.trim().toUpperCase();
  const onlyAlphanumeric = (s) => s.replace(/[^A-Z0-9]/g, "");

  let code;
  const withSeparator = upper.match(SKU_PREFIX_WITH_SEPARATOR);

  if (withSeparator) {
    code = onlyAlphanumeric(withSeparator[2]);
  } else {
    code = onlyAlphanumeric(upper);

    // Prefix yang nempel tanpa pemisah ("LX1234"): dibuang hanya kalau
    // sisanya masih cukup panjang untuk jadi kode utuh.
    if (
      code.startsWith(SKU_PREFIX_WORD) &&
      code.length - SKU_PREFIX_WORD.length >= SKU_CODE_LENGTH
    ) {
      code = code.slice(SKU_PREFIX_WORD.length);
    }
  }

  if (code.length < SKU_CODE_LENGTH) return value;

  return `${SKU_PREFIX}${code.slice(0, SKU_CODE_LENGTH)}`;
};

const pairKey = (row) =>
  `${row.sku.toLowerCase()}\u0000${row.serial_number.toLowerCase()}`;

const validateRows = (rows) => {
  const cleaned = [];
  const rowErrors = [];

  rows.forEach((raw, index) => {
    // SKU dinormalkan dulu, jadi pengecekan duplikat di bawah juga memakai
    // bentuk yang sudah berprefix.
    const { value, error } = importCameraRowSchema.validate(
      { ...raw, sku: normalizeSku(raw?.sku) },
      {
        abortEarly: false,
        messages: ROW_MESSAGES,
      },
    );

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
