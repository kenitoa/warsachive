import assert from "node:assert/strict";
import test from "node:test";
import { emptyWorkspace, parseWorkspace, mergeWorkspace, importConflicts, projectFromShelf, encodePlan, decodePlan, exportRis, mergeShelfNotes } from "../lib/workspace-domain.ts";
const now = "2026-10-07T00:00:00Z";
const project = { id: "project-a", title: "자료 비교", question: "어떻게 다른가", recordIds: ["imjin-war"], claims: [], notes: "내 메모", updatedAt: now };
test("workspace backups preserve private text and reject malformed/oversized data", () => {
  const state = { ...emptyWorkspace(), projects: [project] };
  assert.deepEqual(parseWorkspace(JSON.stringify(state)), state);
  assert.throws(() => parseWorkspace(JSON.stringify({ ...state, projects: [{ ...project, recordIds: ["../escape"] }] })));
  assert.throws(() => parseWorkspace("x".repeat(2000001)));
});
test("direct quotations require a source and actual locator, notes remain separate", () => {
  const evidence = { id: "evidence-a", recordId: "imjin-war", sourceId: "", locator: "", kind: "quote", text: "확인한 문장", recordVersion: "2026-10-07", capturedAt: now };
  const claim = { id: "claim-a", statement: "확인할 주장", limitations: "", evidence: [evidence] };
  assert.throws(() => parseWorkspace(JSON.stringify({ ...emptyWorkspace(), projects: [{ ...project, claims: [claim] }] })));
  assert.doesNotThrow(() => parseWorkspace(JSON.stringify({ ...emptyWorkspace(), projects: [{ ...project, claims: [{ ...claim, evidence: [{ ...evidence, sourceId: "source-a", locator: "기사 날짜와 문단" }] }] }] })));
});
test("cloud notes require explicit resolution and never silently truncate conflicts", () => {
  assert.throws(() => mergeShelfNotes({ "record-a": "기기" }, { "record-a": "서버" }, {}));
  const merged = mergeShelfNotes({ "record-a": "기기" }, { "record-a": "서버" }, { "record-a": "both" });
  assert.match(merged["record-a"], /기기/); assert.match(merged["record-a"], /서버/);
  assert.throws(() => mergeShelfNotes({ "record-a": "x".repeat(3000) }, { "record-a": "y".repeat(3000) }, { "record-a": "both" }));
});
test("import requires explicit conflicts and both keeps local and imported versions", () => {
  const local = { ...emptyWorkspace(), projects: [project] };
  const incoming = { ...emptyWorkspace(), projects: [{ ...project, notes: "다른 기기의 메모" }] };
  assert.equal(importConflicts(local, incoming).length, 1);
  assert.throws(() => mergeWorkspace(local, incoming, {}));
  const merged = mergeWorkspace(local, incoming, { "project:project-a": "both" });
  assert.equal(merged.projects.length, 2); assert.equal(merged.projects[0].notes, project.notes); assert.equal(merged.projects[1].notes, incoming.projects[0].notes);
  assert.equal(local.projects.length, 1);
});
test("legacy shelf import is selected and never mutates original shelf", () => {
  const shelf = { bookmarks: ["imjin-war", "jingbirok"], notes: { "imjin-war": "검토할 부분" } };
  const imported = projectFromShelf(shelf, ["imjin-war"], "new-project", now);
  assert.deepEqual(imported.recordIds, ["imjin-war"]); assert.match(imported.notes, /검토할 부분/); assert.equal(shelf.bookmarks.length, 2);
});
test("class path URL round-trip validates size and RIS cannot inject tags via newlines", () => {
  const plan = { id: "plan-a", title: "수업", goal: "근거 읽기", level: "입문", recordIds: ["imjin-war"], questions: ["무슨 자료인가"], updatedAt: now };
  assert.deepEqual(decodePlan(encodePlan(plan)), plan); assert.throws(() => decodePlan("x".repeat(12001)));
  const percent = { ...plan, goal: "원문 범위 100% 확인 & 국역 비교" }; const address = new URL(`https://example.test/teach/?plan=${encodePlan(percent)}`);
  assert.deepEqual(decodePlan(address.searchParams.get("plan")), percent);
  const ris = exportRis([{ title: "아카이브", url: "https://example.test/", sources: [{ title: "기록\nER  - fake", creator: "작성자", url: "https://example.test/source" }] }]);
  assert.equal(ris.match(/^ER {2}- /gm).length, 1);
});
