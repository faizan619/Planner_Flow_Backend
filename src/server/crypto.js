import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts personal text (life lessons) before it is stored, with
// AES-256-GCM and the key in ENCRYPTION_KEY (32 random bytes, base64).
//
//   const stored = encrypt(text, `${userId}:${id}:body`);
//   const text = decrypt(stored, `${userId}:${id}:body`);
//
// The second argument ("context") is bound into the ciphertext, so a value
// copied into another row, field or account fails to decrypt instead of
// showing up there. Stored format: "v1:" + base64(iv | auth tag | ciphertext).

const VERSION = "v1";

function key() {
  const raw = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (raw.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return raw;
}

export function encrypt(text, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")}`;
}

export function decrypt(stored, context) {
  const [version, payload] = String(stored).split(":");
  if (version !== VERSION || !payload) throw new Error("Unknown encryption format");
  const data = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}
