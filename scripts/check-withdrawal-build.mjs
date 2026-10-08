import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { publicRecord } from "../api/src/domain/archive.ts";
import { verifyPublicationPageHtml } from "./publication-evidence-domain.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const folder=await mkdtemp(join(tmpdir(),"archive-withdrawal-build-"));
const source=JSON.parse(await readFile(resolve(root,"web/content/editorial.json"),"utf8"));
const secret="isolated-withdrawal-build-fixture-key-only";
const hash=value=>createHash("sha256").update(value).digest("hex");
const body={version:1,generatedAt:new Date().toISOString(),contentHash:hash("[]"),items:[],approvals:[],withheldIds:source.records.map(record=>record.id)};
const payloadHash=hash(JSON.stringify(body));
const file=join(folder,"withdrawn.json");
await writeFile(file,JSON.stringify({...body,publication:{algorithm:"hmac-sha256",payloadHash,signature:createHmac("sha256",secret).update(payloadHash).digest("hex")}}));
const baseline={...process.env,ARCHIVE_BUILD_PROFILE:"preview",NEXT_PUBLIC_SITE_URL:"http://127.0.0.1:4173",NEXT_PUBLIC_API_URL:"http://127.0.0.1:4200"};
function run(command,env,workspace){const args=["run",command,...(workspace?["--workspace",workspace]:[])];if(process.platform==="win32")execFileSync("cmd.exe",["/d","/s","/c",`npm.cmd ${args.join(" ")}`],{cwd:root,env,stdio:"inherit"});else execFileSync("npm",args,{cwd:root,env,stdio:"inherit"});}
try {
 // Isolated synthetic approval exercises the actual Next server-rendered path.
 // It never changes source content, imports into a live API, or observes a remote site.
 const approvedRecord=publicRecord({...source.records[0],review:{...source.records[0].review,status:"approved",humanReviewed:true,reviewer:"Test-only build fixture reviewer",reviewedAt:new Date().toISOString(),note:"Isolated automated build fixture; this is not a real human content approval."}});
 const approvedHash=hash(JSON.stringify(approvedRecord)),fixtureSha="a".repeat(40),fixtureSite="https://archive-build-fixture.example.invalid",evidenceSecret="isolated-build-observation-fixture-key-only";
 const approvedBody={version:1,generatedAt:new Date().toISOString(),contentHash:hash(JSON.stringify([approvedRecord])),items:[approvedRecord],approvals:[{recordId:approvedRecord.id,revision:7,contentHash:approvedHash,reviewerId:"test-only-build-reviewer",approvedAt:new Date().toISOString()}],withheldIds:[]};
 const approvedPayloadHash=hash(JSON.stringify(approvedBody)),approvedFile=join(folder,"approved-fixture.json"),observationFile=join(folder,"build-observation-fixture.json");
 await writeFile(approvedFile,JSON.stringify({...approvedBody,publication:{algorithm:"hmac-sha256",payloadHash:approvedPayloadHash,signature:createHmac("sha256",secret).update(approvedPayloadHash).digest("hex")}}),{flag:"wx",mode:0o600});
 // Production is the supported profile; GITHUB_ACTIONS makes release.mode=ci.
 const approvedEnvironment={...baseline,ARCHIVE_BUILD_PROFILE:"production",GITHUB_ACTIONS:"true",ARCHIVE_RELEASE_SHA:fixtureSha,NEXT_PUBLIC_SITE_URL:fixtureSite,NEXT_PUBLIC_API_URL:"",ARCHIVE_APPROVED_EXPORT_FILE:approvedFile,ARCHIVE_PUBLICATION_VERIFY_SECRET:secret,ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET:evidenceSecret};
 run("build",approvedEnvironment,"@war-archive/web");
 execFileSync(process.execPath,["--experimental-strip-types",resolve(root,"scripts/publication-evidence.mjs"),"build",observationFile],{cwd:root,env:approvedEnvironment,stdio:"inherit"});
 const observation=JSON.parse(await readFile(observationFile,"utf8")),{signature:observationSignature,...observationBody}=observation;assert.equal(observationSignature,createHmac("sha256",evidenceSecret).update(JSON.stringify(observationBody)).digest("hex"));
 assert.equal(observation.version,1);assert.equal(observation.entries.length,1);assert.deepEqual(observation.entries[0],{recordId:approvedRecord.id,revision:7,contentHash:approvedHash,commitSha:fixtureSha,artifactHash:JSON.parse(await readFile(resolve(root,"web/out/release.json"),"utf8")).contentHash,url:`${fixtureSite}/archive/${approvedRecord.id}/`,stage:"build"});
 const approvedHtml=await readFile(resolve(root,`web/out/archive/${approvedRecord.id}/index.html`),"utf8");verifyPublicationPageHtml(approvedHtml,{recordId:approvedRecord.id,revision:7,contentHash:approvedHash});
 for(const record of source.records.filter(record=>record.id!==approvedRecord.id)){assert.equal(record.review.humanReviewed,false);const html=await readFile(resolve(root,`web/out/archive/${record.id}/index.html`),"utf8");assert.doesNotMatch(html,/data-archive-publication=["']approved["']/);}
 console.log("Test-only approved publication: actual Next HTML revision/hash and signed CI-shaped build observation verified; no provider or deployment calls.");
 const environment={...baseline,ARCHIVE_APPROVED_EXPORT_FILE:file,ARCHIVE_PUBLICATION_VERIFY_SECRET:secret};
 run("build",environment,"@war-archive/web");run("test:static",environment);
 const release=JSON.parse(await readFile(resolve(root,"web/out/release.json"),"utf8"));assert.equal(release.recordCount,0);
 for(const record of source.records){const html=await readFile(resolve(root,`web/out/archive/${record.id}/index.html`),"utf8");assert.match(html,/noindex/);assert.ok(html.includes("이 기록은 검토 중입니다."));assert.doesNotMatch(html,/data-archive-publication=["']approved["']/);}
 for(const [kind,items] of [["collections",source.collections],["stories",source.stories]])for(const item of items){const html=await readFile(resolve(root,`web/out/${kind}/${item.id}/index.html`),"utf8");assert.match(html,/noindex/);assert.ok(html.includes("연결 자료를 다시 확인하고 있습니다."));}
 console.log("All-record withdrawal: static build, zero public graph/shards, and retained record/editorial notices verified.");
} finally {run("build",baseline,"@war-archive/web");run("test:static",baseline);}
