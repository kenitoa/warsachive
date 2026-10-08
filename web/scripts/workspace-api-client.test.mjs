import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4200";
const { apiRequest, apiObject, ApiError, safeApiMessage, decodeAiResponse, validateAiCitations, decodePaymentOrder, decodeOrderReceipt, verifiedCheckoutUrl, decodeAttachment, downloadCmsAttachment } = await import("../lib/api-client.ts");

test("mutations obtain a CSRF session and include cookies without persisting tokens", async () => {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ data: url.endsWith("/auth/session") ? { user: null, csrfToken: "csrf-for-browser", capabilities: { accounts: true } } : { saved: true }, error: null, meta: {} }), { status: 200 }); };
  try {
    assert.deepEqual(await apiRequest("/workspaces", { method: "POST", body: { payload: { version: 1 } } }, apiObject), { saved: true });
    assert.equal(calls.length, 2); assert.equal(calls[0].url, "http://127.0.0.1:4200/api/v1/auth/session");
    assert.equal(calls[1].options.credentials, "include"); assert.equal(calls[1].options.headers["X-CSRF-Token"], "csrf-for-browser");
    assert.equal(calls[1].options.method, "POST"); assert.match(calls[1].options.body, /payload/);
  } finally { globalThis.fetch = original; }
});
test("API errors hide server text and mutations do not automatically retry unknown outcomes", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ data: null, error: { code: "REFUND_OUTCOME_UNKNOWN", message: "secret database stack" }, meta: { requestId: "request-123" } }), { status: 502 }); };
  try { await assert.rejects(apiRequest("/payments/orders/order-a/refunds", { method: "POST", body: { amountMinor: 20, idempotencyKey: "fixed-key" } }, apiObject), error => error instanceof ApiError && /같은 접수번호/.test(safeApiMessage(error)) && !safeApiMessage(error).includes("secret")); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});
test("AI citations must point to exact sections in selected public records and abstention is preserved", () => {
  const records = [{ id: "imjin-war", sections: [{ id: "background" }] }];
  const answer = decodeAiResponse({ text: "자료 설명", citations: [{ recordId: "imjin-war", sectionId: "background" }] });
  assert.equal(validateAiCitations(answer, records, ["imjin-war"]), true);
  assert.equal(validateAiCitations(answer, records, []), false);
  assert.equal(validateAiCitations({ ...answer, citations: [{ recordId: "imjin-war", sectionId: "invented" }] }, records, ["imjin-war"]), false);
  assert.deepEqual(decodeAiResponse({ text: "근거가 부족합니다", citations: [] }).citations, []);
  assert.throws(() => decodeAiResponse({ text: "설명", citations: [{ recordId: "imjin-war", sectionId: "../unsafe" }] }));
});
test("checkout URLs require the actual HTTPS Stripe host and order decoding keeps server status", () => {
  assert.equal(verifiedCheckoutUrl("https://checkout.stripe.com/c/pay/session"), "https://checkout.stripe.com/c/pay/session");
  for (const url of ["http://checkout.stripe.com/pay", "https://checkout.stripe.com.evil.test/pay", "https://user:pass@checkout.stripe.com/pay", "https://checkout.stripe.com:444/pay", "javascript:alert(1)"]) assert.equal(verifiedCheckoutUrl(url), null);
  assert.deepEqual(decodeOrderReceipt({ orderId: "order-a", status: "checkout-ready", url: "https://checkout.stripe.com/c/pay/session" }), { orderId: "order-a", status: "checkout-ready", checkoutUrl: "https://checkout.stripe.com/c/pay/session" });
  const order = { id: "order-a", productId: "institution-a", amountMinor: 100, refundedMinor: 20, currency: "krw", status: "partially-refunded", checkoutUrl: "", refundRequests: [{ requestId: "request-a", amountMinor: 30, status: "requested" }] };
  assert.equal(decodePaymentOrder(order).status, "partially-refunded"); assert.equal(decodePaymentOrder(order).refundRequests[0].requestId, "request-a");
  assert.throws(() => decodePaymentOrder({ ...order, refundedMinor: 101 }));
  assert.throws(() => decodePaymentOrder({ ...order, id: "../outside" }));
});
test("private evidence upload uses raw bytes, credentials and CSRF while downloads validate MIME", async () => {
  const original = globalThis.fetch; const calls = []; const file = new Blob(["%PDF-1.7\nprivate evidence"], { type: "application/pdf" });
  const attachment = { attachmentId: "attachment-a", recordId: "imjin-war", sourceId: "source-a", contentType: "application/pdf", size: file.size, sha256: "a".repeat(64), rights: "비공개 검수 보관", createdAt: "2026-10-07T00:00:00Z" };
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return options.method === "POST" ? new Response(JSON.stringify({ data: attachment, error: null, meta: {} }), { headers: { "Content-Type": "application/json" } }) : new Response(file, { headers: { "Content-Type": "application/pdf" } }); };
  try {
    assert.equal((await apiRequest("/cms/attachments?rights=range1..3", { method: "POST", rawBody: file }, decodeAttachment)).sha256, attachment.sha256);
    assert.equal(calls[0].options.body, file); assert.equal(calls[0].options.credentials, "include"); assert.equal(calls[0].options.headers["Content-Type"], "application/pdf"); assert.equal(calls[0].options.headers["X-CSRF-Token"], "csrf-for-browser");
    assert.equal((await downloadCmsAttachment("attachment-a")).type, "application/pdf");
    await assert.rejects(apiRequest("/cms/attachments", { method: "POST", rawBody: new Blob(["unsupported"], { type: "text/html" }) }, decodeAttachment));
    assert.throws(() => decodeAttachment({ ...attachment, sha256: "invented" }));
  } finally { globalThis.fetch = original; }
});
