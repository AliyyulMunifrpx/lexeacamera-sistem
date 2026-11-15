import { jsPDF } from "jspdf";

import {
  CLASS_LABEL,
  ORIGIN_LABEL,
  SECTIONS,
  STATUS_LABEL,
  TYPE_LABEL,
  formatDate,
  formatRupiah,
} from "./qc-shared.jsx";

/* Gaya sama dengan PDF invoice dan slip gaji, warna: #3a0718 dan #6c1b30. */
const PDF_COLORS = {
  dark: [58, 7, 24], // #3a0718
  accent: [108, 27, 48], // #6c1b30
  text: [0, 0, 0],
  muted: [102, 102, 102],
  faint: [153, 153, 153],
  line: [232, 226, 227],
  border: [217, 217, 217],
  tint: [249, 240, 242],
  zebra: [251, 246, 247],
  onDark: [236, 214, 221],
  white: [255, 255, 255],
  green: [21, 128, 61],
  red: [200, 30, 30],
};

const SECTION_FIELD = {
  PHYSICAL: "physical",
  FUNCTION: "functions",
  ACCESSORY: "accessories",
  COMPLETENESS: "completeness",
};

const VALUE_HEADER = {
  PHYSICAL: "KERUSAKAN",
  FUNCTION: "KONDISI",
  ACCESSORY: "KONDISI",
  COMPLETENESS: "KELENGKAPAN",
};

const LOGO_MAX_SIDE = 400;

/**
 * Memuat gambar lalu mengubahnya ke PNG lewat canvas, supaya format apa pun
 * (webp, svg, dll) bisa dipakai jsPDF. Null kalau gagal -> PDF tanpa logo.
 */
async function loadPdfImage(src) {
  if (!src) return null;

  let objectUrl = null;

  try {
    let url = src;

    if (!src.startsWith("data:")) {
      const response = await fetch(src);
      if (!response.ok) return null;

      objectUrl = URL.createObjectURL(await response.blob());
      url = objectUrl;
    }

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const ratio = Math.min(
      1,
      LOGO_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

    return { data: canvas.toDataURL("image/png"), format: "PNG" };
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function displayValue(value) {
  return hasValue(value) ? String(value) : "-";
}

/* Ambil nilai pertama yang terisi dari beberapa kemungkinan nama field. */
function pickStoreValue(store, keys) {
  for (const key of keys) {
    const value = store?.[key];
    if (hasValue(value)) return String(value).trim();
  }
  return "";
}

/* Terima "wav.camera", "@wav.camera", atau URL instagram.com/wav.camera -> "@wav.camera" */
function formatInstagram(value) {
  const handle = String(value ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
  return handle ? `@${handle}` : "";
}

function formatPrintDate() {
  return `${new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date())} WIB`;
}

function buildFileName(qc) {
  const name = String(qc.product_name || "produk")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const date = String(qc.date ?? "").slice(0, 10) || "tanpa-tanggal";
  return `QC-${name || "produk"}-${date}.pdf`;
}

/**
 * @param {{ qc: object, store?: object }} params
 */
export async function downloadQcPdf({ qc, store: rawStore }) {
  const store = rawStore?.data ?? rawStore;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  doc.setProperties({
    title: `QC ${qc.product_name ?? ""}`.trim(),
    subject: `Quality control ${store?.name ?? ""}`.trim(),
  });

  const C = PDF_COLORS;
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentRight = pageWidth - margin;
  const contentWidth = contentRight - margin;
  const rightColX = 106;
  const topStart = 12;
  const bottomLimit = pageHeight - 17;
  let y = 0;

  const logo = await loadPdfImage(store?.logo_url);

  /* ---------- Helper gambar ---------- */

  function put(
    text,
    x,
    yy,
    { size = 9, bold = false, color = C.text, align = "left", maxWidth } = {},
  ) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);

    if (maxWidth) {
      const lines = doc.splitTextToSize(String(text), maxWidth);
      doc.text(lines, x, yy, { align });
      return lines.length;
    }

    doc.text(String(text), x, yy, { align });
    return 1;
  }

  function wrap(text, size, bold, maxWidth) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    return doc.splitTextToSize(String(text), maxWidth);
  }

  /* Potong teks satu baris dengan "…" bila melebihi lebar. */
  function fitText(text, size, bold, maxWidth) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);

    let value = String(text);
    if (doc.getTextWidth(value) <= maxWidth) return value;

    while (value.length > 1 && doc.getTextWidth(`${value}…`) > maxWidth) {
      value = value.slice(0, -1);
    }
    return `${value.trimEnd()}…`;
  }

  /* Gradient horizontal: #3a0718 di kiri, #6c1b30 di kanan. */
  function gradientRect(x, yy, w, h) {
    const steps = Math.max(2, Math.ceil(w / 0.8));
    const stepW = w / steps;

    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      doc.setFillColor(
        Math.round(C.dark[0] + (C.accent[0] - C.dark[0]) * t),
        Math.round(C.dark[1] + (C.accent[1] - C.dark[1]) * t),
        Math.round(C.dark[2] + (C.accent[2] - C.dark[2]) * t),
      );
      doc.rect(x + i * stepW, yy, stepW + 0.25, h, "F");
    }
  }

  function fitImage(image, x, yy, boxW, boxH) {
    const props = doc.getImageProperties(image.data);
    const ratio = Math.min(boxW / props.width, boxH / props.height);
    const w = props.width * ratio;
    const h = props.height * ratio;
    doc.addImage(
      image.data,
      image.format,
      x + (boxW - w) / 2,
      yy + (boxH - h) / 2,
      w,
      h,
    );
  }

  function hLine(yy, color = C.line, x1 = margin, x2 = contentRight) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.2);
    doc.line(x1, yy, x2, yy);
  }

  function pill(text, x, yy, { color, tint, align = "left" }) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const w = doc.getTextWidth(text) + 8;
    const startX = align === "right" ? x - w : x;

    doc.setFillColor(...tint);
    doc.roundedRect(startX, yy, w, 5.4, 2.7, 2.7, "F");
    put(text, startX + w / 2, yy + 3.8, {
      size: 7,
      bold: true,
      color,
      align: "center",
    });

    return w;
  }

  function sectionLabel(text, x, yy) {
    put(text, x, yy, { size: 7, bold: true, color: C.accent });
  }

  function newPage() {
    doc.addPage();
    gradientRect(0, 0, pageWidth, 2.5);
    y = topStart;
  }

  function ensure(height) {
    if (y + height > bottomLimit) newPage();
  }

  /* Warna nilai tabel dari "tone" yang dipakai di UI. */
  function toneColor(tone) {
    return (
      {
        red: C.red,
        failure: C.red,
        blue: C.green,
        success: C.green,
        violet: C.accent,
        pending: C.accent,
        strong: C.accent,
      }[tone] ?? C.muted
    );
  }

  /* ---------- Data turunan ---------- */
  const isDeal = qc.status === "DEAL";
  const statusInfo = STATUS_LABEL[qc.status] ?? STATUS_LABEL.CANCEL;
  const statusLabel = String(
    statusInfo?.label ?? qc.status ?? "-",
  ).toUpperCase();
  const statusColor = isDeal ? C.green : C.accent;

  /* ---------- Halaman 1: header band ---------- */
  const logoSize = 16;
  const logoY = 9;
  const storeX = margin + logoSize + 5;

  const storeNameLines = wrap(
    String(store?.name || "-").toUpperCase(),
    12,
    true,
    74,
  );

  const storeAddress = pickStoreValue(store, [
    "address",
    "store_address",
    "alamat",
    "full_address",
    "location",
  ]);
  const storePhone = pickStoreValue(store, [
    "phone",
    "phone_number",
    "telephone",
    "telp",
    "whatsapp",
    "mobile",
    "contact",
  ]);
  const storeEmail = pickStoreValue(store, [
    "email",
    "store_email",
    "contact_email",
  ]);
  const storeInstagram = formatInstagram(
    pickStoreValue(store, ["instagram", "instagram_handle", "ig"]),
  );

  const storeInfo = [
    storeInstagram,
    storeAddress,
    [storePhone && `Telp: ${storePhone}`, storeEmail]
      .filter(Boolean)
      .join("   |   "),
  ].filter(Boolean);

  const nameBaseline = 15;
  let storeBottom = nameBaseline + (storeNameLines.length - 1) * 5;
  const infoBlocks = storeInfo.map((text) => {
    const lines = wrap(text, 7, false, 74);
    storeBottom += 4;
    const block = { lines, baseline: storeBottom };
    storeBottom += (lines.length - 1) * 3.2;
    return block;
  });

  const bandH = Math.max(logoY + logoSize + 7, storeBottom + 6, 36);

  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pageWidth, bandH, "F");
  gradientRect(0, bandH, pageWidth, 1.6);

  // Kotak logo putih
  doc.setFillColor(...C.white);
  doc.roundedRect(margin, logoY, logoSize, logoSize, 2.5, 2.5, "F");

  if (logo) {
    fitImage(logo, margin + 1.5, logoY + 1.5, logoSize - 3, logoSize - 3);
  } else {
    put(
      String(store?.name || "S")
        .charAt(0)
        .toUpperCase(),
      margin + logoSize / 2,
      logoY + 11,
      { size: 16, bold: true, color: C.dark, align: "center" },
    );
  }

  put(storeNameLines.join("\n"), storeX, nameBaseline, {
    size: 12,
    bold: true,
    color: C.white,
  });

  infoBlocks.forEach((block) => {
    put(block.lines.join("\n"), storeX, block.baseline, {
      size: 7,
      color: C.onDark,
    });
  });

  put("QUALITY CONTROL", contentRight, 19, {
    size: 17,
    bold: true,
    color: C.white,
    align: "right",
  });
  put(`Tanggal ${formatDate(qc.date)}`, contentRight, 25, {
    size: 8,
    color: C.onDark,
    align: "right",
  });
  pill(statusLabel, contentRight, 28, {
    color: statusColor,
    tint: C.white,
    align: "right",
  });

  /* ---------- Produk + info unit ---------- */
  const infoY = bandH + 1.6 + 8;
  const colGap = 8;
  const leftW = rightColX - margin - colGap;
  const rightW = contentRight - rightColX;

  const productLines = wrap(displayValue(qc.product_name), 12, true, leftW);
  const metaText = [TYPE_LABEL[qc.type], formatDate(qc.date)]
    .filter(Boolean)
    .join("   ·   ");

  const nameBase = infoY + 12;
  const metaY = nameBase + (productLines.length - 1) * 5.2 + 5;
  const tilesY = metaY + 5;
  const tileH = 15;
  const leftBottom = tilesY + tileH;

  const detailRows = [
    ["Harga", qc.price == null ? "-" : formatRupiah(qc.price)],
    ["Serial number", displayValue(qc.serial_number)],
    ["Pengirim", displayValue(qc.sender_name)],
    ["Nomor resi", displayValue(qc.tracking_number)],
    ["PIC", displayValue(qc.pic)],
  ];

  const rowGap = 5;
  const rightContentH = 11 + detailRows.length * rowGap + 1;
  const panelH = Math.max(leftBottom - infoY, rightContentH, 22);

  // Kolom kiri: tanpa kotak, garis aksen di atas label.
  doc.setFillColor(...C.accent);
  doc.rect(margin, infoY, 10, 0.9, "F");
  sectionLabel("PRODUK", margin, infoY + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.text);
  doc.text(productLines, margin, nameBase);

  put(metaText, margin, metaY, { size: 7.5, color: C.muted, maxWidth: leftW });

  // Dua kotak hitungan
  const tileW = (leftW - 4) / 2;
  [
    ["KERUSAKAN FISIK", qc.defect_count],
    ["MINOR", qc.minor_count],
  ].forEach(([label, value], index) => {
    const tx = margin + index * (tileW + 4);
    doc.setFillColor(...C.tint);
    doc.rect(tx, tilesY, tileW, tileH, "F");
    doc.setFillColor(...C.dark);
    doc.rect(tx, tilesY, 1.2, tileH, "F");
    put(label, tx + 5, tilesY + 5, { size: 6.5, bold: true, color: C.muted });
    put(String(value ?? 0), tx + 5, tilesY + 12, {
      size: 14,
      bold: true,
      color: C.dark,
    });
  });

  // Kolom kanan: kotak tint dengan bar tua di kiri.
  doc.setFillColor(...C.tint);
  doc.rect(rightColX, infoY, rightW, panelH, "F");
  doc.setFillColor(...C.dark);
  doc.rect(rightColX, infoY, 1.4, panelH, "F");

  sectionLabel("INFO UNIT", rightColX + 6, infoY + 5.5);

  detailRows.forEach(([label, value], index) => {
    const rowY = infoY + 11 + index * rowGap;
    put(label, rightColX + 6, rowY, { size: 7.5, color: C.muted });
    put(fitText(value, 7.5, true, 50), contentRight - 4, rowY, {
      size: 7.5,
      bold: true,
      align: "right",
    });
    if (index < detailRows.length - 1) {
      hLine(rowY + 1.7, C.line, rightColX + 6, contentRight - 4);
    }
  });

  y = infoY + panelH + 8;

  /* ---------- Helper bagian + tabel ---------- */
  const tableHeaderH = 7.5;

  function sectionHeading(label, countLabel) {
    doc.setFillColor(...C.accent);
    doc.rect(margin, y, 10, 0.9, "F");
    put(label.toUpperCase(), margin, y + 5.5, {
      size: 8.5,
      bold: true,
      color: C.dark,
    });
    put(countLabel, contentRight, y + 5.5, {
      size: 7.5,
      color: C.muted,
      align: "right",
    });
    y += 9;
  }

  /**
   * rows: [{ name, note?, value?: { text, color } }]
   */
  function renderTable({ numbered = false, nameHeader, valueHeader, rows }) {
    const colName = numbered ? margin + 13 : margin + 5;
    const valueX = contentRight - 4;
    const nameWidth = valueHeader ? 105 : contentWidth - 20;

    function drawHeader(yy) {
      doc.setFillColor(...C.dark);
      doc.rect(margin, yy, contentWidth, tableHeaderH, "F");
      doc.setFillColor(...C.accent);
      doc.rect(margin, yy, 1.4, tableHeaderH, "F");

      const opt = { size: 7.5, bold: true, color: C.white };
      if (numbered) put("NO", margin + 5, yy + 5, opt);
      put(nameHeader, colName, yy + 5, opt);
      if (valueHeader) {
        put(valueHeader, valueX, yy + 5, { ...opt, align: "right" });
      }
    }

    ensure(tableHeaderH + 10);
    drawHeader(y);
    y += tableHeaderH;

    rows.forEach((row, index) => {
      const nameLines = wrap(displayValue(row.name), 8.5, true, nameWidth);
      const noteLines = hasValue(row.note)
        ? wrap(row.note, 7, false, nameWidth)
        : [];

      const rowH = Math.max(
        2.6 + nameLines.length * 3.6 + noteLines.length * 3 + 1.6,
        7,
      );

      if (y + rowH > bottomLimit) {
        newPage();
        drawHeader(y);
        y += tableHeaderH;
      }

      // Baris selang-seling
      if (index % 2 === 1) {
        doc.setFillColor(...C.zebra);
        doc.rect(margin, y, contentWidth, rowH, "F");
      }

      const baseY = y + 4.6;

      if (numbered) {
        put(String(index + 1), margin + 5, baseY, { size: 8, color: C.muted });
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...C.text);
      doc.text(nameLines, colName, baseY);

      if (noteLines.length > 0) {
        const afterName = baseY + (nameLines.length - 1) * 3.6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text(noteLines, colName, afterName + 3.2);
      }

      if (row.value) {
        put(fitText(row.value.text, 8, true, 55), valueX, baseY, {
          size: 8,
          bold: true,
          color: row.value.color,
          align: "right",
        });
      }

      y += rowH;
      hLine(y);
    });

    // Garis penutup tabel
    doc.setDrawColor(...C.dark);
    doc.setLineWidth(0.5);
    doc.line(margin, y, contentRight, y);
    y += 8;
  }

  function entryValue(section, entry) {
    if (section === "PHYSICAL") {
      return entry.checked
        ? { text: "Ada kerusakan", color: C.red }
        : { text: "Tidak ada", color: C.muted };
    }

    if (section === "COMPLETENESS") {
      return entry.checked
        ? {
            text: `Ada${entry.origin ? ` · ${ORIGIN_LABEL[entry.origin] ?? entry.origin}` : ""}`,
            color: C.green,
          }
        : { text: "Tidak ada", color: C.muted };
    }

    const info = CLASS_LABEL[entry.classification] ?? CLASS_LABEL.NORMAL;
    return {
      text: info?.label ?? "-",
      color: toneColor(info?.tone),
    };
  }

  /* ---------- Checklist per bagian ---------- */
  SECTIONS.forEach((section) => {
    const entries = qc[SECTION_FIELD[section.value]] ?? [];

    ensure(9 + tableHeaderH + 10);
    sectionHeading(section.label, `${entries.length} item`);

    if (entries.length === 0) {
      put("Tidak ada isian.", margin, y + 1, { size: 8.5, color: C.muted });
      y += 10;
      return;
    }

    renderTable({
      nameHeader: "ITEM",
      valueHeader: VALUE_HEADER[section.value],
      rows: entries.map((entry) => ({
        name: entry.name,
        note: entry.note,
        value: entryValue(section.value, entry),
      })),
    });
  });

  /* ---------- Tambahan ---------- */
  const extras = qc.extras ?? [];

  ensure(9 + tableHeaderH + 10);
  sectionHeading("Tambahan", `${extras.length} barang`);

  if (extras.length === 0) {
    put("Tidak ada tambahan.", margin, y + 1, { size: 8.5, color: C.muted });
    y += 10;
  } else {
    renderTable({
      numbered: true,
      nameHeader: "NAMA BARANG",
      rows: extras.map((extra) => ({ name: extra.name })),
    });
  }

  /* ---------- Footer & nomor halaman di setiap halaman ---------- */
  const totalPages = doc.getNumberOfPages();
  const footerText = [store?.name, `Dicetak ${formatPrintDate()}`]
    .filter(Boolean)
    .join("   |   ");

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);

    hLine(pageHeight - 13, C.border);
    put(footerText, margin, pageHeight - 8.5, {
      size: 7,
      color: C.faint,
      maxWidth: 140,
    });
    put(`Halaman ${page} dari ${totalPages}`, contentRight, pageHeight - 8.5, {
      size: 7,
      color: C.faint,
      align: "right",
    });

    // Strip bawah
    doc.setFillColor(...C.dark);
    doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, "F");
  }

  doc.save(buildFileName(qc));
}
