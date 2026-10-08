import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { defaultSearch, searchRecords } from "../lib/search.ts";
import { toSearchRecord, isPublicRecord } from "../lib/archive-domain.ts";
const cases=JSON.parse(await readFile(new URL("../content/search-evaluation.json",import.meta.url),"utf8")).cases;
const records=JSON.parse(await readFile(new URL("../content/editorial.json",import.meta.url),"utf8")).records.filter(isPublicRecord).map(toSearchRecord);
test("editorial search evaluation covers Korean titles, authority alias discovery and honest empty results",()=>{
 for(const entry of cases){const ids=searchRecords(records,{...defaultSearch,q:entry.query}).map(record=>record.id);if(entry.first)assert.equal(ids[0],entry.first,entry.query);if(entry.includes)assert.ok(ids.includes(entry.includes),entry.query);if(entry.empty)assert.equal(ids.length,0,entry.query);}
});
