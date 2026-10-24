import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { query, queryOne, transaction } from "@/server/db";

// Access token: a 15-minute JWT (HS256) the app sends as `Authorization: Bearer …`.
// Refresh token: a random 48-byte string valid for 30 days, stored only as a
// SHA-256 hash. Every refresh rotates it; reusing an old one revokes the family.

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = 30;
const ISSUER = "planner-flow";

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function signAccessToken(user) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secretKey());
}

// Returns the user id from a valid access token, or null.
export async function readAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

async function insertRefreshToken(q, userId, familyId, userAgent) {
  const token = randomBytes(48).toString("base64url");
  const result = await q(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, user_agent)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP + INTERVAL ? DAY, ?)`,
    [userId, familyId, sha256(token), REFRESH_TTL_DAYS, userAgent?.slice(0, 255) ?? null]
  );
  return { token, id: result.insertId };
}

async function tokenPair(user, refreshToken) {
  return {
    accessToken: await signAccessToken(user),
    accessTokenExpiresIn: ACCESS_TTL_SECONDS,
    refreshToken,
  };
}

// New login: starts a new token family.
export async function issueTokens(user, userAgent) {
  const { token } = await insertRefreshToken(query, user.id, randomUUID(), userAgent);
  return tokenPair(user, token);
}

// Exchanges a refresh token for a new pair. Returns { user, tokens } or null.
export async function rotateRefreshToken(refreshToken, userAgent, loadUser) {
  const row = await queryOne(
    `SELECT id, user_id AS userId, family_id AS familyId, revoked_at AS revokedAt,
            expires_at <= CURRENT_TIMESTAMP AS expired
     FROM refresh_tokens WHERE token_hash = ?`,
    [sha256(refreshToken)]
  );
  if (!row) return null;

  if (row.revokedAt) {
    // A token that was already used came back: assume it leaked.
    await revokeFamily(row.familyId);
    return null;
  }
  if (Number(row.expired)) return null;

  const user = await loadUser(row.userId);
  if (!user || user.status !== "active") {
    await revokeFamily(row.familyId);
    return null;
  }

  const next = await transaction(async (q) => {
    // Only one concurrent request can win the rotation.
    const claimed = await q(
      "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL",
      [row.id]
    );
    if (claimed.affectedRows !== 1) return null;
    const created = await insertRefreshToken(q, row.userId, row.familyId, userAgent);
    await q("UPDATE refresh_tokens SET replaced_by = ? WHERE id = ?", [created.id, row.id]);
    return created.token;
  });
  if (!next) return null;

  return { user, tokens: await tokenPair(user, next) };
}

export async function revokeFamilyOf(refreshToken) {
  const row = await queryOne("SELECT family_id AS familyId FROM refresh_tokens WHERE token_hash = ?", [
    sha256(refreshToken),
  ]);
  if (row) await revokeFamily(row.familyId);
}

async function revokeFamily(familyId) {
  await query(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE family_id = ? AND revoked_at IS NULL",
    [familyId]
  );
}

// Signs the user out everywhere (password reset, deactivation).
export async function revokeAllForUser(userId) {
  await query(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
    [userId]
  );
}

// The user id behind a refresh token that is still valid (not revoked or
// expired), or null. Used by the admin web panel's cookie session.
export async function userIdForRefreshToken(refreshToken) {
  const row = await queryOne(
    `SELECT user_id AS userId FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
    [sha256(refreshToken)]
  );
  return row?.userId ?? null;
}
