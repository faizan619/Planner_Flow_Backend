// Applies database/schema.sql (idempotent: CREATE … IF NOT EXISTS, ADD COLUMN
// IF NOT EXISTS). Plain Node module so both scripts/setup-db.mjs and
// src/instrumentation.js can use it.
import { readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

export async function applySchema() {
  const sql = await readFile(path.join(process.cwd(), "database", "schema.sql"), "utf8");

  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    timezone: "Z",
    multipleStatements: true,
    connectTimeout: 15_000,
  });

  try {
    await connection.query(sql);
    const [tables] = await connection.query("SHOW TABLES");
    return tables.map((row) => Object.values(row)[0]);
  } finally {
    await connection.end();
  }
}
