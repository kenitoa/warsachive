import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { createApiContract } from "../../scripts/generate-api-contracts.mjs";
import { createApp } from "../src/http/app.ts";
import { Store } from "../src/infrastructure/database.ts";
import { readConfig } from "../src/config.ts";

const contract = createApiContract();

function assertSchema(value, schema, label = "data") {
  if (schema.$ref) return assertSchema(value, contract.components.schemas[schema.$ref.split("/").at(-1)], label);
  if (schema.anyOf) { assert.ok(schema.anyOf.some(option => { try { assertSchema(value, option, label); return true; } catch { return false; } }), `${label} must match a declared alternative`); return; }
  if (schema.enum) assert.ok(schema.enum.includes(value), `${label} enum`);
  if (Object.hasOwn(schema, "const")) assert.equal(value, schema.const, `${label} const`);
  if (schema.type === "null") assert.equal(value, null, label);
  if (schema.type === "boolean") assert.equal(typeof value, "boolean", label);
  if (schema.type === "integer") { assert.ok(Number.isSafeInteger(value), label); if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, label); }
  if (schema.type === "string") { assert.equal(typeof value, "string", label); if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, label); if (schema.maxLength !== undefined) assert.ok(value.length <= schema.maxLength, label); if (schema.pattern) assert.match(value, new RegExp(schema.pattern), label); }
  if (schema.type === "array") { assert.ok(Array.isArray(value), label); if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems, label); value.forEach((item, index) => assertSchema(item, schema.items, `${label}[${index}]`)); }
  if (schema.type === "object") { assert.ok(value && typeof value === "object" && !Array.isArray(value), label); for (const key of schema.required ?? []) assert.ok(Object.hasOwn(value, key), `${label}.${key} required`); for (const [key, property] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(value, key)) assertSchema(value[key], property, `${label}.${key}`); }
}

test("generated API contract retains Korean descriptions and resolves every component reference", async () => {
  const published = JSON.parse(await readFile(new URL("../openapi.json", import.meta.url), "utf8"));
  assert.deepEqual(published, contract, "regenerate the contract when source changes");
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.$ref) {
      assert.ok(value.$ref.startsWith("#/components/schemas/"));
      assert.ok(contract.components.schemas[value.$ref.split("/").at(-1)], value.$ref);
    }
    for (const [key, entry] of Object.entries(value)) {
      if ((key === "summary" || key === "description") && typeof entry === "string") {
        assert.match(entry, /[가-힣]/, "all reader-facing descriptions use Korean");
        assert.doesNotMatch(entry, /[\u3040-\u30ff]/);
      }
      walk(entry);
    }
  };
  walk(contract);
  for (const [path, methods] of Object.entries(contract.paths)) {
    for (const operation of Object.values(methods)) {
      assert.equal(typeof operation.summary, "string");
      const parameters = operation.parameters || [];
      for (const match of path.matchAll(/\{([^}]+)\}/g)) assert.ok(parameters.some((item) => item.name === match[1] && item.in === "path" && item.required));
    }
  }
});

test("contract distinguishes optimistic writes, anonymous CSRF, signed webhooks and private binary evidence", () => {
  const schemas = contract.components.schemas;
  assert.deepEqual(schemas.WorkspaceCreate.required, ["payload"]);
  const shelf = schemas.ShelfUpdate.properties.payload.properties;
  assert.equal(shelf.notes.additionalProperties.maxLength, 4000);
  for (const idSchema of [shelf.bookmarks.items, shelf.notes.propertyNames]) {
    assert.equal(idSchema.maxLength, 80);
    assert.deepEqual(idSchema.not.enum, ["__proto__", "constructor", "prototype"]);
  }
  for (const name of ["ShelfUpdate", "VersionedPayload", "SubmissionUpdate", "SubmissionFeedback", "DraftUpdate", "RightsUpdate", "ContractUpdate"]) assert.ok(schemas[name].required.includes("version"), name);
  assert.deepEqual(schemas.ApprovalAction.required, ["version", "note", "contentHash"]);
  assert.deepEqual(schemas.RestoreAction.required, ["version", "revision"]);
  assert.equal(schemas.Correction.properties.category.maxLength, 100);
  assert.equal(schemas.Correction.properties.proposal.maxLength, 10000);
  assert.ok(contract.paths["/api/v1/corrections"].post.responses[201]);
  assert.deepEqual(contract.paths["/api/v1/corrections"].post.security, [{ SessionCookie: [], CsrfHeader: [] }]);
  for (const path of ["/api/v1/payments/webhook", "/api/v1/payments/webhook/stripe"]) {
    assert.deepEqual(contract.paths[path].post.security, []);
    assert.ok(contract.paths[path].post.parameters.some((item) => item.name === "Stripe-Signature" && item.required));
  }
  for (const path of ["/api/v1/auth/logout", "/api/v1/jobs/{jobId}/retry"]) assert.equal(contract.paths[path].post.requestBody, undefined);
  assert.equal(schemas.Refund.properties.requestId, undefined);
  const upload = contract.paths["/api/v1/cms/attachments"].post;
  assert.deepEqual(Object.keys(upload.requestBody.content).sort(), ["application/pdf", "image/jpeg", "image/png"]);
  assert.ok(upload.parameters.some((item) => item.name === "rights" && item.in === "query" && item.required));
  const binary = contract.paths["/api/v1/cms/attachments/{attachmentId}"].get.responses[200];
  assert.equal(binary.content["application/pdf"].schema.format, "binary");
  assert.equal(binary.content["application/json"], undefined);
  assert.equal(binary.headers["X-Content-Type-Options"].schema.const, "nosniff");
});

test("refinement contract describes scope gates, private teaching versions and actual signed evidence", () => {
  const schemas = contract.components.schemas;
  assert.deepEqual(schemas.ScopeUpdate.properties.scopes.items.enum, ["content:read", "content:write", "content:review", "content:publish", "finance:read", "finance:manage", "operations:manage", "security:manage", "rights:manage", "analytics:read"]);
  assert.equal(schemas.ScopeUpdate.properties.scopes.uniqueItems, true);
  assert.equal(schemas.User.required.includes("scopes"), false);
  assert.ok(schemas.SpaceTaskUpdate.required.includes("version"));
  assert.equal(schemas.SpaceTask.properties.teacherNotes.maxLength, 10000);
  assert.equal(schemas.SpaceTask.properties.answerKey.maxLength, 10000);
  assert.equal(schemas.StudyTaskData.required.includes("teacherNotes"), false);
  assert.equal(schemas.StudyTaskData.required.includes("answerKey"), false);
  for (const field of ["submissionVersion", "taskVersion", "feedbackVersion", "feedbackSubmissionVersion"]) assert.ok(schemas.StudySubmissionData.required.includes(field), field);
  assert.ok(schemas.SubmissionHistory.properties.feedback.items.required.includes("submissionVersion"));
  assert.deepEqual(schemas.AttachmentMetadata.properties.scanStatus.enum, ["unknown", "clean", "rejected"]);
  assert.ok(schemas.PaymentProduct.properties.serviceDefinition);
  assert.ok(schemas.AiAnswer.properties.citationDetails.items.required.includes("contentHash"));
  assert.deepEqual(contract.paths["/api/v1/cms/drafts/{draftId}/publish"].post["x-required-scopes"], ["content:read", "content:publish"]);
  assert.equal(contract.paths["/api/v1/cms/drafts/{draftId}/publish"].post["x-recent-reauth-when-configured"], true);
  assert.ok(contract.paths["/api/v1/corrections"].get["x-staff-mfa-when-configured"]);
  assert.ok(contract.paths["/api/v1/service-requests/{requestId}"].get["x-staff-mfa-when-configured"]);
  assert.deepEqual(contract.paths["/api/v1/operations/workboard/{kind}/{resourceId}"].put["x-kind-additional-scopes"].refund, ["finance:manage"]);
  for (const path of ["/api/v1/notifications/receipts", "/api/v1/operations/file-scan-receipts"]) {
    const operation = contract.paths[path].post;
    assert.deepEqual(operation.security, []);
    assert.ok(operation.parameters.some(item => item.name === "X-Archive-Signature" && item.required));
    assert.equal(operation.parameters.some(item => item.name === "Origin"), false);
  }
  for (const path of ["/api/v1/auth/reauth", "/api/v1/auth/mfa", "/api/v1/admin/users/{userId}/scopes", "/api/v1/admin/users/{userId}/offboard", "/api/v1/spaces/{spaceId}/tasks/{taskId}", "/api/v1/spaces/{spaceId}/submissions/{submissionId}/history", "/api/v1/cms/drafts/{draftId}/preflight", "/api/v1/cms/drafts/{draftId}/publication", "/api/v1/operations/assignees", "/api/v1/operations/metrics", "/api/v1/service-requests", "/api/v1/payments/orders/{orderId}/fulfillment", "/api/v1/payments/orders/{orderId}/fulfillment/confirm"]) assert.ok(contract.paths[path], path);
});

test("live contract and catalogue use the declared envelope and keep protected operations inaccessible", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "war-openapi-tests-"));
  const config = readConfig({ ARCHIVE_API_DB_PATH: resolve(directory, "archive.sqlite"), ARCHIVE_API_EXPORT_DIR: resolve(directory, "exports"), ARCHIVE_API_PRIVATE_STORAGE_DIR: resolve(directory, "private"), ARCHIVE_API_SESSION_SECRET: "contract-test-secret-".repeat(3), ARCHIVE_API_ALLOWED_ORIGINS: "http://localhost:3000" });
  const store = new Store(config.dbPath);
  const app = createApp({ store, config });
  const server = createServer((request, response) => { void app.handler(request, response); });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(async () => {
    server.closeAllConnections(); await new Promise((done) => server.close(done)); store.close();
    const child = relative(tmpdir(), directory);
    assert.ok(child && !child.startsWith("..") && !isAbsolute(child) && directory.startsWith(resolve(tmpdir(), "war-openapi-tests-")));
    await rm(directory, { recursive: true });
  });
  const address = server.address(); assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${base}/api/v1/openapi.json`);
  assert.equal(response.status, 200);
  const envelope = await response.json(); assert.deepEqual(envelope.data, contract); assert.equal(envelope.error, null); assert.ok(envelope.meta.requestId);
  const catalogue = await fetch(`${base}/api/v1/public/records?page=1&limit=2`);
  assert.deepEqual((await catalogue.json()).data, { version: 1, items: [], total: 0, page: 1, limit: 2 });
  assert.equal((await fetch(`${base}/api/v1/public/records?page=1000001&limit=2`)).status, 400);
  for (const path of ["/api/v1/jobs", "/api/v1/cms/drafts", "/api/v1/cms/attachments", "/api/v1/payments/orders/missing-order", "/health/metrics", "/api/v1/auth/mfa", "/api/v1/operations/assignees", "/api/v1/operations/workboard", "/api/v1/operations/metrics", "/api/v1/service-requests", "/api/v1/admin/users/missing/scopes", "/api/v1/cms/drafts/missing/preflight", "/api/v1/cms/drafts/missing/publication"]) {
    const denied = await fetch(`${base}${path}`); assert.equal(denied.status, 401, path);
    assert.equal((await denied.json()).error.code, "AUTH_REQUIRED");
  }
  assert.equal((await fetch(`${base}/api/v1/corrections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 403);
  const session = app.auth.createSession(null);
  const account = await app.auth.register({ email: "contract-member@example.org", name: "명세 검증", password: "tested-contract-password-123" }, session.token, "contract-test");
  assert.ok(account.user);
  const shelfWrite = (payload) => fetch(`${base}/api/v1/shelf`, { method: "PUT", headers: { Origin: "http://localhost:3000", Cookie: `war_session=${account.token}`, "X-CSRF-Token": account.csrfToken, "Content-Type": "application/json" }, body: JSON.stringify({ version: 0, payload }) });
  for (const payload of [
    { bookmarks: ["a".repeat(81)], notes: {} },
    { bookmarks: ["constructor"], notes: {} },
    { bookmarks: ["prototype"], notes: {} },
    { bookmarks: ["__proto__"], notes: {} },
    { bookmarks: [], notes: { "imjin-war": "a".repeat(4001) } },
    { bookmarks: [], notes: { ["a".repeat(81)]: "검증 메모" } },
  ]) {
    const rejected = await shelfWrite(payload); assert.equal(rejected.status, 400); assert.equal((await rejected.json()).error.code, "INVALID_INPUT");
  }
  const saved = await shelfWrite({ bookmarks: ["a".repeat(80)], notes: { "imjin-war": "a".repeat(4000) } });
  assert.equal(saved.status, 200); const shelf = (await saved.json()).data; assert.equal(shelf.version, 1); assert.equal(shelf.payload.notes["imjin-war"].length, 4000);
  const call = async (identity, path, method = "GET", input) => {
    const headers = { Cookie: `war_session=${identity.token}` };
    if (method !== "GET") Object.assign(headers, { Origin: "http://localhost:3000", "X-CSRF-Token": identity.csrfToken, "Content-Type": "application/json" });
    const response = await fetch(`${base}${path}`, { method, headers, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    const envelope = await response.json(); assert.ok(envelope.meta.requestId);
    return { status: response.status, ...envelope };
  };
  assert.equal((await call(account, "/api/v1/operations/workboard")).status, 403);
  assert.equal((await call(account, "/api/v1/admin/users/missing/scopes")).status, 403);
  const mfa = await call(account, "/api/v1/auth/mfa");
  assert.equal(mfa.status, 200); assert.equal(mfa.data.enabled, false); assert.equal(mfa.data.required, false);
  const reauth = await call(account, "/api/v1/auth/reauth", "POST", { password: "tested-contract-password-123" });
  assert.equal(reauth.status, 200); assert.equal(reauth.data.recentAuthenticated, true);
  for (const path of ["/api/v1/notifications/receipts", "/api/v1/operations/file-scan-receipts"]) {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 503); assert.equal((await response.json()).error.code, "RECEIPT_DISABLED");
  }
  const learnerSession = app.auth.createSession(null);
  const learner = await app.auth.register({ email: "contract-learner@example.org", name: "학습자", password: "tested-learner-password-123" }, learnerSession.token, "contract-test");
  const created = await call(account, "/api/v1/spaces", "POST", { kind: "study", title: "실제 명세 수업", payload: { teacherNotes: "교사 개인 내용", nested: { answerKey: "중첩 비공개 답안", question: "학생 질문" } } });
  assert.equal(created.status, 200); const space = created.data.id;
  assert.equal((await call(account, `/api/v1/spaces/${space}/members`, "POST", { email: "contract-learner@example.org", role: "viewer" })).status, 200);
  const taskInput = { title: "작성 목적 비교", instructions: "자료 범위를 구분해 보세요.", recordIds: ["imjin-war"], teacherNotes: "교사 채점 메모", answerKey: "비공개 모범 답안", readingMetadata: [{ recordId: "imjin-war", minutes: 10, sourceKind: "사료 안내", limitations: "연결 자료 제공 범위 확인" }] };
  const taskCreate = await call(account, `/api/v1/spaces/${space}/tasks`, "POST", taskInput);
  assert.equal(taskCreate.status, 200); const task = taskCreate.data.tasks[0];
  assert.equal(task.version, 1); assert.equal(task.teacherNotes, taskInput.teacherNotes);
  const learnerView = await call(learner, `/api/v1/spaces/${space}`);
  assert.equal(learnerView.status, 200);
  for (const field of ["teacherNotes", "answerKey"]) assert.equal(Object.hasOwn(learnerView.data.tasks[0], field), false);
  assert.equal(learnerView.data.payload.teacherNotes, undefined); assert.equal(learnerView.data.payload.nested.answerKey, undefined);
  assert.equal(learnerView.data.payload.nested.question, "학생 질문");
  assert.equal(learnerView.data.members.find(item => item.userId === account.user.id).email, undefined);
  const changed = await call(account, `/api/v1/spaces/${space}/tasks/${task.id}`, "PUT", { ...taskInput, version: 1, instructions: "보완된 과제" });
  assert.equal(changed.status, 200); assert.equal(changed.data.tasks[0].version, 2);
  const staleTask = await call(account, `/api/v1/spaces/${space}/tasks/${task.id}`, "PUT", { ...taskInput, version: 1 });
  assert.equal(staleTask.status, 409); assert.equal(staleTask.error.code, "VERSION_CONFLICT");
  const submitted = await call(learner, `/api/v1/spaces/${space}/tasks/${task.id}/submissions`, "POST", { version: 0, payload: { answer: "첫 답안", recordIds: ["imjin-war"] } });
  assert.equal(submitted.status, 200); const submission = submitted.data.submissions[0];
  assert.equal(submission.taskVersion, 2); assert.equal(submission.submissionVersion, 1);
  const feedback = await call(account, `/api/v1/spaces/${space}/submissions/${submission.id}/feedback`, "PUT", { version: 1, feedback: "첫 답안에 대한 피드백" });
  assert.equal(feedback.status, 200); assert.equal(feedback.data.submissions[0].feedbackSubmissionVersion, 1);
  const resubmitted = await call(learner, `/api/v1/spaces/${space}/tasks/${task.id}/submissions`, "POST", { version: 1, payload: { answer: "두 번째 답안", recordIds: ["imjin-war"] } });
  assert.equal(resubmitted.status, 200); assert.equal(resubmitted.data.submissions[0].version, 2); assert.equal(resubmitted.data.submissions[0].feedback, "");
  const staleFeedback = await call(account, `/api/v1/spaces/${space}/submissions/${submission.id}/feedback`, "PUT", { version: 1, feedback: "오래된 답안용 피드백" });
  assert.equal(staleFeedback.status, 409);
  const history = await call(learner, `/api/v1/spaces/${space}/submissions/${submission.id}/history`);
  assert.equal(history.status, 200); assert.deepEqual(history.data.revisions.map(item => item.version), [2, 1]);
  assert.equal(history.data.feedback[0].submissionVersion, 1); assert.equal(history.data.feedback[0].feedback, "첫 답안에 대한 피드백");
  const request = await call(learner, "/api/v1/service-requests", "POST", { title: "학교 자료 문의", audience: "중등 수업", deliverables: ["자료 비교 수업"], rights: "수업 목적" });
  assert.equal(request.status, 200); assert.equal(request.data.status, "received");
  assert.equal((await call(learner, `/api/v1/service-requests/${request.data.id}`)).status, 200);
  assert.equal((await call(account, `/api/v1/service-requests/${request.data.id}`)).status, 404);
  for (const result of [created, taskCreate, learnerView, changed, submitted, feedback, resubmitted]) assertSchema(result.data, contract.components.schemas.StudySpaceData);
  assertSchema(history.data, contract.components.schemas.SubmissionHistory);
  assertSchema(request.data, contract.components.schemas.ServiceRequestData);
  assertSchema(mfa.data, contract.components.schemas.SecurityStatus);
  assertSchema(reauth.data, contract.components.schemas.SecurityStatus);
});
