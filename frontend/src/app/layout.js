import { Geist, Geist_Mono } from "next/font/google";
import { cacheLife } from "next/cache";
import "./globals.css";
import Providers from "./providers.jsx";
import { Toaster } from "react-hot-toast";
import BackgroundVideo from "../components/public/home/background-video.jsx";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const SITE_URL = /^https?:\/\//.test(rawSiteUrl)
  ? rawSiteUrl
  : `https://${rawSiteUrl}`;
const FALLBACK_NAME = "WAV Camera";

// Data toko diambil dari endpoint publik dan di-cache lewat "use cache".
// Sukses: cache 5 menit. Gagal (backend gratisan lambat bangun): cache singkat
// supaya fallback tidak tertahan lama.
async function getStore() {
  try {
    const response = await fetch(`${API_URL}/public/store`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return null;

    const json = await response.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata() {
  const store = await getStore();

  const name = store?.name?.trim() || FALLBACK_NAME;
  const description = `${name} menjual kamera, lensa, tripod, dan perlengkapan kamera, baru maupun bekas. Cek harga, stok, dan promo terbaru.`;
  const image = store?.main_banner_url || store?.logo_url || null;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${name} | Jual Kamera dan Perlengkapan Kamera`,
      template: `%s | ${name}`,
    },
    description,
    applicationName: name,
    keywords: [
      name,
      "jual kamera",
      "kamera bekas",
      "kamera DSLR",
      "kamera mirrorless",
      "lensa kamera",
      "tripod",
      "aksesoris kamera",
    ],
    icons: store?.logo_url
      ? { icon: store.logo_url, apple: store.logo_url }
      : undefined,
    openGraph: {
      type: "website",
      locale: "id_ID",
      siteName: name,
      title: name,
      description,
      url: "/",
      images: image ? [{ url: image, alt: name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative isolate min-h-full flex flex-col bg-primary">
        <Toaster></Toaster>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
