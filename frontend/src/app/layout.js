import { Geist, Geist_Mono } from "next/font/google";
import { cacheLife } from "next/cache";
import "./globals.css";
import Providers from "./providers.jsx";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "https://wavcamera.id";
const FALLBACK_NAME = "WAV Camera";

// Data toko diambil dari endpoint publik dan di-cache lewat "use cache".
// cacheLife harus satu nilai tetap dengan expire >= 5 menit, supaya ikut
// diprerender (cache jangka pendek dianggap dynamic dan membuat build gagal).
async function getStore() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });

  try {
    const response = await fetch(`${API_URL}/public/store`, {
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
      <body className="min-h-full flex flex-col bg-primary">
        <Toaster></Toaster>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
