import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {toSearchRecord} from "../lib/archive-domain.ts";
import {sha256Text,isPublicCatalog} from "../lib/public-catalog.ts";
test("portable public integrity SHA matches native standard vectors and UTF-8",()=>{
 for(const text of ["","abc","a".repeat(100000),"전쟁사 📜", "\ud800"]) assert.equal(sha256Text(text),createHash("sha256").update(text).digest("hex"));
});
test("catalog refuses cross-path references, duplicate IDs and held records",()=>{
 assert.equal(isPublicCatalog({version:2,siteUrl:"https://example.org",contentHash:"a".repeat(64),generatedAt:"2026-10-07",records:[],collections:[]}),true);
 assert.equal(isPublicCatalog({version:2,siteUrl:"https://example.org",contentHash:"bad",generatedAt:"2026-10-07",records:[],collections:[]}),false);
});
test("real descriptors reject stale or held metadata, duplicate IDs and escaping detail paths",async()=>{
 const record=JSON.parse(await readFile(new URL("../content/editorial.json",import.meta.url),"utf8")).records[0];
 const sha256="a".repeat(64);const entry={...toSearchRecord(record),sha256,bytes:1000,detailPath:`/data/records/${record.id}-${sha256}.json`};
 const catalog={version:2,siteUrl:"https://example.org",contentHash:sha256,generatedAt:"2026-10-07",records:[entry],collections:[]};
 assert.equal(isPublicCatalog(catalog),true);
 for(const detailPath of ["/data/../private.json","https://other.example/record.json",entry.detailPath+"?old=1"]){assert.equal(isPublicCatalog({...catalog,records:[{...entry,detailPath}]}),false);}
 assert.equal(isPublicCatalog({...catalog,records:[entry,entry]}),false);
 for(const reviewStatus of ["withheld","needs-review"]){assert.equal(isPublicCatalog({...catalog,records:[{...entry,reviewStatus}]}),false);}
 assert.equal(isPublicCatalog({...catalog,collections:[{id:"path",title:"Path",recordIds:["unpublished"]}]}),false);
});
