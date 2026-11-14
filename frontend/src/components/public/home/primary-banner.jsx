"use client";
import Image from "next/image.js";
import Link from "next/link.js";
import { useEffect, useState } from "react";
import PriceLabel from "../../price-label.jsx";

// Mengembalikan "dark" | "light" | null (null = belum/ gagal terdeteksi)
// "dark"  = area bawah gambar gelap  -> teks putih
// "light" = area bawah gambar terang -> teks hitam

export default function PrimaryBanner({ banner, cameras }) {
  return (
    <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden">
      {banner?.banner_url ? (
        <Image
          src={banner.banner_url}
          alt="best selling banner"
          fill
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-grad" />
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10 p-5">
        <div className="flex flex-wrap gap-5">
          {cameras.map((item) => (
            <Link
              href={`/${item.id}`}
              key={item.id}
              className="relative block w-[calc(50%-10px)] aspect-square shrink-0 overflow-hidden rounded-lg"
            >
              <Image
                alt={`${item.name} photo`}
                fill
                src={item.image_url}
                className="object-cover"
              />

              <PriceLabel item={item} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
