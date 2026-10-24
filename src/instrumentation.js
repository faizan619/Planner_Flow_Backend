// Runs once when the Next.js server starts, before it handles requests.
// Keeps the database schema in sync with database/schema.sql so new tables
// and columns exist without remembering to run `npm run db:setup`.
//
// On by default in development. In production set AUTO_MIGRATE=true to
// enable it (or keep running `npm run db:setup` as part of deploys).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;

  const enabled = process.env.AUTO_MIGRATE
    ? process.env.AUTO_MIGRATE === "true"
    : process.env.NODE_ENV === "development";
  if (!enabled) return;

  const { applySchema } = await import("./server/migrate.js");
  try {
    await applySchema();
    console.log("✓ Database schema is up to date");
  } catch (error) {
    // Don't stop the server; API routes will return the real database error.
    console.error("✖ Database schema update failed:", error.message);
  }
}
