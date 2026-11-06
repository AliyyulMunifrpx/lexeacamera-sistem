import Image from "next/image.js";
import Link from "next/link.js";
import { FiCamera, FiPackage } from "react-icons/fi";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const CONDITION_LABEL = {
  NEW: "Baru",
  SECOND: "Bekas",
};

function formatPrice(price) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);
}

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function stockTag(stock) {
  const value = Number(stock) || 0;
  if (value <= 0) return { tone: "failure", label: "Habis" };
  if (value <= 3) return { tone: "pending", label: `${value} unit` };
  return { tone: "soft", label: `${value} unit` };
}

export default function CameraCard({ camera, role }) {
  const image =
    camera.images?.find((item) => item.is_primary) ?? camera.images?.[0];
  const stock = stockTag(camera.stock);
  const condition = CONDITION_LABEL[camera.condition] ?? camera.condition;
  console.log(role);
  return (
    <Link
      href={`/${role}/cameras/${camera.id}`}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-second/15 bg-primary shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
    >
      {/* Gambar */}
      <div className="relative aspect-square overflow-hidden bg-second/10">
        {image?.image_url ? (
          <Image
            width={1600}
            height={1600}
            src={image.image_url}
            alt={camera.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-second/40">
            <FiCamera size={32} aria-hidden="true" />
            <span className="text-xs">Tidak ada foto</span>
          </div>
        )}

        {/* Kategori di kiri atas */}
        <span className="absolute left-2 top-2">
          <Tag>{camera.category?.name ?? "Tanpa kategori"}</Tag>
        </span>

        {/* Promo & best seller di kanan atas */}
        {(camera.promo || camera.best_selling) && (
          <div className="absolute right-2 top-2 flex flex-col items-end gap-2">
            {camera.best_selling && <Tag tone="solid">Best seller</Tag>}
            {camera.promo && <Tag tone="strong">Promo</Tag>}
          </div>
        )}
      </div>

      {/* Konten */}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="min-w-0">
          <h3
            className="line-clamp-2 break-words text-sm font-semibold text-second group-hover:text-second4"
            title={camera.name}
          >
            {camera.name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {condition && <Tag>{condition}</Tag>}
            {camera.sku && (
              <span className="truncate font-mono text-xs text-second/60">
                {camera.sku}
              </span>
            )}
          </div>

          <p className="mt-2 text-base font-bold tabular-nums text-second">
            {formatPrice(camera.price)}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-second/10 pt-4">
          <div className="flex min-w-0 items-center gap-2 text-xs text-second/60">
            <FiPackage size={14} aria-hidden="true" />
            <span className="truncate">Stok tersedia</span>
          </div>

          <Tag tone={stock.tone}>{stock.label}</Tag>
        </div>
      </div>
    </Link>
  );
}
