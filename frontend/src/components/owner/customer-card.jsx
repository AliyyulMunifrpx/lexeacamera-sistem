import Link from "next/link.js";
import {
  FiInstagram,
  FiMapPin,
  FiMessageCircle,
  FiArrowRight,
  FiTag,
} from "react-icons/fi";
import PrimaryButton from "../primary-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

function formatPrice(value = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatNumber(value = 0) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

// "0812…" -> "62812…", "+62 812…" -> "62812…"
function toWaNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function toInstagramHandle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "");
}

function getInitials(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
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

function ContactRow({ icon: Icon, label, children }) {
  return (
    <li className="flex min-w-0 items-start gap-4">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
      >
        <Icon size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-second/60">{label}</p>
        <div className="mt-2 break-words text-sm font-semibold text-second">
          {children}
        </div>
      </div>
    </li>
  );
}

function ExternalLink({ href, label, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      aria-label={`${label} (membuka tab baru)`}
      className={`break-all underline underline-offset-2 transition-colors hover:text-second4 ${FOCUS_RING}`}
    >
      {children}
    </a>
  );
}

/* ---------------------------------- Card ---------------------------------- */

export default function CustomerCard({ customer, admin }) {
  const whatsapp = toWaNumber(customer.whatsapp);
  const instagram = toInstagramHandle(customer.instagram);
  const hasOrders = Number(customer.order_count) > 0;
  const name = customer.name || "Tanpa nama";
  const detailHref = `/${admin ? "admin" : "owner"}/customers/${customer.id}`;

  return (
    <article className="group flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5">
      {/* Header — bisa diklik ke detail */}
      <Link
        href={detailHref}
        className={`flex min-w-0 items-center gap-4 rounded-xl ${FOCUS_RING}`}
      >
        <div
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-grad text-lg font-bold text-primary shadow-lg shadow-second4/20"
        >
          {getInitials(name)}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-base font-bold text-second group-hover:text-second4"
            title={name}
          >
            {name}
          </h3>

          <p className="mt-2 truncate font-mono text-xs text-second/60">
            {customer.id}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hasOrders ? (
              <Tag tone="success">
                {formatNumber(customer.order_count)} pesanan
              </Tag>
            ) : (
              <Tag>Belum ada pesanan</Tag>
            )}
          </div>
        </div>
      </Link>

      {/* Ringkasan angka */}
      <dl className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl bg-second/[0.03] p-4">
          <dt className="text-xs text-second/60">Pesanan</dt>
          <dd className="mt-2 text-base font-bold tabular-nums text-second">
            {formatNumber(customer.order_count)}
          </dd>
        </div>

        <div className="min-w-0 rounded-xl bg-second/[0.03] p-4">
          <dt className="text-xs text-second/60">Total belanja</dt>
          <dd className="mt-2 break-words text-base font-bold tabular-nums text-second">
            {formatPrice(customer.total_spent)}
          </dd>
        </div>
      </dl>

      {/* Kontak */}
      <ul className="flex flex-col gap-4 border-t border-second/30 pt-4">
        <ContactRow icon={FiMessageCircle} label="WhatsApp">
          {whatsapp ? (
            <ExternalLink
              href={`https://wa.me/${whatsapp}`}
              label={`Chat ${name} lewat WhatsApp`}
            >
              <span className="tabular-nums">+{whatsapp}</span>
            </ExternalLink>
          ) : (
            "—"
          )}
        </ContactRow>

        <ContactRow icon={FiInstagram} label="Instagram">
          {instagram ? (
            <ExternalLink
              href={`https://instagram.com/${instagram}`}
              label={`Buka Instagram ${name}`}
            >
              @{instagram}
            </ExternalLink>
          ) : (
            "—"
          )}
        </ContactRow>

        <ContactRow icon={FiMapPin} label="Alamat">
          {customer.address?.trim() || "—"}
        </ContactRow>
      </ul>

      {/* Footer — aksi */}
      <footer className="mt-auto flex items-center justify-between gap-4 border-t border-second/30 pt-4">
        <p className="text-xs text-second/60">
          Bergabung{" "}
          <time dateTime={customer.created_at}>
            {formatDate(customer.created_at)}
          </time>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chat ${name} lewat WhatsApp (membuka tab baru)`}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
            >
              <FiMessageCircle size={16} aria-hidden="true" />
              Chat
            </a>
          )}

          <PrimaryButton
            href={detailHref}
            aria-label={`Lihat detail pelanggan ${name}`}
            className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
          >
            Detail
            <FiArrowRight size={16} aria-hidden="true" />
          </PrimaryButton>
        </div>
      </footer>
    </article>
  );
}
