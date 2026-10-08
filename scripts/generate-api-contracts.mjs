import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const str = (maxLength, minLength = 1) => ({ type: "string", minLength, ...(maxLength ? { maxLength } : {}) });
const obj = (properties, required = Object.keys(properties)) => ({ type: "object", required, properties });
const arr = (items, constraints = {}) => ({ type: "array", items, ...constraints });
const choice = (values) => ({ type: "string", enum: values });
const identifier = { ...str(100), pattern: "^[a-zA-Z0-9_-]+$" };
const archiveId = { ...identifier, maxLength: 80 };
const shelfId = { ...archiveId, not: { enum: ["__proto__", "constructor", "prototype"] } };
const version = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const email = { ...str(254), format: "email" };
const credential = { ...str(128), description: "앞뒤 공백을 제거하지 않는 현재 비밀번호입니다." };
const password = { ...str(128, 12), description: "공백을 포함한 입력값을 그대로 사용합니다." };
const stamp = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}(?:T.*Z)?$", description: "유효한 날짜 또는 UTC 시각입니다. 서버가 달력 날짜도 검사합니다." };
const inputDate = { ...str(40), pattern: "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z)?$", description: "유효한 YYYY-MM-DD 또는 UTC Z 시각을 입력하면 서버가 UTC 시각으로 정규화합니다." };
const httpsUrl = { ...str(2000), format: "uri", pattern: "^https://", description: "자격증명이 없는 HTTPS 주소입니다. 기관 주소는 조각 식별자도 허용하지 않습니다." };
const optionalInput = (schema) => ({ anyOf: [schema, { enum: ["", null] }], description: "생략하거나 빈 문자열 또는 null을 보내면 미설정으로 처리합니다." });
const year = { anyOf: [{ type: "null" }, { type: "integer", minimum: -9999, maximum: 9999, not: { const: 0 } }] };
const idList = arr(identifier, { maxItems: 500, description: "중복 식별자는 서버에서 제거합니다." });
const roles = ["member", "editor", "reviewer", "publisher", "admin"];
const scopes = ["content:read", "content:write", "content:review", "content:publish", "finance:read", "finance:manage", "operations:manage", "security:manage", "rights:manage", "analytics:read"];
const rightsPermissions = ["display", "download", "teaching", "commercial", "translation", "adaptation"];
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const payload = { type: "object", description: "안전한 JSON 객체입니다. 직렬화 후 256 KiB 이하, 깊이 20 이하이며 __proto__/constructor/prototype 키는 거절합니다." };
const responseEnvelope = (data = {}) => obj({ data, error: { type: "null" }, meta: ref("ResponseMeta") });
const jsonResponse = (description, schema) => ({ description, content: { "application/json": { schema } } });

/** 소유권·근거·상태 전이는 실제 서버의 런타임 업무 규칙도 함께 검사합니다. */
export function createApiContract() {
  const schemas = {
    ResponseMeta: obj({ requestId: str() }),
    ErrorEnvelope: obj({ data: { type: "null" }, error: obj({ code: str(), message: str() }), meta: ref("ResponseMeta") }),
    Envelope: { oneOf: [responseEnvelope(), ref("ErrorEnvelope")] },
    User: obj({ id: identifier, email, name: str(100), role: choice(roles) }),
    Registration: obj({ email, name: str(100), password }),
    Login: obj({ email, password: credential }),
    PasswordChange: obj({ currentPassword: credential, password }),
    DeleteAccount: obj({ password: credential }),
    ResetRequest: obj({ email }), ResetComplete: obj({ token: str(100), password }),
    ShelfUpdate: obj({ version, payload: obj({ bookmarks: arr(shelfId, { maxItems: 500, description: "80자 이하의 기록 ID이며 예약 이름을 거절하고 중복을 제거합니다." }), notes: { type: "object", maxProperties: 500, propertyNames: shelfId, additionalProperties: str(4000, 0) } }) }),
    WorkspaceCreate: obj({ payload }), VersionedPayload: obj({ version, payload }),
    SpaceCreate: obj({ kind: choice(["study", "research"]), title: str(200), description: str(2000, 0), payload }, ["kind", "title"]),
    SpaceMember: obj({ email, role: choice(["editor", "viewer"]) }),
    SpaceInvitation: obj({ role: choice(["editor", "viewer"]), maxUses: { type: "integer", minimum: 1, maximum: 100 }, expiresAt: { ...inputDate, description: "현재보다 뒤이며 30일 이내인 만료 시각입니다." } }),
    SpaceTransfer: obj({ email }), SpaceJoin: obj({ code: str(100) }),
    SpaceTask: obj({ title: str(200), instructions: str(10000), recordIds: idList, dueAt: optionalInput(inputDate) }, ["title", "instructions", "recordIds"]),
    SubmissionUpdate: obj({ version, payload: { ...obj({ answer: str(20000), recordIds: idList, evidenceNotes: str(10000, 0) }, ["answer", "recordIds"]), description: payload.description } }),
    SubmissionFeedback: obj({ version, feedback: str(10000) }),
    Correction: obj({ recordId: identifier, category: str(100), proposal: str(10000), evidenceUrl: optionalInput({ ...httpsUrl, description: "선택 근거 주소입니다. HTTPS이며 조각 식별자를 허용합니다. 서버가 이 주소를 가져오지는 않습니다." }), contactEmail: optionalInput(email), consent: { const: true, description: "검토에 필요한 제안 보관 동의입니다." } }, ["recordId", "category", "proposal", "consent"]),
    CorrectionModeration: obj({ status: choice(["triaged", "accepted", "rejected", "resolved"]), note: str(2000) }),
    VersionAction: obj({ version }), ReviewAction: obj({ version, note: str(2000) }),
    ApprovalAction: obj({ version, note: str(2000), contentHash: { type: "string", pattern: "^[a-f0-9]{64}$" } }),
    RestoreAction: obj({ version, revision: version }),
    DraftCreate: obj({ record: ref("ArchiveRecord"), privateNotes: str(10000, 0) }, ["record"]),
    DraftUpdate: obj({ version, record: ref("ArchiveRecord"), privateNotes: str(10000, 0) }, ["version", "record"]),
    StaticImport: obj({ version: { const: 1 }, records: arr(ref("ArchiveRecord"), { maxItems: 10000 }) }),
    OrganizationCreate: obj({ title: str(200), website: optionalInput(httpsUrl), status: choice(["prospect", "active", "suspended"]) }, ["title", "status"]),
    RightsCreate: obj({ organizationId: identifier, recordId: identifier, sourceId: identifier, usage: str(2000), status: choice(["requested", "granted", "expired", "withdrawn"]), expiresAt: optionalInput(inputDate), note: str(5000) }, ["organizationId", "recordId", "sourceId", "usage", "status", "note"]),
    ContractCreate: obj({ organizationId: identifier, title: str(200), status: choice(["draft", "review", "active", "ended", "revoked"]), startsAt: optionalInput(inputDate), endsAt: optionalInput(inputDate), note: str(5000) }, ["organizationId", "title", "status", "note"]),
    ContractReadiness: obj({ operationallyReady: { type: "boolean" }, blockers: arr(choice(["contract-inactive", "organization-inactive", "rights-unavailable", "term-not-started", "term-ended"])) }),
    AttachmentMetadata: obj({ attachmentId: identifier, recordId: identifier, sourceId: identifier, contentType: choice(["image/png", "image/jpeg", "application/pdf"]), size: { type: "integer", minimum: 1, maximum: 5242880 }, sha256: { type: "string", pattern: "^[a-f0-9]{64}$" }, rights: str(2000), createdAt: stamp }),
    AttachmentList: obj({ items: arr(ref("AttachmentMetadata"), { maxItems: 500 }) }),
    RoleUpdate: obj({ role: choice(roles) }), Checkout: obj({ productId: identifier, idempotencyKey: identifier }),
    Refund: obj({ amountMinor: { ...version, minimum: 1 }, idempotencyKey: identifier }),
    RefundRequest: obj({ amountMinor: { ...version, minimum: 1 }, idempotencyKey: identifier, reason: str(2000) }),
    RefundReject: obj({ note: str(2000) }),
    AiQuestion: obj({ question: str(2000), recordIds: arr(identifier, { minItems: 1, maxItems: 500, description: "최대 500개 입력을 중복 제거한 뒤 1~8개 공개 기록이어야 합니다." }), mode: choice(["answer", "assist"]) }),
    ArchiveDate: { ...obj({ startYear: year, endYear: year, precision: choice(["day", "year", "range", "approximate", "unknown"]) }), description: "연도 0은 없고 음수는 기원전입니다. unknown은 시작·종료 연도가 모두 null이어야 하며 나머지는 두 연도가 필요합니다. 시작 연도는 종료 연도 이하여야 합니다." },
    ArchiveEntity: obj({ id: archiveId, name: str(), aliases: arr(str()) }),
    ArchiveReview: obj({ status: choice(["needs-review", "source-checked", "approved", "withheld"]), reviewer: str(), reviewedAt: stamp, note: str(), humanReviewed: { type: "boolean" } }),
    ArchiveSource: obj({ id: archiveId, title: str(), creator: str(), institution: str(), url: str(), kind: choice(["primary", "research", "institutional", "testimony", "media"]), language: str(), created: str(), location: str(), rights: str(), checkedAt: stamp, independenceGroup: str() }, ["id", "title", "creator", "institution", "url", "kind", "language", "location", "rights", "checkedAt", "independenceGroup"]),
    ArchiveSection: obj({ id: archiveId, title: str(), paragraphs: arr(str(), { minItems: 1 }), sourceIds: arr(archiveId), interpretation: { type: "boolean" } }, ["id", "title", "paragraphs", "sourceIds"]),
    ArchiveMoment: obj({ date: str(), year, title: str(), text: str(), sourceIds: arr(archiveId) }),
    ArchiveCorrection: obj({ date: stamp, reason: str() }),
    ArchiveRecord: obj({ id: archiveId, title: str(), period: str(), region: str(), summary: str(), kind: choice(["event", "source"]), language: str(), labels: arr(str()), aliases: arr(str()), date: ref("ArchiveDate"), people: arr(ref("ArchiveEntity")), places: arr(ref("ArchiveEntity")), review: ref("ArchiveReview"), sources: arr(ref("ArchiveSource")), sections: arr(ref("ArchiveSection")), chronology: arr(ref("ArchiveMoment")), limitations: arr(str()), relatedIds: arr(archiveId), collectionIds: arr(archiveId), publishedAt: stamp, updatedAt: stamp, readingMinutes: { type: "integer", minimum: 1 }, featuredReason: str(), sensitivity: str(), corrections: arr(ref("ArchiveCorrection")), sourceCount: { type: "integer", minimum: 0 } }, ["id", "title", "period", "region", "summary", "kind", "language", "labels", "aliases", "date", "people", "places", "review", "sources", "sections", "chronology", "limitations", "relatedIds", "collectionIds", "publishedAt", "updatedAt", "readingMinutes", "corrections", "sourceCount"]),
    PublicRecordPage: obj({ version: { const: 1 }, items: arr(ref("ArchiveRecord")), total: { type: "integer", minimum: 0 }, page: { type: "integer", minimum: 1, maximum: 1000000 }, limit: { type: "integer", minimum: 1, maximum: 100 } }),
  };
  schemas.ArchiveRecord.description = "공통 ArchiveRecord 전체 계약입니다. 공개 projection은 이 필드만 복사하며 알 수 없는 비공개 필드를 내보내지 않습니다. CMS 저장은 review를 needs-review로, updatedAt을 서버 시각으로 다시 설정합니다. 관계·실제 달력·근거·공개 여부는 런타임 도메인에서도 검사합니다. 상세: docs/data-contracts.md.";
  addRefinementSchemas(schemas);
  for (const name of ["Organization", "Rights", "Contract"]) {
    const create = schemas[`${name}Create`];
    schemas[`${name}Update`] = obj({ ...create.properties, version }, [...create.required, "version"]);
    const properties = { id: identifier, ...create.properties, version, updatedAt: stamp };
    if (name === "Organization") { properties.ownerId = identifier; properties.website = str(2000, 0); }
    for (const key of ["expiresAt", "startsAt", "endsAt"]) if (key in properties) properties[key] = { anyOf: [{ type: "null" }, stamp] };
    if (name === "Contract") Object.assign(properties, schemas.ContractReadiness.properties);
    if (name === "Rights") Object.assign(properties, { documentId: nullable(identifier), scopeVerified: { type: "boolean" } });
    schemas[`${name}Data`] = obj(properties);
    schemas[`${name}List`] = obj({ items: arr(ref(`${name}Data`), { maxItems: 500 }) });
  }

  const paths = {};
  const commonErrors = {
    400: "입력 형식 또는 업무 조건을 확인할 수 없습니다.", 401: "로그인이 필요합니다.",
    403: "역할·소유권·요청 출처 또는 CSRF 확인값이 유효하지 않습니다.", 404: "자원을 찾을 수 없거나 접근 가능한 자원이 아닙니다.",
    409: "버전·상태·멱등성 키 또는 업무 조건이 충돌합니다.", 413: "요청 또는 저장 자료가 크기 제한을 초과했습니다.",
    415: "JSON 요청의 Content-Type이 올바르지 않습니다.", 429: "요청 한도를 초과했습니다.",
    500: "내부 오류입니다. 문의에 요청 ID를 사용합니다.",
    502: "외부 응답이나 처리 결과를 확인하지 못했습니다. 결과 불명 상태는 같은 멱등성 키로 확인합니다.",
    503: "실제 공급자 또는 발행 환경의 출시 조건이 충족되지 않았습니다.",
  };
  const add = (path, method, summary, options = {}) => {
    const { schema, publicRoute = false, status = 200, data, description, requiredRoles, spaceRole, webhook = false } = options;
    const mutating = method !== "get";
    const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({ name: match[1], in: "path", required: true, schema: identifier }));
    if (mutating && !webhook) parameters.push({ name: "Origin", in: "header", required: true, description: "환경에서 명시적으로 허용한 웹 출처입니다.", schema: str() });
    const responses = { [status]: jsonResponse(status === 201 ? "접수한 결과입니다." : "요청 처리 결과입니다.", responseEnvelope(data ? ref(data) : {})) };
    for (const [code, message] of Object.entries(commonErrors)) responses[code] = jsonResponse(message, ref("ErrorEnvelope"));
    const operation = { summary, ...(description ? { description } : {}), security: publicRoute || webhook ? [] : mutating ? [{ SessionCookie: [], CsrfHeader: [] }] : [{ SessionCookie: [] }], ...(parameters.length ? { parameters } : {}), responses };
    if (schema) operation.requestBody = { required: true, content: { "application/json": { schema: typeof schema === "string" ? ref(schema) : schema } } };
    if (requiredRoles) operation["x-required-roles"] = [...new Set([...requiredRoles, "admin"])];
    if (spaceRole) operation["x-required-space-role"] = spaceRole;
    paths[path] ??= {}; paths[path][method] = operation;
    return operation;
  };
  const staff = ["editor", "reviewer", "publisher"];
  add("/api/v1/capabilities", "get", "실제 환경 설정에 따른 기능 상태 조회", { publicRoute: true });
  add("/api/v1/openapi.json", "get", "API 명세 조회", { publicRoute: true, description: "이 문서 자체를 일반 API 응답의 data 안에 반환합니다. OpenAPI 도구는 data 값을 추출해 사용합니다." });
  const catalogue = add("/api/v1/public/records", "get", "공개 기록 목록 조회", { publicRoute: true, data: "PublicRecordPage", description: "현재 공개 가능한 기록만 SQL 페이지 조회합니다. 공개가 보류된 기록은 제외됩니다." });
  catalogue.parameters = [{ name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }];
  add("/api/v1/public/records/{recordId}", "get", "공개 기록 상세 조회", { publicRoute: true, data: "ArchiveRecord" });
  add("/api/v1/auth/session", "get", "세션 및 CSRF 확인값 조회", { publicRoute: true, description: "세션이 없으면 익명 세션 쿠키를 생성합니다. 회원가입·로그인·비밀번호 재설정·정정 제안도 이 세션과 CSRF 확인값이 필요합니다." });
  add("/api/v1/auth/register", "post", "회원가입 및 세션 교체", { schema: "Registration" });
  add("/api/v1/auth/login", "post", "로그인 및 세션 교체", { schema: "Login" });
  add("/api/v1/auth/logout", "post", "로그아웃 및 익명 세션 교체", { description: "요청 본문은 필요하지 않습니다." });
  add("/api/v1/auth/password/change", "post", "현재 비밀번호 확인 후 변경", { schema: "PasswordChange", description: "다른 로그인 세션을 폐기하고 현재 세션을 교체합니다." });
  add("/api/v1/auth/password/reset/request", "post", "비밀번호 재설정 안내 요청", { schema: "ResetRequest", description: "실제 알림 전달 경로가 필요합니다. 계정 존재 여부와 관계없이 동일한 접수 응답을 반환합니다." });
  add("/api/v1/auth/password/reset/complete", "post", "일회용 코드로 비밀번호 재설정", { schema: "ResetComplete", description: "20분 기한의 실제 발급 코드가 필요합니다. 재설정 후 기존 로그인 세션을 폐기합니다." });
  add("/api/v1/auth/export", "get", "본인 계정 자료 내보내기");
  add("/api/v1/auth/account", "delete", "현재 비밀번호 확인 후 계정 비활성화", { schema: "DeleteAccount", description: "소유한 공동 공간을 먼저 이전해야 합니다. 거래·감사 기록의 실제 보관 정책은 운영 문서를 따릅니다." });
  add("/api/v1/shelf", "get", "본인 책갈피와 메모 조회");
  add("/api/v1/shelf", "put", "버전 확인 후 본인 책갈피와 메모 저장", { schema: "ShelfUpdate" });
  add("/api/v1/workspaces", "get", "본인 연구 공간 목록 조회");
  add("/api/v1/workspaces", "post", "본인 연구 공간 생성", { schema: "WorkspaceCreate" });
  add("/api/v1/workspaces/{workspaceId}", "get", "본인 연구 공간 상세 조회");
  add("/api/v1/workspaces/{workspaceId}", "put", "버전 확인 후 본인 연구 공간 저장", { schema: "VersionedPayload" });
  add("/api/v1/workspaces/{workspaceId}", "delete", "본인 연구 공간 삭제");
  add("/api/v1/spaces", "get", "가입한 공동 공간 목록 조회");
  add("/api/v1/spaces", "post", "공동 연구 또는 학습 공간 생성", { schema: "SpaceCreate" });
  add("/api/v1/spaces/{spaceId}", "get", "공동 공간 자료와 과제 조회", { spaceRole: "member", description: "viewer는 본인 제출물만 볼 수 있고 다른 구성원의 이메일은 응답에서 제외됩니다." });
  add("/api/v1/spaces/{spaceId}", "put", "버전 확인 후 공동 공간 저장", { schema: "VersionedPayload", spaceRole: "owner/editor" });
  add("/api/v1/spaces/join", "post", "유효한 초대 코드로 공동 공간 가입", { schema: "SpaceJoin" });
  for (const [action, summary, schema, spaceRole] of [
    ["members", "공동 공간 구성원 추가 또는 역할 변경", "SpaceMember", "owner"],
    ["invitations", "공동 공간 초대 코드 발급", "SpaceInvitation", "owner"],
    ["transfer", "기존 구성원에게 공동 공간 소유권 이전", "SpaceTransfer", "owner"],
    ["tasks", "공동 공간 과제 생성", "SpaceTask", "owner/editor"],
  ]) add(`/api/v1/spaces/{spaceId}/${action}`, "post", summary, { schema, spaceRole });
  add("/api/v1/spaces/{spaceId}/members/{userId}", "delete", "공동 공간 구성원 제거", { spaceRole: "owner", description: "소유자 자신은 제거할 수 없습니다. 요청 본문은 필요하지 않습니다." });
  add("/api/v1/spaces/{spaceId}/tasks/{taskId}/submissions", "post", "본인 과제 제출 또는 재제출", { schema: "SubmissionUpdate", spaceRole: "member", description: "첫 제출 버전은 0입니다. 재제출은 이전 피드백을 지우고 새 제출 버전을 저장합니다." });
  add("/api/v1/spaces/{spaceId}/submissions/{submissionId}/feedback", "put", "현재 제출 버전을 확인한 피드백 저장", { schema: "SubmissionFeedback", spaceRole: "owner/editor" });
  add("/api/v1/corrections", "get", "권한에 따른 정정 제안 목록 조회", { description: "일반 회원은 본인 제안만, admin/editor/reviewer는 전체 제안과 검토 정보를 조회합니다." });
  add("/api/v1/corrections", "post", "자료 보관 동의 후 정정 제안 접수", { schema: "Correction", status: 201, description: "로그인 없이 익명 세션으로도 접수합니다. 공개 기록이 있어야 하며 변경 요청의 출처와 CSRF 확인값을 검증합니다." });
  add("/api/v1/corrections/{receiptId}", "get", "접수 번호로 공개 처리 상태 조회", { publicRoute: true, description: "제안 본문과 연락처를 공개하지 않습니다." });
  add("/api/v1/corrections/{receiptId}/status", "post", "정정 제안 검토 상태 변경", { schema: "CorrectionModeration", requiredRoles: ["reviewer"], description: "resolved는 accepted에서만 가능합니다. resolved/rejected 완료 상태는 다시 변경할 수 없습니다." });
  add("/api/v1/cms/drafts", "get", "편집 초안 목록 조회", { requiredRoles: staff });
  add("/api/v1/cms/drafts", "post", "비공개 편집 초안 생성", { schema: "DraftCreate", requiredRoles: ["editor"] });
  add("/api/v1/cms/drafts/{draftId}", "get", "편집 초안 및 현재 해시 조회", { requiredRoles: staff });
  add("/api/v1/cms/drafts/{draftId}", "put", "버전 확인 후 초안 수정", { schema: "DraftUpdate", requiredRoles: ["editor"], description: "기록 ID는 유지합니다. 수정은 기존 승인을 무효화합니다." });
  add("/api/v1/cms/drafts/{draftId}/revisions", "get", "초안 버전 이력 조회", { requiredRoles: staff });
  for (const [action, summary, schema, requiredRoles, description] of [
    ["submit", "초안 검수 요청", "VersionAction", ["editor"], "draft/rejected에서 제출합니다."],
    ["source-check", "제출된 초안의 출처 대조 기록", "ReviewAction", ["reviewer"], "출처 대조는 사람의 최종 승인과 구분되며 humanReviewed는 false입니다."],
    ["approve", "작성자와 다른 검수자의 현재 버전 승인", "ApprovalAction", ["reviewer"], "source-checked 상태와 현재 contentHash가 필요합니다. 작성자 자신은 승인할 수 없습니다."],
    ["reject", "초안 반려", "ReviewAction", ["reviewer"], "수정 사유를 기록하고 승인을 무효화합니다."],
    ["withhold", "공개 보류 및 발행 보류 목록 등록", "ReviewAction", ["reviewer"], "API 공개 목록에서 즉시 제외하고 정적 공개물 반영용 작업을 등록합니다."],
    ["publish", "승인된 현재 버전의 발행 작업 요청", "VersionAction", ["publisher"], "실제 승인 해시와 발행 서명 환경이 필요합니다. 응답은 작업 접수이며 정적 사이트 반영 완료를 뜻하지 않습니다."],
    ["restore", "이전 초안 내용을 새 버전으로 복구", "RestoreAction", ["editor"], "과거 승인 이력을 재사용하지 않고 검수 대기 새 버전을 만듭니다."],
  ]) add(`/api/v1/cms/drafts/{draftId}/${action}`, "post", summary, { schema, requiredRoles, description });
  add("/api/v1/cms/dashboard", "get", "편집 운영 집계와 기능 상태 조회", { requiredRoles: staff });
  add("/api/v1/cms/export", "get", "현재 공개 기록 내보내기", { requiredRoles: staff });
  add("/api/v1/cms/import", "post", "관리자의 출처 대조 정적 기록 수입", { schema: "StaticImport", requiredRoles: [], description: "source-checked이며 humanReviewed=false인 공개 조건 충족 기록만 받습니다. 기존 CMS 기록과 공개 보류 목록을 덮어쓰지 않으며 사람 승인 이력을 만들지 않습니다." });
  const upload = add("/api/v1/cms/attachments", "post", "비공개 검수 근거 파일 업로드", { status: 201, data: "AttachmentMetadata", requiredRoles: staff, description: "PNG/JPEG/PDF 원문 최대 5 MiB입니다. 실제 공개 기록 또는 CMS 초안의 출처 연결과 파일 서명을 확인합니다. rights는 검수용 권리 서술이며 사용 허가 승인이나 공개 재사용 허가를 뜻하지 않습니다. 공개 데이터 산출물에서 제외됩니다." });
  upload.parameters.push(...[["recordId", identifier], ["sourceId", identifier], ["rights", str(2000)]].map(([name, schema]) => ({ name, in: "query", required: true, schema })));
  upload.requestBody = { required: true, content: Object.fromEntries(["image/png", "image/jpeg", "application/pdf"].map((mime) => [mime, { schema: { type: "string", format: "binary", description: "서버가 크기와 MIME에 맞는 파일 서명을 검사하는 원문 바이트입니다." } }])) };
  const attachments = add("/api/v1/cms/attachments", "get", "비공개 검수 근거 파일 목록 조회", { data: "AttachmentList", requiredRoles: staff });
  attachments.parameters = [{ name: "recordId", in: "query", required: false, schema: identifier }];
  const download = add("/api/v1/cms/attachments/{attachmentId}", "get", "비공개 검수 근거 파일 다운로드", { requiredRoles: staff, description: "성공 응답은 API envelope 없는 파일 원문입니다. 저장 경로·크기·SHA256 무결성을 검사하며 Content-Disposition: attachment, nosniff, no-store를 적용합니다." });
  download.responses[200] = { description: "등록된 PNG/JPEG/PDF 파일 원문입니다.", headers: { "Content-Disposition": { schema: str(), description: "attachment 형식이며 서버가 생성한 파일명입니다." }, "X-Content-Type-Options": { schema: { const: "nosniff" } }, "Cache-Control": { schema: { const: "no-store" } } }, content: upload.requestBody.content };
  for (const [resource, name, label] of [["organizations", "Organization", "기관"], ["rights", "Rights", "사용권"], ["contracts", "Contract", "계약"]]) {
    const description = resource === "organizations" ? "active 지정은 reviewer/admin 권한이 필요합니다." : resource === "rights" ? "granted/withdrawn 지정은 reviewer/admin 권한이 필요합니다. 승인에는 활성 기관, 유효 기간, 실제 기록의 출처 연결이 필요합니다." : "active/revoked 지정은 reviewer/admin 권한이 필요합니다. 활성화에는 활성 기관과 유효 사용권이 필요하며 응답의 operationallyReady/blockers는 현재 운영 가능 조건입니다.";
    add(`/api/v1/${resource}`, "get", `${label} 관리 목록 조회`, { data: `${name}List`, requiredRoles: ["editor", "reviewer"], description });
    add(`/api/v1/${resource}`, "post", `${label} 관리 자료 생성`, { schema: `${name}Create`, data: `${name}Data`, requiredRoles: ["editor", "reviewer"], description });
    add(`/api/v1/${resource}/{id}`, "put", `버전 확인 후 ${label} 관리 자료 변경`, { schema: `${name}Update`, data: `${name}Data`, requiredRoles: ["editor", "reviewer"], description });
  }
  add("/api/v1/jobs", "get", "발행 및 알림 작업 상태 조회", { requiredRoles: staff });
  add("/api/v1/jobs/{jobId}/retry", "post", "실패한 작업 재시도 요청", { requiredRoles: ["reviewer", "publisher"], description: "failed 상태의 작업만 pending으로 전환합니다. 요청 본문은 필요하지 않습니다." });
  add("/api/v1/admin/users", "get", "관리자의 활성 사용자 목록 조회", { requiredRoles: [] });
  add("/api/v1/admin/users/{userId}/role", "put", "관리자의 사용자 역할 변경", { schema: "RoleUpdate", requiredRoles: [], description: "역할 변경은 기존 세션을 폐기하며 마지막 관리자는 보호합니다." });
  add("/api/v1/payments/products", "get", "서버에 등록된 판매 상품 조회", { publicRoute: true });
  add("/api/v1/payments/orders", "get", "본인 주문 목록 조회");
  add("/api/v1/payments/orders", "post", "서버 상품 기준 결제 주문 생성", { schema: "Checkout", description: "금액과 통화는 서버 상품에서 결정합니다. 결과 불명인 재시도에는 같은 멱등성 키를 사용합니다." });
  add("/api/v1/payments/orders/{orderId}", "get", "본인 주문 및 환불 요청 상태 조회");
  add("/api/v1/payments/orders/{orderId}/refund-requests", "post", "본인 주문의 환불 검토 요청", { schema: "RefundRequest", description: "금액은 통화의 최소 단위 정수입니다. 처리 대기·결과 불명 요청도 잔액에서 예약합니다." });
  add("/api/v1/payments/orders/{orderId}/refunds", "post", "검수 권한으로 공급자 환불 실행", { schema: "Refund", requiredRoles: ["reviewer"], description: "기존 환불 요청 실행은 그 요청의 idempotencyKey를 사용합니다. requestId라는 별도 요청 필드는 없습니다. 공급자 누적 환불액을 검증합니다." });
  add("/api/v1/payments/refund-requests", "get", "검수 권한의 환불 검토 목록 조회", { requiredRoles: ["reviewer"] });
  add("/api/v1/payments/refund-requests/{requestId}/reject", "post", "검토 대기 환불 요청 거절", { schema: "RefundReject", requiredRoles: ["reviewer"] });
  for (const path of ["/api/v1/payments/webhook/stripe", "/api/v1/payments/webhook"]) {
    const operation = add(path, "post", "Stripe 서명으로 결제 및 환불 상태 반영", { webhook: true, schema: { type: "object", description: "Stripe가 전송한 JSON 원문입니다. 서명 검증 전에 재직렬화하거나 수정하면 안 됩니다." }, description: "세션·CSRF 대신 Stripe-Signature, 서명 시각, 공급자 모드와 주문 금액·통화를 검증합니다. 동일 이벤트를 중복 반영하지 않습니다." });
    operation.parameters = [{ name: "Stripe-Signature", in: "header", required: true, schema: str() }];
  }
  add("/api/v1/ai/answer", "post", "공개 기록 근거를 제한한 AI 답변 또는 편집 보조", { schema: "AiQuestion", description: "로그인이 필요합니다. assist는 editor/reviewer/admin 전용이고 공개 answer는 별도 평가·환경 출시 조건이 필요합니다. 비공개 초안·개인 메모를 전송하지 않습니다. 사용자별 요청 한도와 DB에 저장한 서비스 일일 예산을 초과하면 429 AI_DAILY_LIMIT 등으로 거절합니다." });
  add("/health/live", "get", "API 프로세스 생존 상태 조회", { publicRoute: true });
  add("/health/ready", "get", "데이터베이스 연결과 기능 준비 상태 조회", { publicRoute: true });
  add("/health/metrics", "get", "관리자의 API 및 작업 운영 지표 조회", { requiredRoles: [] });
  addRefinementRoutes(paths, add);

  return {
    openapi: "3.1.0",
    info: { title: "전쟁사 아카이브 API", version: "1.0.0", description: "실제 API v1 계약입니다. 파일 다운로드 성공을 제외한 응답은 data/error/meta 형식이며 업무 권한·근거·소유권·버전·공개 조건은 서버 런타임 검증을 함께 적용합니다. JSON 본문은 최대 2 MiB, 비공개 검수 파일 원문은 최대 5 MiB입니다. 변경 요청은 익명 또는 로그인 세션과 허용 Origin 및 CSRF 확인값이 필요하며 서명 웹훅은 별도 검증합니다. 상세: docs/api-contracts.md, docs/data-contracts.md." },
    servers: [{ url: "/", description: "요청하는 API 서버의 기준 주소입니다." }],
    externalDocs: { url: "../docs/api-contracts.md", description: "저장소의 API 권한·운영 계약입니다." },
    paths,
    components: { securitySchemes: {
      SessionCookie: { type: "apiKey", in: "cookie", name: "__Host-war_session", description: "운영 HTTPS 쿠키입니다. 개발 환경은 war_session 이름을 사용합니다. HttpOnly/SameSite=Strict이며 운영에서는 Secure를 적용합니다. 변경 요청 전에 auth/session으로 익명 또는 로그인 세션을 확인합니다." },
      CsrfHeader: { type: "apiKey", in: "header", name: "X-CSRF-Token", description: "현재 세션에 연결된 CSRF 확인값입니다. 로그인·로그아웃 등 세션 교체 후 새 값을 사용합니다." },
    }, schemas },
  };
}

function addRefinementSchemas(schemas) {
  schemas.User.properties.scopes = arr(choice(scopes), { maxItems: scopes.length, uniqueItems: true, description: "생략 시 기존 역할의 권한을 사용합니다. 명시된 빈 배열은 업무 권한이 없으며 명시 배열은 그 범위만 허용합니다." });
  Object.assign(schemas.SpaceTask.properties, { teacherNotes: str(10000, 0), answerKey: str(10000, 0), readingMetadata: arr(obj({ recordId: identifier, minutes: { type: "integer", minimum: 1, maximum: 1440 }, sourceKind: str(100, 0), limitations: str(2000, 0) }), { maxItems: 100 }) });
  schemas.SpaceTaskUpdate = obj({ ...schemas.SpaceTask.properties, version }, [...schemas.SpaceTask.required, "version"]);
  Object.assign(schemas.CorrectionModeration.properties, { revision: version, publicationId: identifier, closureEvidence: str(5000) });
  schemas.CorrectionModeration.allOf = [{ if: { properties: { status: { const: "resolved" } }, required: ["status"] }, then: { required: ["revision", "publicationId", "closureEvidence"] } }];
  schemas.CorrectionModeration.description = "resolved는 accepted 접수에만 허용하며 현재 공개 버전의 deploy/feed 증거와 반영 근거가 필요합니다. rejected/resolved 접수는 재변경하지 않습니다.";
  Object.assign(schemas.RightsCreate.properties, { permissions: arr(choice(rightsPermissions), { maxItems: 10, uniqueItems: true }), territory: str(200, 0), startsAt: optionalInput(inputDate), attribution: str(2000, 0), documentId: optionalInput(identifier) });
  schemas.RightsCreate.description = "세부 허가 범위가 있는 granted 사용권은 같은 기록·출처의 실제 문서, 지역·저작자 표시와 clean 검사 증거가 필요합니다. 생략한 세부 필드는 기존 값을 유지합니다.";
  Object.assign(schemas.ContractCreate.properties, { requiredRightsIds: arr(identifier, { maxItems: 100, uniqueItems: true }), requiredPermissions: arr(choice(rightsPermissions), { maxItems: 6 }), territory: str(200, 0) });
  schemas.ContractReadiness = obj({ operationallyReady: { type: "boolean" }, scopeVerified: { type: "boolean" }, coverageStatus: choice(["legacy-unspecified", "blocked", "verified"]), requiredRightsIds: arr(identifier), requiredPermissions: arr(choice(rightsPermissions)), territory: str(200, 0), blockers: arr(str(200)) });
  Object.assign(schemas.AttachmentMetadata.properties, { scanStatus: choice(["unknown", "clean", "rejected"]), scanner: nullable(str(200)), scannedAt: nullable(stamp), scanObservedAt: nullable(stamp) });
  const scopeList = arr(choice(scopes), { maxItems: scopes.length, uniqueItems: true });
  const taskProperties = { id: identifier, ...schemas.SpaceTask.properties, version: { ...version, minimum: 1 }, createdAt: stamp, updatedAt: stamp, dueAt: nullable(stamp) };
  Object.assign(schemas, {
    Capabilities: { type: "object", properties: Object.fromEntries(["payments", "ai", "aiAssist", "notifications", "passwordReset", "accounts", "cms", "publishing", "publicationEnabled", "corrections", "collaboration", "privateAttachments", "staffMfaRequired", "recentReauthRequired", "knowledgePreflight", "fileScanning", "notificationReceipts", "deploymentEvidence"].map(key => [key, { type: "boolean" }])) },
    AuthSession: obj({ user: nullable(ref("User")), csrfToken: str(300), capabilities: ref("Capabilities") }),
    Reauthentication: obj({ password: credential, totp: { type: "string", pattern: "^[0-9]{6}$" } }, ["password"]),
    MfaEnrollment: obj({ password: credential }), MfaCode: obj({ code: { type: "string", pattern: "^[0-9]{6}$" } }),
    MfaEnrollmentData: obj({ secret: str(100), uri: { ...str(2000), pattern: "^otpauth://totp/", description: "본인 등록 확인을 위한 비밀 키이며 감사 로그나 기기 복구 초안에 저장하지 않습니다." } }),
    SecurityStatus: obj({ enabled: { type: "boolean" }, enrollmentAvailable: { type: "boolean" }, required: { type: "boolean" }, recentAuthenticated: { type: "boolean" }, mfaVerified: { type: "boolean" } }),
    ScopeUpdate: obj({ scopes: scopeList }), ScopeData: obj({ userId: identifier, explicit: { type: "boolean" }, scopes: scopeList }), OffboardingData: obj({ userId: identifier, status: { const: "offboarded" } }),
    StudyTaskData: obj(taskProperties, ["id", "title", "instructions", "recordIds", "version", "createdAt", "updatedAt", "dueAt", "readingMetadata"]),
    StudySubmissionData: obj({ id: identifier, userId: identifier, taskId: identifier, version, submissionVersion: version, payload, feedback: str(10000, 0), taskVersion: version, createdAt: stamp, updatedAt: stamp, feedbackVersion: version, feedbackSubmissionVersion: nullable(version), feedbackAt: nullable(stamp) }),
    StudySpaceData: obj({ id: identifier, ownerId: identifier, kind: choice(["study", "research"]), title: str(200), description: str(2000, 0), role: choice(["owner", "editor", "viewer"]), version, payload, updatedAt: stamp, members: arr(obj({ userId: identifier, name: str(100), role: choice(["owner", "editor", "viewer"]), email }, ["userId", "name", "role"])), tasks: arr(ref("StudyTaskData")), submissions: arr(ref("StudySubmissionData")) }),
    SubmissionHistory: obj({ revisions: arr(obj({ version, taskVersion: version, payload, createdAt: stamp }), { maxItems: 500 }), feedback: arr(obj({ submissionVersion: version, feedbackVersion: version, feedback: str(10000), createdAt: stamp }), { maxItems: 500 }) }),
    PreflightData: obj({ recordId: identifier, revision: version, contentHash: str(64), registryHash: nullable(str(64)), ready: { type: "boolean" }, issues: arr(obj({ code: str(100), message: str(2000) })), impact: obj({ sourceIds: arr(identifier), affectedKnowledgeIds: arr(str(200)) }) }),
    PublicationStage: obj({ id: identifier, revision: version, contentHash: str(64), stage: choice(["export", "build", "deploy", "feed"]), commitSha: nullable(str(100)), artifactHash: str(64), url: nullable(str(2000)), observedAt: stamp, evidenceSource: str(200) }),
    PublicationData: obj({ recordId: identifier, revision: version, contentHash: str(64), stages: arr(ref("PublicationStage"), { maxItems: 500 }) }),
    WorkItemUpdate: obj({ version, assigneeId: optionalInput(identifier), priority: choice(["low", "normal", "high", "urgent"]), dueAt: optionalInput(inputDate), nextAction: str(2000, 0) }, ["version", "priority", "nextAction"]),
    WorkItem: obj({ kind: choice(["draft", "correction", "job", "rights", "order", "refund", "service-request"]), id: identifier, title: str(500, 0), recordId: identifier, status: str(50), version, assigneeId: nullable(identifier), priority: choice(["low", "normal", "high", "urgent"]), dueAt: nullable(stamp), nextAction: str(2000, 0), updatedAt: nullable(stamp) }, ["kind", "id", "status", "version", "assigneeId", "priority", "dueAt", "nextAction", "updatedAt"]),
    WorkboardData: obj({ items: arr(ref("WorkItem"), { maxItems: 1400 }) }), AssigneesData: obj({ items: arr(obj({ id: identifier, name: str(100), role: choice(roles), scopes: scopeList }), { maxItems: 500 }) }),
    FulfillmentUpdate: obj({ version, status: choice(["planned", "in-progress", "delivered", "cancelled"]), deliveryNote: str(5000, 0), deliveryUrl: optionalInput(httpsUrl) }, ["version", "status", "deliveryNote"]),
    FulfillmentData: obj({ orderId: identifier, paymentStatus: str(50), version, status: choice(["planned", "in-progress", "delivered", "confirmed", "cancelled"]), deliveryNote: str(5000, 0), deliveryUrl: nullable(httpsUrl), updatedAt: stamp, confirmedAt: nullable(stamp) }, ["orderId", "paymentStatus", "version", "status", "deliveryNote", "deliveryUrl"]),
    ServiceRequestCreate: obj({ title: str(200), audience: str(2000), deliverables: arr(str(500), { minItems: 1, maxItems: 20 }), rights: str(2000), deadline: optionalInput(inputDate) }, ["title", "audience", "deliverables", "rights"]),
    ServiceRequestUpdate: obj({ version, status: choice(["qualified", "quoted", "contracted", "fulfilling", "delivered", "closed"]), assignedTo: optionalInput(identifier), dueAt: optionalInput(inputDate), quoteNote: str(5000, 0), contractId: optionalInput(identifier), orderId: optionalInput(identifier), evidence: str(5000, 0) }, ["version", "status"]),
    ServiceRequestData: obj({ id: identifier, userId: identifier, version, title: str(200), audience: str(2000), deliverables: arr(str(500)), rights: str(2000), deadline: nullable(stamp), status: choice(["received", "qualified", "quoted", "contracted", "fulfilling", "delivered", "closed"]), assignedTo: nullable(identifier), dueAt: nullable(stamp), quoteNote: str(5000, 0), contractId: nullable(identifier), orderId: nullable(identifier), evidence: str(5000, 0), createdAt: stamp, updatedAt: stamp }),
    ServiceRequestList: obj({ items: arr(ref("ServiceRequestData"), { maxItems: 500 }) }),
    NotificationReceipt: obj({ version: { const: 1 }, eventId: identifier, jobId: identifier, status: choice(["delivered", "failed"]), observedAt: inputDate }),
    FileScanReceipt: obj({ version: { const: 1 }, attachmentId: identifier, sha256: { type: "string", pattern: "^[a-f0-9]{64}$" }, status: choice(["clean", "rejected"]), scanner: str(200), observedAt: inputDate }),
    NotificationReceiptData: obj({ jobId: identifier, status: choice(["delivered", "failed"]), duplicate: { type: "boolean" } }, ["jobId", "status"]), FileScanReceiptData: obj({ attachmentId: identifier, scanStatus: choice(["clean", "rejected"]) }),
    ServiceDefinition: obj({ description: str(5000), audience: str(2000), deliverables: arr(str(500), { minItems: 1, maxItems: 20 }), rightsStatement: str(5000), deliveryDays: { type: "integer", minimum: 1, maximum: 365 }, supportPolicy: str(5000) }),
    PaymentProduct: obj({ id: identifier, title: str(200), amountMinor: { ...version, minimum: 1 }, currency: { type: "string", pattern: "^[A-Z]{3}$" }, serviceDefinition: ref("ServiceDefinition") }, ["id", "title", "amountMinor", "currency"]), ProductList: obj({ enabled: { type: "boolean" }, items: arr(ref("PaymentProduct")) }),
    AiAnswer: obj({ text: str(40000, 0), citations: arr(obj({ recordId: identifier, sectionId: identifier })), answerId: identifier, evaluationId: str(200), model: str(200), usage: obj({ inputTokens: version, outputTokens: version }), citationDetails: arr(obj({ recordId: identifier, sectionId: identifier, recordVersion: stamp, contentHash: str(64), excerpt: str(100000, 0), sourceIds: arr(identifier) })) }, ["text", "citations", "answerId", "citationDetails"]),
    OperationsMetrics: { type: "object", required: ["windowHours", "histogram", "requests", "serverErrors", "errorRate", "latencyMs", "slo"], properties: { windowHours: { const: 24 }, requests: version, serverErrors: version, errorRate: nullable({ type: "number", minimum: 0, maximum: 1 }), histogram: obj({ boundsMs: arr(nullable({ type: "number", minimum: 0 })), counts: arr(version) }), latencyMs: obj({ p50: nullable({ type: "number", minimum: 0 }), p95: nullable({ type: "number", minimum: 0 }), p99: nullable({ type: "number", minimum: 0 }), approximation: { const: "histogram-upper-bound" }, overflowCount: version }), slo: obj({ availabilityTarget: { const: 0.995 }, p95TargetMs: { const: 1000 }, measuredAvailability: nullable({ type: "number", minimum: 0, maximum: 1 }), meetsObservedTarget: nullable({ type: "boolean" }), minimumRequests: { const: 100 }, productionEvidence: { const: false } }) } },
  });
}

function addRefinementRoutes(paths, add) {
  const responseData = (path, method, name) => { paths[path][method].responses[200] = jsonResponse("요청 처리 결과입니다.", responseEnvelope(ref(name))); };
  responseData("/api/v1/auth/session", "get", "AuthSession"); responseData("/api/v1/auth/register", "post", "AuthSession"); responseData("/api/v1/auth/login", "post", "AuthSession"); responseData("/api/v1/capabilities", "get", "Capabilities");
  responseData("/api/v1/spaces/{spaceId}", "get", "StudySpaceData"); responseData("/api/v1/spaces/{spaceId}", "put", "StudySpaceData"); responseData("/api/v1/payments/products", "get", "ProductList"); responseData("/api/v1/ai/answer", "post", "AiAnswer"); responseData("/health/metrics", "get", "OperationsMetrics");
  add("/api/v1/auth/reauth", "post", "현재 비밀번호로 본인 재확인", { schema: "Reauthentication", data: "SecurityStatus", description: "현재 비밀번호와 등록된 경우 TOTP를 확인해 10분의 민감 작업 재인증을 기록합니다. 코드·비밀번호는 서버 로그나 기기 초안에 보관하지 않습니다." });
  add("/api/v1/auth/mfa", "get", "본인 MFA와 최근 인증 상태 조회", { data: "SecurityStatus" });
  add("/api/v1/auth/mfa/enroll", "post", "본인 TOTP 등록 준비", { schema: "MfaEnrollment", data: "MfaEnrollmentData", description: "별도 암호화 키 설정이 필요합니다. 기존 확정 키는 덮어쓰지 않으며 10분 내 확인하지 않은 등록은 만료됩니다." });
  for (const [action, label] of [["confirm", "등록 확인"], ["challenge", "추가 인증"]]) add(`/api/v1/auth/mfa/${action}`, "post", `TOTP 코드로 ${label}`, { schema: "MfaCode", data: "SecurityStatus", description: "6자리 코드의 현재 시간 구간과 재사용 여부를 서버에서 확인합니다." });
  add("/api/v1/admin/users/{userId}/scopes", "get", "계정의 명시적인 업무 범위 조회", { data: "ScopeData" });
  add("/api/v1/admin/users/{userId}/scopes", "put", "계정 업무 범위 변경 및 세션 폐기", { schema: "ScopeUpdate", data: "ScopeData", description: "명시 배열만 허용하며 자기 security:manage 제거를 차단합니다. 기존 세션을 폐기하고 감사·복구 원장을 기록합니다." });
  add("/api/v1/admin/users/{userId}/offboard", "post", "직원 계정의 활동과 세션 차단", { data: "OffboardingData", description: "자기 차단·마지막 관리자 제거를 막고 공동 공간 소유권 이전을 요구합니다. 자료 삭제와 구분되는 운영 계정 차단입니다." });
  add("/api/v1/spaces/{spaceId}/tasks/{taskId}", "put", "현재 과제 버전을 확인해 수업 수정", { schema: "SpaceTaskUpdate", data: "StudySpaceData", spaceRole: "owner/editor" });
  add("/api/v1/spaces/{spaceId}/submissions/{submissionId}/history", "get", "본인 또는 교사의 답안과 피드백 이력 조회", { data: "SubmissionHistory", spaceRole: "member", description: "viewer는 본인의 제출물만 조회합니다. 이전 피드백의 답안 버전을 보존하며 재제출 후 최신 답안에 이전 피드백을 붙이지 않습니다." });
  for (const method of ["post", "put"]) if (paths["/api/v1/spaces/{spaceId}/tasks"]?.[method]) responseData("/api/v1/spaces/{spaceId}/tasks", method, "StudySpaceData");
  add("/api/v1/cms/drafts/{draftId}/preflight", "get", "초안과 지식 레지스트리의 변경 영향 확인", { data: "PreflightData", description: "실제 등록한 지식 레지스트리의 출처 제목·주소·작성자·종류·독립성, 언어판 원본과 연결 자료를 비교합니다. 사람의 최종 검수와 승인 증거는 별도입니다." });
  add("/api/v1/cms/drafts/{draftId}/publication", "get", "현재 초안의 export·빌드·배포·피드 증거 조회", { data: "PublicationData", description: "발행 작업 접수와 실제 산출물·배포 관측을 구분하며 해당 기록의 불변 버전·해시와 증거 출처를 함께 반환합니다." });
  add("/api/v1/operations/assignees", "get", "활성 업무 범위를 가진 담당자 목록 조회", { data: "AssigneesData" });
  add("/api/v1/operations/workboard", "get", "본인의 허용 업무 범위에 따른 운영 큐 조회", { data: "WorkboardData", description: "편집·정정·작업·사용권·주문·환불·서비스 문의를 권한에 따라 분리하며 담당·기한·다음 조치와 실제 자원 상태를 표시합니다." });
  const assignment = add("/api/v1/operations/workboard/{kind}/{resourceId}", "put", "업무 배정 버전과 담당 범위 확인 후 변경", { schema: "WorkItemUpdate", description: "operations:manage와 자원별 추가 범위가 필요합니다. 담당자도 해당 업무 범위를 가져야 하며 같은 업무 배정 버전의 동시 변경을 거절합니다." });
  assignment.parameters.find(item => item.name === "kind").schema = choice(["draft", "correction", "job", "rights", "order", "refund", "service-request"]);
  add("/api/v1/operations/metrics", "get", "24시간의 DB 누적 운영 지표 조회", { data: "OperationsMetrics", description: "재시작 후에도 유지하는 5분 구간 지표에서 오류율과 히스토그램 근사 지연을 집계합니다. 표본이 100건 미만이면 목표 충족 여부는 미평가이며 운영 사용자 증거를 생성하지 않습니다." });
  add("/api/v1/service-requests", "get", "본인 또는 금융 담당자의 기관 서비스 문의 목록 조회", { data: "ServiceRequestList" });
  add("/api/v1/service-requests", "post", "기관 서비스 이용 범위와 납품 요구 접수", { schema: "ServiceRequestCreate", data: "ServiceRequestData" });
  add("/api/v1/service-requests/{requestId}", "get", "본인 또는 금융 담당자의 서비스 문의 상세 조회", { data: "ServiceRequestData" });
  add("/api/v1/service-requests/{requestId}", "put", "문의·견적·계약·이행·고객 확인 단계 변경", { schema: "ServiceRequestUpdate", data: "ServiceRequestData", description: "버전, 실제 견적, 검증된 계약 범위, 같은 고객의 주문과 서버 결제 확인을 대조합니다. 종결에는 주문의 실제 납품·고객 확인과 근거가 필요합니다." });
  add("/api/v1/payments/orders/{orderId}/fulfillment", "get", "본인 주문 또는 금융 담당자의 이행 상태 조회", { data: "FulfillmentData" });
  add("/api/v1/payments/orders/{orderId}/fulfillment", "put", "실제 결제 확인 후 주문 납품 단계 변경", { schema: "FulfillmentUpdate", data: "FulfillmentData", description: "금융 담당자는 planned → in-progress → delivered 순서와 버전을 검증합니다. delivered에는 납품 근거가 필요하며 브라우저 결제 복귀만으로 결제를 확정하지 않습니다." });
  add("/api/v1/payments/orders/{orderId}/fulfillment/confirm", "post", "본인 주문의 실제 납품 수령 확인", { schema: "VersionAction", data: "FulfillmentData", description: "주문 소유자만 delivered 버전을 confirmed로 바꿀 수 있습니다. 금융 담당자가 고객 수령을 대신 확정할 수 없습니다." });
  for (const [path, schema, data, label] of [["/api/v1/notifications/receipts", "NotificationReceipt", "NotificationReceiptData", "실제 알림 수신"], ["/api/v1/operations/file-scan-receipts", "FileScanReceipt", "FileScanReceiptData", "실제 파일 보안 검사"]]) {
    const operation = add(path, "post", `${label} 증거의 서명과 최신성 확인`, { schema, data, webhook: true, description: "세션·CSRF 대신 X-Archive-Signature를 확인합니다. 서버가 파싱한 입력을 JSON.stringify한 바이트의 HMAC-SHA256이며 5분 이내 관측·1분 이내 미래 시각만 허용합니다. 중복·재사용·종료된 상태를 검증합니다." });
    operation.parameters = [{ name: "X-Archive-Signature", in: "header", required: true, schema: { type: "string", pattern: "^[a-f0-9]{64}$" } }];
  }
  const scoped = (path, methods, needed, alternatives = false) => { for (const method of methods) { const operation = paths[path]?.[method]; if (!operation) continue; operation[alternatives ? "x-required-any-scope" : "x-required-scopes"] = needed; if (operation["x-required-roles"]) { operation["x-legacy-required-roles"] = operation["x-required-roles"]; delete operation["x-required-roles"]; } } };
  for (const path of Object.keys(paths)) {
    if (path.startsWith("/api/v1/cms/")) scoped(path, Object.keys(paths[path]), ["content:read"]);
    if (path.startsWith("/api/v1/admin/")) scoped(path, Object.keys(paths[path]), ["security:manage"]);
  }
  for (const [path, method, permission] of [["/api/v1/cms/drafts", "post", "content:write"], ["/api/v1/cms/drafts/{draftId}", "put", "content:write"], ...["submit", "restore"].map(action => [`/api/v1/cms/drafts/{draftId}/${action}`, "post", "content:write"]), ...["source-check", "approve", "reject", "withhold"].map(action => [`/api/v1/cms/drafts/{draftId}/${action}`, "post", "content:review"]), ["/api/v1/cms/drafts/{draftId}/publish", "post", "content:publish"]]) scoped(path, [method], ["content:read", permission]);
  paths["/api/v1/cms/import"].post["x-required-roles"] = ["admin"];
  paths["/api/v1/admin/users/{userId}/role"].put["x-required-roles"] = ["admin"];
  for (const resource of ["rights", "contracts", "organizations"]) for (const path of Object.keys(paths).filter(path => path === `/api/v1/${resource}` || path.startsWith(`/api/v1/${resource}/`))) scoped(path, Object.keys(paths[path]), ["rights:manage"]);
  for (const [path, methods, permission] of [["/api/v1/jobs/{jobId}/retry", ["post"], "operations:manage"], ["/api/v1/operations/assignees", ["get"], "operations:manage"], ["/api/v1/operations/workboard/{kind}/{resourceId}", ["put"], "operations:manage"], ["/api/v1/operations/metrics", ["get"], "analytics:read"], ["/health/metrics", ["get"], "analytics:read"], ["/api/v1/payments/refund-requests", ["get"], "finance:read"], ["/api/v1/payments/refund-requests/{requestId}/reject", ["post"], "finance:manage"], ["/api/v1/payments/orders/{orderId}/refunds", ["post"], "finance:manage"], ["/api/v1/payments/orders/{orderId}/fulfillment", ["put"], "finance:manage"], ["/api/v1/service-requests/{requestId}", ["put"], "finance:manage"], ["/api/v1/corrections/{receiptId}/status", ["post"], "content:review"]]) scoped(path, methods, [permission]);
  scoped("/api/v1/jobs", ["get"], ["content:read", "operations:manage"], true);
  scoped("/api/v1/operations/workboard", ["get"], scopes, true);
  assignment["x-kind-additional-scopes"] = { draft: ["content:read"], correction: ["content:read"], rights: ["rights:manage"], order: ["finance:manage"], refund: ["finance:manage"], "service-request": ["finance:manage"] };
  paths["/api/v1/ai/answer"].post["x-assist-any-scope"] = ["content:write", "content:review"];
  paths["/api/v1/ai/answer"].post.description = "로그인이 필요합니다. assist는 content:write 또는 content:review 범위와 설정된 직원 추가 인증이 필요하고 공개 answer는 실제 평가·공개 기록 내용 해시의 일치가 필요합니다. 개인 메모·비공개 초안은 전송하지 않습니다. 근거 부족은 인용 없는 응답이며 선택한 공개 기록의 정확한 문단만 citationDetails로 반환합니다.";
  paths["/api/v1/corrections"].get.description = "일반 회원은 본인 제안만, content:read 범위의 담당자는 전체 제안과 검토 정보를 조회하며 설정된 직원 추가 인증을 통과해야 합니다. 공개 접수번호 조회에는 개인정보·제안 원문이 포함되지 않습니다.";
  paths["/api/v1/corrections"].get["x-staff-mfa-when-configured"] = "content:read 담당자 조회";
  paths["/api/v1/corrections/{receiptId}/status"].post["x-staff-mfa-when-configured"] = true;
  for (const path of ["/api/v1/service-requests", "/api/v1/service-requests/{requestId}"]) { paths[path].get["x-staff-mfa-when-configured"] = "finance:read 담당자 조회"; paths[path].get.description += " finance:read 담당자는 설정된 직원 추가 인증이 필요하며 일반 회원의 본인 요청 조회에는 이 추가 인증을 요구하지 않습니다."; }
  paths["/api/v1/spaces/{spaceId}"].get.description += " study 공간의 viewer 응답에서는 교사 메모·답안이 모든 payload 깊이에서 제외되며 과제의 비공개 필드도 반환되지 않습니다.";
  for (const path of ["/api/v1/admin/users/{userId}/role", "/api/v1/admin/users/{userId}/scopes", "/api/v1/admin/users/{userId}/offboard", "/api/v1/rights", "/api/v1/rights/{id}", "/api/v1/contracts", "/api/v1/contracts/{id}", "/api/v1/cms/import", "/api/v1/cms/drafts/{draftId}/approve", "/api/v1/cms/drafts/{draftId}/publish", "/api/v1/cms/drafts/{draftId}/withhold", "/api/v1/jobs/{jobId}/retry", "/api/v1/payments/orders/{orderId}/refunds", "/api/v1/payments/orders/{orderId}/fulfillment", "/api/v1/service-requests/{requestId}"]) for (const [method, operation] of Object.entries(paths[path] ?? {})) if (method !== "get") operation["x-recent-reauth-when-configured"] = true;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const document = createApiContract();
  await writeFile(new URL("../api/openapi.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`한국어 API 명세 생성: ${Object.keys(document.paths).length}개 경로`);
}
