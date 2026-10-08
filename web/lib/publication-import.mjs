import { readFileSync } from "node:fs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isArchiveRecord, isPublicRecord, toPendingArchiveRecord } from "./archive-domain.ts";
const sha = value => createHash("sha256").update(value).digest("hex");
const identifier = value => typeof value === "string" && /^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]{1,80}$/.test(value);
const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function safe(value, depth = 0) { if(depth>20)return false;if(value===null||typeof value!=="object")return true;if(Array.isArray(value))return value.every(item=>safe(item,depth+1));return Object.entries(value).every(([key,item])=>!["__proto__","constructor","prototype"].includes(key)&&safe(item,depth+1)); }
export function validatePublication(value, secret) {
  if(typeof secret!=="string"||secret.length<32)throw new Error("Publication verification secret is required.");
  if(!object(value)||!safe(value)||value.version!==1||typeof value.generatedAt!=="string"||!Number.isFinite(Date.parse(value.generatedAt))||!Array.isArray(value.items)||value.items.length>10000||!Array.isArray(value.approvals)||!Array.isArray(value.withheldIds)||!value.withheldIds.every(identifier)||!object(value.publication))throw new Error("Signed publication contract is invalid.");
  const allowed=["version","generatedAt","contentHash","items","approvals","withheldIds","publication"];
  if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error("Unexpected data in signed publication.");
  const body={version:value.version,generatedAt:value.generatedAt,contentHash:value.contentHash,items:value.items,approvals:value.approvals,withheldIds:value.withheldIds};
  const payloadHash=sha(JSON.stringify(body));const signature=createHmac("sha256",secret).update(payloadHash).digest();
  if(value.publication.algorithm!=="hmac-sha256"||value.publication.payloadHash!==payloadHash||typeof value.publication.signature!=="string"||!/^[a-f0-9]{64}$/.test(value.publication.signature)||!timingSafeEqual(signature,Buffer.from(value.publication.signature,"hex")))throw new Error("Publication signature verification failed.");
  if(value.contentHash!==sha(JSON.stringify(value.items)))throw new Error("Publication content hash differs.");
  const ids=new Set(value.items.map(record=>record.id));
  if(ids.size!==value.items.length||new Set(value.withheldIds).size!==value.withheldIds.length||value.withheldIds.some(id=>ids.has(id)))throw new Error("Publication contains duplicate or withheld public IDs.");
  if(value.approvals.length!==value.items.length||new Set(value.approvals.map(item=>item.recordId)).size!==value.items.length)throw new Error("Publication approval evidence is incomplete.");
  for(const record of value.items){
    if(!isArchiveRecord(record)||!isPublicRecord(record)||record.review.status!=="approved"||!record.review.humanReviewed)throw new Error("Only human-approved publication records may be imported.");
    const evidence=value.approvals.find(item=>item.recordId===record.id);
    if(!object(evidence)||!identifier(evidence.reviewerId)||typeof evidence.approvedAt!=="string"||!Number.isFinite(Date.parse(evidence.approvedAt))||!Number.isSafeInteger(evidence.revision)||evidence.revision<1||evidence.contentHash!==sha(JSON.stringify(record)))throw new Error("Publication approval does not match the record version.");
  }
  return {items:value.items,approvals:value.approvals.map(({recordId,revision,contentHash,reviewerId,approvedAt})=>({recordId,revision,contentHash,reviewerId,approvedAt})),withheldIds:value.withheldIds,generatedAt:value.generatedAt};
}
export function readSignedPublication(path, secret) {
  if(!path)return {items:[],approvals:[],withheldIds:[],generatedAt:""};
  const raw=readFileSync(path,"utf8");if(raw.length>20_000_000)throw new Error("Signed publication exceeds the import limit.");
  return validatePublication(JSON.parse(raw),secret);
}
export function applyPublication(records, publication) {
  const overlays=new Map(publication.items.map(record=>[record.id,record]));
  const merged=records.map(record=>overlays.get(record.id)??record);const existing=new Set(merged.map(record=>record.id));
  for(const record of publication.items)if(!existing.has(record.id)){merged.push(record);existing.add(record.id);}
  const withheld=new Set(publication.withheldIds);
  for(const id of withheld)if(!existing.has(id)){merged.push(toPendingArchiveRecord({id,title:"공개 보류된 기록",summary:"공개 보류",period:"미확인",region:"미확인",sourceCount:0},publication.generatedAt));existing.add(id);}
  return merged.map(record=>withheld.has(record.id)?{...record,review:{...record.review,status:"withheld",humanReviewed:false,note:"발행 담당자가 공개를 보류했습니다. 기존 주소는 보존하며 공개 탐색과 자료 내보내기에서 제외합니다."}}:record);
}
