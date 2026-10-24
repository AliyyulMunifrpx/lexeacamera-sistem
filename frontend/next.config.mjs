/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wdivgrgyywklfwhwsxug.supabase.co",
        pathname: "/**", // Bikin wildcard penuh ke seluruh endpoint Supabase kamu
      },
      // Opsional: kalau mau support semua project Supabase lain sekaligus:
      // {
      //   protocol: "https",
      //   hostname: "*.supabase.co",
      //   pathname: "/**",
      // }
    ],
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
