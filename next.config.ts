import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    // Tell Next.js/Turbopack to treat these as native Node modules.
    // Without this, Turbopack re-bundles pg and @prisma/adapter-pg into its
    // own module graph, breaking the globalThis singleton pattern and causing
    // the PrismaClient to reference a different Pool instance on every
    // module re-evaluation → P1010 DatabaseAccessDenied / P1017 ConnectionClosed.
    "pg",
    "pg-native",
    "@prisma/adapter-pg",
    "@prisma/client",
  ],
};

export default nextConfig;
