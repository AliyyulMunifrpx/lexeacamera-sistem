// components/owner/cancel-button.jsx
"use client";

import Link from "next/link.js";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

/**
 * Tombol sekunder untuk "Batal" / "Kembali" / "Selesai".
 *
 * Props:
 * - children: ReactNode       → isi tombol (default: "Batal")
 * - onClick?: () => void      → handler (jika bukan Link)
 * - href?: string             → jika diisi, render sebagai <Link>
 * - type?: "button" | "submit" → default "button"
 * - disabled?: boolean
 * - disabledHint?: boolean    → default true. Jika true, hover jadi merah (second2)
 *                                (untuk "Batal" di form). Jika false, hover ungu (second4)
 *                                (untuk navigasi seperti "Kembali").
 * - ariaLabel?: string
 * - className?: string        → tambahan (mis. "w-full sm:w-auto")
 * - fullWidth?: boolean       → shortcut untuk w-full
 */
export default function CancelButton({
  children = "Batal",
  onClick,
  href,
  type = "button",
  disabled = false,
  dangerHover = true,
  ariaLabel,
  className = "",
  fullWidth = false,
}) {
  const hoverClass = dangerHover
    ? "hover:border-second2 hover:text-second2"
    : "hover:border-second4 hover:text-second4";

  const sharedClass = `${BTN_BASE} border border-second/30 text-second ${hoverClass} disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
    fullWidth ? "w-full" : ""
  } ${className}`;

  if (href) {
    if (disabled) {
      return (
        <span
          aria-label={ariaLabel}
          aria-disabled="true"
          className={`${sharedClass} pointer-events-none opacity-50`}
        >
          {children}
        </span>
      );
    }

    return (
      <Link href={href} aria-label={ariaLabel} className={sharedClass}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={sharedClass}
    >
      {children}
    </button>
  );
}
