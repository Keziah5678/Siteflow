import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function scrypt(pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(pw, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

/* ---------------------------------------------------------- passwords */
const N = 16384, R = 8, P = 1, LEN = 64, MAXMEM = 64 * 1024 * 1024;
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const got = await scrypt(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/* ------------------------------------------------------------- tokens */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/* ------------------------------------------------- secrets at rest */
function key(): Buffer {
  if (!env.encryptionKey) {
    if (env.isProduction && process.env.RP_ALLOW_DEV_KEY !== "true") throw new Error("ENCRYPTION_KEY est obligatoire en production.");
    return createHash("sha256").update("relancepro-dev-only-key").digest();
  }
  const k = Buffer.from(env.encryptionKey, "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY doit faire 32 octets encodés en base64.");
  return k;
}

/** Opposition registry key: a keyed hash, so the list never stores readable addresses. */
export const emailHash = (email: string) => createHmac("sha256", key()).update(email.trim().toLowerCase()).digest("hex");

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}
export function decrypt(blob: string): string {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1") throw new Error("Format de secret inconnu");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/* ------------------------------------------------- signed links */
export function sign(value: string): string {
  return createHmac("sha256", key()).update(value).digest("base64url").slice(0, 32);
}
export function verifySignature(value: string, signature: string): boolean {
  const a = Buffer.from(sign(value)), b = Buffer.from(signature ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
