import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
function derive(value: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => { scrypt(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)); });
}
export async function hashPassword(value: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:32768:8:1:${salt}:${(await derive(value, salt)).toString("hex")}`;
}
export async function verifyPassword(value: string, encoded: string): Promise<boolean> {
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts.slice(0, 4).join(":") !== "scrypt:32768:8:1") { await derive(value, "0".repeat(32)); return false; }
  const key = await derive(value, parts[4]); const expected = Buffer.from(parts[5], "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}
