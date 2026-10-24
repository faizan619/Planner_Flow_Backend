// Starts the app against a separate test database for the API test suite.
//
// The test database is DATABASE_URL with its name replaced by
// `<name>_test`. It is dropped and recreated from database/schema.sql at the
// start of every run, so tests never touch real data.
import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";

const PORT = Number(process.env.TEST_PORT ?? 3999);
export const BASE_URL = `http://localhost:${PORT}`;

function testDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL);
  const name = url.pathname.slice(1);
  url.pathname = `/${name.endsWith("_test") ? name : `${name}_test`}`;
  return url;
}

async function resetDatabase(url) {
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/";
  const connection = await mysql.createConnection({ uri: admin.toString(), ssl: { rejectUnauthorized: true } });
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.query(`CREATE DATABASE \`${name}\``);
  } finally {
    await connection.end();
  }
  process.env.DATABASE_URL = url.toString();
  const { applySchema } = await import("../../src/server/migrate.js");
  await applySchema();
}

let child;
let db;
export let outboxDir;

export async function startServer() {
  const url = testDatabaseUrl();
  await resetDatabase(url);
  db = await mysql.createConnection({ uri: url.toString(), ssl: { rejectUnauthorized: true }, timezone: "Z" });
  outboxDir = await mkdtemp(path.join(os.tmpdir(), "planner-mail-"));

  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], {
    env: {
      ...process.env,
      DATABASE_URL: url.toString(),
      MAIL_MODE: "file",
      MAIL_OUTBOX_DIR: outboxDir,
      AUTO_MIGRATE: "false",
      NODE_ENV: "development",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next dev exited:\n${log}`);
    try {
      const response = await fetch(`${BASE_URL}/api/v1/health`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`next dev did not become ready:\n${log}`);
}

export async function stopServer() {
  await db?.end();
  if (child && child.exitCode === null) {
    // On Windows the dev server spawns workers; kill the whole tree.
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  if (outboxDir) await rm(outboxDir, { recursive: true, force: true });
}

// Direct SQL against the test database, for arranging state (e.g. deactivating a user).
export async function sql(statement, params = []) {
  const [result] = await db.query(statement, params);
  return result;
}

// Calls the API. Each call can pretend to come from its own IP so the
// rate limiter doesn't spill over between tests.
export async function api(method, pathname, { body, token, ip = "10.0.0.1" } = {}) {
  const headers = { "x-forwarded-for": ip };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}

// The 6-digit code from the newest email sent to `to`.
export async function lastCode(to) {
  const files = (await readdir(outboxDir)).filter((file) => file.includes(to.replace(/[^a-z0-9@._-]/gi, "_"))).sort();
  if (!files.length) throw new Error(`No email sent to ${to}`);
  const mail = JSON.parse(await readFile(path.join(outboxDir, files.at(-1)), "utf8"));
  return mail.text.match(/\b(\d{6})\b/)[1];
}

let counter = 0;
export const uniqueEmail = (label = "user") => `${label}.${Date.now()}.${++counter}@test.local`;
export const uniqueIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${++counter % 250}`;
