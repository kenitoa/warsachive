import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {toSearchRecord} from "../../web/lib/archive-domain.ts";
import {loadCatalog,loadCatalogRecord,downloadSelection,readDownloads,clearDownloads,selectionSize,downloadStates,loadDownloadedRecord,utf8Bytes} from "../catalog-client.ts";
const editorial=JSON.parse(await readFile(new URL("../../web/content/editorial.json",import.meta.url),"utf8"));
const site="https://example.org/archive";const bodies=editorial.records.map(record=>JSON.stringify(record));
const catalog={version:2,siteUrl:site,contentHash:"a".repeat(64),generatedAt:"2026-10-07T00:00:00Z",records:editorial.records.map((record,index)=>{const sha256=createHash("sha256").update(bodies[index]).digest("hex");return{...toSearchRecord(record),sha256,bytes:Buffer.byteLength(bodies[index]),detailPath:`/data/records/${record.id}-${sha256}.json`};}),collections:[{id:"path",title:"Path",recordIds:editorial.records.map(record=>record.id)}]};
function storage(){const values=new Map();return{values,async getItem(key){return values.get(key)??null;},async setItem(key,value){values.set(key,value);},async removeItem(key){values.delete(key);}};}
const fetcher=async(url)=>new Response(url.endsWith("catalog-v2.json")?JSON.stringify(catalog):bodies[catalog.records.findIndex(entry=>url.endsWith(entry.detailPath))]);
test("catalog download requests lightweight metadata then selected detail and preserves offline reads",async()=>{
 const cache=storage();let calls=0;const wrapped=async(...args)=>{calls++;return fetcher(...args);};const result=await loadCatalog(site,cache,wrapped);assert.equal(calls,1);assert.equal(result.catalog.records[0].sections,undefined);
 const detail=await loadCatalogRecord(site,catalog.records[0],cache,wrapped);assert.equal(calls,2);assert.equal(detail.record.id,catalog.records[0].id);
 const offline=async()=>{throw new Error("offline");};assert.equal((await loadCatalog(site,cache,offline)).mode,"offline");assert.equal((await loadCatalogRecord(site,catalog.records[0],cache,offline)).mode,"offline");
});
test("hash tampering and changed site never overwrite the usable detail",async()=>{
 const cache=storage();await loadCatalogRecord(site,catalog.records[0],cache,fetcher);const before=[...cache.values.values()];
 const fallback=await loadCatalogRecord(site,catalog.records[0],cache,async()=>new Response(bodies[0].replace("임진왜란","다른 내용")));assert.equal(fallback.mode,"offline");assert.deepEqual([...cache.values.values()],before);
 await assert.rejects(loadCatalog("https://other.example.org",cache,fetcher),/사이트/);
});
test("failed selection leaves its old marker unchanged and successful selection commits all records",async()=>{
 const cache=storage();await downloadSelection(site,catalog,[catalog.records[0].id],cache,fetcher);const old=await readDownloads(site,cache);
 await assert.rejects(downloadSelection(site,catalog,catalog.records.map(item=>item.id),cache,async(url)=>url.endsWith(catalog.records[1].detailPath)?new Response("broken"):fetcher(url)));
 assert.deepEqual(await readDownloads(site,cache),old);await downloadSelection(site,catalog,catalog.records.map(item=>item.id),cache,fetcher);assert.equal((await readDownloads(site,cache)).length,4);
 await cache.setItem("war-archive:saved:v1",'["imjin-war"]');await clearDownloads(site,cache);assert.equal((await readDownloads(site,cache)).length,0);assert.equal(await cache.getItem("war-archive:saved:v1"),'["imjin-war"]');
});
test("corrupt selection is not silently replaced and withdrawal is reported after a valid refresh",async()=>{
 const cache=storage();await loadCatalog(site,cache,fetcher);const fresh=structuredClone(catalog);fresh.records.shift();fresh.collections=[];
 const next=await loadCatalog(site,cache,async()=>new Response(JSON.stringify(fresh)));assert.match(next.warning,/공개 목록/);
 const key=`war-archive:downloads:v2:${encodeURIComponent(site)}`;await cache.setItem(key,"broken");await assert.rejects(downloadSelection(site,catalog,[catalog.records[0].id],cache,fetcher));assert.equal(await cache.getItem(key),"broken");
});

test("download size, actual byte progress and catalog confirmation time remain explicit offline",async()=>{
 const cache=storage();const events=[];const current=await loadCatalog(site,cache,fetcher);
 const selected=catalog.records.slice(0,2);const size=selectionSize(catalog,selected.map(item=>item.id));
 assert.equal(size.records,2);assert.equal(size.bytes,selected.reduce((sum,item)=>sum+item.bytes,0));
 await downloadSelection(site,catalog,selected.map(item=>item.id),cache,fetcher,progress=>events.push(progress));
 assert.equal(events[0].phase,"downloading");assert.equal(events.at(-1).phase,"complete");assert.equal(events.at(-1).downloadedBytes,size.bytes);assert.equal(events.at(-1).completedRecords,2);
 assert.ok(events.every(item=>item.downloadedBytes<=item.totalBytes));
 assert.equal(utf8Bytes("한글🙂\ud800"),Buffer.byteLength("한글🙂\ud800"));
 const offline=await loadCatalog(site,cache,async()=>{throw new Error("offline");});
 assert.equal(offline.checkedAt,current.checkedAt);assert.match(offline.warning,/즉시 알 수 없습니다/);
 assert.throws(()=>selectionSize(catalog,["missing-record"]),/공개 목록/);
});

test("a partial failed bundle retains old marker and reports failure without claiming completion",async()=>{
 const cache=storage();await downloadSelection(site,catalog,[catalog.records[0].id],cache,fetcher);const old=await readDownloads(site,cache);const progress=[];
 await assert.rejects(downloadSelection(site,catalog,catalog.records.slice(0,2).map(item=>item.id),cache,async url=>url.endsWith(catalog.records[1].detailPath)?new Response("broken"):fetcher(url),item=>progress.push(item)));
 assert.equal(progress.at(-1).phase,"failed");assert.equal(progress.at(-1).completedRecords,1);assert.ok(!progress.some(item=>item.phase==="complete"));assert.deepEqual(await readDownloads(site,cache),old);
});

test("online withdrawal prevents old body reads while an offline last-known copy is labelled",async()=>{
 const cache=storage();await loadCatalog(site,cache,fetcher);await downloadSelection(site,catalog,[catalog.records[0].id],cache,fetcher);const entry=(await readDownloads(site,cache))[0];
 const withdrawn=structuredClone(catalog);withdrawn.records.shift();withdrawn.collections=[];
 const current=await loadCatalog(site,cache,async()=>new Response(JSON.stringify(withdrawn)));
 assert.deepEqual(current.removedIds,[entry.id]);assert.equal(downloadStates(current.catalog,[entry])[0].state,"unavailable");
 await assert.rejects(loadDownloadedRecord(site,entry,cache,current),/公開|공개 목록/);
 await assert.rejects(loadCatalogRecord(site,catalog.records[0],cache,async()=>{throw new Error("offline");}),/공개 목록/);
 const beforeRefresh={...current,catalog,mode:"offline"};const old=await loadDownloadedRecord(site,entry,cache,beforeRefresh);
 assert.equal(old.record.id,entry.id);assert.match(old.warning,/오프라인/);
});

test("changed version exposes old snapshot deliberately and requires new download for current contents",async()=>{
 const cache=storage();await loadCatalog(site,cache,fetcher);await downloadSelection(site,catalog,[catalog.records[0].id],cache,fetcher);const entry=(await readDownloads(site,cache))[0];
 const record=structuredClone(editorial.records[0]);record.summary+=" 편집 변경 테스트 fixture";const body=JSON.stringify(record);const digest=createHash("sha256").update(body).digest("hex");
 const next=structuredClone(catalog);next.contentHash="b".repeat(64);next.records[0]={...toSearchRecord(record),sha256:digest,bytes:Buffer.byteLength(body),detailPath:`/data/records/${record.id}-${digest}.json`};
 const current=await loadCatalog(site,cache,async()=>new Response(JSON.stringify(next)));
 assert.deepEqual(current.updatedIds,[entry.id]);assert.equal(downloadStates(current.catalog,[entry])[0].state,"outdated");
 const old=await loadDownloadedRecord(site,entry,cache,current);assert.equal(old.record.summary,editorial.records[0].summary);assert.match(old.warning,/이전 버전/);
 await downloadSelection(site,next,[entry.id],cache,async()=>new Response(body));const latest=(await readDownloads(site,cache))[0];assert.equal(latest.sha256,digest);assert.equal((await loadDownloadedRecord(site,latest,cache,current)).record.summary,record.summary);
});

test("withdrawal during response or disk save cannot restore old content through fallback or commit",async()=>{
 const cache=storage();await loadCatalog(site,cache,fetcher);await loadCatalogRecord(site,catalog.records[0],cache,fetcher);
 const withdrawn=structuredClone(catalog);withdrawn.records.shift();withdrawn.collections=[];
 await assert.rejects(loadCatalogRecord(site,catalog.records[0],cache,async()=>{await loadCatalog(site,cache,async()=>new Response(JSON.stringify(withdrawn)));return new Response(bodies[0]);}),/공개 목록/);
 await loadCatalog(site,cache,fetcher);await downloadSelection(site,catalog,[catalog.records[1].id],cache,fetcher);const old=await readDownloads(site,cache);
 const mutate={...cache,async setItem(key,value){await cache.setItem(key,value);if(key.includes(":detail:v2:")&&key.includes(":"+catalog.records[0].id+":"))await cache.setItem(`war-archive:catalog:v2:${encodeURIComponent(site)}`,JSON.stringify(withdrawn));}};
 await assert.rejects(downloadSelection(site,catalog,[catalog.records[0].id],mutate,fetcher),/공개 목록/);assert.deepEqual(await readDownloads(site,cache),old);
});
