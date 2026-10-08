import test from "node:test";
import assert from "node:assert/strict";
import { decodeDetailedAiResponse } from "../lib/assist-domain.ts";
test("AI display binds each citation to the actual server passage/version and rejects unmatched details", () => {
  const value = { text: "서버에서 연결한 답변", citations: [{ recordId: "imjin-war", sectionId: "background" }], citationDetails: [{ recordId: "imjin-war", sectionId: "background", recordVersion: "2026-10-07", contentHash: "a".repeat(64), excerpt: "검증된 공개 해설 문단", sourceIds: ["nikh-imjin"] }] };
  assert.equal(decodeDetailedAiResponse(value).citationDetails[0].excerpt, value.citationDetails[0].excerpt); assert.throws(() => decodeDetailedAiResponse({ ...value, citationDetails: [] })); assert.throws(() => decodeDetailedAiResponse({ ...value, citationDetails: [{ ...value.citationDetails[0], sectionId: "different" }] })); assert.throws(() => decodeDetailedAiResponse({ ...value, citationDetails: [{ ...value.citationDetails[0], contentHash: "invalid" }] })); assert.deepEqual(decodeDetailedAiResponse({ text: "근거 부족", citations: [], citationDetails: [] }).citationDetails, []);
});
