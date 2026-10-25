"use client";

import Image from "next/image.js";
import Link from "next/link.js";
import { FiEdit2, FiShoppingBag, FiTrash2 } from "react-icons/fi";

function StatusBadge({ isActive }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        isActive
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-second/5 text-second/60"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          isActive ? "bg-emerald-500" : "bg-second/40"
        }`}
      />
      {isActive ? "Aktif" : "Nonaktif"}
    </span>
  );
}

export default function MarketplaceCard({
  marketplace,
  onDelete,
  isDeleting = false,
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-second/30 bg-primary p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-second/25 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-inner transition-transform group-hover:scale-105">
            {marketplace.logo_url ? (
              <Image
                src={marketplace.logo_url}
                alt={`Logo ${marketplace.name}`}
                width={80}
                height={80}
                className="h-full w-full object-contain"
              />
            ) : (
              <FiShoppingBag size={24} className="text-second/40" />
            )}
          </div>

          <div className="min-w-0">
            <span className="inline-block rounded-md bg-second/5 text-xs font-medium uppercase tracking-wide text-second/60">
              Marketplace
            </span>

            <h2 className="mt-1 line-clamp-2 break-words text-base font-bold text-second">
              {marketplace.name}
            </h2>
          </div>
        </div>

        <StatusBadge isActive={marketplace.is_active} />
      </div>

      <div className="mt-auto flex gap-2 pt-5">
        <Link
          href={`/admin/marketplaces/${marketplace.id}/edit`}
          className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-second px-3 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-second/80"
        >
          <FiEdit2 size={14} />
          <span>Edit</span>
        </Link>

        <button
          type="button"
          onClick={() => onDelete(marketplace)}
          disabled={isDeleting}
          className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-second2 px-3 py-2.5 text-xs font-semibold text-primary transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiTrash2 size={14} />
          <span>{isDeleting ? "Menghapus..." : "Hapus"}</span>
        </button>
      </div>
    </article>
  );
}
