"use client";

import { useEffect, useRef, useState } from "react";

// Jarak vertikal antar kartu, dalam px.
const ROW_GAP = 8;

function MasonryItem({ children }) {
  const contentRef = useRef(null);
  const [span, setSpan] = useState(null);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const update = () => setSpan(Math.ceil(node.offsetHeight) + ROW_GAP);
    update();

    // Hitung ulang saat gambar selesai dimuat atau ukuran layar berubah.
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="self-start"
      style={{
        gridRowEnd: span ? `span ${span}` : undefined,
        opacity: span ? 1 : 0,
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

export default function MasonryGrid({ children, className = "" }) {
  return (
    <div className={`grid auto-rows-[1px] gap-x-2 gap-y-0 ${className}`}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <MasonryItem key={child?.key ?? index}>{child}</MasonryItem>
          ))
        : children && <MasonryItem>{children}</MasonryItem>}
    </div>
  );
}
