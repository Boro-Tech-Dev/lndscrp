import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

function getKey(raw: string | undefined): Buffer | null {
  if (!raw || raw.trim() === "") return null;
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

/** Encrypt JSON-serializable object; returns null if no key configured (caller must refuse to store secrets). */
export function encryptJson(obj: unknown, credentialsKey: string | undefined): Buffer | null {
  const key = getKey(credentialsKey);
  if (!key) return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptJson<T>(blob: Buffer, credentialsKey: string | undefined): T | null {
  const key = getKey(credentialsKey);
  if (!key || blob.length < IV_LEN + 16) return null;
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + 16);
  const data = blob.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  try {
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
