import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { query } from "@/server/db";

// Crashes sent by the app, shown on the admin Crashes page. The same crash in
// the same version is one row with a count, so a crash loop can't fill the
// table. Reports are anonymous: nothing links a row to an account.

export const CrashReport = z.object({
  source: z.enum(["js", "native"]),
  name: z.string().trim().min(1).max(120),
  message: z.string().max(500).default(""),
  stack: z.string().max(8000).default(""),
  appVersion: z.string().trim().min(1).max(20),
  versionCode: z.number().int().min(0).max(4_000_000),
  androidVersion: z.string().max(20).default(""),
  device: z.string().max(120).default(""),
});

// An error message can quote what it failed on, so anything that looks
// personal is taken out before it's stored.
const scrub = (text) => text.replace(/[^\s@"',]+@[^\s@"',]+\.[^\s@"',]+/g, "[email]").replace(/\d{6,}/g, "[number]");

function fingerprint({ source, name, message, stack, versionCode }) {
  const top = stack.split("\n").slice(0, 6).join("\n");
  return createHash("sha256")
    .update([versionCode, source, name, message.replace(/\d+/g, "#"), top].join("\n"))
    .digest("hex");
}

export async function recordCrash(report) {
  const crash = { ...report, message: scrub(report.message).slice(0, 500), stack: scrub(report.stack) };
  await query(
    `INSERT INTO crash_reports
       (fingerprint, source, error_name, message, stack, app_version, version_code, android_version, device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       occurrences = occurrences + 1, last_seen_at = CURRENT_TIMESTAMP(3),
       android_version = VALUES(android_version), device = VALUES(device)`,
    [
      fingerprint(crash),
      crash.source,
      crash.name,
      crash.message,
      crash.stack,
      crash.appVersion,
      crash.versionCode,
      crash.androidVersion,
      crash.device,
    ]
  );
}

// Most recently seen first.
export function listCrashes() {
  return query(
    `SELECT id, source, error_name AS name, message, stack, app_version AS appVersion, version_code AS versionCode,
            android_version AS androidVersion, device, occurrences, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt
     FROM crash_reports ORDER BY last_seen_at DESC LIMIT 100`
  );
}
