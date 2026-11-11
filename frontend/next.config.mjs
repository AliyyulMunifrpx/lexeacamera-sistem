/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL belum diset");
}

const nextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wdivgrgyywklfwhwsxug.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "secuozclimrjcdcsxjtb.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    agentFeedback: true,
    instantInsights: {
      validationLevel: "manual-warning",
    },
    proxyClientMaxBodySize: "50mb",
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
