import { useEffect, useState } from "react";
const priceFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});
function formatPrice(value) {
  const number = Number(value);

  if (value === null || value === undefined || Number.isNaN(number)) {
    return "0";
  }

  return priceFormatter.format(number);
}
function useBottomTone(src) {
  const [tone, setTone] = useState(null);

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (cancelled) return;

      try {
        const w = 24;
        const h = 12;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        // Ambil 25% bagian bawah gambar (area label harga)
        const sy = img.naturalHeight * 0.75;
        const sh = img.naturalHeight * 0.25;
        ctx.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, w, h);

        const { data } = ctx.getImageData(0, 0, w, h);
        let total = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          // Lewati piksel transparan
          if (data[i + 3] < 40) continue;
          total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          count += 1;
        }

        if (count === 0) return;

        setTone(total / count > 150 ? "light" : "dark");
      } catch {
        // Canvas "tainted" (CORS) -> biarkan default (putih)
      }
    };

    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return tone;
}

export default function PriceLabel({ item }) {
  const price = Number(item.price) || 0;
  const strikethrough = Number(item.strikethrough_price) || 0;
  const hasDiscount = strikethrough > price && price >= 0;

  const tone = useBottomTone(item.image_url);
  const isLight = tone === "light";

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-2 py-1 backdrop-blur-sm rounded-md">
      {hasDiscount && (
        <p
          className={`text-sm line-through text-center transition-colors ${
            isLight ? "text-black/70" : "text-primary/70"
          }`}
        >
          <span className="text-[10px]">Rp</span>
          {formatPrice(strikethrough)}
        </p>
      )}
      <p
        className={`text-base font-semibold text-center transition-colors ${
          isLight ? "text-black" : "text-primary"
        }`}
      >
        <span className="text-[10px]">Rp</span>
        {formatPrice(price)}
      </p>
    </div>
  );
}
