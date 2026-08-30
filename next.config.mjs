/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // mysql2, stripe and razorpay are server-only; keep them external to the bundle
  experimental: {
    serverComponentsExternalPackages: ["mysql2", "stripe", "razorpay", "@omnidim-ai/sdk"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
