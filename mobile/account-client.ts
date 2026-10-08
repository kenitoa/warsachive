import { ApiError, apiNumber, apiObject, decodeSession, type ApiSession } from "../web/lib/api-client.ts";
export type AccountShelf = { version: number; payload: { bookmarks: string[]; notes: Record<string, string> } };
const idPattern = /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]{1,80}$/;
export function decodeAccountShelf(value: unknown): AccountShelf {
  const data = apiObject(value); const payload = apiObject(data.payload); const notes = apiObject(payload.notes);
  if (!Array.isArray(payload.bookmarks) || payload.bookmarks.length > 500 || !payload.bookmarks.every(id => typeof id === "string" && idPattern.test(id)) || Object.keys(notes).length > 500 || !Object.entries(notes).every(([id, note]) => idPattern.test(id) && typeof note === "string" && note.length <= 4000)) throw new ApiError("INVALID_RESPONSE", 0);
  return { version: apiNumber(data.version), payload: { bookmarks: [...new Set(payload.bookmarks)], notes: Object.fromEntries(Object.entries(notes)) as Record<string, string> } };
}
export function mergedAccountBookmarks(current: AccountShelf, local: readonly string[]): string[] {
  if (!local.every(id => idPattern.test(id))) throw new ApiError("INVALID_INPUT", 400);
  const merged = [...new Set([...current.payload.bookmarks, ...local])]; if (merged.length > 500) throw new Error("계정 북마크는 500개까지 보관할 수 있습니다. 기존 자료를 삭제하지 않았습니다."); return merged;
}
/** HttpOnly session cookies use the native cookie jar. CSRF stays in memory and is never written to storage. */
export class MobileAccountClient {
  private readonly base: string; private readonly origin: string; private readonly fetcher: typeof fetch; private csrf = "";
  constructor(apiUrl: string, siteUrl: string, fetcher: typeof fetch = fetch) {
    const api = new URL(apiUrl); const site = new URL(siteUrl); const local = ["localhost", "127.0.0.1", "[::1]"];
    if (!(api.protocol === "https:" || api.protocol === "http:" && local.includes(api.hostname)) || api.username || api.password || api.search || api.hash || !(site.protocol === "https:" || site.protocol === "http:" && local.includes(site.hostname)) || site.username || site.password || site.search || site.hash) throw new ApiError("API_NOT_CONFIGURED", 0);
    this.base = apiUrl.replace(/\/$/, "") + (api.pathname.replace(/\/$/, "").endsWith("/api/v1") ? "" : "/api/v1"); this.origin = site.origin; this.fetcher = fetcher;
  }
  private async request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await this.fetcher(this.base + path, { method, credentials: "include", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json", Origin: this.origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(method === "GET" ? {} : { "X-CSRF-Token": this.csrf }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const raw = await response.text(); if (raw.length > 600_000) throw new ApiError("INVALID_RESPONSE", response.status);
      let envelope: Record<string, unknown>; try { envelope = apiObject(JSON.parse(raw)); } catch { throw new ApiError("INVALID_RESPONSE", response.status); }
      if (!response.ok || envelope.error) { const error = envelope.error ? apiObject(envelope.error) : {}; throw new ApiError(typeof error.code === "string" ? error.code : "NETWORK_ERROR", response.status); }
      const data = apiObject(envelope.data); if (typeof data.csrfToken === "string") this.csrf = data.csrfToken; return data;
    } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR", 0); }
    finally { clearTimeout(timeout); }
  }
  async session(): Promise<ApiSession> { return decodeSession(await this.request("/auth/session")); }
  async login(email: string, password: string): Promise<ApiSession> { await this.session(); return decodeSession(await this.request("/auth/login", "POST", { email, password })); }
  async logout(): Promise<void> { await this.request("/auth/logout", "POST", {}); this.csrf = ""; }
  async shelf(): Promise<AccountShelf> { return decodeAccountShelf(await this.request("/shelf")); }
  async mergeBookmarks(current: AccountShelf, local: readonly string[]): Promise<AccountShelf> {
    return decodeAccountShelf(await this.request("/shelf", "PUT", { version: current.version, payload: { bookmarks: mergedAccountBookmarks(current, local), notes: current.payload.notes } }));
  }
}
