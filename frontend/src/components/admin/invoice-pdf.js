import { jsPDF } from "jspdf";

import {
  displayValue,
  formatCurrency,
  formatDate,
} from "./invoice-formatters.js";

const PDF_COLORS = {
  accent: [189, 45, 0], // #bd2d00
  text: [30, 30, 30],
  muted: [120, 120, 125],
  panel: [232, 233, 235],
  rowLight: [236, 237, 239],
  rowDark: [220, 222, 225],
  white: [255, 255, 255],
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

/**
 * @param {object} invoice
 * @param {{ logoUrl?: string, ownerName?: string }} options
 */
export async function downloadInvoicePdf(
  invoice,
  { logoUrl = "", ownerName = "" } = {},
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const C = PDF_COLORS;
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentRight = pageWidth - margin;
  const rightColX = 106;
  const bottomLimit = pageHeight - 15;
  let y = 0;

  const logo = await loadPdfImage(logoUrl);

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

  function drawTableHeader(yy) {
    doc.setFillColor(...C.accent);
    doc.rect(margin, yy, contentRight - margin, 10, "F");

    const opt = { size: 9, bold: true, color: C.white };
    put("NO", margin + 4, yy + 6.5, opt);
    put("DESKRIPSI ITEM", margin + 18, yy + 6.5, opt);
    put("HARGA", 140, yy + 6.5, { ...opt, align: "right" });
    put("QTY", 160, yy + 6.5, { ...opt, align: "right" });
    put("TOTAL", contentRight - 4, yy + 6.5, { ...opt, align: "right" });
  }

  /* ---------- Header: logo + toko (kiri), INVOICE (kanan) ---------- */
  if (logo) {
    fitImage(logo, margin, 14, 14, 14);
  } else {
    doc.setFillColor(...C.accent);
    doc.rect(margin, 14, 14, 14, "F");
    put(
      String(invoice.store_name || "S")
        .charAt(0)
        .toUpperCase(),
      margin + 7,
      23.5,
      { size: 18, bold: true, color: C.white, align: "center" },
    );
  }

  put(String(invoice.store_name || "-").toUpperCase(), margin + 18, 20, {
    size: 12,
    bold: true,
    maxWidth: 70,
  });

  if (invoice.instagram_store) {
    put(invoice.instagram_store, margin + 18, 25, {
      size: 8,
      color: C.muted,
    });
  }

  put(displayValue(invoice.store_address), margin, 35, {
    size: 8,
    color: C.muted,
    maxWidth: 80,
  });

  put("INVOICE", rightColX, 26, { size: 28, bold: true });
  put(`#${displayValue(invoice.no_invoice)}`, rightColX, 33, {
    size: 8,
    color: C.muted,
  });

  /* ---------- Tagihan kepada (kiri) ---------- */
  let leftY = 58;
  put("TAGIHAN KEPADA:", margin, leftY, { size: 9, bold: true });
  leftY += 6;

  leftY +=
    put(displayValue(invoice.customer_name), margin, leftY, {
      size: 9,
      bold: true,
      maxWidth: 80,
    }) * 4.5;

  leftY +=
    put(displayValue(invoice.customer_address), margin, leftY, {
      size: 8,
      color: C.muted,
      maxWidth: 80,
    }) * 4;

  if (invoice.customer_whatsapp) {
    put(`Whatsapp: ${invoice.customer_whatsapp}`, margin, leftY, {
      size: 8,
      color: C.muted,
    });
    leftY += 4;
  }

  if (invoice.customer_instagram) {
    put(`Instagram: ${invoice.customer_instagram}`, margin, leftY, {
      size: 8,
      color: C.muted,
    });
  }

  /* ---------- Kotak info invoice (kanan) ---------- */
  const boxY = 52;
  const boxW = contentRight - rightColX;

  doc.setFillColor(...C.panel);
  doc.rect(rightColX, boxY, boxW, 26, "F");
  doc.setFillColor(...C.accent);
  doc.rect(rightColX, boxY, 2.2, 26, "F");

  put("Nomor Invoice", rightColX + 8, boxY + 9, { size: 8.5, bold: true });
  put(displayValue(invoice.no_invoice), rightColX + 8, boxY + 15, {
    size: 8,
    color: C.muted,
    maxWidth: 44,
  });

  put("Tanggal", rightColX + 56, boxY + 9, { size: 8.5, bold: true });
  put(formatDate(invoice.created_at), rightColX + 56, boxY + 15, {
    size: 8,
    color: C.muted,
    maxWidth: 34,
  });

  /* ---------- Tabel item ---------- */
  y = 90;
  drawTableHeader(y);
  y += 10;

  const items = invoice.items ?? [];

  items.forEach((item, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const nameLines = doc.splitTextToSize(displayValue(item.camera_name), 78);
    const rowH = Math.max(12, 4 + nameLines.length * 4.2 + 3);

    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = 20;
      drawTableHeader(y);
      y += 10;
    }

    doc.setFillColor(...(index % 2 === 0 ? C.rowLight : C.rowDark));
    doc.rect(margin, y, contentRight - margin, rowH, "F");

    put(`${String(index + 1).padStart(2, "0")}.`, margin + 4, y + 6, {
      size: 8.5,
      color: C.muted,
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text(nameLines, margin + 18, y + 6);

    put(formatCurrency(item.camera_price), 140, y + 6, {
      size: 8.5,
      align: "right",
    });
    put(String(item.quantity), 160, y + 6, { size: 8.5, align: "right" });
    put(formatCurrency(item.line_total), contentRight - 4, y + 6, {
      size: 8.5,
      align: "right",
    });

    y += rowH;
  });

  /* ---------- Pembayaran + ringkasan ---------- */
  y += 10;

  if (y + 70 > bottomLimit) {
    doc.addPage();
    y = 20;
  }

  put("Metode Pembayaran", margin, y, { size: 9, bold: true });
  put(displayValue(invoice.payment_method), margin, y + 5.5, {
    size: 8,
    color: C.muted,
    maxWidth: 50,
  });

  put("Pengiriman", margin + 56, y, { size: 9, bold: true });
  put(displayValue(invoice.ship), margin + 56, y + 5.5, {
    size: 8,
    color: C.muted,
    maxWidth: 32,
  });

  const labelX = 162;
  const valueX = contentRight;

  put("Subtotal:", labelX, y, { size: 8.5, bold: true, align: "right" });
  put(formatCurrency(invoice.subtotal), valueX, y, {
    size: 8.5,
    bold: true,
    align: "right",
  });

  put("Diskon toko:", labelX, y + 6.5, {
    size: 8.5,
    bold: true,
    align: "right",
  });
  put(formatCurrency(invoice.store_discount), valueX, y + 6.5, {
    size: 8.5,
    bold: true,
    align: "right",
  });

  put("Diskon pelanggan:", labelX, y + 13, {
    size: 8.5,
    bold: true,
    align: "right",
  });
  put(formatCurrency(invoice.customer_discount), valueX, y + 13, {
    size: 8.5,
    bold: true,
    align: "right",
  });

  const totalY = y + 19;
  doc.setFillColor(...C.accent);
  doc.rect(rightColX, totalY, contentRight - rightColX, 10, "F");
  put("Grand Total:", rightColX + 6, totalY + 6.8, {
    size: 9.5,
    bold: true,
    color: C.white,
  });
  put(formatCurrency(invoice.total_amount), contentRight - 4, totalY + 6.8, {
    size: 9.5,
    bold: true,
    color: C.white,
    align: "right",
  });

  /* ---------- Footer: area tanda tangan + ucapan ---------- */
  const footY = totalY + 22;
  const signCenterX = margin + 25;

  put("Terima kasih atas kepercayaan Anda!", rightColX, footY + 8, {
    size: 11,
    bold: true,
    color: C.accent,
    maxWidth: contentRight - rightColX,
  });

  let contactY = footY + 17;

  if (invoice.whatsapp_store) {
    put(`Whatsapp: ${invoice.whatsapp_store}`, rightColX, contactY, {
      size: 8,
      color: C.muted,
    });
    contactY += 5;
  }

  if (invoice.instagram_store) {
    put(`Instagram: ${invoice.instagram_store}`, rightColX, contactY, {
      size: 8,
      color: C.muted,
    });
  }

  const safeInvoiceNumber = String(invoice.no_invoice || invoice.id).replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );

  doc.save(`${safeInvoiceNumber}.pdf`);
}
