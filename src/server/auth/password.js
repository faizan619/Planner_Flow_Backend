import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id with the library defaults (19 MiB memory, 2 iterations), which
// match the OWASP minimum recommendation.
export function hashPassword(password) {
  return hash(password);
}

export async function verifyPassword(passwordHash, password) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Used when the email doesn't exist, so a failed login takes about as long
// either way and doesn't reveal which emails are registered.
let dummyHash;
export async function burnPasswordCheck(password) {
  dummyHash ??= await hash("not-a-real-password");
  await verifyPassword(dummyHash, password);
}
