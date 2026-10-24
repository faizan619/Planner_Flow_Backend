import "server-only";
import mysql from "mysql2/promise";

// One shared connection pool for the whole app (reused across hot reloads in dev).
//
// How to query:
//   const rows = await query("SELECT id, title FROM tasks WHERE is_done = ?", [false]);
//   const task = await queryOne("SELECT * FROM tasks WHERE id = ?", [id]);   // row or null
//   const result = await query("INSERT INTO tasks (title) VALUES (?)", [title]);
//   result.insertId / result.affectedRows
//
// Always pass values as `?` parameters, never by building the SQL string
// yourself. mysql2 escapes them, which prevents SQL injection.
// `IN (?)` accepts an array, and `VALUES ?` accepts an array of row arrays.

const globalForDb = globalThis;

export const pool =
  globalForDb.__plannerPool ??
  mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true }, // TiDB Cloud requires TLS
    timezone: "Z", // TIMESTAMP columns come back as JS Dates in UTC
    connectionLimit: 10,
    // BOOLEAN columns (TINYINT(1)) come back as true/false instead of 1/0.
    typeCast(field, next) {
      if (field.type === "TINY" && field.length === 1) {
        const value = field.string();
        return value === null ? null : value === "1";
      }
      return next();
    },
  });

if (process.env.NODE_ENV !== "production") globalForDb.__plannerPool = pool;

const DEAD_CONNECTION = new Set(["ECONNRESET", "EPIPE", "PROTOCOL_CONNECTION_LOST", "ETIMEDOUT"]);

// Runs one statement. SELECT returns an array of rows; INSERT/UPDATE/DELETE
// return { insertId, affectedRows }.
// A read that hits a dropped connection is retried once on a fresh one. Writes
// are not retried: the first attempt may already have been applied.
export async function query(sql, params = []) {
  try {
    const [result] = await pool.query(sql, params);
    return result;
  } catch (error) {
    if (!DEAD_CONNECTION.has(error?.code) || !/^\s*select\b/i.test(sql)) throw error;
    const [result] = await pool.query(sql, params);
    return result;
  }
}

// Runs a SELECT and returns the first row, or null.
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// Runs several statements as one unit: all succeed or none do.
//   await transaction(async (q) => {
//     await q("INSERT ...", [...]);
//     await q("DELETE ...", [...]);
//   });
export async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const q = async (sql, params = []) => (await connection.query(sql, params))[0];
    const result = await work(q);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// JSON columns usually arrive already parsed; some drivers/proxies send text.
export function json(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

// True when an INSERT/UPDATE hit a UNIQUE key.
export function isDuplicateKeyError(error) {
  return error?.code === "ER_DUP_ENTRY";
}
