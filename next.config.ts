import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
  // Allow dev access from LAN devices (e.g. testing on a phone).
  allowedDevOrigins: ["192.168.1.39"],
  // node-ical pulls in moment-timezone / rrule which break when bundled by
  // webpack on Vercel ("g.BigInt is not a function"). Letting Node require
  // them natively at runtime avoids the bundler's rewrite.
  serverExternalPackages: ["node-ical", "moment-timezone", "rrule"],
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
    // nodeMiddleware is recognized at runtime but not yet typed.
    ...(({ nodeMiddleware: true } as unknown) as Record<string, unknown>),
  },
};

export default config;
