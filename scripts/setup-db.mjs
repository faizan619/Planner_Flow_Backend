// Runs database/schema.sql against DATABASE_URL (creates tables, adds new
// columns). Safe to run again.
//
// Usage: npm run db:setup
// (In development the app also does this automatically on startup.)
import "dotenv/config";
import { applySchema } from "../src/server/migrate.js";

if (!process.env.DATABASE_URL) {
  console.error("✖ DATABASE_URL is not set (.env).");
  process.exit(1);
}

try {
  const tables = await applySchema();
  console.log("✓ Schema applied. Tables:", tables.join(", "));
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
}
