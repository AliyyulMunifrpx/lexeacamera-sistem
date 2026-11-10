import { jsPDF } from "jspdf";

import {
  displayValue,
  formatCurrency,
  formatDate,
} from "./invoice-formatters.js";

/* Warna mengikuti palet aplikasi (global.css):
   gradient #7b0a67 → #de23e8, hitam, merah #dc2626, biru #2563eb, ungu #7c3aed.
   Abu-abu adalah hitam dengan opasitas, sama seperti text-second/60 di web. */
const PDF_COLORS = {
  gradDark: [123, 10, 103], // #7b0a67
  gradLight: [222, 35, 232], // #de23e8
  text: [0, 0, 0], // --second
  muted: [102, 102, 102], // second/60
  faint: [153, 153, 153], // second/40
  line: [230, 230, 230], // second/10
  border: [217, 217, 217], // second/15
  panel: [245, 245, 245], // second/4
  white: [255, 255, 255],
  blue: [37, 99, 235], // #2563eb
  blueTint: [235, 240, 253],
  violet: [124, 58, 237], // #7c3aed
  violetTint: [242, 238, 254],
  red: [220, 38, 38], // #dc2626
};

const LOGO_MAX_SIDE = 400;

/**
 * Memuat gambar (URL atau data URL) lalu mengubahnya ke PNG lewat canvas,
 * supaya format apa pun (webp, svg, dll) bisa dipakai jsPDF.
 * Mengembalikan null kalau gagal, jadi PDF tetap jadi tanpa logo.
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

/* Diskon produk per unit = harga coret - harga jual. 0 jika tidak ada harga coret. */
function unitDiscount(item) {
  const strike = Number(item.strikethrough_price);
  const price = Number(item.camera_price);

  if (!Number.isFinite(strike) || !Number.isFinite(price)) return 0;

  return strike > price ? strike - price : 0;
}

/* "- Rp100.000" jika ada diskon, "-" jika tidak. */
function discountText(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `- ${formatCurrency(amount)}`
    : "-";
}

/* Pecah syarat & ketentuan bernomor ("1. Judul" + baris isi) menjadi blok. */
function parseTerms(text) {
  const blocks = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (heading) {
      blocks.push({ number: heading[1], title: heading[2], lines: [] });
      continue;
    }

    const bullet = line.match(/^[•*-]\s*(.+)$/);
    const entry = bullet
      ? { bullet: true, text: bullet[1] }
      : { bullet: false, text: line };

    const current = blocks[blocks.length - 1];
    if (current) current.lines.push(entry);
    else blocks.push({ number: null, title: null, lines: [entry] });
  }

  return blocks;
}

/**
 * @param {object} invoice
 * @param {{ logoUrl?: string, ownerName?: string }} options
 */
export async function downloadInvoicePdf(invoice, { logoUrl = "" } = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  doc.setProperties({
    title: `Invoice ${invoice.no_invoice ?? ""}`.trim(),
    subject: `Invoice ${invoice.store_name ?? ""}`.trim(),
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

  const logo = await loadPdfImage(logoUrl);

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

  function newPage() {
    doc.addPage();
    gradientRect(0, 0, pageWidth, 2.5);
    y = topStart;
  }

  function ensure(height) {
    if (y + height > bottomLimit) newPage();
  }

  /* ---------- Data turunan ---------- */
  const isRefund = invoice.type === "REFUND";

  const isPaid = invoice.payment_status === "PAID";
  const statusLabel = isRefund
    ? isPaid
      ? "SUDAH DIKEMBALIKAN"
      : "BELUM DIKEMBALIKAN"
    : isPaid
      ? "LUNAS"
      : "BELUM DIBAYAR";
  const statusColor = isPaid ? C.blue : C.violet;
  const statusTint = isPaid ? C.blueTint : C.violetTint;

  // Diskon produk: selisih harga coret dan harga jual, dikali jumlah unit.
  const lineItems = invoice.items ?? [];
  const productDiscountTotal = lineItems.reduce(
    (sum, item) => sum + unitDiscount(item) * (Number(item.quantity) || 0),
    0,
  );
  const normalPriceTotal =
    (Number(invoice.subtotal) || 0) + productDiscountTotal;
  const showProductDiscount = !isRefund && productDiscountTotal > 0;

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
      String(invoice.store_name || "S")
        .charAt(0)
        .toUpperCase(),
      margin + logoSize / 2,
      logoY + 9,
      { size: 14, bold: true, color: C.white, align: "center" },
    );
  }

  const storeX = margin + logoSize + 4;
  let storeY = logoY + 4;

  storeY +=
    put(String(invoice.store_name || "-").toUpperCase(), storeX, storeY, {
      size: 11.5,
      bold: true,
      maxWidth: 74,
    }) * 4.4;

  if (hasValue(invoice.store_address)) {
    storeY +=
      put(invoice.store_address, storeX, storeY, {
        size: 7,
        color: C.muted,
        maxWidth: 74,
      }) * 3.2;
  }

  const storeContacts = [
    hasValue(invoice.whatsapp_store) && `WA ${invoice.whatsapp_store}`,
    hasValue(invoice.instagram_store) && invoice.instagram_store,
  ].filter(Boolean);

  if (storeContacts.length > 0) {
    put(storeContacts.join("   |   "), storeX, storeY, {
      size: 7,
      color: C.muted,
    });
    storeY += 3.2;
  }

  put(isRefund ? "NOTA REFUND" : "INVOICE", contentRight, 16, {
    size: isRefund ? 17 : 22,
    bold: true,
    align: "right",
  });
  put(`#${displayValue(invoice.no_invoice)}`, contentRight, 21.5, {
    size: 8,
    color: C.muted,
    align: "right",
  });
  pill(statusLabel, contentRight, 24, {
    color: statusColor,
    tint: statusTint,
    align: "right",
  });

  const headerBottom = Math.max(logoY + logoSize, storeY, 30);
  hLine(headerBottom + 2, C.border);

  /* ---------- Tagihan kepada + detail invoice ---------- */
  const infoY = headerBottom + 6;
  const colGap = 6;
  const leftW = rightColX - margin - colGap;
  const rightW = contentRight - rightColX;

  const nameLines = wrap(
    displayValue(invoice.customer_name),
    9.5,
    true,
    leftW - 12,
  );
  const addrLines = hasValue(invoice.customer_address)
    ? wrap(invoice.customer_address, 7.5, false, leftW - 12)
    : [];
  const customerContacts = [
    hasValue(invoice.customer_whatsapp) &&
      `WhatsApp: ${invoice.customer_whatsapp}`,
    hasValue(invoice.customer_instagram) &&
      `Instagram: ${invoice.customer_instagram}`,
  ].filter(Boolean);

  const detailRows = [
    ["Nomor invoice", displayValue(invoice.no_invoice)],
    ["Tanggal dibuat", formatDate(invoice.created_at)],
    ...(isPaid && invoice.paid_at
      ? [
          [
            isRefund ? "Tanggal dikembalikan" : "Tanggal dibayar",
            formatDate(invoice.paid_at),
          ],
        ]
      : []),
    ["Metode pembayaran", displayValue(invoice.payment_method)],
    ["Pengiriman", displayValue(invoice.ship)],
  ];

  const leftContentH =
    10.5 +
    nameLines.length * 4.2 +
    addrLines.length * 3.5 +
    customerContacts.length * 3.6 +
    3;
  const rightContentH = 11 + detailRows.length * 4.6 + 1.5;
  const panelH = Math.max(leftContentH, rightContentH, 22);

  // Panel kiri
  doc.setFillColor(...C.panel);
  doc.roundedRect(margin, infoY, leftW, panelH, 2, 2, "F");
  gradientRect(margin, infoY + 3, 1.2, panelH - 6);

  sectionLabel(
    isRefund ? "DIKEMBALIKAN KEPADA" : "TAGIHAN KEPADA",
    margin + 6,
    infoY + 5.5,
  );

  let leftY = infoY + 10.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.text);
  doc.text(nameLines, margin + 6, leftY);
  leftY += nameLines.length * 4.2;

  if (addrLines.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(addrLines, margin + 6, leftY);
    leftY += addrLines.length * 3.5;
  }

  leftY += 0.5;
  customerContacts.forEach((line) => {
    put(line, margin + 6, leftY, { size: 7.5, color: C.muted });
    leftY += 3.6;
  });

  // Panel kanan
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(rightColX, infoY, rightW, panelH, 2, 2, "S");

  sectionLabel("DETAIL INVOICE", rightColX + 6, infoY + 5.5);

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

  /* ---------- Tabel item ---------- */
  const colPrice = 140;
  const colQty = 160;
  const colTotal = contentRight - 4;
  const tableHeaderH = 7;

  function drawTableHeader(yy) {
    gradientRect(margin, yy, contentWidth, tableHeaderH);

    const opt = { size: 7.5, bold: true, color: C.white };
    put("ITEM", margin + 4, yy + 4.7, opt);
    put("HARGA", colPrice, yy + 4.7, { ...opt, align: "right" });
    put("QTY", colQty, yy + 4.7, { ...opt, align: "right" });
    put("TOTAL", colTotal, yy + 4.7, { ...opt, align: "right" });
  }

  y = infoY + panelH + 4;
  ensure(tableHeaderH + 10);
  drawTableHeader(y);
  y += tableHeaderH;

  const items = invoice.items ?? [];

  items.forEach((item) => {
    const itemNameLines = wrap(displayValue(item.camera_name), 8.5, true, 84);

    const hasSku = hasValue(item.sku);
    const hasSerial = hasValue(item.serial_number);

    const metaLine = [
      hasSku && `SKU ${item.sku}`,
      hasSerial && `SN ${item.serial_number}`,
    ]
      .filter(Boolean)
      .join("   ·   ");

    const metaLines = metaLine ? wrap(metaLine, 7, false, 84) : [];

    const perUnitDiscount = unitDiscount(item);
    const hasItemDiscount = perUnitDiscount > 0;

    const rowH = Math.max(
      2.6 +
        itemNameLines.length * 3.6 +
        metaLines.length * 3 +
        (hasItemDiscount ? 3.2 : 0) +
        1.6,
      hasItemDiscount ? 10 : 6.5,
    );

    if (y + rowH > bottomLimit) {
      newPage();
      drawTableHeader(y);
      y += tableHeaderH;
    }

    const baseY = y + 4.4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    doc.text(itemNameLines, margin + 4, baseY);

    const afterName = baseY + (itemNameLines.length - 1) * 3.6;

    if (metaLines.length > 0) {
      put(metaLine, margin + 4, afterName + 3.2, {
        size: 7,
        color: C.muted,
        maxWidth: 84,
      });
    }

    put(formatCurrency(item.camera_price), colPrice, baseY, {
      size: 8,
      align: "right",
    });

    if (hasItemDiscount) {
      // Harga coret dicoret di bawah harga jual.
      const strikeLabel = formatCurrency(item.strikethrough_price);
      const strikeY = baseY + 3.6;

      put(strikeLabel, colPrice, strikeY, {
        size: 6.5,
        color: C.faint,
        align: "right",
      });

      const strikeW = doc.getTextWidth(strikeLabel);
      doc.setDrawColor(...C.faint);
      doc.setLineWidth(0.2);
      doc.line(colPrice - strikeW, strikeY - 0.8, colPrice, strikeY - 0.8);

      // Keterangan diskon per unit di bawah nama/SKU.
      const noteY = afterName + 3.2 + metaLines.length * 3;

      put(
        `Diskon produk ${formatCurrency(perUnitDiscount)} / unit`,
        margin + 4,
        noteY,
        {
          size: 7,
          bold: true,
          color: C.violet,
        },
      );
    }

    put(String(item.quantity), colQty, baseY, { size: 8, align: "right" });
    put(formatCurrency(item.line_total), colTotal, baseY, {
      size: 8,
      bold: true,
      align: "right",
    });

    y += rowH;
    hLine(y);
  });

  /* ---------- Ringkasan pembayaran (kanan) ---------- */
  const refundDiscount = Math.max(
    0,
    (Number(invoice.subtotal) || 0) - (Number(invoice.total_amount) || 0),
  );
  const summaryRows = isRefund
    ? [
        ["Nilai barang", formatCurrency(invoice.subtotal)],
        ["Diskon pembelian awal", discountText(refundDiscount)],
      ]
    : [
        ...(showProductDiscount
          ? [
              ["Harga normal", formatCurrency(normalPriceTotal)],
              ["Diskon produk", discountText(productDiscountTotal)],
            ]
          : []),
        ["Subtotal", formatCurrency(invoice.subtotal)],
        ["Diskon toko", discountText(invoice.store_discount)],
        ["Diskon pelanggan", discountText(invoice.customer_discount)],
      ];

  const rowStep = 5;
  const totalBarH = 9;
  // Tinggi kolom kanan: baris ringkasan + bar total + ucapan di bawahnya.
  const summaryH = 3.5 + summaryRows.length * rowStep - 2 + totalBarH + 14;

  y += 4;
  ensure(summaryH);

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
  put(isRefund ? "Total dikembalikan" : "Grand Total", labelX, totalY + 6, {
    size: 9,
    bold: true,
    color: C.white,
  });
  put(formatCurrency(invoice.total_amount), valueX, totalY + 6, {
    size: 10.5,
    bold: true,
    color: C.white,
    align: "right",
  });

  /* ---------- Ucapan di bawah Grand Total ---------- */
  const thanksY = totalY + totalBarH + 5.5;

  put("Thank you for shopping", contentRight, thanksY, {
    size: 11,
    bold: true,
    color: C.gradDark,
    align: "right",
  });

  put("Selamat & sukses untuk karyamu", contentRight, thanksY + 4.8, {
    size: 8.5,
    color: C.muted,
    align: "right",
  });

  /* ---------- Syarat dan ketentuan (kiri, sejajar ringkasan) ----------
     Bagian atasnya sama dengan bagian atas ringkasan pembayaran. Selama masih
     di halaman yang sama, lebarnya dibatasi kolom kiri; kalau lanjut ke
     halaman berikutnya, lebarnya penuh. */
  const terms = String(invoice.terms_and_condition ?? "").trim();

  if (terms) {
    y = summaryTop;

    let termRight = rightColX - 8;

    function termEnsure(height) {
      if (y + height > bottomLimit) {
        newPage();
        termRight = contentRight;
      }
    }

    termEnsure(18);

    gradientRect(margin, y, 1.2, 4.5);
    put("SYARAT & KETENTUAN", margin + 4, y + 3.5, { size: 8.5, bold: true });
    y += 8;

    const blocks = parseTerms(terms);
    const textX = margin + 6;

    blocks.forEach((block) => {
      let textW = termRight - textX;

      let headingLines = block.title ? wrap(block.title, 8, true, textW) : [];
      const firstLine = block.lines[0]
        ? wrap(block.lines[0].text, 7, false, textW - 3.5)
        : [];

      // Judul tidak ditinggal sendirian di bawah halaman.
      const needed = headingLines.length * 3.8 + firstLine.length * 3.3 + 1;
      if (y + needed > bottomLimit) {
        termEnsure(needed);
        textW = termRight - textX;
        headingLines = block.title ? wrap(block.title, 8, true, textW) : [];
      }

      if (block.number) {
        doc.setFillColor(...C.panel);
        doc.circle(margin + 2.3, y - 1, 2.3, "F");
        put(block.number, margin + 2.3, y, {
          size: 6.5,
          bold: true,
          color: C.muted,
          align: "center",
        });
      }

      if (headingLines.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.text);
        doc.text(headingLines, textX, y);
        y += headingLines.length * 3.8;
      }

      block.lines.forEach((line) => {
        const lines = wrap(
          line.text,
          7,
          false,
          termRight - textX - (line.bullet ? 3.5 : 0),
        );

        lines.forEach((part, partIndex) => {
          termEnsure(3.3);

          if (line.bullet && partIndex === 0) {
            put("-", textX, y, { size: 7, color: C.faint });
          }

          put(part, textX + (line.bullet ? 3.5 : 0), y, {
            size: 7,
            color: C.muted,
          });
          y += 3.3;
        });
      });

      y += 2.2;
    });
  }

  /* ---------- Footer & nomor halaman di setiap halaman ---------- */
  const totalPages = doc.getNumberOfPages();
  const footerParts = [
    invoice.store_name,
    hasValue(invoice.whatsapp_store) && `WA ${invoice.whatsapp_store}`,
    hasValue(invoice.instagram_store) && invoice.instagram_store,
  ].filter(Boolean);

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);

    hLine(pageHeight - 13, C.border);
    put(footerParts.join("   |   "), margin, pageHeight - 8.5, {
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

  const safeInvoiceNumber = String(invoice.no_invoice || invoice.id).replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );

  doc.save(`${safeInvoiceNumber}.pdf`);
}
