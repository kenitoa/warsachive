import assert from "node:assert/strict";
import test from "node:test";
import { createLocalBackup, draftStorageKey, localDataKeys, parseDraftStore, parseLocalBackup, writeDraft } from "../lib/local-draft-storage.ts";
import { decodeResearchRecovery, decodeSharedRecovery, emptyResearchRecovery, emptySharedRecovery, preserveResearchCapture, safeInternalReturn } from "../lib/personal-recovery.ts";
import { emptyWorkspace, encodePlan, decodePlan, importConflicts, mergeWorkspace, publicWorkspace, workspaceKey } from "../lib/workspace-domain.ts";
import { shelfKey } from "../lib/shelf-storage.ts";
import { decodeSession, decodePaymentProduct, decodeAttachment, decodeStudyHistory } from "../lib/api-client.ts";
const now = "2026-10-07T00:00:00Z";
const plan = { id: "lesson", title: "수업", goal: "근거 비교", level: "입문", recordIds: ["imjin-war"], questions: ["왜 다른가?"], updatedAt: now, teacherNotes: "학생에게 비공개", answerKey: "교사 답안" };
const project = { id: "research", title: "연구", question: "작성 목적은?", recordIds: ["legacy-record"], claims: [], notes: "기존 개인 메모", updatedAt: now };

test("draft writes preserve other scopes and stale revisions cannot overwrite a newer tab", () => {
  const first = writeDraft(parseDraftStore(null), "workspace", emptyResearchRecovery(), 0, now);
  const second = writeDraft(first, "teach", { question: "작성 중" }, 0, now);
  const newer = writeDraft(second, "workspace", { ...emptyResearchRecovery(), form: { ...emptyResearchRecovery().form, claimText: "미완성 주장" } }, 1, now);
  assert.equal(newer.entries.find(item => item.scope === "workspace").revision, 2);
  assert.equal(newer.entries.find(item => item.scope === "teach").payload.question, "작성 중");
  assert.throws(() => writeDraft(newer, "workspace", emptyResearchRecovery(), 1, now), /다른 탭/);
  assert.equal(newer.entries.find(item => item.scope === "workspace").payload.form.claimText, "미완성 주장");
});
test("corrupt, duplicate, unsafe and oversized drafts fail without creating a replacement", () => {
  const original = "broken-private-original";
  assert.throws(() => parseDraftStore(original));
  assert.equal(original, "broken-private-original");
  assert.throws(() => writeDraft(parseDraftStore(null), "../other", {}, 0, now));
  assert.throws(() => writeDraft(parseDraftStore(null), "workspace", JSON.parse('{"__proto__":{"polluted":true}}'), 0, now));
  assert.throws(() => writeDraft(parseDraftStore(null), "workspace", { text: "x".repeat(524288) }, 0, now));
  const valid = writeDraft(parseDraftStore(null), "workspace", {}, 0, now);
  assert.throws(() => parseDraftStore(JSON.stringify({ ...valid, entries: [...valid.entries, ...valid.entries] })));
  assert.equal({}.polluted, undefined);
});
test("uncommitted claim, locator and next checks round-trip separately from manually saved workspace", () => {
  const draft = { ...emptyResearchRecovery(), draft: project, buffers: [{ ...project, id: "other", title: "다른 연구" }], form: { ...emptyResearchRecovery().form, claimText: "추가 전 주장", locator: "기사 날짜 작성 중", evidenceText: "확인 메모", nextCheck: "권수 확인" } };
  const store = writeDraft(parseDraftStore(null), "workspace", draft, 0, now);
  assert.deepEqual(decodeResearchRecovery(parseDraftStore(JSON.stringify(store)).entries[0].payload), draft);
  assert.deepEqual(emptyWorkspace().projects, []);
});
test("a new source context preserves earlier pending evidence without duplicating or silently evicting it", () => {
  const form = { ...emptyResearchRecovery().form, recordId: "imjin-war", sourceId: "source-a", locator: "기존 권·쪽", evidenceKind: "quote", evidenceText: "실제로 확인해 쓰던 인용" };
  const captures = preserveResearchCapture([], project.id, form, "capture-a", now);
  assert.equal(captures[0].form.evidenceText, form.evidenceText);
  assert.equal(preserveResearchCapture(captures, project.id, form, "capture-b", now), captures);
  const recovery = { ...emptyResearchRecovery(), captures };
  assert.deepEqual(decodeResearchRecovery(JSON.parse(JSON.stringify(recovery))).captures, captures);
  assert.deepEqual(decodeResearchRecovery({ ...emptyResearchRecovery(), captures: undefined }).captures, []);
  assert.throws(() => preserveResearchCapture(Array.from({ length: 50 }, (_, index) => ({ ...captures[0], id: String(index), projectId: String(index) })), "another", form, "new", now), /50개/);
  assert.equal(captures.length, 1);
});
test("backups use exact owned keys, preserve corrupt raw exports and reject unsafe restores", () => {
  const values = new Map([[workspaceKey, "broken-original"], [shelfKey, null], [draftStorageKey, null], ["other-app", "keep"]]);
  const exported = createLocalBackup(key => values.get(key) ?? null, localDataKeys, now);
  assert.equal(exported.items.find(item => item.key === workspaceKey).raw, "broken-original");
  assert.equal(exported.items.some(item => item.key === "other-app"), false);
  assert.throws(() => parseLocalBackup(JSON.stringify(exported)));
  const valid = createLocalBackup(key => key === workspaceKey ? JSON.stringify({ ...emptyWorkspace(), projects: [project] }) : null, [workspaceKey], now);
  assert.deepEqual(parseLocalBackup(JSON.stringify(valid)), valid);
  assert.throws(() => parseLocalBackup(JSON.stringify({ ...valid, items: [{ key: "other-app", raw: null }] })));
  assert.throws(() => parseLocalBackup(JSON.stringify({ ...valid, items: [...valid.items, ...valid.items] })));
  assert.throws(() => createLocalBackup(() => "가".repeat(2400000), [workspaceKey], now), /7MB/);
  assert.equal(values.get("other-app"), "keep");
});
test("public teaching shares exclude private preparation without mutating local originals", () => {
  const state = { ...emptyWorkspace(), plans: [plan] };
  const shared = publicWorkspace(state);
  assert.equal(shared.plans[0].teacherNotes, undefined);
  assert.equal(shared.plans[0].answerKey, undefined);
  assert.equal(state.plans[0].teacherNotes, "학생에게 비공개");
  assert.equal(decodePlan(encodePlan(plan)).answerKey, undefined);
  assert.deepEqual(shared.plans[0].recordIds, plan.recordIds);
});
test("conflicts expose real field differences and keep both complete private versions", () => {
  const current = { ...emptyWorkspace(), plans: [plan] };
  const incoming = { ...emptyWorkspace(), plans: [{ ...plan, goal: "수정된 목표", teacherNotes: "다른 메모", updatedAt: "2026-10-08T00:00:00Z" }] };
  const [conflict] = importConflicts(current, incoming);
  assert.equal(conflict.localUpdatedAt, now);
  assert.equal(conflict.incomingUpdatedAt, "2026-10-08T00:00:00Z");
  assert.deepEqual(conflict.differences.map(item => item.field).sort(), ["goal", "teacherNotes"]);
  assert.throws(() => mergeWorkspace(current, incoming, {}));
  const merged = mergeWorkspace(current, incoming, { "plan:lesson": "both" });
  assert.equal(merged.plans.length, 2);
  assert.equal(merged.plans[0].teacherNotes, "학생에게 비공개");
  assert.equal(merged.plans[1].teacherNotes, "다른 메모");
});
test("login returns preserve internal context and reject external, encoded traversal and base-path escapes", () => {
  assert.equal(safeInternalReturn("/workspace/?project=research&record=imjin-war#draft"), "/workspace/?project=research&record=imjin-war#draft");
  assert.equal(safeInternalReturn("/warsachive/teach/?plan=lesson", "/warsachive/"), "/warsachive/teach/?plan=lesson");
  for (const raw of ["https://other.example/workspace/", "//other.example/workspace", "/workspace/../account/", "/workspace/%2e%2e/teach/", "/workspace/%252e%252e/teach/", "/\\other", "/account/", "/workspace/\n"]) assert.equal(safeInternalReturn(raw), null);
  assert.equal(safeInternalReturn("/teach/", "/warsachive"), null);
});
test("shared recovery preserves unsent answer versions and immutable copies across a restart", () => {
  const value = { ...emptySharedRecovery(), spaceId: "space-a", taskId: "task-a", payloadVersion: 2, payloadText: JSON.stringify(emptyWorkspace()), answer: "제출 전 답", answers: { "space-a:task-a": { answer: "제출 전 답", evidenceNotes: "권·쪽", recordIds: ["legacy-record"], version: 3 } }, copies: [{ id: "copy-a", title: "서버 사본", version: 4, capturedAt: now, text: JSON.stringify(emptyWorkspace()) }] };
  assert.deepEqual(decodeSharedRecovery(JSON.parse(JSON.stringify(value))), value);
  assert.throws(() => decodeSharedRecovery({ ...value, payloadVersion: -1 }));
});
test("session scopes preserve explicit empty access and reject unknown or duplicate grants", () => {
  const user = { id: "person", email: "person@example.test", name: "사용자", role: "admin" };
  const session = { user, csrfToken: "csrf", capabilities: {} };
  assert.equal(decodeSession(session).user.scopes, undefined);
  assert.deepEqual(decodeSession({ ...session, user: { ...user, scopes: [] } }).user.scopes, []);
  assert.deepEqual(decodeSession({ ...session, user: { ...user, scopes: ["content:read"] } }).user.scopes, ["content:read"]);
  assert.throws(() => decodeSession({ ...session, user: { ...user, scopes: ["superuser"] } }));
  assert.throws(() => decodeSession({ ...session, user: { ...user, scopes: ["content:read", "content:read"] } }));
});
test("service definitions are decoded only when real structured values are provided", () => {
  const item = { id: "product", title: "상품", amountMinor: 100, currency: "KRW" };
  assert.equal(decodePaymentProduct(item).serviceDefinition, undefined);
  const serviceDefinition = { description: "실제 제공 내용", audience: "기관", deliverables: ["검토 자료"], rightsStatement: "계약 범위", deliveryDays: 7, supportPolicy: "실제 문의 정책" };
  assert.deepEqual(decodePaymentProduct({ ...item, serviceDefinition }).serviceDefinition, serviceDefinition);
  assert.throws(() => decodePaymentProduct({ ...item, serviceDefinition: { ...serviceDefinition, deliveryDays: 0 } }));
});
test("attachment scans preserve nullable evidence and reject fake scan states", () => {
  const item = { attachmentId: "upload", recordId: "imjin-war", sourceId: "source", contentType: "image/png", size: 100, sha256: "a".repeat(64), rights: "비공개 검수용", createdAt: now };
  assert.equal(decodeAttachment(item).scanStatus, undefined);
  assert.equal(decodeAttachment({ ...item, scanStatus: "unknown", scanner: null, scannedAt: null }).scanner, null);
  assert.equal(decodeAttachment({ ...item, scanStatus: "clean", scanner: "configured-scanner", scannedAt: now }).scanStatus, "clean");
  assert.throws(() => decodeAttachment({ ...item, scanStatus: "approved" }));
  assert.throws(() => decodeAttachment({ ...item, scanStatus: ["clean"] }));
});
test("submission history keeps feedback linked to the submitted answer version", () => {
  const value = { revisions: [{ version: 2, taskVersion: 3, payload: { answer: "수정 답안" }, createdAt: now }], feedback: [{ submissionVersion: 1, feedbackVersion: 1, feedback: "이전 답안 검토", createdAt: now }] };
  assert.deepEqual(decodeStudyHistory(value), value);
  assert.equal(decodeStudyHistory(value).feedback[0].submissionVersion, 1);
  assert.throws(() => decodeStudyHistory({ ...value, revisions: [{ ...value.revisions[0], version: -1 }] }));
});
