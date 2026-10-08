export class ProviderError extends Error {
  code: "CONFIGURATION" | "UNAVAILABLE" | "INVALID_RESPONSE" | "UNKNOWN_OUTCOME";
  constructor(code: ProviderError["code"], message: string) { super(message); this.name = "ProviderError"; this.code = code; }
}
export function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
export function required(value: string | undefined, name: string): string { if (!value?.trim()) throw new ProviderError("CONFIGURATION", `${name} is required.`); return value.trim(); }
export function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const result = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new ProviderError("CONFIGURATION", "Provider limit is invalid.");
  return result;
}
export async function providerRequest(url: string, init: RequestInit, fetcher: typeof fetch = fetch, mutation = false): Promise<unknown> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetcher(url, { ...init, redirect: "error", signal: controller.signal });
    if (!response.ok) { await response.body?.cancel(); throw new ProviderError(response.status >= 500 && mutation ? "UNKNOWN_OUTCOME" : "UNAVAILABLE", "External provider did not complete the request."); }
    if (Number(response.headers.get("content-length")) > 2_000_000) { await response.body?.cancel(); throw new ProviderError("INVALID_RESPONSE", "Provider response exceeds the limit."); }
    if (!response.body) throw new ProviderError("INVALID_RESPONSE", "Provider returned no response.");
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 2_000_000) { await reader.cancel(); throw new ProviderError("INVALID_RESPONSE", "Provider response exceeds the limit."); } chunks.push(part.value); } }
    finally { reader.releaseLock(); }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); return parsed;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(mutation ? "UNKNOWN_OUTCOME" : "UNAVAILABLE", mutation ? "Provider outcome must be reconciled before retrying." : "External provider is unavailable.");
  } finally { clearTimeout(timer); }
}
