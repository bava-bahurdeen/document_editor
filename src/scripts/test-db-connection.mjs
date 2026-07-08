// Standalone raw pg connection test — run with:
//   node --env-file=.env src/scripts/test-db-connection.mjs

import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in environment.");
  process.exit(1);
}

console.log("🔍 Testing connection to:", DATABASE_URL.replace(/:([^:@]+)@/, ":****@"));

// Test 1: No SSL
async function testNoSSL() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const res = await pool.query("SELECT current_database(), current_user, version()");
    console.log("✅ Test 1 (no SSL): Connected!");
    console.log("   Database:", res.rows[0].current_database);
    console.log("   User:    ", res.rows[0].current_user);
    await pool.end();
    return true;
  } catch (err) {
    console.log("❌ Test 1 (no SSL) failed:", err.message);
    await pool.end().catch(() => {});
    return false;
  }
}

// Test 2: SSL rejectUnauthorized false
async function testSSLFalse() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const res = await pool.query("SELECT current_database(), current_user");
    console.log("✅ Test 2 (ssl: rejectUnauthorized false): Connected!");
    console.log("   Database:", res.rows[0].current_database);
    console.log("   User:    ", res.rows[0].current_user);
    await pool.end();
    return true;
  } catch (err) {
    console.log("❌ Test 2 (ssl: rejectUnauthorized false) failed:", err.message);
    await pool.end().catch(() => {});
    return false;
  }
}

// Test 3: SSL true
async function testSSLTrue() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: true,
  });
  try {
    const res = await pool.query("SELECT current_database(), current_user");
    console.log("✅ Test 3 (ssl: true): Connected!");
    console.log("   Database:", res.rows[0].current_database);
    console.log("   User:    ", res.rows[0].current_user);
    await pool.end();
    return true;
  } catch (err) {
    console.log("❌ Test 3 (ssl: true) failed:", err.message);
    await pool.end().catch(() => {});
    return false;
  }
}

// Test 4: URL with ?sslmode=require and rejectUnauthorized false
async function testSSLModeRequire() {
  const url = DATABASE_URL.includes("sslmode")
    ? DATABASE_URL
    : DATABASE_URL + "?sslmode=require";
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const res = await pool.query("SELECT current_database(), current_user");
    console.log("✅ Test 4 (sslmode=require + rejectUnauthorized false): Connected!");
    console.log("   Database:", res.rows[0].current_database);
    console.log("   User:    ", res.rows[0].current_user);
    await pool.end();
    return true;
  } catch (err) {
    console.log("❌ Test 4 (sslmode=require) failed:", err.message);
    await pool.end().catch(() => {});
    return false;
  }
}

console.log("\n--- Running 4 connection tests ---\n");

const t1 = await testNoSSL();
const t2 = await testSSLFalse();
const t3 = await testSSLTrue();
const t4 = await testSSLModeRequire();

console.log("\n--- Summary ---");
console.log("Test 1 (no SSL):                          ", t1 ? "✅ PASS" : "❌ FAIL");
console.log("Test 2 (ssl: rejectUnauthorized false):   ", t2 ? "✅ PASS" : "❌ FAIL");
console.log("Test 3 (ssl: true):                       ", t3 ? "✅ PASS" : "❌ FAIL");
console.log("Test 4 (sslmode=require + false):         ", t4 ? "✅ PASS" : "❌ FAIL");

if (!t1 && !t2 && !t3 && !t4) {
  console.log("\n🚨 ALL TESTS FAILED. Possible causes:");
  console.log("   1. Wrong DATABASE_URL — check username/password/hostname.");
  console.log("   2. Render database is SUSPENDED (free tier spins down).");
  console.log("   3. Your IP is not whitelisted by the database firewall.");
  console.log("   4. The Render database has been deleted or expired.");
}
