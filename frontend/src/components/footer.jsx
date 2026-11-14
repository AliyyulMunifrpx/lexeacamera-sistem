import Image from "next/image.js";
import Link from "next/link.js";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
import { FiArrowRight } from "react-icons/fi";
import { SiShopee } from "react-icons/si";

/* Samakan dengan MENU_ITEMS di navbar. */
const MENU_ITEMS = [
  { label: "Beranda", href: "/" },
  { label: "Produk", href: "/products" },
  { label: "Kontak", href: "/contact" },
  { label: "Syarat dan Ketentuan", href: "/terms-and-condition" },
];

const WA_MESSAGE = "Halo, saya ingin bertanya.";
const MAP_PREFIX = "https://www.google.com/maps/embed";

function normalizeUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

/* Terima URL embed langsung, atau potongan <iframe ... src="..."> dari Google Maps.
   Hanya URL embed Google Maps yang diizinkan. */
function normalizeMapUrl(value) {
  let url = String(value ?? "").trim();
  if (!url) return "";
  const fromIframe = url.match(/src=["']([^"']+)["']/i);
  if (fromIframe) url = fromIframe[1];
  url = url.replace(/&amp;/g, "&");
  return url.startsWith(MAP_PREFIX) ? url : "";
}

const LINK_CLASS =
  "text-sm font-medium uppercase tracking-wider text-primary/80 transition-colors hover:text-primary";

/* Link navigasi: panah muncul dan teks bergeser saat di-hover atau fokus. */
function NavLink({ href, children }) {
  return (
    <Link
      href={href}
      className={`${LINK_CLASS} group inline-flex items-center gap-2 border-b border-transparent pb-0.5 hover:border-primary focus-visible:border-primary`}
    >
      <span className="transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none">
        {children}
      </span>
      <FiArrowRight
        aria-hidden="true"
        className="h-4 w-4 -translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
      />
    </Link>
  );
}

/**
 * instagram: store.instagram
 * shopee: store.facebook (kolom facebook dipakai untuk link Shopee)
 * mapUrl: URL embed Google Maps dari backend
 * slogan: opsional, tampil di bawah nama toko
 */
export default function Footer({
  logo,
  name,
  slogan = "",
  address = "",
  phone = "",
  email = "",
  whatsapp = "",
  instagram = "",
  shopee = "",
  mapUrl = "",
}) {
  const waNumber = normalizePhone(whatsapp);
  const waUrl = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(WA_MESSAGE)}`
    : "";
  const mapSrc = normalizeMapUrl(mapUrl);

  const socials = [
    { label: "Instagram", href: normalizeUrl(instagram), icon: FaInstagram },
    { label: "Shopee", href: normalizeUrl(shopee), icon: SiShopee },
    { label: "WhatsApp", href: waUrl, icon: FaWhatsapp },
  ].filter((item) => item.href);

  const hasContact = Boolean(address || phone || email);

  return (
    <footer className="relative z-20 w-full bg-second">
      <div className="mx-auto w-full px-8 lg:px-16 pt-12">
        {/* lg: nama/logo | peta | navigasi | alamat. Di bawah lg menumpuk. */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          {/* Kiri: logo + nama */}
          <div className="flex flex-col gap-2 lg:max-w-100 lg:shrink-0">
            <Link href="/" className="flex w-fit items-center gap-3">
              {logo && (
                <div className="relative aspect-square h-10 shrink-0">
                  <Image
                    alt="store logo"
                    src={logo}
                    fill
                    className="h-full w-full rounded-full"
                  />
                </div>
              )}
              <span className="text-3xl font-bold uppercase tracking-wide text-primary">
                {name}
              </span>
            </Link>
            {slogan && (
              <p className="text-sm uppercase tracking-wider text-primary/70">
                {slogan}
              </p>
            )}
          </div>

          {/* Peta: mengisi sisa lebar */}
          {mapSrc && (
            <div className="h-56 w-full overflow-hidden rounded-xl border border-primary/30 lg:min-w-0 lg:flex-1">
              <iframe
                title={`Lokasi ${name}`}
                src={mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="block h-full w-full"
              />
            </div>
          )}

          {/* Navigasi */}
          <nav aria-label="Menu footer" className="lg:shrink-0">
            <ul className="flex flex-col gap-3">
              {MENU_ITEMS.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Garis pemisah */}
        <div className="mt-10 border-t border-primary/30" />

        {/* Bawah: ikon sosial + copyright, rata tengah */}
        <div className="flex flex-col items-center gap-6 py-10">
          {socials.length > 0 && (
            <div className="flex items-center gap-8">
              {socials.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-10 items-center justify-center rounded-full border border-primary/80 text-primary transition-colors hover:bg-primary hover:text-second"
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </a>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-primary/70">
            © {new Date().getFullYear()} {name}. Hak cipta dilindungi.
          </p>
        </div>
      </div>
    </footer>
  );
}
