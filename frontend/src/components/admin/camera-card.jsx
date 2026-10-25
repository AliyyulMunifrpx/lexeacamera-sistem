import Image from "next/image.js";
import Link from "next/link.js";
import { FiCamera, FiPackage } from "react-icons/fi";

function formatPrice(price) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function CameraCard({ camera }) {
  const image = camera.images?.[0];
  console.log(image);
  return (
    <Link
      href={`/admin/cameras/${camera.id}`}
      className="group overflow-hidden rounded-2xl border border-second/30 bg-primary transition duration-200 hover:-translate-y-1 hover:border-second/50 hover:shadow-lg hover:shadow-second/5"
    >
      <div className="relative aspect-[1/1] overflow-hidden bg-second/5">
        {image ? (
          <Image
            width={1600}
            height={1600}
            src={image.image_url}
            alt={camera.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-second/30">
            <FiCamera size={36} />
            <span className="text-xs">Tidak ada foto</span>
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-second shadow-sm">
          {camera.category?.name ?? "Tanpa kategori"}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h3
            className="truncate text-base font-semibold text-second"
            title={camera.name}
          >
            {camera.name}
          </h3>

          <p className="mt-2 text-lg font-bold text-second">
            {formatPrice(camera.price)}
          </p>
        </div>

        <div className="flex items-center justify-between  pt-3">
          <div className="flex items-center gap-2 text-sm text-second/60">
            <FiPackage size={16} />
            <span>Stok tersedia</span>
          </div>

          <span
            className={`text-sm font-semibold ${
              camera.stock > 0 ? "text-second" : "text-second2"
            }`}
          >
            {camera.stock} unit
          </span>
        </div>
      </div>
    </Link>
  );
}
