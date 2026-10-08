import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createStripeAdapter } from "../src/adapters/stripe.ts";
import { createAiAdapter } from "../src/adapters/ai.ts";
import { createNotificationAdapter } from "../src/adapters/notification.ts";
const stripeEnv = { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture", STRIPE_API_VERSION: "2026-09-30.clover" };
function signed(event, delta = 0) { const raw = Buffer.from(JSON.stringify(event)); const time = Math.floor(Date.now()/1000) + delta; return { raw, signature: `t=${time},v1=${createHmac("sha256", stripeEnv.STRIPE_WEBHOOK_SECRET).update(`${time}.`).update(raw).digest("hex")}` }; }
const session = { id: "cs_fixture", client_reference_id: "order_fixture", payment_status: "paid", amount_total: 500, currency: "usd", payment_intent: "pi_fixture" };
test("unconfigured providers are unavailable and partial/live payment configurations fail early", () => {
  assert.equal(createStripeAdapter({}).enabled, false); assert.equal(createAiAdapter({}).enabled, false); assert.equal(createNotificationAdapter({}).enabled, false);
  assert.throws(() => createStripeAdapter({ STRIPE_SECRET_KEY: "sk_test_fixture" }), /required/);
  assert.throws(() => createStripeAdapter({ ...stripeEnv, STRIPE_SECRET_KEY: "sk_live_fixture" }), /release/);
  assert.throws(() => createNotificationAdapter({ ARCHIVE_NOTIFICATION_URL: "http://localhost/", ARCHIVE_NOTIFICATION_SECRET: "x".repeat(32), ARCHIVE_NOTIFICATION_ALLOWED_HOSTS: "localhost" }), /approved/);
});
test("checkout sends only server prices with a stable idempotency key", async () => {
  let seen;
  const adapter = createStripeAdapter(stripeEnv, async (url, init) => { seen = {url,init}; return new Response(JSON.stringify({...session,url:"https://checkout.stripe.com/c/pay/cs_fixture"})); });
  await adapter.createCheckout({ orderId:"order_fixture",userId:"user_fixture",product:{id:"course",title:"Course",amountMinor:500,currency:"usd"},successUrl:"https://example.org/account/",cancelUrl:"https://example.org/account/" });
  assert.equal(seen.init.headers["Idempotency-Key"],"archive-checkout-order_fixture"); assert.equal(seen.init.body.get("line_items[0][price_data][unit_amount]"),"500");
});
test("webhook signature, timestamp, mode and server session state are checked", async () => {
  const adapter = createStripeAdapter(stripeEnv, async () => new Response(JSON.stringify(session)));
  const event = { id:"evt_fixture",type:"checkout.session.completed",livemode:false,data:{object:{id:session.id,client_reference_id:session.client_reference_id,payment_status:"unpaid"}}};
  const valid = signed(event); assert.equal((await adapter.verifyWebhook(valid.raw,valid.signature)).status,"paid");
  await assert.rejects(adapter.verifyWebhook(valid.raw,valid.signature.replace(/v1=.*$/,"v1="+"0".repeat(64))),/signature/);
  const old = signed(event,-600); await assert.rejects(adapter.verifyWebhook(old.raw,old.signature),/expired/);
  const live = signed({...event,livemode:true}); await assert.rejects(adapter.verifyWebhook(live.raw,live.signature),/invalid/);
  const unpaid = createStripeAdapter(stripeEnv, async () => new Response(JSON.stringify({...session,payment_status:"unpaid"}))); assert.equal(await unpaid.verifyWebhook(valid.raw,valid.signature),null);
});
test("refunds carry idempotency and verify ownership of the paid session", async () => {
  let key="";
  const adapter=createStripeAdapter(stripeEnv,async(url,init)=>{ if(url.includes("checkout/sessions/")) return new Response(JSON.stringify(session)); key=init.headers["Idempotency-Key"];return new Response(JSON.stringify({id:"re_fixture",status:"pending"})); });
  assert.equal((await adapter.refund({orderId:"order_fixture",sessionId:"cs_fixture",amountMinor:100,idempotencyKey:"refund_fixture"})).status,"pending"); assert.equal(key,"archive-refund-refund_fixture");
  await assert.rejects(adapter.refund({orderId:"another",sessionId:"cs_fixture",amountMinor:100,idempotencyKey:"refund_fixture"}),/verified/);
});
test("successful refund uses provider cumulative amounts and charge events do not depend on copied metadata", async () => {
  const adapter=createStripeAdapter(stripeEnv,async(url)=>new Response(JSON.stringify(url.includes("payment_intents/") ? {id:"pi_fixture",latest_charge:{amount:500,amount_refunded:200,currency:"usd"}} : url.includes("checkout/sessions?") ? {data:[session]} : url.includes("checkout/sessions/") ? session : {id:"re_fixture",status:"succeeded"})));
  assert.equal((await adapter.refund({orderId:"order_fixture",sessionId:"cs_fixture",amountMinor:100,idempotencyKey:"refund_fixture"})).refundedMinor,200);
  const event=signed({id:"evt_refund",type:"charge.refunded",livemode:false,data:{object:{id:"ch_fixture",payment_intent:"pi_fixture",amount:500,amount_refunded:200,currency:"usd",metadata:{}}}});
  const result=await adapter.verifyWebhook(event.raw,event.signature); assert.equal(result.orderId,"order_fixture");assert.equal(result.refundedMinor,200);
});
const editorial = JSON.parse(await readFile(new URL("../../web/content/editorial.json",import.meta.url),"utf8"));
const records=editorial.records.slice(0,1); const aiEnv={OPENAI_API_KEY:"fixture-key",ARCHIVE_AI_MODEL:"configured-test-model",ARCHIVE_AI_ENABLED:"true",ARCHIVE_AI_EVALUATION_APPROVED:"true"};
function aiResponse(answer){return new Response(JSON.stringify({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({abstained:false,...answer})}]}],usage:{input_tokens:100,output_tokens:20}}));}
test("AI uses stateless structured output and validates all evidence references",async()=>{
  let payload;
  const citation={recordId:records[0].id,sectionId:records[0].sections[0].id};
  const adapter=createAiAdapter(aiEnv,async(_url,init)=>{payload=JSON.parse(init.body);return aiResponse({text:"자료의 설명을 확인하세요.",citations:[citation]});},true);
  const answer=await adapter.answer({question:"자료를 설명해주세요",records,mode:"answer"}); assert.deepEqual(answer.citations,[citation]);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(payload.tools,undefined);
  const bad=createAiAdapter(aiEnv,async()=>aiResponse({text:"내용",citations:[{recordId:"private",sectionId:"secret"}]}),true);await assert.rejects(bad.answer({question:"질문",records,mode:"answer"}),/scope/);
});
test("AI release gate and public data boundary reject unapproved use and private drafts",async()=>{
  const unapproved=createAiAdapter({...aiEnv,ARCHIVE_AI_EVALUATION_APPROVED:"false"});await assert.rejects(unapproved.answer({question:"질문",records,mode:"answer"}),/approved/);
  const pending=structuredClone(records);pending[0].review.status="needs-review";
  const adapter=createAiAdapter(aiEnv);await assert.rejects(adapter.answer({question:"질문",records:pending,mode:"assist"}),/boundary/);
  const noEvidence=createAiAdapter(aiEnv,async()=>aiResponse({text:"근거 없는 확정 설명",citations:[]}),true);await assert.rejects(noEvidence.answer({question:"질문",records,mode:"answer"}),/evidence/);
});
