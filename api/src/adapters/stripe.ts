import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdapterEnvironment, PaymentAdapter, PaymentEvent } from "./contracts.ts";
import { disabledAdapters } from "./contracts.ts";
import { object, required, providerRequest, ProviderError } from "./provider-http.ts";

function safeId(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value); }
function amount(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function currency(value: unknown): value is string { return typeof value === "string" && /^[a-z]{3}$/.test(value); }
function returnUrl(value: string): string { const url = new URL(value); if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) || url.username || url.password) throw new ProviderError("CONFIGURATION", "Checkout return URL is invalid."); return url.href; }

export function createStripeAdapter(env: AdapterEnvironment, fetcher: typeof fetch = fetch): PaymentAdapter {
  if (!env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) return disabledAdapters().payments;
  const secret = required(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY"); const webhook = required(env.STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET");
  const version = required(env.STRIPE_API_VERSION, "STRIPE_API_VERSION");
  if (!/^\d{4}-\d{2}-\d{2}(?:\.[a-z]+)?$/.test(version) || !/^sk_(test|live)_/.test(secret) || !webhook.startsWith("whsec_")) throw new ProviderError("CONFIGURATION", "Stripe configuration is invalid.");
  if (secret.startsWith("sk_live_") && env.ARCHIVE_PAYMENT_LIVE_ENABLED !== "true") throw new ProviderError("CONFIGURATION", "Live payments require the release gate.");
  const headers = { Authorization: `Bearer ${secret}`, "Stripe-Version": version, "Content-Type": "application/x-www-form-urlencoded" };
  const request = (path: string, init: RequestInit, mutation = false) => providerRequest(`https://api.stripe.com/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } }, fetcher, mutation);
  async function retrieveSession(id: string): Promise<Record<string, unknown>> {
    if (!safeId(id)) throw new ProviderError("INVALID_RESPONSE", "Checkout identifier is invalid.");
    const value = await request(`checkout/sessions/${encodeURIComponent(id)}`, { method: "GET" });
    if (!object(value) || value.id !== id) throw new ProviderError("INVALID_RESPONSE", "Checkout could not be verified."); return value;
  }
  return {
    enabled: true,
    async createCheckout(input) {
      if (!safeId(input.orderId) || !safeId(input.userId) || !safeId(input.product.id) || !amount(input.product.amountMinor) || input.product.amountMinor === 0 || !currency(input.product.currency)) throw new ProviderError("CONFIGURATION", "Server product or order is invalid.");
      const body = new URLSearchParams({ mode: "payment", client_reference_id: input.orderId, success_url: returnUrl(input.successUrl), cancel_url: returnUrl(input.cancelUrl), "metadata[orderId]": input.orderId, "payment_intent_data[metadata][orderId]": input.orderId, "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": input.product.currency, "line_items[0][price_data][unit_amount]": String(input.product.amountMinor), "line_items[0][price_data][product_data][name]": input.product.title });
      const result = await request("checkout/sessions", { method: "POST", headers: { "Idempotency-Key": `archive-checkout-${input.orderId}` }, body }, true);
      if (!object(result) || !safeId(result.id) || typeof result.url !== "string" || result.client_reference_id !== input.orderId) throw new ProviderError("INVALID_RESPONSE", "Checkout response is invalid.");
      const url = new URL(result.url); if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password) throw new ProviderError("INVALID_RESPONSE", "Checkout address is invalid.");
      return { sessionId: result.id, url: url.href };
    },
    async verifyWebhook(rawBody, signature) {
      if (rawBody.length > 1_000_000 || signature.length > 4096) throw new ProviderError("INVALID_RESPONSE", "Webhook exceeds the limit.");
      const pieces = signature.split(",").map(item => item.trim().split("=")); const timestamps = pieces.filter(([key]) => key === "t");
      if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0][1] ?? "")) throw new ProviderError("INVALID_RESPONSE", "Webhook signature is invalid.");
      const timestamp = Number(timestamps[0][1]); if (Math.abs(Date.now() / 1000 - timestamp) > 300) throw new ProviderError("INVALID_RESPONSE", "Webhook timestamp is expired.");
      const expected = createHmac("sha256", webhook).update(`${timestamp}.`).update(rawBody).digest();
      const valid = pieces.filter(([key, value]) => key === "v1" && /^[a-f0-9]{64}$/i.test(value ?? "")).some(([, value]) => timingSafeEqual(expected, Buffer.from(value, "hex")));
      if (!valid) throw new ProviderError("INVALID_RESPONSE", "Webhook signature is invalid.");
      const event: unknown = JSON.parse(rawBody.toString("utf8"));
      if (!object(event) || !safeId(event.id) || typeof event.type !== "string" || !object(event.data) || !object(event.data.object) || event.livemode !== secret.startsWith("sk_live_")) throw new ProviderError("INVALID_RESPONSE", "Webhook event is invalid.");
      const item = event.data.object;
      if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "charge.refunded"].includes(event.type)) return null;
      if (event.type === "charge.refunded") {
        if (!safeId(item.payment_intent) || !amount(item.amount) || !amount(item.amount_refunded) || item.amount_refunded > item.amount || !currency(item.currency)) throw new ProviderError("INVALID_RESPONSE", "Refund event is invalid.");
        const sessions = await request(`checkout/sessions?payment_intent=${encodeURIComponent(item.payment_intent)}&limit=2`, { method: "GET" });
        if (!object(sessions) || !Array.isArray(sessions.data) || sessions.data.length !== 1 || !object(sessions.data[0]) || !safeId(sessions.data[0].id) || !safeId(sessions.data[0].client_reference_id) || sessions.data[0].amount_total !== item.amount || sessions.data[0].currency !== item.currency) throw new ProviderError("INVALID_RESPONSE", "Refund order could not be verified.");
        return { eventId: event.id, type: event.type, orderId: sessions.data[0].client_reference_id, sessionId: sessions.data[0].id, status: item.amount_refunded === item.amount ? "refunded" : "partially-refunded", amountMinor: item.amount, refundedMinor: item.amount_refunded, currency: item.currency } satisfies PaymentEvent;
      }
      if (!safeId(item.id) || !safeId(item.client_reference_id)) throw new ProviderError("INVALID_RESPONSE", "Webhook order is invalid.");
      const session = await retrieveSession(item.id);
      if (session.client_reference_id !== item.client_reference_id || !amount(session.amount_total) || !currency(session.currency)) throw new ProviderError("INVALID_RESPONSE", "Checkout amount could not be verified.");
      const status = session.payment_status === "paid" ? "paid" : event.type === "checkout.session.async_payment_failed" ? "failed" : event.type === "checkout.session.expired" ? "cancelled" : null;
      if (!status) return null;
      return { eventId: event.id, type: event.type, orderId: item.client_reference_id, sessionId: item.id, status, amountMinor: session.amount_total, currency: session.currency } satisfies PaymentEvent;
    },
    async refund(input) {
      if (!safeId(input.orderId) || !safeId(input.idempotencyKey) || !amount(input.amountMinor) || input.amountMinor === 0) throw new ProviderError("CONFIGURATION", "Refund request is invalid.");
      const session = await retrieveSession(input.sessionId);
      if (session.client_reference_id !== input.orderId || session.payment_status !== "paid" || !safeId(session.payment_intent) || !amount(session.amount_total) || input.amountMinor > session.amount_total) throw new ProviderError("INVALID_RESPONSE", "Paid order could not be verified.");
      const result = await request("refunds", { method: "POST", headers: { "Idempotency-Key": `archive-refund-${input.idempotencyKey}` }, body: new URLSearchParams({ payment_intent: session.payment_intent, amount: String(input.amountMinor), "metadata[orderId]": input.orderId }) }, true);
      if (!object(result) || !safeId(result.id) || !["succeeded", "pending"].includes(String(result.status))) throw new ProviderError("UNKNOWN_OUTCOME", "Refund must be reconciled with the provider.");
      if (result.status === "pending") return { refundId: result.id, status: "pending" };
      const intent = await request(`payment_intents/${encodeURIComponent(session.payment_intent)}?expand%5B%5D=latest_charge`, { method: "GET" });
      if (!object(intent) || intent.id !== session.payment_intent || !object(intent.latest_charge) || !amount(intent.latest_charge.amount_refunded) || intent.latest_charge.amount !== session.amount_total || intent.latest_charge.currency !== session.currency || intent.latest_charge.amount_refunded > session.amount_total) throw new ProviderError("UNKNOWN_OUTCOME", "Refund must be reconciled with the provider.");
      return { refundId: result.id, status: "refunded", refundedMinor: intent.latest_charge.amount_refunded };
    }
  };
}
