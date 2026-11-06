// components/owner/primary-button.jsx
"use client";

import Link from "next/link.js";
import { FiLoader } from "react-icons/fi";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

/**
 * Tombol aksi utama (gradient ungu).
 *
 * Props:
 * - children: ReactNode       → isi tombol (icon + teks)
 * - onClick?: () => void      → handler (jika bukan Link)
 * - href?: string             → jika diisi, render sebagai <Link>
 * - type?: "button" | "submit" → default "button" (atau "submit" jika dalam form)
 * - isLoading?: boolean       → spinner + disabled
 * - loadingText?: string      → teks saat loading (default: children tetap, spinner ditambah)
 * - disabled?: boolean        → disabled manual
 * - ariaLabel?: string
 * - ariaBusy?: boolean        → default = isLoading
 * - className?: string        → tambahan (mis. "w-full sm:w-auto")
 * - fullWidth?: boolean       → shortcut untuk w-full
 */
export default function PrimaryButton({
  children,
  onClick,
  href,
  type = "button",
  isLoading = false,
  loadingText,
  disabled = false,
  ariaLabel,
  ariaBusy,
  className = "",
  fullWidth = false,
}) {
  const isDisabled = disabled || isLoading;
  const content = isLoading ? (
    <>
      <FiLoader
        className="animate-spin motion-reduce:animate-none"
        size={16}
        aria-hidden="true"
      />
      {loadingText ?? children}
    </>
  ) : (
    children
  );

  const sharedClass = `${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${
    fullWidth ? "w-full" : ""
  } ${className}`;

  if (href && !isDisabled) {
    return (
      <Link href={href} aria-label={ariaLabel} className={sharedClass}>
        {content}
      </Link>
    );
  }

  if (href && isDisabled) {
    // Link yang disabled: render sebagai <span> agar tidak bisa diklik
    return (
      <span
        aria-label={ariaLabel}
        aria-disabled="true"
        className={`${sharedClass} pointer-events-none opacity-50`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={ariaBusy ?? isLoading}
      className={sharedClass}
    >
      {content}
    </button>
  );
}
