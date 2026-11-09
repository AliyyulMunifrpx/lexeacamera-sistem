"use client";

import { FiArrowUpRight, FiExternalLink, FiMapPin } from "react-icons/fi";
import { FaFacebook, FaInstagram, FaTiktok, FaWhatsapp } from "react-icons/fa";

// Contoh: "@wavcamera" -> "wavcamera"
function cleanHandle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "");
}

// Nomor WhatsApp dari API bisa "0823...", "62823...", atau "823...".
// Hasilnya selalu berawalan 62.
function normalizeWhatsapp(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

// 6282329475745 -> "+62 823-2947-5745"
function formatWhatsapp(normalized) {
  const local = normalized.slice(2);
  const parts = local.match(/^(\d{3})(\d{4})(\d+)$/);

  return parts ? `+62 ${parts[1]}-${parts[2]}-${parts[3]}` : `+${normalized}`;
}

function isGoogleMapsEmbed(url) {
  return (
    typeof url === "string" &&
    url.startsWith("https://www.google.com/maps/embed")
  );
}

function ContactItem({ href, icon: Icon, label, value }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 transition-colors hover:bg-primary/5 border-b border-primary/30 pb-4"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-second">
        <Icon size={19} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-primary/50">{label}</p>
        <p className="truncate text-sm font-medium text-primary">{value}</p>
      </div>

      <FiArrowUpRight
        size={16}
        className="shrink-0 text-primary/30 transition-colors group-hover:text-primary"
      />
    </a>
  );
}

// Teks syarat & ketentuan dari API memakai \r\n, tab, dan "•".
// Dipecah per baris supaya judul, poin, dan sub-poin tampil rapi.
function TermsContent({ text }) {
  const lines = text
    .split(/\r?\n/)
    .map((raw) => {
      const tabs = raw.match(/^\t*/)[0].length;
      return { content: raw.trim(), tabs };
    })
    .filter((line) => line.content !== "");

  return (
    <div className="space-y-2 text-sm text-primary/70">
      {lines.map((line, index) => {
        if (/^\d+\.\s/.test(line.content)) {
          return (
            <h3
              key={index}
              className={`font-semibold text-primary ${index > 0 ? "pt-3" : ""}`}
            >
              {line.content}
            </h3>
          );
        }

        const isBullet = line.content.startsWith("•");
        const content = isBullet
          ? line.content.replace(/^•\s*/, "")
          : line.content;

        return (
          <p
            key={index}
            style={{ paddingLeft: `${line.tabs * 16}px` }}
            className={isBullet ? "flex gap-2" : ""}
          >
            {isBullet && <span className="text-primary/40">•</span>}
            <span>{content}</span>
          </p>
        );
      })}
    </div>
  );
}

export default function ContactHomePage({ data }) {
  const store = data?.store;

  if (!store) {
    return (
      <p className="py-10 text-center text-sm text-primary/50">
        Informasi kontak belum tersedia.
      </p>
    );
  }

  const whatsapp = normalizeWhatsapp(store.whatsapp);
  const instagram = cleanHandle(store.instagram);
  const tiktok = cleanHandle(store.tiktok);
  const facebook = cleanHandle(store.facebook);

  const contacts = [
    whatsapp && {
      key: "whatsapp",
      icon: FaWhatsapp,
      label: "WhatsApp",
      value: formatWhatsapp(whatsapp),
      href: `https://wa.me/${whatsapp}`,
    },
    instagram && {
      key: "instagram",
      icon: FaInstagram,
      label: "Instagram",
      value: `@${instagram}`,
      href: `https://www.instagram.com/${instagram}`,
    },
    tiktok && {
      key: "tiktok",
      icon: FaTiktok,
      label: "TikTok",
      value: `@${tiktok}`,
      href: `https://www.tiktok.com/@${tiktok}`,
    },
    facebook && {
      key: "facebook",
      icon: FaFacebook,
      label: "Facebook",
      value: facebook,
      href: `https://www.facebook.com/${facebook}`,
    },
  ].filter(Boolean);

  const hasMap = isGoogleMapsEmbed(store.map_url);
  const hasAddress = Boolean(store.address?.trim());
  const hasTerms = Boolean(store.terms_and_condition?.trim());

  const mapsLink = hasAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${store.name ?? ""} ${store.address}`.trim(),
      )}`
    : null;

  return (
    <div className="w-full space-y-4">
      {contacts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {contacts.map((item) => (
            <ContactItem
              key={item.key}
              href={item.href}
              icon={item.icon}
              label={item.label}
              value={item.value}
            />
          ))}
        </div>
      )}

      {(hasAddress || hasMap) && (
        <section className="space-y-4 rounded-md">
          {hasAddress && (
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-second">
                <FiMapPin size={19} />
              </div>

              <div className="min-w-0 flex-1 w-full">
                <p className="text-sm text-primary/70 w-full">
                  {store.address}
                </p>
              </div>
            </div>
          )}

          {hasMap && (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-second/5 sm:aspect-[16/9]">
              <iframe
                src={store.map_url}
                title={`Peta lokasi ${store.name ?? "toko"}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
