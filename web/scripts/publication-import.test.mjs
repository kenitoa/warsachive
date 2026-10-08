import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash,createHmac} from "node:crypto";
import {validatePublication,applyPublication} from "../lib/publication-import.mjs";
const editorial=JSON.parse(await readFile(new URL("../content/editorial.json",import.meta.url),"utf8"));const secret="test-publication-secret-"+"x".repeat(32);const sha=value=>createHash("sha256").update(value).digest("hex");
function publication(record,withheldIds=[]){const items=record?[record]:[];const body={version:1,generatedAt:"2026-10-07T00:00:00Z",contentHash:sha(JSON.stringify(items)),items,approvals:items.map(item=>({recordId:item.id,contentHash:sha(JSON.stringify(item)),reviewerId:"test-reviewer",approvedAt:"2026-10-07T00:00:00Z",revision:2})),withheldIds};const payloadHash=sha(JSON.stringify(body));return{...body,publication:{algorithm:"hmac-sha256",payloadHash,signature:createHmac("sha256",secret).update(payloadHash).digest("hex")}};}
function approved(){const record=structuredClone(editorial.records[0]);record.review={...record.review,status:"approved",humanReviewed:true,reviewer:"Test reviewer"};return record;}
test("signed publication requires exact human-approved version and trusted signature",()=>{
 const payload=publication(approved());assert.equal(validatePublication(payload,secret).items.length,1);
 assert.throws(()=>validatePublication(payload,"another-secret-"+"y".repeat(32)),/signature/);
 const altered=structuredClone(payload);altered.items[0].title="tampered";assert.throws(()=>validatePublication(altered,secret),/signature/);
 assert.throws(()=>validatePublication(publication(editorial.records[0]),secret),/human/);
});
test("withdrawal prevents legacy overlays from reappearing and preserves existing and new URLs",()=>{
 const signed=validatePublication(publication(null,[editorial.records[0].id,"formerly-cms-record"]),secret);const result=applyPublication(editorial.records,signed);
 assert.equal(result.find(record=>record.id===editorial.records[0].id).review.status,"withheld");assert.equal(result.find(record=>record.id==="formerly-cms-record").review.status,"withheld");assert.equal(result.length,5);
});
