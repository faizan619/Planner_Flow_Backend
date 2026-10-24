import "server-only";
import { z } from "zod";
import { json, query, queryOne } from "@/server/db";

// App-wide settings an admin can change (table app_settings). Values are
// cached for 30 seconds per server instance, so reading them is cheap.

const DEFAULTS = {
  logs: { security: true, admin: true, usage: true, retentionDays: 45 },
};

export const LogSettings = z.object({
  security: z.boolean(),
  admin: z.boolean(),
  usage: z.boolean(),
  retentionDays: z.number().int().min(7, "Keep logs at least 7 days").max(365, "Keep logs at most 365 days"),
});

const CACHE_MS = 30_000;
const globalForSettings = globalThis;
const cache = (globalForSettings.__plannerSettings ??= new Map());

export async function getSetting(key) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const row = await queryOne("SELECT value FROM app_settings WHERE setting_key = ?", [key]);
  const value = { ...DEFAULTS[key], ...(row ? json(row.value) : {}) };
  cache.set(key, { value, expires: Date.now() + CACHE_MS });
  return value;
}

export async function setSetting(key, value, adminId) {
  await query(
    `INSERT INTO app_settings (setting_key, value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
    [key, JSON.stringify(value), adminId]
  );
  cache.delete(key);
}
