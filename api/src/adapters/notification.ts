import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { createHmac } from "node:crypto";
import type { AdapterEnvironment, NotificationAdapter } from "./contracts.ts";
import { disabledAdapters } from "./contracts.ts";
import { required, ProviderError } from "./provider-http.ts";

function publicAddress(address: string): boolean {
  if (address.includes(":")) return /^[23][a-f0-9]{3}:/i.test(address);
  const octets = address.split(".").map(Number); if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = octets;
  return a !== 0 && a !== 10 && a !== 127 && a < 224 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0, 168].includes(b)) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && [18, 19, 51].includes(b)) && !(a === 203 && b === 0);
}
export function createNotificationAdapter(env: AdapterEnvironment): NotificationAdapter {
  if (!env.ARCHIVE_NOTIFICATION_URL) return disabledAdapters().notifications;
  const url = new URL(env.ARCHIVE_NOTIFICATION_URL); const secret = required(env.ARCHIVE_NOTIFICATION_SECRET, "ARCHIVE_NOTIFICATION_SECRET");
  const hosts = required(env.ARCHIVE_NOTIFICATION_ALLOWED_HOSTS, "ARCHIVE_NOTIFICATION_ALLOWED_HOSTS").split(",").map(value => value.trim().toLowerCase());
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port && url.port !== "443" || !hosts.includes(url.hostname.toLowerCase()) || secret.length < 16) throw new ProviderError("CONFIGURATION", "Notification destination is not approved.");
  return { enabled: true, async send(input) {
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(input.eventId) || Object.values(input.data).some(value => typeof value !== "string" || value.length > 10_000)) throw new ProviderError("CONFIGURATION", "Notification exceeds the data boundary.");
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || !addresses.every(item => publicAddress(item.address))) throw new ProviderError("CONFIGURATION", "Notification destination did not resolve to public addresses.");
    const chosen = addresses[0]; const body = Buffer.from(JSON.stringify(input)); const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
    await new Promise<void>((resolve, reject) => {
      const outgoing = request(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": String(body.length), "Idempotency-Key": input.eventId, "X-Archive-Timestamp": timestamp, "X-Archive-Signature": signature }, lookup: (_hostname, _options, callback) => { callback(null, chosen.address, chosen.family); } }, response => {
        let bytes = 0; response.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 4096) outgoing.destroy(new Error("Notification response exceeds limit.")); });
        response.on("end", () => { if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) resolve(); else reject(new ProviderError("UNAVAILABLE", "Notification was not accepted.")); });
        response.on("error", () => reject(new ProviderError("UNKNOWN_OUTCOME", "Notification receipt must be reconciled.")));
      });
      outgoing.setTimeout(8_000, () => outgoing.destroy(new Error("Notification timeout.")));
      outgoing.on("error", () => reject(new ProviderError("UNKNOWN_OUTCOME", "Notification receipt must be reconciled."))); outgoing.end(body);
    });
  } };
}
