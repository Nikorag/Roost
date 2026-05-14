import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
  // Allow dev access from LAN devices (e.g. testing on a phone).
  allowedDevOrigins: ["192.168.1.39"],
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
    // nodeMiddleware is recognized at runtime but not yet typed.
    ...(({ nodeMiddleware: true } as unknown) as Record<string, unknown>),
  },
};

export default config;
