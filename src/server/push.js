import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { query } from "@/server/db";

// Push notifications through Firebase Cloud Messaging (HTTP v1 API).
//
// FIREBASE_SERVICE_ACCOUNT holds the Firebase service-account key file
// (Project settings → Service accounts → Generate new private key), base64
// encoded. Without it push is simply off: announcements still reach the
// in-app inbox and their push_status is "skipped".

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const account = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    return account.project_id && account.client_email && account.private_key ? account : null;
  } catch {
    return null;
  }
}

export const isPushConfigured = () => serviceAccount() !== null;

// Google OAuth access token for FCM, cached until shortly before it expires.
const globalForPush = globalThis;
async function accessToken(account) {
  const cached = globalForPush.__plannerFcmToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`Google token request failed (${response.status})`);
  const data = await response.json();
  globalForPush.__plannerFcmToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// The FCM message for one device. `data` values must be strings.
export function buildMessage(token, { title, body, data = {} }) {
  return {
    message: {
      token,
      notification: { title, body },
      data,
      android: { priority: "HIGH", notification: { channel_id: "announcements" } },
    },
  };
}

// Sends to each token; returns Map(token → "sent" | "failed" | "invalid").
// "invalid" means the app was uninstalled or the token expired.
async function sendToTokens(account, tokens, notification) {
  const bearer = await accessToken(account);
  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  const results = new Map();
  const queue = [...tokens];

  // A few requests at a time keeps this fast without hammering FCM.
  await Promise.all(
    Array.from({ length: Math.min(8, queue.length) }, async () => {
      for (let token = queue.shift(); token; token = queue.shift()) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
            body: JSON.stringify(buildMessage(token, notification)),
          });
          if (response.ok) results.set(token, "sent");
          else {
            const error = await response.json().catch(() => ({}));
            const code = error?.error?.details?.find((detail) => detail.errorCode)?.errorCode ?? error?.error?.status;
            results.set(token, ["UNREGISTERED", "NOT_FOUND", "INVALID_ARGUMENT"].includes(code) ? "invalid" : "failed");
          }
        } catch {
          results.set(token, "failed");
        }
      }
    })
  );
  return results;
}

// Pushes an announcement to every recipient's devices and records the outcome.
export async function pushAnnouncement(announcement) {
  const account = serviceAccount();
  if (!account) {
    await query("UPDATE announcement_recipients SET push_status = 'skipped' WHERE announcement_id = ?", [announcement.id]);
    return;
  }

  const devices = await query(
    `SELECT d.token, d.user_id AS userId FROM device_tokens d
     JOIN announcement_recipients r ON r.user_id = d.user_id AND r.announcement_id = ?`,
    [announcement.id]
  );
  await query(
    `UPDATE announcement_recipients r SET push_status = 'no_device'
     WHERE r.announcement_id = ? AND NOT EXISTS (SELECT 1 FROM device_tokens d WHERE d.user_id = r.user_id)`,
    [announcement.id]
  );
  if (!devices.length) return;

  let results;
  try {
    results = await sendToTokens(account, devices.map((device) => device.token), {
      title: announcement.title,
      body: announcement.body.length > 180 ? `${announcement.body.slice(0, 177)}…` : announcement.body,
      data: { type: "announcement", announcementId: String(announcement.id) },
    });
  } catch (error) {
    console.error("push: could not reach FCM:", error.message);
    await query("UPDATE announcement_recipients SET push_status = 'failed' WHERE announcement_id = ? AND push_status = 'pending'", [
      announcement.id,
    ]);
    return;
  }

  const sentTo = new Set();
  const invalid = [];
  for (const device of devices) {
    const outcome = results.get(device.token);
    if (outcome === "sent") sentTo.add(device.userId);
    if (outcome === "invalid") invalid.push(device.token);
  }
  if (invalid.length) await query("DELETE FROM device_tokens WHERE token IN (?)", [invalid]);
  if (sentTo.size) {
    await query("UPDATE announcement_recipients SET push_status = 'sent' WHERE announcement_id = ? AND user_id IN (?)", [
      announcement.id,
      [...sentTo],
    ]);
  }
  await query("UPDATE announcement_recipients SET push_status = 'failed' WHERE announcement_id = ? AND push_status = 'pending'", [
    announcement.id,
  ]);
}
