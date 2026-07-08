// Standalone Prisma adapter connection test — run with:
//   node --env-file=.env src/scripts/test-prisma-connection.mjs

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

console.log("🔍 Testing Prisma adapter connection...\n");

// Match EXACTLY what db.ts does
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["query", "error", "warn"],
});

try {
  console.log("▶ Calling prisma.$queryRaw...");
  const result = await prisma.$queryRaw`SELECT current_database(), current_user`;
  console.log("✅ Prisma connected successfully!");
  console.log("   Result:", result);
} catch (err) {
  console.error("❌ Prisma connection failed:");
  console.error("   Code   :", err.code);
  console.error("   Message:", err.message);
  console.error("   Meta   :", JSON.stringify(err.meta, null, 2));
  if (err.cause) {
    console.error("   Cause  :", err.cause);
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
}
