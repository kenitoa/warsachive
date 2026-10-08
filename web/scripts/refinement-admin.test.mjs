import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { blankEditorialRecord, editableRecord, editorialChanges, recordEditorIssues } from "../lib/refinement-admin.ts";
const record = JSON.parse(await readFile(new URL("../content/editorial.json", import.meta.url), "utf8")).records[0];
test("CMS incomplete form input remains recoverable but cannot be saved as a complete record", () => {
  const blank = blankEditorialRecord("2026-10-07T00:00:00Z"); assert.deepEqual(editableRecord(blank), blank); assert.ok(recordEditorIssues(blank).some(issue => issue.target === "cms-title"));
  const partial = structuredClone(record); partial.title = ""; partial.date.startYear = null; partial.sources[0].url = ""; assert.deepEqual(editableRecord(partial), partial); assert.ok(recordEditorIssues(partial).length >= 3);
  assert.equal(editableRecord({ title: "missing structure" }), null);
});
test("CMS diff follows stable section and source IDs and shows ordering separately", () => {
  const next = structuredClone(record); next.sections.reverse(); next.sections[0].paragraphs[0] += " 변경 확인"; next.sources[0].location += " 위치 확인";
  const changes = editorialChanges(record, next); assert.ok(changes.some(change => change.field.includes(next.sections[0].id))); assert.ok(changes.some(change => change.field.includes("순서"))); assert.ok(changes.some(change => change.field.includes(next.sources[0].id))); assert.equal(editorialChanges(record, structuredClone(record)).length, 0);
});
test("CMS errors locate invalid evidence, dates, duplicate IDs and source URLs", () => {
  const bad = structuredClone(record); bad.date.startYear = 2000; bad.sections[0].sourceIds.push("missing-source"); bad.sources[0].url = "http://localhost/private"; bad.sources.push(structuredClone(bad.sources[0]));
  const issues = recordEditorIssues(bad); assert.ok(issues.some(issue => issue.target === "cms-date")); assert.ok(issues.some(issue => issue.message.includes("중복"))); assert.ok(issues.some(issue => issue.message.includes("등록되지 않은 자료"))); assert.ok(issues.some(issue => issue.target === "cms-source-0"));
});
