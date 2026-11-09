import {
  displayValue,
  formatCurrency,
  formatDate,
} from "./invoice-formatters.js";

/* Elemen ini hanya muncul saat mencetak struk thermal.
   Style print (termasuk .no-print) ikut didefinisikan di sini. */

/* Diskon produk per unit = harga coret - harga jual. 0 jika tidak ada harga coret.
   Sama persis dengan logika PDF (unitDiscount). */
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

export default function ThermalReceipt({ invoice, paperWidth }) {
  const items = invoice.items ?? [];
  const isFinal = invoice.is_final === true;
  const isRefund = invoice.type === "REFUND";
  const receiptWidth = paperWidth === "58" ? "48mm" : "70mm";

  // Diskon produk total: selisih harga coret dan harga jual × qty.
  const productDiscountTotal = items.reduce(
    (sum, item) => sum + unitDiscount(item) * (Number(item.quantity) || 0),
    0,
  );
  const showProductDiscount = !isRefund && productDiscountTotal > 0;

  return (
    <>
      <style jsx global>{`
        #thermal-receipt {
          display: none;
        }

        @media print {
          @page {
            size: auto;
            margin: 0;
          }

          body * {
            visibility: hidden !important;
          }

          #thermal-receipt,
          #thermal-receipt * {
            visibility: visible !important;
          }

          #thermal-receipt {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: var(--receipt-width) !important;
            max-width: var(--receipt-width) !important;
            height: auto !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 3mm !important;
            overflow: visible !important;
            background: #fff !important;
            color: #111 !important;
            box-shadow: none !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 9pt !important;
            line-height: 1.35 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          #thermal-receipt * {
            color: #111 !important;
            background-color: transparent !important;
            box-shadow: none !important;
          }

          #thermal-receipt .receipt-divider {
            border-color: #888 !important;
          }

          /* Harga coret & keterangan diskon tetap terbaca di printer thermal
             (monokrom): pakai garis coret + teks biasa, tanpa warna. */
          #thermal-receipt .receipt-strike {
            text-decoration: line-through !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <section
        id="thermal-receipt"
        aria-hidden="true"
        style={{ "--receipt-width": receiptWidth }}
      >
        <div className="text-center">
          <p className="text-base font-bold">
            {displayValue(invoice.store_name)}
          </p>

          <p className="mt-1 whitespace-pre-wrap break-words text-xs">
            {displayValue(invoice.store_address)}
          </p>

          {invoice.whatsapp_store && (
            <p className="mt-1 text-xs">WA: {invoice.whatsapp_store}</p>
          )}

          {invoice.instagram_store && (
            <p className="mt-1 text-xs">IG: {invoice.instagram_store}</p>
          )}
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div>
          <p className="break-all font-bold">{invoice.no_invoice}</p>
          <p className="mt-1 text-xs">{formatDate(invoice.created_at)}</p>
          <p className="mt-1 text-xs">
            Status: {isFinal ? "FINAL" : "BELUM FINAL"}
          </p>
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div>
          <p className="font-bold">PELANGGAN</p>
          <p className="mt-1 break-words">
            {displayValue(invoice.customer_name)}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs">
            {displayValue(invoice.customer_address)}
          </p>
          <p className="mt-1 break-words text-xs">
            WA: {displayValue(invoice.customer_whatsapp)}
          </p>
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div>
          {items.map((item) => {
            const perUnitDiscount = unitDiscount(item);
            const hasItemDiscount = perUnitDiscount > 0;

            return (
              <div key={item.id} className="mb-3">
                <p className="break-words font-semibold">{item.camera_name}</p>

                {/* Harga satuan — coret harga normal jika ada diskon */}
                <div className="mt-1 flex justify-between gap-2 text-xs">
                  <span>
                    {item.quantity} ×{" "}
                    {hasItemDiscount ? (
                      <>
                        <span className="receipt-strike">
                          {formatCurrency(item.strikethrough_price)}
                        </span>{" "}
                        {formatCurrency(item.camera_price)}
                      </>
                    ) : (
                      formatCurrency(item.camera_price)
                    )}
                  </span>
                  <span className="shrink-0">
                    {formatCurrency(item.line_total)}
                  </span>
                </div>

                {/* Keterangan diskon per unit */}
                {hasItemDiscount && (
                  <p className="mt-1 text-xs font-semibold">
                    Diskon produk {formatCurrency(perUnitDiscount)} / unit
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div className="space-y-1.5 text-xs">
          {/* Baris "Harga normal" & "Diskon produk" hanya untuk non-refund */}
          {showProductDiscount && (
            <>
              <div className="flex justify-between gap-2">
                <span>Harga normal</span>
                <span>
                  {formatCurrency(
                    (Number(invoice.subtotal) || 0) + productDiscountTotal,
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Diskon produk</span>
                <span>{discountText(productDiscountTotal)}</span>
              </div>
            </>
          )}

          <div className="flex justify-between gap-2">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>

          <div className="flex justify-between gap-2">
            <span>Diskon toko</span>
            <span>{formatCurrency(invoice.store_discount)}</span>
          </div>

          <div className="flex justify-between gap-2">
            <span>Diskon pelanggan</span>
            <span>{formatCurrency(invoice.customer_discount)}</span>
          </div>
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div className="flex items-start justify-between gap-2 font-bold">
          <span>TOTAL</span>
          <span className="text-right">
            {formatCurrency(invoice.total_amount)}
          </span>
        </div>

        <div className="mt-3 space-y-1 text-xs">
          <p>Pembayaran: {displayValue(invoice.payment_method)}</p>
          <p>Pengiriman: {displayValue(invoice.ship)}</p>
        </div>

        <div className="receipt-divider my-3 border-t border-dashed" />

        <div className="text-center">
          <p className="font-bold">Terima kasih</p>
          <p className="mt-1 text-xs">
            Simpan struk ini sebagai bukti transaksi.
          </p>
        </div>
      </section>
    </>
  );
}
