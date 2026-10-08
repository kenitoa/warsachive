import { check } from "./errors.ts";
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export function isSafeJson(value: unknown, depth = 0): value is JsonValue {
  if (depth > 20) return false;
  if (value === null || typeof value === "boolean" || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 10000 && value.every((item) => isSafeJson(item, depth + 1));
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Object.entries(value).every(([key, item]) => !["__proto__", "constructor", "prototype"].includes(key) && isSafeJson(item, depth + 1));
}
export function object(value: unknown): Record<string, unknown> {
  check(isSafeJson(value) && value !== null && typeof value === "object" && !Array.isArray(value), 400, "INVALID_INPUT", "올바른 JSON 객체가 필요합니다.");
  return value;
}
export function text(value: unknown, label: string, max = 2000, min = 1): string {
  check(typeof value === "string" && value.trim().length >= min && value.length <= max, 400, "INVALID_INPUT", `${label} 형식을 확인해 주세요.`);
  return value.trim();
}
export function email(value: unknown): string {
  const result = text(value, "이메일", 254).toLowerCase();
  check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 400, "INVALID_INPUT", "이메일 형식을 확인해 주세요.");
  return result;
}
export function password(value: unknown): string {
  check(typeof value === "string" && value.length >= 12 && value.length <= 128, 400, "INVALID_PASSWORD", "비밀번호는 12~128자여야 합니다.");
  return value;
}
export function credential(value: unknown): string { check(typeof value === "string" && value.length >= 1 && value.length <= 128, 400, "INVALID_INPUT", "비밀번호 형식을 확인해 주세요."); return value; }
export function identifier(value: unknown): string {
  const result = text(value, "식별자", 100);
  check(/^[a-zA-Z0-9_-]+$/.test(result), 400, "INVALID_INPUT", "식별자 형식을 확인해 주세요.");
  return result;
}
export function version(value: unknown): number {
  check(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, 400, "INVALID_VERSION", "자료 버전이 필요합니다.");
  return value;
}
export function payload(value: unknown, limit = 262144): Record<string, unknown> {
  const result = object(value);
  check(Buffer.byteLength(JSON.stringify(result)) <= limit, 413, "PAYLOAD_TOO_LARGE", "자료 크기가 허용 범위를 초과했습니다.");
  return result;
}
export function ids(value: unknown): string[] {
  check(Array.isArray(value) && value.length <= 500, 400, "INVALID_INPUT", "기록 목록을 확인해 주세요.");
  return [...new Set(value.map(identifier))];
}
export function optionalText(value: unknown, label: string, max = 2000): string { return value === undefined || value === "" ? "" : text(value, label, max); }
export function isoDate(value: unknown): string {
  const result = text(value, "날짜", 40);
  check(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(result) && Number.isFinite(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result.slice(0, 10), 400, "INVALID_INPUT", "올바른 날짜 또는 UTC 시각이 필요합니다.");
  return new Date(result).toISOString();
}
export function httpsUrl(value: unknown, label: string, allowFragment = false): string {
  const candidate = text(value, label, 2000); let url: URL;
  try { url = new URL(candidate); } catch { check(false, 400, "INVALID_INPUT", `${label} 형식을 확인해 주세요.`); }
  check(url.protocol === "https:" && !url.username && !url.password && (allowFragment || !url.hash), 400, "INVALID_INPUT", `${label}는 자격증명 없는 HTTPS 주소여야 합니다.`); return url.href;
}
