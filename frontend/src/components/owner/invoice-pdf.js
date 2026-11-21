import { jsPDF } from "jspdf";

import {
  displayValue,
  formatCurrency,
  formatDate,
} from "./invoice-formatters.js";

/* Palet: merah tua #760a16 dan merah terang #d02f1c.
   Abu-abu adalah hitam dengan opasitas, sama seperti text-second/60 di web. */
const PDF_COLORS = {
  dark: [118, 10, 22], // #760a16
  accent: [208, 47, 28], // #d02f1c
  text: [0, 0, 0],
  muted: [102, 102, 102],
  faint: [153, 153, 153],
  line: [232, 226, 225],
  border: [217, 217, 217],
  tint: [252, 241, 240], // latar panel (merah sangat muda)
  zebra: [251, 246, 245], // baris selang-seling tabel
  onDark: [255, 226, 222], // teks sekunder di atas latar merah tua
  white: [255, 255, 255],
  green: [21, 128, 61],
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

  /* Gradient horizontal: merah tua di kiri, merah terang di kanan. */
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

  /* Label bagian: teks merah terang dengan garis pendek di bawahnya. */
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

  /* ---------- Data turunan ---------- */
  const isRefund = invoice.type === "REFUND";
  const isPaid = invoice.payment_status === "PAID";
  const isDp = !isRefund && invoice.payment_status === "DP";

  const dpAmount =
    !isRefund && invoice.dp_amount !== null && invoice.dp_amount !== undefined
      ? Number(invoice.dp_amount)
      : null;
  // Order lunas dianggap DP-nya sudah diterima.
  const dpReceived = invoice.dp_paid === true || isPaid;
  const dpPaidAt = invoice.dp_paid_at ?? null;
  const totalAmount = Number(invoice.total_amount) || 0;

  // Sisa setelah DP dibayar, dihitung sendiri (bukan dari remaining_amount)
  const remainingAfterDp =
    dpAmount !== null ? Math.max(0, totalAmount - dpAmount) : null;

  // Sisa tagihan saat ini: kalau DP sudah diterima, pakai nilai backend
  const remainingAmount = dpReceived
    ? (invoice.remaining_amount ?? remainingAfterDp)
    : remainingAfterDp;
  const isDpBill = isDp && !dpReceived; // invoice tagihan DP

  const statusLabel = isRefund
    ? isPaid
      ? "SUDAH DIKEMBALIKAN"
      : "BELUM DIKEMBALIKAN"
    : isPaid
      ? "LUNAS"
      : isDp
        ? dpReceived
          ? "DP DIBAYAR"
          : "DP BELUM DIBAYAR"
        : "BELUM DIBAYAR";
  const statusColor = isPaid ? C.green : isDp && dpReceived ? C.dark : C.accent;
  const docTitle = isRefund
    ? "NOTA REFUND"
    : isDpBill
      ? "TAGIHAN DP"
      : "INVOICE";

  // Diskon produk: selisih harga coret dan harga jual, dikali jumlah unit.
  const lineItems = invoice.items ?? [];
  const productDiscountTotal = lineItems.reduce(
    (sum, item) => sum + unitDiscount(item) * (Number(item.quantity) || 0),
    0,
  );
  const normalPriceTotal =
    (Number(invoice.subtotal) || 0) + productDiscountTotal;
  const showProductDiscount = !isRefund && productDiscountTotal > 0;

  /* ---------- Halaman 1: header band merah tua ---------- */
  const logoSize = 16;
  const logoY = 9;
  const storeX = margin + logoSize + 5;

  const storeNameLines = wrap(
    String(invoice.store_name || "-").toUpperCase(),
    12,
    true,
    74,
  );
  const storeAddrLines = hasValue(invoice.store_address)
    ? wrap(invoice.store_address, 7, false, 74)
    : [];
  const storeContacts = [
    hasValue(invoice.whatsapp_store) && `WA ${invoice.whatsapp_store}`,
    hasValue(invoice.instagram_store) && invoice.instagram_store,
  ].filter(Boolean);

  const nameBaseline = 15;
  const addrBaseline = nameBaseline + (storeNameLines.length - 1) * 5 + 4.4;
  const contactBaseline =
    storeAddrLines.length > 0
      ? addrBaseline + (storeAddrLines.length - 1) * 3.3 + 3.4
      : addrBaseline;
  const storeBottom = storeContacts.length > 0 ? contactBaseline : addrBaseline;

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
      String(invoice.store_name || "S")
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

  if (storeAddrLines.length > 0) {
    put(storeAddrLines.join("\n"), storeX, addrBaseline, {
      size: 7,
      color: C.onDark,
    });
  }

  if (storeContacts.length > 0) {
    put(storeContacts.join("   |   "), storeX, contactBaseline, {
      size: 7,
      color: C.onDark,
    });
  }

  put(docTitle, contentRight, 19, {
    size: docTitle === "INVOICE" ? 24 : 17,
    bold: true,
    color: C.white,
    align: "right",
  });
  put(`#${displayValue(invoice.no_invoice)}`, contentRight, 25, {
    size: 8,
    color: C.onDark,
    align: "right",
  });
  pill(statusLabel, contentRight, 28, {
    color: statusColor,
    tint: C.white,
    align: "right",
  });

  /* ---------- Tagihan kepada + detail invoice ---------- */
  const infoY = bandH + 1.6 + 8;
  const colGap = 8;
  const leftW = rightColX - margin - colGap;
  const rightW = contentRight - rightColX;

  const nameLines = wrap(
    displayValue(invoice.customer_name),
    10,
    true,
    leftW - 2,
  );
  const addrLines = hasValue(invoice.customer_address)
    ? wrap(invoice.customer_address, 7.5, false, leftW - 2)
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
    ...(dpAmount !== null && dpReceived && dpPaidAt
      ? [["Tanggal DP dibayar", formatDate(dpPaidAt)]]
      : []),
    ["Metode pembayaran", displayValue(invoice.payment_method)],
    ["Pengiriman", displayValue(invoice.ship)],
  ];

  const leftContentH =
    9 +
    nameLines.length * 4.4 +
    addrLines.length * 3.5 +
    customerContacts.length * 3.6 +
    2;
  const rowGap = 5;
  const rightContentH = 11 + detailRows.length * rowGap + 1;
  const panelH = Math.max(leftContentH, rightContentH, 22);

  // Kolom kiri: tanpa kotak, hanya garis aksen di atas label.
  doc.setFillColor(...C.accent);
  doc.rect(margin, infoY, 10, 0.9, "F");
  sectionLabel(
    isRefund ? "DIKEMBALIKAN KEPADA" : "TAGIHAN KEPADA",
    margin,
    infoY + 5.5,
  );

  let leftY = infoY + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  doc.text(nameLines, margin, leftY);
  leftY += nameLines.length * 4.4;

  if (addrLines.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(addrLines, margin, leftY);
    leftY += addrLines.length * 3.5;
  }

  leftY += 0.5;
  customerContacts.forEach((line) => {
    put(line, margin, leftY, { size: 7.5, color: C.muted });
    leftY += 3.6;
  });

  // Kolom kanan: kotak tint dengan bar merah tua di kiri.
  doc.setFillColor(...C.tint);
  doc.rect(rightColX, infoY, rightW, panelH, "F");
  doc.setFillColor(...C.dark);
  doc.rect(rightColX, infoY, 1.4, panelH, "F");

  sectionLabel("DETAIL INVOICE", rightColX + 6, infoY + 5.5);

  detailRows.forEach(([label, value], index) => {
    const rowY = infoY + 11 + index * rowGap;
    put(label, rightColX + 6, rowY, { size: 7.5, color: C.muted });
    put(value, contentRight - 4, rowY, {
      size: 7.5,
      bold: true,
      align: "right",
      maxWidth: 46,
    });
    if (index < detailRows.length - 1) {
      hLine(rowY + 1.7, C.line, rightColX + 6, contentRight - 4);
    }
  });

  /* ---------- Tabel item ---------- */
  const colPrice = 140;
  const colQty = 160;
  const colTotal = contentRight - 4;
  const tableHeaderH = 7.5;

  function drawTableHeader(yy) {
    doc.setFillColor(...C.dark);
    doc.rect(margin, yy, contentWidth, tableHeaderH, "F");
    doc.setFillColor(...C.accent);
    doc.rect(margin, yy, 1.4, tableHeaderH, "F");

    const opt = { size: 7.5, bold: true, color: C.white };
    put("ITEM", margin + 5, yy + 5, opt);
    put("HARGA", colPrice, yy + 5, { ...opt, align: "right" });
    put("QTY", colQty, yy + 5, { ...opt, align: "right" });
    put("TOTAL", colTotal, yy + 5, { ...opt, align: "right" });
  }

  y = infoY + panelH + 6;
  ensure(tableHeaderH + 10);
  drawTableHeader(y);
  y += tableHeaderH;

  const items = invoice.items ?? [];

  items.forEach((item, index) => {
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
      hasItemDiscount ? 10 : 7,
    );

    if (y + rowH > bottomLimit) {
      newPage();
      drawTableHeader(y);
      y += tableHeaderH;
    }

    // Baris selang-seling
    if (index % 2 === 1) {
      doc.setFillColor(...C.zebra);
      doc.rect(margin, y, contentWidth, rowH, "F");
    }

    const baseY = y + 4.6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    doc.text(itemNameLines, margin + 5, baseY);

    const afterName = baseY + (itemNameLines.length - 1) * 3.6;

    if (metaLines.length > 0) {
      put(metaLine, margin + 5, afterName + 3.2, {
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
        margin + 5,
        noteY,
        {
          size: 7,
          bold: true,
          color: C.accent,
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

  // Garis penutup tabel
  doc.setDrawColor(...C.dark);
  doc.setLineWidth(0.5);
  doc.line(margin, y, contentRight, y);

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

  const dpRows =
    dpAmount !== null
      ? [
          {
            label: dpReceived ? "DP dibayar" : "DP yang harus dibayar",
            value: formatCurrency(dpAmount),
            highlight: !dpReceived,
          },
          {
            label: dpReceived ? "Sisa pembayaran" : "Sisa setelah DP",
            value: formatCurrency(remainingAmount),
            highlight: dpReceived,
          },
        ]
      : [];
  const dpBlockH = dpRows.length > 0 ? dpRows.length * 5.4 + 1 : 0;

  const rowStep = 5.4;
  const totalBarH = 10;
  // Tinggi kolom kanan: baris ringkasan + bar total + baris DP + ucapan.
  const summaryH =
    3.5 + summaryRows.length * rowStep - 1 + totalBarH + dpBlockH + 15;

  y += 5;
  ensure(summaryH);

  const summaryTop = y;
  const labelX = rightColX + 6;
  const valueX = contentRight - 4;

  summaryRows.forEach(([label, value], index) => {
    const rowY = summaryTop + 3.5 + index * rowStep;
    put(label, rightColX, rowY, { size: 8, color: C.muted });
    put(value, contentRight, rowY, { size: 8, bold: true, align: "right" });
    hLine(rowY + 1.9, C.line, rightColX, contentRight);
  });

  const totalY = summaryTop + 3.5 + summaryRows.length * rowStep - 1;
  doc.setFillColor(...C.dark);
  doc.rect(rightColX, totalY, contentRight - rightColX, totalBarH, "F");
  doc.setFillColor(...C.accent);
  doc.rect(rightColX, totalY, 3, totalBarH, "F");

  put(isRefund ? "Total dikembalikan" : "Grand Total", labelX, totalY + 6.6, {
    size: 9,
    bold: true,
    color: C.white,
  });
  put(formatCurrency(invoice.total_amount), valueX, totalY + 6.8, {
    size: 11,
    bold: true,
    color: C.white,
    align: "right",
  });

  /* ---------- Ucapan di bawah Grand Total ---------- */

  /* ---------- DP dan sisa pembayaran (di bawah Grand Total) ---------- */
  const dpHighlightColor = dpReceived ? C.dark : C.accent;

  dpRows.forEach((row, index) => {
    const rowY = totalY + totalBarH + 5 + index * rowStep;

    put(row.label, rightColX, rowY, {
      size: 8,
      bold: row.highlight,
      color: row.highlight ? dpHighlightColor : C.muted,
    });
    put(row.value, contentRight, rowY, {
      size: 8,
      bold: true,
      color: row.highlight ? dpHighlightColor : C.text,
      align: "right",
    });
    hLine(rowY + 1.9, C.line, rightColX, contentRight);
  });

  /* ---------- Ucapan di bawah Grand Total ---------- */
  const thanksY = totalY + totalBarH + dpBlockH + 6;

  put("Thank you for shopping", contentRight, thanksY, {
    size: 11,
    bold: true,
    color: C.accent,
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

    doc.setFillColor(...C.accent);
    doc.rect(margin, y, 10, 0.9, "F");
    put("SYARAT & KETENTUAN", margin, y + 5.5, {
      size: 8.5,
      bold: true,
      color: C.dark,
    });
    y += 11;

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
        doc.setFillColor(...C.dark);
        doc.circle(margin + 2.3, y - 1, 2.3, "F");
        put(block.number, margin + 2.3, y, {
          size: 6.5,
          bold: true,
          color: C.white,
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
            put("-", textX, y, { size: 7, color: C.accent });
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

    // Strip bawah merah tua
    doc.setFillColor(...C.dark);
    doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, "F");
  }

  const safeInvoiceNumber = String(invoice.no_invoice || invoice.id).replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );

  doc.save(`${safeInvoiceNumber}.pdf`);
}
