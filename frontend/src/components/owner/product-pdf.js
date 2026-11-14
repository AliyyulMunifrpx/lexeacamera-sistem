/**
 * Export lembar produk (detail kamera) ke PDF A4.
 * Dijalankan di browser. jsPDF di-import dinamis supaya tidak masuk bundle awal.
 *
 * Palet sama dengan PDF invoice dan slip gaji: merah tua #760a16 dan
 * merah terang #d02f1c.
 */

const PAGE = { w: 210, h: 297, margin: 16 };
const CONTENT_W = PAGE.w - PAGE.margin * 2;

const C = {
  dark: [118, 10, 22], // #760a16
  accent: [208, 47, 28], // #d02f1c
  darkTint: [247, 232, 234],
  accentTint: [253, 236, 233],
  tint: [252, 241, 240],
  onDark: [255, 226, 222],
  white: [255, 255, 255],
  green: [21, 128, 61],
};

const CONDITION_LABEL = { NEW: "Baru", SECOND: "Bekas" };

/* -------------------------------- Formatters ------------------------------ */

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatRupiah(n) {
  if (n === null || n === undefined) return "-";
  const sign = n < 0 ? "-" : "";
  return `${sign}Rp ${formatNumber(Math.abs(n))}`;
}

function formatPercent(n) {
  return `${(Math.round(n * 10) / 10).toString().replace(".", ",")}%`;
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/* ------------------------------ Browser helpers --------------------------- */

/** Muat gambar -> JPEG data URL (webp/avif ikut terkonversi). Gagal -> null. */
async function loadImage(url) {
  if (!url || typeof document === "undefined") return null;

  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;

    const bitmap = await createImageBitmap(await response.blob());
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width, height };
  } catch {
    return null;
  }
}

/* ------------------------------- Drawing kit ------------------------------ */

// Hitam dengan opacity di atas putih, dihitung jadi abu-abu solid.
const ink = (opacity) => {
  const v = Math.round(255 * (1 - opacity));
  return [v, v, v];
};

const INK = {
  main: ink(1),
  text: ink(0.7),
  muted: ink(0.5),
  line: ink(0.15),
  soft: ink(0.04),
};

function createKit(doc) {
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const color = (c) => doc.setTextColor(c[0], c[1], c[2]);

  /* Gradient horizontal: merah tua di kiri, merah terang di kanan. */
  function gradientBar(x, y, w, h) {
    const steps = 80;
    const a = C.dark;
    const b = C.accent;

    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      fill([
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
      ]);
      // sedikit overlap agar tidak ada garis celah antar strip
      doc.rect(x + (w / steps) * i, y, w / steps + 0.3, h, "F");
    }
  }

  function text(
    str,
    x,
    y,
    { size = 10, style = "normal", c = INK.main, align = "left" } = {},
  ) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(c);
    doc.text(String(str), x, y, { align });
  }

  /** Teks wrap. Mengembalikan y setelah baris terakhir. */
  function paragraph(
    str,
    x,
    y,
    width,
    { size = 10, style = "normal", c = INK.text, lh = 5 } = {},
  ) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(c);
    const lines = doc.splitTextToSize(String(str), width);
    doc.text(lines, x, y);
    return y + lines.length * lh;
  }

  function pill(label, x, y, tone = "outline") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const w = doc.getTextWidth(label) + 8;
    const h = 6;

    if (tone === "dark") {
      fill(C.darkTint);
      doc.roundedRect(x, y, w, h, 3, 3, "F");
      color(C.dark);
    } else if (tone === "accent") {
      fill(C.accentTint);
      doc.roundedRect(x, y, w, h, 3, 3, "F");
      color(C.accent);
    } else {
      stroke(INK.line);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, h, 3, 3, "S");
      color(INK.muted);
    }

    doc.text(label, x + w / 2, y + 4.1, { align: "center" });
    return w;
  }

  /* Judul bagian: teks merah tua, garis tipis, dan aksen merah di awal garis. */
  function sectionTitle(label, x, y, width = CONTENT_W) {
    text(label.toUpperCase(), x, y, { size: 8, style: "bold", c: C.dark });
    stroke(INK.line);
    doc.setLineWidth(0.3);
    doc.line(x, y + 2, x + width, y + 2);
    fill(C.accent);
    doc.rect(x, y + 1.6, 12, 0.9, "F");
    return y + 8;
  }

  function imageCover(img, x, y, w, h, radius = 3) {
    // Potong ala object-cover lewat clipping.
    doc.saveGraphicsState();
    doc.roundedRect(x, y, w, h, radius, radius, null);
    doc.clip();
    doc.discardPath();

    const ratio = img.width / img.height;
    let dw = w;
    let dh = w / ratio;
    if (dh < h) {
      dh = h;
      dw = h * ratio;
    }
    doc.addImage(
      img.dataUrl,
      "JPEG",
      x - (dw - w) / 2,
      y - (dh - h) / 2,
      dw,
      dh,
    );
    doc.restoreGraphicsState();

    stroke(INK.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, radius, radius, "S");
  }

  function placeholder(x, y, w, h, label = "Gambar tidak tersedia") {
    fill(INK.soft);
    doc.roundedRect(x, y, w, h, 3, 3, "F");
    text(label, x + w / 2, y + h / 2, {
      size: 9,
      c: INK.muted,
      align: "center",
    });
  }

  return {
    fill,
    stroke,
    color,
    gradientBar,
    text,
    paragraph,
    pill,
    sectionTitle,
    imageCover,
    placeholder,
  };
}

/* ---------------------------------- Export -------------------------------- */

/**
 * @param {object} camera  data dari useGetCamera
 * @param {{ includeFinance?: boolean }} options
 */
export async function exportCameraPdf(camera, { includeFinance = false } = {}) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const k = createKit(doc);

  /* ----- Data turunan ----- */
  const price = toNumber(camera.price) ?? 0;
  const capital = toNumber(camera.capital);
  const strike = toNumber(camera.strikethrough_price);
  const stock = toNumber(camera.stock) ?? 0;
  const shutter = toNumber(camera.shutter_count);
  const hasDiscount = strike !== null && strike > price;
  const discountPercent = hasDiscount
    ? Math.round(((strike - price) / strike) * 100)
    : 0;
  const profit =
    toNumber(camera.profit) ?? (capital !== null ? price - capital : null);
  const margin = profit !== null && price > 0 ? (profit / price) * 100 : null;
  const markup = profit !== null && capital ? (profit / capital) * 100 : null;

  const images = (camera.images ?? [])
    .slice()
    .sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
    );
  const marketplaces = camera.marketplaceLinks ?? [];

  /* ----- Muat gambar (maks 5: 1 utama + 4 thumbnail) ----- */
  const loaded = await Promise.all(
    images.slice(0, 5).map((img) => loadImage(img.image_url)),
  );

  /* ----- Dekorasi halaman lanjutan ----- */
  function decoratePage() {
    k.gradientBar(0, 0, PAGE.w, 2.5);
  }

  function ensureSpace(y, needed) {
    if (y + needed <= PAGE.h - 16) return y;
    doc.addPage();
    decoratePage();
    return PAGE.margin + 4;
  }

  /* ----- Masthead: band merah tua ----- */
  const bandH = 22;
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.rect(0, 0, PAGE.w, bandH, "F");
  k.gradientBar(0, bandH, PAGE.w, 1.6);

  k.text("LEMBAR PRODUK", PAGE.margin, 14, {
    size: 16,
    style: "bold",
    c: C.white,
  });
  k.text(formatDateTime(), PAGE.w - PAGE.margin, 14, {
    size: 8,
    c: C.onDark,
    align: "right",
  });

  /* ----- Judul ----- */
  let y = bandH + 1.6 + 9;
  const tagY = y;
  let tx = PAGE.margin;
  if (camera.category?.name)
    tx += k.pill(camera.category.name, tx, tagY, "dark") + 2;
  tx +=
    k.pill(
      CONDITION_LABEL[camera.condition] ?? camera.condition ?? "-",
      tx,
      tagY,
      camera.condition === "NEW" ? "accent" : "dark",
    ) + 2;
  if (camera.promo) tx += k.pill("Promosi aktif", tx, tagY, "outline") + 2;
  if (camera.best_selling) k.pill("Best seller", tx, tagY, "outline");
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(camera.name ?? "-", CONTENT_W);
  k.color(INK.main);
  doc.text(titleLines.slice(0, 2), PAGE.margin, y);
  y += Math.min(titleLines.length, 2) * 8 + 4;

  /* ----- Dua kolom: galeri | harga + spesifikasi ----- */
  const galleryW = 84;
  const gap = 8;
  const rightX = PAGE.margin + galleryW + gap;
  const rightW = CONTENT_W - galleryW - gap;
  const topY = y;

  // Galeri
  if (loaded[0]) k.imageCover(loaded[0], PAGE.margin, topY, galleryW, galleryW);
  else k.placeholder(PAGE.margin, topY, galleryW, galleryW);

  if (hasDiscount) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const label = `Hemat ${discountPercent}%`;
    const w = doc.getTextWidth(label) + 8;
    k.gradientBar(PAGE.margin + 4, topY + 4, w, 6);
    k.text(label, PAGE.margin + 4 + w / 2, topY + 8.1, {
      size: 8,
      style: "bold",
      c: C.white,
      align: "center",
    });
  }

  let galleryBottom = topY + galleryW;
  const thumbs = loaded.slice(1).filter(Boolean);
  if (thumbs.length > 0) {
    const tgap = 2;
    const tsize = (galleryW - tgap * 3) / 4;
    thumbs.forEach((img, i) =>
      k.imageCover(
        img,
        PAGE.margin + i * (tsize + tgap),
        galleryBottom + 4,
        tsize,
        tsize,
        2,
      ),
    );
    galleryBottom += 4 + tsize;
  }
  k.text(`${images.length} gambar`, PAGE.margin, galleryBottom + 6, {
    size: 8,
    c: INK.muted,
  });
  galleryBottom += 8;

  // Kolom kanan: kotak harga (tint + bar merah tua di kiri)
  const priceBoxH = hasDiscount ? 29 : 21;
  k.fill(C.tint);
  doc.rect(rightX, topY, rightW, priceBoxH, "F");
  k.fill(C.dark);
  doc.rect(rightX, topY, 1.4, priceBoxH, "F");

  k.text("HARGA JUAL", rightX + 6, topY + 6, {
    size: 7,
    style: "bold",
    c: C.accent,
  });
  k.text(formatRupiah(price), rightX + 6, topY + 15, {
    size: 20,
    style: "bold",
    c: C.dark,
  });

  if (hasDiscount) {
    const strikeY = topY + 23;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const strikeLabel = formatRupiah(strike);
    k.color(INK.muted);
    doc.text(strikeLabel, rightX + 6, strikeY);
    const sw = doc.getTextWidth(strikeLabel);
    k.stroke(INK.muted);
    doc.setLineWidth(0.3);
    doc.line(rightX + 6, strikeY - 1.2, rightX + 6 + sw, strikeY - 1.2);
    k.text(
      `Potongan ${formatRupiah(strike - price)}`,
      rightX + 6 + sw + 4,
      strikeY,
      { size: 8, style: "bold", c: C.accent },
    );
  }

  let ry = topY + priceBoxH + 5;

  // Stok
  const outOfStock = stock <= 0;
  const stockLow = stock > 0 && stock <= 3;
  k.fill(INK.soft);
  doc.roundedRect(rightX, ry, rightW, 14, 3, 3, "F");
  k.text("Stok", rightX + 4, ry + 5.5, { size: 8, c: INK.muted });
  k.text(
    outOfStock ? "Habis" : `${formatNumber(stock)} unit`,
    rightX + 4,
    ry + 11,
    {
      size: 11,
      style: "bold",
      c: outOfStock ? C.accent : INK.main,
    },
  );
  if (stockLow)
    k.text("Stok menipis", rightX + rightW - 4, ry + 11, {
      size: 8,
      style: "bold",
      c: C.accent,
      align: "right",
    });
  ry += 22;

  // Spesifikasi
  const specs = [
    ["Kategori", camera.category?.name ?? "-"],
    ["SKU", camera.sku || "-"],
    ["Serial number", camera.serial_number || "-"],
    ["Warna", camera.color ? String(camera.color) : "-"],
    ["Kondisi", CONDITION_LABEL[camera.condition] ?? camera.condition ?? "-"],
    ["Shutter count", shutter !== null ? `${formatNumber(shutter)} klik` : "-"],
  ];

  ry = k.sectionTitle("Spesifikasi", rightX, ry, rightW);

  specs.forEach(([label, value], i) => {
    k.text(label, rightX, ry, { size: 9, c: INK.muted });
    const lines = doc.splitTextToSize(String(value), rightW * 0.58);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    k.color(INK.main);
    doc.text(lines[0] ?? "-", rightX + rightW, ry, { align: "right" });
    k.stroke(INK.line);
    doc.setLineWidth(0.2);
    if (i < specs.length - 1)
      doc.line(rightX, ry + 2.5, rightX + rightW, ry + 2.5);
    ry += 7;
  });

  y = Math.max(galleryBottom, ry) + 8;

  /* ----- Deskripsi ----- */
  y = ensureSpace(y, 30);
  y = k.sectionTitle("Deskripsi", PAGE.margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const descLines = doc.splitTextToSize(
    camera.description || "Tidak ada deskripsi.",
    CONTENT_W,
  );
  for (const line of descLines) {
    y = ensureSpace(y, 6);
    k.text(line, PAGE.margin, y, { size: 10, c: INK.text });
    y += 5;
  }
  y += 6;

  /* ----- Kelengkapan ----- */
  y = ensureSpace(y, 24);
  y = k.sectionTitle("Kelengkapan", PAGE.margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const incLines = doc.splitTextToSize(
    camera.inclusions || "Tidak ada informasi kelengkapan.",
    CONTENT_W,
  );
  for (const line of incLines) {
    y = ensureSpace(y, 6);
    k.text(line, PAGE.margin, y, { size: 10, c: INK.text });
    y += 5;
  }
  y += 6;

  /* ----- Marketplace ----- */
  if (marketplaces.length > 0) {
    y = ensureSpace(y, 24);
    y = k.sectionTitle("Marketplace", PAGE.margin, y);

    for (const item of marketplaces) {
      y = ensureSpace(y, 10);
      const name = item.marketplace?.name ?? "Marketplace";
      k.text(name, PAGE.margin, y, { size: 10, style: "bold" });

      if (item.product_url) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        k.color(C.accent);
        const short = doc.splitTextToSize(item.product_url, CONTENT_W - 40)[0];
        doc.textWithLink(short, PAGE.margin + 36, y, { url: item.product_url });
      }
      y += 7;
    }
    y += 4;
  }

  /* ----- Keuangan (opsional, internal) ----- */
  if (includeFinance) {
    y = ensureSpace(y, 64);
    y = k.sectionTitle("Informasi keuangan (internal)", PAGE.margin, y);

    const profitColor = profit !== null && profit < 0 ? C.accent : C.green;

    const rows = [
      ["Modal per unit", formatRupiah(capital), null],
      ["Harga jual", formatRupiah(price), null],
      [
        "Profit per unit",
        profit !== null ? formatRupiah(profit) : "-",
        profitColor,
      ],
      ["Margin", margin !== null ? formatPercent(margin) : "-", null],
      [
        "Markup dari modal",
        markup !== null ? formatPercent(markup) : "-",
        null,
      ],
    ];

    rows.forEach(([label, value, c], i) => {
      k.text(label, PAGE.margin, y, { size: 9, c: INK.muted });
      k.text(value, PAGE.w - PAGE.margin, y, {
        size: 9,
        style: "bold",
        c: c ?? INK.main,
        align: "right",
      });
      if (i < rows.length - 1) {
        k.stroke(INK.line);
        doc.setLineWidth(0.2);
        doc.line(PAGE.margin, y + 2.5, PAGE.w - PAGE.margin, y + 2.5);
      }
      y += 7;
    });
    y += 4;

    const boxes = [
      [
        "Modal tertanam",
        capital !== null ? formatRupiah(capital * stock) : "-",
        INK.main,
      ],
      ["Nilai stok", formatRupiah(price * stock), INK.main],
      [
        "Potensi profit",
        profit !== null ? formatRupiah(profit * stock) : "-",
        profitColor,
      ],
    ];
    const bw = (CONTENT_W - 8) / 3;
    boxes.forEach(([label, value, c], i) => {
      const bx = PAGE.margin + i * (bw + 4);
      k.fill(C.tint);
      doc.rect(bx, y, bw, 16, "F");
      k.fill(C.dark);
      doc.rect(bx, y, 1.2, 16, "F");
      k.text(label, bx + 5, y + 6, { size: 8, c: INK.muted });
      k.text(value, bx + 5, y + 12, { size: 10, style: "bold", c });
    });
    y += 22;
  }

  /* ----- Footer semua halaman ----- */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    k.stroke(INK.line);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, PAGE.h - 14, PAGE.w - PAGE.margin, PAGE.h - 14);
    k.text(`ID produk: ${camera.id ?? "-"}`, PAGE.margin, PAGE.h - 8, {
      size: 7,
      c: INK.muted,
    });
    k.text(
      `Dicetak ${formatDateTime()}  ·  Halaman ${p}/${total}`,
      PAGE.w - PAGE.margin,
      PAGE.h - 8,
      {
        size: 7,
        c: INK.muted,
        align: "right",
      },
    );

    // Strip bawah merah tua
    k.fill(C.dark);
    doc.rect(0, PAGE.h - 2.5, PAGE.w, 2.5, "F");
  }

  const safeName = String(camera.name ?? "produk")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  doc.save(`produk-${safeName || "kamera"}.pdf`);
}
