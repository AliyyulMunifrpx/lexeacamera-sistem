import { jsPDF } from "jspdf";

import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "./payroll-shared.jsx";

/* Palet sama dengan PDF invoice (global.css). */
const PDF_COLORS = {
  gradDark: [123, 10, 103], // #7b0a67
  gradLight: [222, 35, 232], // #de23e8
  text: [0, 0, 0],
  muted: [102, 102, 102],
  faint: [153, 153, 153],
  line: [230, 230, 230],
  border: [217, 217, 217],
  panel: [245, 245, 245],
  white: [255, 255, 255],
  blue: [37, 99, 235],
  blueTint: [235, 240, 253],
  violet: [124, 58, 237],
  violetTint: [242, 238, 254],
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

function buildFileName(slip) {
  const name = String(slip.employee_name || "karyawan")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = slip.disbursement_date?.slice(0, 10) ?? "belum-cair";
  return `Slip-Gaji-${name}-${date}.pdf`;
}

/**
 * @param {{ slip: object, store?: object, ownerName?: string }} params
 */
export async function downloadPayrollPdf({ slip, store, ownerName }) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  doc.setProperties({
    title: `Slip Gaji ${slip.employee_name ?? ""}`.trim(),
    subject: `Slip Gaji ${store?.name ?? ""}`.trim(),
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

  /* Gradient horizontal: gelap di kiri, terang di kanan (seperti bg-grad). */
  function gradientRect(x, yy, w, h) {
    const steps = Math.max(2, Math.ceil(w / 0.8));
    const stepW = w / steps;

    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      doc.setFillColor(
        Math.round(C.gradDark[0] + (C.gradLight[0] - C.gradDark[0]) * t),
        Math.round(C.gradDark[1] + (C.gradLight[1] - C.gradDark[1]) * t),
        Math.round(C.gradDark[2] + (C.gradLight[2] - C.gradDark[2]) * t),
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
    const w = doc.getTextWidth(text) + 7;
    const startX = align === "right" ? x - w : x;

    doc.setFillColor(...tint);
    doc.roundedRect(startX, yy, w, 5.2, 2.6, 2.6, "F");
    put(text, startX + w / 2, yy + 3.7, {
      size: 7,
      bold: true,
      color,
      align: "center",
    });

    return w;
  }

  function sectionLabel(text, x, yy) {
    put(text, x, yy, { size: 7, bold: true, color: C.muted });
  }

  /* Kotak centang digambar manual (font bawaan PDF tidak punya simbol ✓). */
  function checkbox(cx, cy, checked) {
    const size = 3.6;
    const x = cx - size / 2;
    const top = cy - size / 2;

    if (checked) {
      doc.setFillColor(...C.violet);
      doc.roundedRect(x, top, size, size, 0.7, 0.7, "F");

      doc.setDrawColor(...C.white);
      doc.setLineWidth(0.45);
      doc.line(x + 0.8, cy + 0.1, x + 1.5, cy + 0.9);
      doc.line(x + 1.5, cy + 0.9, x + 2.85, cy - 0.9);
    } else {
      doc.setDrawColor(...C.faint);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, top, size, size, 0.7, 0.7, "S");
    }
  }

  function newPage() {
    doc.addPage();
    gradientRect(0, 0, pageWidth, 2.5);
    y = topStart;
  }

  function ensure(height) {
    if (y + height > bottomLimit) newPage();
  }

  /* ---------- Data turunan ---------- */
  const items = slip.items ?? [];
  const checkedCount = items.filter((item) => item.checked).length;
  const isPaid = slip.status === "PAID";
  const statusLabel = isPaid ? "SUDAH CAIR" : "BELUM CAIR";
  const statusColor = isPaid ? C.blue : C.violet;
  const statusTint = isPaid ? C.blueTint : C.violetTint;

  /* ---------- Halaman 1: bar gradient + header ---------- */
  gradientRect(0, 0, pageWidth, 2.5);

  const logoSize = 13;
  const logoY = 8;

  if (logo) {
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, logoY, logoSize, logoSize, 2, 2, "S");
    fitImage(logo, margin + 1, logoY + 1, logoSize - 2, logoSize - 2);
  } else {
    gradientRect(margin, logoY, logoSize, logoSize);
    put(
      String(store?.name || "S")
        .charAt(0)
        .toUpperCase(),
      margin + logoSize / 2,
      logoY + 9,
      { size: 14, bold: true, color: C.white, align: "center" },
    );
  }

  const storeX = margin + logoSize + 4;
  const storeLines = put(
    String(store?.name || "-").toUpperCase(),
    storeX,
    logoY + 8,
    { size: 11.5, bold: true, maxWidth: 74 },
  );
  const storeBottom = logoY + 8 + (storeLines - 1) * 4.4;

  put("SLIP GAJI", contentRight, 16, {
    size: 22,
    bold: true,
    align: "right",
  });
  put(`Dibuat ${formatDate(slip.created_at)}`, contentRight, 21.5, {
    size: 8,
    color: C.muted,
    align: "right",
  });
  pill(statusLabel, contentRight, 24, {
    color: statusColor,
    tint: statusTint,
    align: "right",
  });

  const headerBottom = Math.max(logoY + logoSize, storeBottom, 30);
  hLine(headerBottom + 2, C.border);

  /* ---------- Karyawan + detail slip ---------- */
  const infoY = headerBottom + 6;
  const colGap = 6;
  const leftW = rightColX - margin - colGap;
  const rightW = contentRight - rightColX;

  const nameLines = wrap(
    displayValue(slip.employee_name),
    9.5,
    true,
    leftW - 12,
  );
  const jobLines = hasValue(slip.job_title)
    ? wrap(slip.job_title, 7.5, false, leftW - 12)
    : [];
  const accountLines = [
    hasValue(slip.bank_name) && `Bank: ${slip.bank_name}`,
    hasValue(slip.account_number) && `No. rekening: ${slip.account_number}`,
    hasValue(slip.account_holder) && `Atas nama: ${slip.account_holder}`,
  ].filter(Boolean);

  const detailRows = [
    ["Tanggal dibuat", formatDate(slip.created_at)],
    [
      "Tanggal cair",
      slip.disbursement_date ? formatDate(slip.disbursement_date) : "-",
    ],
    ["Jumlah penerimaan", `${items.length} item`],
    ["Status", statusLabel],
  ];

  const leftContentH =
    10.5 +
    nameLines.length * 4.2 +
    jobLines.length * 3.5 +
    accountLines.length * 3.6 +
    3;
  const rightContentH = 11 + detailRows.length * 4.6 + 1.5;
  const panelH = Math.max(leftContentH, rightContentH, 22);

  // Panel kiri
  doc.setFillColor(...C.panel);
  doc.roundedRect(margin, infoY, leftW, panelH, 2, 2, "F");
  gradientRect(margin, infoY + 3, 1.2, panelH - 6);

  sectionLabel("KARYAWAN", margin + 6, infoY + 5.5);

  let leftY = infoY + 10.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.text);
  doc.text(nameLines, margin + 6, leftY);
  leftY += nameLines.length * 4.2;

  if (jobLines.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(jobLines, margin + 6, leftY);
    leftY += jobLines.length * 3.5;
  }

  leftY += 0.5;
  accountLines.forEach((line) => {
    put(line, margin + 6, leftY, {
      size: 7.5,
      color: C.muted,
      maxWidth: leftW - 12,
    });
    leftY += 3.6;
  });

  // Panel kanan
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(rightColX, infoY, rightW, panelH, 2, 2, "S");

  sectionLabel("DETAIL SLIP", rightColX + 6, infoY + 5.5);

  detailRows.forEach(([label, value], index) => {
    const rowY = infoY + 11 + index * 4.6;
    put(label, rightColX + 6, rowY, { size: 7.5, color: C.muted });
    put(value, contentRight - 6, rowY, {
      size: 7.5,
      bold: true,
      align: "right",
      maxWidth: 46,
    });
  });

  /* ---------- Tabel penerimaan ---------- */
  const colName = margin + 12;
  const colCheck = 148; // titik tengah kolom CEK
  const colTotal = contentRight - 4;
  const nameWidth = 108;
  const tableHeaderH = 7;

  function drawTableHeader(yy) {
    gradientRect(margin, yy, contentWidth, tableHeaderH);

    const opt = { size: 7.5, bold: true, color: C.white };
    put("NO", margin + 4, yy + 4.7, opt);
    put("PENERIMAAN", colName, yy + 4.7, opt);
    put("CEK", colCheck, yy + 4.7, { ...opt, align: "center" });
    put("JUMLAH", colTotal, yy + 4.7, { ...opt, align: "right" });
  }

  y = infoY + panelH + 4;
  ensure(tableHeaderH + 10);
  drawTableHeader(y);
  y += tableHeaderH;

  items.forEach((item, index) => {
    const itemNameLines = wrap(displayValue(item.name), 8.5, true, nameWidth);
    const noteLines = hasValue(item.note)
      ? wrap(item.note, 7, false, nameWidth)
      : [];

    const rowH = Math.max(
      2.6 + itemNameLines.length * 3.6 + noteLines.length * 3 + 1.6,
      6.5,
    );

    if (y + rowH > bottomLimit) {
      newPage();
      drawTableHeader(y);
      y += tableHeaderH;
    }

    const baseY = y + 4.4;

    put(String(index + 1), margin + 4, baseY, { size: 8, color: C.muted });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    doc.text(itemNameLines, colName, baseY);

    if (noteLines.length > 0) {
      const afterName = baseY + (itemNameLines.length - 1) * 3.6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(noteLines, colName, afterName + 3.2);
    }

    checkbox(colCheck, baseY - 1, Boolean(item.checked));

    put(formatCurrency(item.amount), colTotal, baseY, {
      size: 8,
      bold: true,
      align: "right",
    });

    y += rowH;
    hLine(y);
  });

  /* ---------- Ringkasan (kanan) + penerbit (kiri) ---------- */
  const summaryRows = [
    ["Jumlah penerimaan", `${items.length} item`],
    ["Sudah dicek", `${checkedCount} dari ${items.length}`],
  ];

  const rowStep = 5;
  const totalBarH = 9;
  const summaryH = 3.5 + summaryRows.length * rowStep - 2 + totalBarH + 4;
  const issuerH = 32;

  y += 4;
  ensure(Math.max(summaryH, issuerH));

  const summaryTop = y;
  const labelX = rightColX + 6;
  const valueX = contentRight - 4;

  summaryRows.forEach(([label, value], index) => {
    const rowY = summaryTop + 3.5 + index * rowStep;
    put(label, labelX, rowY, { size: 8, color: C.muted });
    put(value, valueX, rowY, { size: 8, bold: true, align: "right" });
  });

  const totalY = summaryTop + 3.5 + summaryRows.length * rowStep - 2;
  gradientRect(rightColX, totalY, contentRight - rightColX, totalBarH);
  put("Total Gaji", labelX, totalY + 6, {
    size: 9,
    bold: true,
    color: C.white,
  });
  put(formatCurrency(slip.total_amount), valueX, totalY + 6, {
    size: 10.5,
    bold: true,
    color: C.white,
    align: "right",
  });

  // Penerbit (tanpa gambar tanda tangan), sejajar ringkasan
  gradientRect(margin, summaryTop, 1.2, 4.5);
  put("DITERBITKAN OLEH", margin + 4, summaryTop + 3.5, {
    size: 8.5,
    bold: true,
  });
  hLine(summaryTop + 22, C.text, margin + 6, margin + 62);
  put(displayValue(ownerName || "Owner"), margin + 6, summaryTop + 26.5, {
    size: 8.5,
    bold: true,
    maxWidth: 56,
  });
  put("Owner", margin + 6, summaryTop + 30.5, { size: 7, color: C.muted });

  /* ---------- Footer & nomor halaman di setiap halaman ---------- */
  const totalPages = doc.getNumberOfPages();
  const footerText = [
    store?.name,
    `Dicetak ${formatDateTime(new Date().toISOString())}`,
  ]
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
  }

  doc.save(buildFileName(slip));
}
