import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Prisma v7 + @prisma/adapter-pg — Turbopack-safe singleton
//
// WHY serverExternalPackages IS REQUIRED (next.config.ts):
//   Turbopack (Next.js 16 default dev bundler) re-evaluates server modules in
//   its own module graph. Without marking pg/@prisma as external, Turbopack
//   creates a SEPARATE copy of the pg Pool on every hot-reload while
//   globalThis still holds the OLD PrismaClient → P1010 / P1017 errors.
//   next.config.ts sets serverExternalPackages so Node.js require() is used
//   directly, keeping the module in the same global registry as globalThis.
//
// SINGLETON STRATEGY:
//   Pool + adapter + client are always created together as one atomic unit
//   and stored under a single globalThis key. Either all three exist or none.
// ---------------------------------------------------------------------------

type PrismaGlobal = {
  prismaInstance:
    | {
        pool: Pool;
        adapter: PrismaPg;
        client: PrismaClient;
      }
    | undefined;
};

const g = globalThis as unknown as PrismaGlobal;

function createPrismaInstance() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[db.ts] DATABASE_URL environment variable is not set. " +
        "Add it to your .env file."
    );
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    // Render/Supabase/Neon external hosts require SSL.
    // rejectUnauthorized: false accepts self-signed or managed certificates.
    ssl: { rejectUnauthorized: false },

    // Free-tier hosts cap connections at ~20-25 total across all services.
    max: 5,

    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,

    // Prevents the pool from being destroyed between serverless invocations.
    allowExitOnIdle: false,
  });

  // Surface pool-level errors to the console instead of crashing silently.
  pool.on("error", (err) => {
    console.error("[db.ts] pg Pool error:", err.message);
  });

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return { pool, adapter, client };
}

if (!g.prismaInstance) {
  g.prismaInstance = createPrismaInstance();
}

export const prisma = g.prismaInstance.client;