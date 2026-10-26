import { Geist, Geist_Mono } from "next/font/google";
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

const SITE_URL = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "https://wavcamera.id";
const NAME = "WAV Camera";
const DESCRIPTION = `${NAME} menjual kamera, lensa, tripod, dan perlengkapan kamera, baru maupun bekas. Cek harga, stok, dan promo terbaru.`;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${NAME} | Jual Kamera dan Perlengkapan Kamera`,
    template: `%s | ${NAME}`,
  },
  icons: {
    icon: "/favicon.ico",
  },
  description: DESCRIPTION,
  applicationName: NAME,
  keywords: [
    NAME,
    "jual kamera",
    "kamera bekas",
    "kamera DSLR",
    "kamera mirrorless",
    "lensa kamera",
    "tripod",
    "aksesoris kamera",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: NAME,
    title: NAME,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: NAME,
    description: DESCRIPTION,
  },
};

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
