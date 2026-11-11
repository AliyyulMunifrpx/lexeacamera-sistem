/* -------------------------------------------------------------------------- */
/*  Import produk dari Excel                                                  */
/*  Semua dikerjakan di browser: membuat template, membaca file, menyiapkan   */
/*  data. Server hanya menerima data yang sudah dibaca.                       */
/* -------------------------------------------------------------------------- */

export const IMPORT_CHUNK_SIZE = 200; // batas server per kiriman
export const IMPORT_MAX_ROWS = 2000;

export const DATA_SHEET = "Data kamera";
const GUIDE_SHEET = "Petunjuk";
const CATEGORY_SHEET = "Daftar kategori";

/* Kolom template. `key` = nama kolom yang dipakai sistem. */
export const IMPORT_COLUMNS = [
  {
    key: "name",
    label: "Nama kamera",
    required: true,
    width: 28,
    note: "Nama produk, maksimal 100 huruf.",
    example: "Canon EOS R6",
    aliases: ["nama", "namaproduk", "produk"],
  },
  {
    key: "category",
    label: "Kategori",
    required: true,
    width: 20,
    note: "Nama kategori produk. Kalau belum ada, akan dibuat otomatis.",
    example: "Mirrorless",
    aliases: ["kategoriproduk"],
  },
  {
    key: "price",
    label: "Harga jual",
    required: true,
    width: 16,
    numeric: true,
    note: "Angka saja, tanpa “Rp”.",
    example: 25000000,
    aliases: ["harga"],
  },
  {
    key: "capital",
    label: "Modal",
    required: true,
    width: 16,
    numeric: true,
    note: "Harga modal. Angka saja.",
    example: 20000000,
    aliases: ["modal", "hargamodal"],
  },
  {
    key: "strikethrough_price",
    label: "Harga coret",
    required: false,
    width: 16,
    numeric: true,
    note: "Boleh dikosongkan. Isi kalau produk punya harga coret.",
    example: 27000000,
    aliases: ["hargacoret"],
  },
  {
    key: "stock",
    label: "Stok",
    required: true,
    width: 10,
    numeric: true,
    note: "Jumlah barang yang tersedia. Isi 0 kalau habis.",
    example: 2,
    aliases: ["jumlahstok"],
  },
  {
    key: "condition",
    label: "Kondisi",
    required: false,
    width: 14,
    note: "Baru atau Bekas. Kalau dikosongkan dianggap Baru.",
    example: "Baru",
    list: ["Baru", "Bekas"],
  },
  {
    key: "sku",
    label: "SKU",
    required: true,
    width: 16,
    text: true,
    note: "Kode produk. Bersama serial number, tidak boleh sama dengan produk lain.",
    example: "R6-001",
  },
  {
    key: "serial_number",
    label: "Serial number",
    required: true,
    width: 18,
    text: true,
    note: "Nomor seri unit.",
    example: "SN123456",
    aliases: ["serial", "nomorseri", "noseri"],
  },
  {
    key: "color",
    label: "Warna",
    required: true,
    width: 14,
    note: "Warna produk.",
    example: "Hitam",
  },
  {
    key: "shutter_count",
    label: "Shutter count",
    required: true,
    width: 16,
    text: true,
    note: "Jumlah jepretan, misalnya 1200. Isi 0 untuk barang baru.",
    example: "1200",
    aliases: ["jumlahjepretan", "shutter"],
  },
  {
    key: "description",
    label: "Deskripsi",
    required: false,
    width: 36,
    note: "Boleh dikosongkan. Maksimal 1000 huruf.",
    example: "Kondisi mulus",
    aliases: ["keterangan"],
  },
  {
    key: "inclusions",
    label: "Kelengkapan",
    required: false,
    width: 28,
    note: "Boleh dikosongkan. Contoh: Box, charger, strap.",
    example: "Box, charger, strap",
  },
  {
    key: "promo",
    label: "Promo",
    required: false,
    width: 12,
    note: "Ya atau Tidak. Kalau dikosongkan dianggap Tidak.",
    example: "Ya",
    list: ["Ya", "Tidak"],
  },
  {
    key: "best_selling",
    label: "Terlaris",
    required: false,
    width: 12,
    note: "Ya atau Tidak. Kalau dikosongkan dianggap Tidak.",
    example: "Tidak",
    list: ["Ya", "Tidak"],
    aliases: ["bestselling", "produkterlaris"],
  },
];

/* Nama kolom di Excel untuk pesan kesalahan. */
export const FIELD_LABEL = Object.fromEntries(
  IMPORT_COLUMNS.map((column) => [column.key, column.label]),
);

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_LOOKUP = (() => {
  const map = new Map();
  for (const column of IMPORT_COLUMNS) {
    for (const name of [column.label, column.key, ...(column.aliases ?? [])]) {
      map.set(normalizeHeader(name), column.key);
    }
  }
  return map;
})();

/* -------------------------------- Template -------------------------------- */

/* ExcelJS dikirim dari luar supaya file ini ringan dan mudah dites. */
export function buildTemplateWorkbook(ExcelJS, categoryNames = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "wav camera";

  /* Lembar 1: tempat mengisi data */
  const sheet = workbook.addWorksheet(DATA_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = IMPORT_COLUMNS.map((column) => ({
    header: column.required ? `${column.label} *` : column.label,
    key: column.key,
    width: column.width,
    style: column.text ? { numFmt: "@" } : {},
  }));

  const header = sheet.getRow(1);
  header.height = 32;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111111" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  const lastRow = IMPORT_MAX_ROWS + 1;
  const cleanNames = categoryNames.filter(Boolean);

  IMPORT_COLUMNS.forEach((column, index) => {
    const letter = sheet.getColumn(index + 1).letter;
    let validation = null;

    if (column.list) {
      validation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${column.list.join(",")}"`],
        showErrorMessage: true,
        errorTitle: column.label,
        error: `Pilih salah satu: ${column.list.join(" atau ")}.`,
      };
    } else if (column.key === "category" && cleanNames.length > 0) {
      validation = {
        type: "list",
        allowBlank: true,
        formulae: [`'${CATEGORY_SHEET}'!$A$2:$A$${cleanNames.length + 1}`],
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Kategori baru",
        error:
          "Kategori ini belum ada di daftar. Kalau lanjut, kategori baru akan dibuat. Pastikan ejaannya benar.",
      };
    } else if (column.numeric) {
      validation = {
        type: "whole",
        operator: "greaterThanOrEqual",
        formulae: [0],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: column.label,
        error: "Isi dengan angka bulat, tanpa titik, koma, atau “Rp”.",
      };
    }

    if (!validation) return;
    for (let row = 2; row <= lastRow; row += 1) {
      sheet.getCell(`${letter}${row}`).dataValidation = validation;
    }
  });

  /* Lembar 2: petunjuk */
  const guide = workbook.addWorksheet(GUIDE_SHEET);
  guide.columns = [{ width: 22 }, { width: 14 }, { width: 70 }, { width: 22 }];

  guide.addRow(["Cara mengisi template"]).font = { bold: true, size: 14 };
  guide.addRow([]);
  [
    "1. Isi data produk di lembar “Data kamera”. Satu baris = satu produk.",
    "2. Kolom bertanda * wajib diisi. Kolom lain boleh dikosongkan.",
    "3. Jangan mengubah, menghapus, atau memindahkan judul kolom di baris pertama.",
    "4. Simpan sebagai file Excel (.xlsx), lalu unggah di halaman import.",
    "5. Kalau ada baris yang salah, sistem akan memberi tahu baris dan kolomnya. Belum ada produk yang tersimpan sampai semua baris benar.",
    "6. Produk hasil import belum punya foto. Tambahkan foto dari halaman produk. Sebelum ada foto, produk belum tampil di katalog toko.",
  ].forEach((text) => guide.addRow([text]));

  guide.addRow([]);
  const tableHeader = guide.addRow([
    "Kolom",
    "Wajib?",
    "Cara mengisi",
    "Contoh",
  ]);
  tableHeader.font = { bold: true };

  IMPORT_COLUMNS.forEach((column) => {
    guide.addRow([
      column.label,
      column.required ? "Ya" : "Tidak",
      column.note,
      column.example,
    ]);
  });

  /* Lembar 3: daftar kategori yang sudah ada */
  if (cleanNames.length > 0) {
    const categories = workbook.addWorksheet(CATEGORY_SHEET);
    categories.columns = [{ header: "Nama kategori", width: 30 }];
    categories.getRow(1).font = { bold: true };
    cleanNames.forEach((name) => categories.addRow([name]));
  }

  return workbook;
}

export async function downloadImportTemplate(categoryNames = []) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = buildTemplateWorkbook(ExcelJS, categoryNames);
  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "template-import-produk.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------- Membaca file Excel --------------------------- */

function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    }
    if ("result" in value) return cellText(value.result);
    if (typeof value.text === "string") return value.text.trim();
    return "";
  }
  return String(value).trim();
}

function cleanNumber(text) {
  let value = text.replace(/rp\.?/gi, "").replace(/\s/g, "");
  if (value === "") return "";

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) {
    value = value.replace(/,/g, "");
  } else {
    value = value.replace(",", ".");
  }

  return value.replace(/^(\d+)\.0+$/, "$1");
}

function cleanChoice(text, yes, no, yesLabel, noLabel) {
  const value = text.toLowerCase();
  if (yes.includes(value)) return yesLabel;
  if (no.includes(value)) return noLabel;
  return text;
}

const YES = ["ya", "y", "yes", "true", "1"];
const NO = ["tidak", "t", "no", "n", "false", "0"];

function cleanValue(key, text) {
  if (text === "") return "";
  const column = IMPORT_COLUMNS.find((item) => item.key === key);
  if (column?.numeric) return cleanNumber(text);
  if (key === "promo" || key === "best_selling") {
    return cleanChoice(text, YES, NO, "Ya", "Tidak");
  }
  if (key === "condition") {
    return cleanChoice(
      text,
      ["baru", "new"],
      ["bekas", "second", "seken"],
      "Baru",
      "Bekas",
    );
  }
  return text;
}

/* Mengembalikan:
   { rows, excelRows, ignoredHeaders, missingHeaders, error } */
export function parseCameraRows(ExcelJS, arrayBuffer) {
  return new ExcelJS.Workbook().xlsx.load(arrayBuffer).then((workbook) => {
    const sheet =
      workbook.getWorksheet(DATA_SHEET) ?? workbook.worksheets[0] ?? null;

    if (!sheet) {
      return { error: "File ini tidak punya lembar data." };
    }

    /* Cari baris judul di 10 baris pertama */
    let headerRowNumber = 0;
    let bestMatches = 0;
    const limit = Math.min(10, sheet.rowCount);

    for (let rowNumber = 1; rowNumber <= limit; rowNumber += 1) {
      let matches = 0;
      sheet.getRow(rowNumber).eachCell((cell) => {
        if (HEADER_LOOKUP.has(normalizeHeader(cellText(cell.value)))) {
          matches += 1;
        }
      });
      if (matches > bestMatches) {
        bestMatches = matches;
        headerRowNumber = rowNumber;
      }
    }

    if (bestMatches < 3) {
      return {
        error:
          "Judul kolom tidak dikenali. Gunakan template dari halaman ini dan jangan ubah baris judulnya.",
      };
    }

    const columnByIndex = new Map();
    const ignoredHeaders = [];

    sheet.getRow(headerRowNumber).eachCell((cell, colNumber) => {
      const raw = cellText(cell.value);
      if (!raw) return;
      const key = HEADER_LOOKUP.get(normalizeHeader(raw));
      if (key && ![...columnByIndex.values()].includes(key)) {
        columnByIndex.set(colNumber, key);
      } else {
        ignoredHeaders.push(raw);
      }
    });

    const present = new Set(columnByIndex.values());
    const missingHeaders = IMPORT_COLUMNS.filter(
      (column) => column.required && !present.has(column.key),
    ).map((column) => column.label);

    const rows = [];
    const excelRows = [];

    for (
      let rowNumber = headerRowNumber + 1;
      rowNumber <= sheet.rowCount;
      rowNumber += 1
    ) {
      const row = sheet.getRow(rowNumber);
      const item = {};
      let hasData = false;

      for (const [colNumber, key] of columnByIndex) {
        const text = cellText(row.getCell(colNumber).value);
        if (text !== "") hasData = true;
        item[key] = cleanValue(key, text);
      }

      if (!hasData) continue;
      rows.push(item);
      excelRows.push(rowNumber);
    }

    return { rows, excelRows, ignoredHeaders, missingHeaders };
  });
}

export async function parseCameraFile(file) {
  const ExcelJS = (await import("exceljs")).default;
  const buffer = await file.arrayBuffer();
  return parseCameraRows(ExcelJS, buffer);
}

/* ------------------------------ Pemeriksaan ------------------------------- */

/* Pasangan SKU + serial number yang muncul lebih dari sekali di file.
   Dicek untuk seluruh file, karena server hanya melihat 200 baris sekali kirim. */
export function findFileDuplicates(rows, excelRows) {
  const seen = new Map();
  const problems = [];

  rows.forEach((row, index) => {
    const sku = String(row.sku ?? "")
      .trim()
      .toLowerCase();
    const serial = String(row.serial_number ?? "")
      .trim()
      .toLowerCase();
    if (!sku || !serial) return;

    const key = `${sku}\u0000${serial}`;
    if (seen.has(key)) {
      problems.push({
        excelRow: excelRows[index],
        field: "sku",
        message: `SKU dan serial number ini sama dengan baris ${seen.get(key)}. Satu produk hanya boleh muncul sekali.`,
        isDuplicate: true,
      });
    } else {
      seen.set(key, excelRows[index]);
    }
  });

  return problems;
}

export function chunkRows(rows, size = IMPORT_CHUNK_SIZE) {
  const chunks = [];
  for (let start = 0; start < rows.length; start += size) {
    chunks.push(rows.slice(start, start + size));
  }
  return chunks;
}

/* Ubah kesalahan dari server (nomor baris per kiriman) menjadi baris Excel. */
export function toProblems(rowErrors, chunkIndex, excelRows) {
  return (rowErrors ?? []).map((error) => {
    const globalIndex =
      chunkIndex * IMPORT_CHUNK_SIZE + (Number(error.row) - 1);
    return {
      excelRow: excelRows[globalIndex] ?? null,
      field: error.field,
      message: String(error.message ?? "Data tidak valid."),
    };
  });
}

/* Gabungkan kesalahan lokal dan server tanpa laporan ganda untuk duplikat. */
export function mergeProblems(local, server) {
  const duplicateRows = new Set(local.map((problem) => problem.excelRow));
  const kept = server.filter(
    (problem) =>
      !(
        duplicateRows.has(problem.excelRow) &&
        (problem.field === "sku" || problem.field === "serial_number")
      ),
  );

  return [...local, ...kept].sort(
    (a, b) => (a.excelRow ?? 0) - (b.excelRow ?? 0),
  );
}

export function mergeCategoryNames(current, incoming) {
  const seen = new Set(current.map((name) => name.toLowerCase()));
  const next = [...current];
  for (const name of incoming ?? []) {
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      next.push(name);
    }
  }
  return next;
}
