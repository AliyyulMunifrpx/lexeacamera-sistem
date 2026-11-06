// components/owner/refresh-button.jsx
"use client";

import { FiRefreshCw } from "react-icons/fi";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";
export default function RefreshButton({
  onClick,
  isFetching = false,
  ariaLabel = "Perbarui data",
  className = "",
  labelIdle = "Perbarui",
  labelBusy = "Memperbarui…",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isFetching}
      aria-label={ariaLabel}
      aria-busy={isFetching}
      className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${className}`}
    >
      <FiRefreshCw
        size={16}
        className={isFetching ? "animate-spin motion-reduce:animate-none" : ""}
        aria-hidden="true"
      />
      {isFetching ? labelBusy : labelIdle}
    </button>
  );
}
