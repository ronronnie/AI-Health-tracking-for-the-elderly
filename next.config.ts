import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent webpack from trying to bundle Node-only packages used in API routes
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
