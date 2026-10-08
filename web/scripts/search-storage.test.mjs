import assert from "node:assert/strict";
import test from "node:test";
import { parseSearch, serializeSearch, searchRecords, matchingContext, safeReturnPath } from "../lib/search.ts";
import { emptyShelf, parseShelf, toggleBookmark, setNote, recordVisit, incrementMetric } from "../lib/shelf-storage.ts";

const record = { id: "test-record", title: "기록 A", period: "1592–1598", region: "동아시아", kind: "event", summary: "전쟁과 외교를 살펴봅니다", labels: ["외교"], aliases: ["Record A"], date: { startYear: 1592, endYear: 1598, precision: "range" }, people: [{ id: "person", name: "이순신", aliases: ["Yi Sun-sin"] }], places: [], language: "ko", updatedAt: "2026-10-07T00:00:00Z", readingMinutes: 2, sourceCount: 1, institutions: ["공식 기관"], hasOriginal: true, reviewStatus: "source-checked" };
test("URL search round-trip and malformed parameters", () => {
  const state = parseSearch(new URLSearchParams("q=이순신&label=외교&original=1&page=3&sort=date"));
  assert.deepEqual(parseSearch(new URLSearchParams(serializeSearch(state))), state);
  assert.equal(parseSearch(new URLSearchParams("page=-1&sort=evil&era=evil&kind=evil")).page, 1);
  assert.equal(parseSearch(new URLSearchParams("page=NaN")).page, 1);
});
test("search matches entity aliases, institutions and combined filters", () => {
  const state = parseSearch(new URLSearchParams("q=Yi Sun-sin&label=외교&era=early-modern&original=1"));
  assert.equal(searchRecords([record], state).length, 1);
  assert.match(matchingContext(record, state.q), /이순신/);
  assert.equal(searchRecords([record], { ...state, region: "다른 지역" }).length, 0);
  assert.equal(searchRecords([record], { ...state, saved: true }, []).length, 0);
  assert.equal(searchRecords([record], { ...state, saved: true }, [record.id]).length, 1);
});
test("BCE and unknown dates are filtered without inventing a date", () => {
  const ancient = { ...record, id: "ancient", date: { startYear: -100, endYear: -90, precision: "range" } };
  const unknown = { ...record, id: "unknown", date: { startYear: null, endYear: null, precision: "unknown" } };
  assert.deepEqual(searchRecords([unknown, record, ancient], parseSearch(new URLSearchParams("era=ancient"))).map(item => item.id), ["ancient"]);
  assert.deepEqual(searchRecords([unknown, record], parseSearch(new URLSearchParams("era=unknown"))).map(item => item.id), ["unknown"]);
});
test("return path accepts only same-site section roots", () => {
  assert.equal(safeReturnPath("/warsachive/archive/?q=hello", "/warsachive"), "/warsachive/archive/?q=hello");
  assert.equal(safeReturnPath("/warsachive/workspace/?project=research-1#evidence", "/warsachive"), "/warsachive/workspace/?project=research-1#evidence");
  assert.equal(safeReturnPath("/warsachive/teach/?space=class-1&task=task-2", "/warsachive"), "/warsachive/teach/?space=class-1&task=task-2");
  assert.equal(safeReturnPath("/warsachive/workspace/unknown/", "/warsachive"), null);
  assert.equal(safeReturnPath("/warsachive/collections/reading-path/#step-1", "/warsachive", ["/warsachive/collections/reading-path/"]), "/warsachive/collections/reading-path/#step-1");
  assert.equal(safeReturnPath("/warsachive/collections/unknown/#step-1", "/warsachive", ["/warsachive/collections/reading-path/"]), null);
  for (const url of ["//evil.test/", "https://evil.test/", "/warsachive/archive/../../evil/", "/warsachive/archive/record/", "/warsachive/archive/\\evil", "/archive/?q=x"]) assert.equal(safeReturnPath(url, "/warsachive"), null);
});
test("bookmark, note and reading position survive export/import", () => {
  let state = toggleBookmark(emptyShelf(), record.id);
  state = setNote(state, record.id, "개인 메모 <script>는 텍스트입니다");
  state = recordVisit(state, record.id, "background", "2026-10-07T00:00:00Z");
  assert.deepEqual(parseShelf(JSON.stringify(state)), state);
  assert.deepEqual(toggleBookmark(state, record.id).bookmarks, []);
  assert.equal(setNote(state, record.id, "").notes[record.id], undefined);
});
test("corrupt, oversized and unsafe imported data is rejected", () => {
  for (const raw of ["bad JSON", JSON.stringify({ ...emptyShelf(), version: 2 }), JSON.stringify({ ...emptyShelf(), bookmarks: ["../escape"] }), JSON.stringify({ ...emptyShelf(), notes: { "__proto__": "x", "../escape": "x" } }), JSON.stringify({ ...emptyShelf(), notes: { safe: "x".repeat(4001) } })]) assert.throws(() => parseShelf(raw));
  assert.throws(() => parseShelf("x".repeat(600001)));
});
test("metrics require opt-in and collect counters only", () => {
  assert.deepEqual(incrementMetric(emptyShelf(), "record_open").metrics, {});
  const state = incrementMetric({ ...emptyShelf(), metricsConsent: true }, "record_open");
  assert.deepEqual(state.metrics, { record_open: 1 });
  assert.deepEqual(incrementMetric(state, "query=private"), state);
});
