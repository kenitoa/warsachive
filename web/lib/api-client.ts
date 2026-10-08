export const apiScopes = ["content:read", "content:write", "content:review", "content:publish", "finance:read", "finance:manage", "operations:manage", "security:manage", "rights:manage", "analytics:read"] as const;
export type ApiScope = typeof apiScopes[number];
export type ApiUser = { id: string; email: string; name: string; role: string; scopes?: ApiScope[] };
export type ApiCapability = boolean | string | Record<string, boolean | string>;
export type ApiSession = { user: ApiUser | null; csrfToken: string; capabilities: Record<string, ApiCapability> };
const apiConfigured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
export const apiAvailable = Boolean(apiConfigured);
let csrfToken = "";
export class ApiError extends Error {
  code: string; status: number; requestId: string;
  constructor(code: string, status: number, requestId = "") {
    const messages: Record<string, string> = { MFA_REQUIRED: "운영 작업의 추가 인증을 완료하세요.", REAUTH_REQUIRED: "이 작업 전에 최근 본인 확인이 필요합니다.", AI_EVALUATION_STALE: "자료가 변경되어 공개 AI 재평가가 필요합니다. 원자료를 직접 확인하세요.", RIGHTS_EVIDENCE_REQUIRED: "실제 권리 문서·검수 근거와 허용 범위를 확인하세요.", AUTH_REQUIRED: "로그인 후 사용할 수 있습니다.", UNAUTHORIZED: "로그인을 다시 확인하세요.", FORBIDDEN: "이 작업에 필요한 권한이 없습니다.", VERSION_CONFLICT: "다른 버전이 저장되어 있습니다. 최신 내용을 확인하고 병합하세요.", CONFLICT: "현재 상태와 요청이 충돌합니다. 최신 내용을 확인하세요.", INVALID_INPUT: "입력 내용을 확인하세요.", VALIDATION_ERROR: "입력 내용을 확인하세요.", RATE_LIMITED: "요청이 많습니다. 잠시 뒤 다시 시도하세요.", NOT_FOUND: "요청한 항목을 찾을 수 없습니다.", RESOURCE_NOT_FOUND: "요청한 항목을 찾을 수 없습니다.", SERVICE_UNAVAILABLE: "서비스 연결을 사용할 수 없습니다.", CSRF_INVALID: "세션 확인이 만료되었습니다. 다시 로그인하세요.", API_NOT_CONFIGURED: "계정 서비스가 연결되지 않았습니다. 기기 내 도구는 계속 사용할 수 있습니다.", INVALID_RESPONSE: "서비스 응답을 확인할 수 없습니다. 저장 완료로 처리하지 않았습니다.", NETWORK_ERROR: "서비스에 연결하지 못했습니다. 입력 내용은 현재 화면에 남아 있습니다.", TIMEOUT: "서비스 응답 시간이 초과되었습니다. 저장 상태를 확인한 뒤 다시 시도하세요.", AI_DISABLED: "공개 AI 답변이 활성화되지 않았습니다. 자료를 직접 읽거나 비교하세요.", AI_DAILY_LIMIT: "서비스의 현재 일일 AI 요청 한도에 도달했습니다. 자료를 직접 읽거나 비교하세요.", OWNERSHIP_TRANSFER_REQUIRED: "공동 공간의 기존 참여자에게 소유권을 먼저 이전한 뒤 계정 삭제를 요청하세요.", AI_CITATION_INVALID: "답변의 근거 문단을 확인하지 못했습니다. 답변을 제공하지 않았습니다.", PAYMENT_DISABLED: "실제 결제 서비스가 활성화되지 않았습니다.", PAYMENT_OUTCOME_UNKNOWN: "결제 공급자 결과를 확인하지 못했습니다. 같은 주문으로 상태를 다시 확인하세요.", REFUND_OUTCOME_UNKNOWN: "환불 공급자 결과를 확인하지 못했습니다. 같은 접수번호로 상태를 다시 확인하세요.", REFUND_LIMIT: "검토 중인 요청을 포함한 환불 가능 잔액을 확인하세요.", IDEMPOTENCY_CONFLICT: "같은 요청의 상품이나 금액이 변경되었습니다. 기존 요청 상태를 먼저 확인하세요.", INVALID_TRANSITION: "현재 처리 상태에서 실행할 수 없습니다. 최신 상태를 확인하세요.", APPROVAL_REQUIRED: "현재 버전에 대한 실제 사람 승인이 필요합니다.", APPROVAL_STALE: "승인 대상 버전이 변경되었습니다. 새 해시를 다시 확인하세요.", INDEPENDENT_REVIEW_REQUIRED: "작성자와 다른 검수자가 현재 버전을 확인해야 합니다.", PAYLOAD_TOO_LARGE: "자료가 허용 크기를 초과합니다. 나누어 저장하세요." };
    super(messages[code] ?? "요청을 완료할 수 없습니다. 입력 내용과 서비스 상태를 확인하세요."); this.name = "ApiError"; this.code = code; this.status = status; this.requestId = requestId;
  }
}
export function apiObject(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("INVALID_RESPONSE", 0); return value as Record<string, unknown>; }
export function apiString(value: unknown, max = 100000): string { if (typeof value !== "string" || value.length > max) throw new ApiError("INVALID_RESPONSE", 0); return value; }
export function apiNumber(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new ApiError("INVALID_RESPONSE", 0); return value; }
export function apiItems(value: unknown): unknown[] { const items = Array.isArray(value) ? value : apiObject(value).items; if (!Array.isArray(items) || items.length > 2000) throw new ApiError("INVALID_RESPONSE", 0); return items; }
export type StudyTask = { id: string; title: string; instructions: string; recordIds: string[]; version?: number; createdAt?: string; updatedAt?: string; dueAt?: string; teacherNotes?: string; answerKey?: string; readingMetadata?: { recordId: string; minutes: number; sourceKind: string; limitations: string }[] };
export type StudySubmission = { id: string; userId: string; taskId: string; version: number; payload: Record<string, unknown>; feedback: string; taskVersion?: number; feedbackVersion?: number; feedbackSubmissionVersion?: number; createdAt?: string; updatedAt?: string; feedbackAt?: string };
export type StudyHistory = { revisions: { version: number; taskVersion: number; payload: Record<string, unknown>; createdAt: string }[]; feedback: { submissionVersion: number; feedbackVersion: number; feedback: string; createdAt: string }[] };
export function decodeStudyHistory(value: unknown): StudyHistory { const data = apiObject(value); return { revisions: apiItems(data.revisions).map(value => { const item = apiObject(value); return { version: apiNumber(item.version), taskVersion: apiNumber(item.taskVersion), payload: apiObject(item.payload), createdAt: apiString(item.createdAt, 40) }; }), feedback: apiItems(data.feedback).map(value => { const item = apiObject(value); return { submissionVersion: apiNumber(item.submissionVersion), feedbackVersion: apiNumber(item.feedbackVersion), feedback: apiString(item.feedback, 10000), createdAt: apiString(item.createdAt, 40) }; }) }; }
export type StudySpace = { id: string; role: string; title: string; version: number; payload: Record<string, unknown>; tasks: StudyTask[]; submissions: StudySubmission[]; members: { userId: string; name: string; email: string; role: string }[] };
export function decodeStudySpace(value: unknown): StudySpace {
  const data = apiObject(value); const optionalText = (value: unknown, max: number) => value === undefined || value === null ? undefined : apiString(value, max); const optionalNumber = (value: unknown) => value === undefined || value === null ? undefined : apiNumber(value);
  return { id: apiString(data.id, 100), role: typeof data.role === "string" ? data.role : "viewer", title: apiString(data.title, 200), version: apiNumber(data.version), payload: apiObject(data.payload ?? {}),
    tasks: apiItems(data.tasks ?? []).map(value => { const task = apiObject(value); return { id: apiString(task.id, 100), title: apiString(task.title, 200), instructions: apiString(task.instructions, 10000), recordIds: apiItems(task.recordIds ?? []).map(id => apiString(id, 80)), version: optionalNumber(task.version), createdAt: optionalText(task.createdAt, 40), updatedAt: optionalText(task.updatedAt, 40), dueAt: optionalText(task.dueAt, 40), teacherNotes: optionalText(task.teacherNotes, 10000), answerKey: optionalText(task.answerKey, 10000), readingMetadata: task.readingMetadata === undefined ? undefined : apiItems(task.readingMetadata).map(value => { const item = apiObject(value); return { recordId: apiString(item.recordId, 80), minutes: apiNumber(item.minutes), sourceKind: apiString(item.sourceKind, 100), limitations: apiString(item.limitations, 2000) }; }) }; }),
    submissions: apiItems(data.submissions ?? []).map(value => { const item = apiObject(value); return { id: apiString(item.id, 100), userId: apiString(item.userId, 100), taskId: apiString(item.taskId, 100), version: apiNumber(item.version), payload: apiObject(item.payload), feedback: typeof item.feedback === "string" ? apiString(item.feedback, 8000) : "", taskVersion: optionalNumber(item.taskVersion), feedbackVersion: optionalNumber(item.feedbackVersion), feedbackSubmissionVersion: optionalNumber(item.feedbackSubmissionVersion), createdAt: optionalText(item.createdAt, 40), updatedAt: optionalText(item.updatedAt, 40), feedbackAt: optionalText(item.feedbackAt, 40) }; }),
    members: apiItems(data.members ?? []).map(value => { const member = apiObject(value); return { userId: apiString(member.userId, 100), name: apiString(member.name, 160), email: typeof member.email === "string" ? apiString(member.email, 320) : "", role: apiString(member.role, 80) }; }) };
}
export function decodeSession(value: unknown): ApiSession {
  const data = apiObject(value); const capabilities: Record<string, ApiCapability> = {};
  for (const [key, item] of Object.entries(apiObject(data.capabilities ?? {}))) {
    if (["__proto__", "constructor", "prototype"].includes(key)) continue;
    if (typeof item === "boolean" || typeof item === "string") capabilities[key] = item;
    else if (item && typeof item === "object" && !Array.isArray(item)) capabilities[key] = Object.fromEntries(Object.entries(apiObject(item)).filter((entry): entry is [string, boolean | string] => typeof entry[1] === "boolean" || typeof entry[1] === "string"));
  }
  const user = data.user === null ? null : apiObject(data.user);
  let scopes: ApiScope[] | undefined;
  if (user?.scopes !== undefined) { const supplied = apiItems(user.scopes); if (supplied.length > apiScopes.length || !supplied.every((scope): scope is ApiScope => typeof scope === "string" && apiScopes.some(allowed => allowed === scope)) || new Set(supplied).size !== supplied.length) throw new ApiError("INVALID_RESPONSE", 0); scopes = supplied; }
  return { user: user ? { id: apiString(user.id, 100), email: apiString(user.email, 320), name: apiString(user.name, 160), role: apiString(user.role, 80), ...(scopes !== undefined ? { scopes } : {}) } : null, csrfToken: apiString(data.csrfToken, 300), capabilities };
}
function configuredApiBase(): string { const root = new URL(apiConfigured); const local = ["localhost", "127.0.0.1", "[::1]"].includes(root.hostname); if (!(root.protocol === "https:" || (root.protocol === "http:" && local)) || root.username || root.password || root.search || root.hash) throw new ApiError("API_NOT_CONFIGURED", 0); return apiConfigured.endsWith("/api/v1") ? apiConfigured : `${apiConfigured}/api/v1`; }
export async function apiRequest<T>(path: string, options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; rawBody?: Blob } = {}, decode: (value: unknown) => T): Promise<T> {
  if (!apiAvailable) throw new ApiError("API_NOT_CONFIGURED", 0);
  const pathname = path.split("?")[0];
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("#")) throw new ApiError("INVALID_INPUT", 0);
  try { if (decodeURIComponent(pathname).split("/").includes("..")) throw new ApiError("INVALID_INPUT", 0); } catch { throw new ApiError("INVALID_INPUT", 0); }
  const method = options.method ?? "GET";
  if (options.rawBody && (options.body !== undefined || options.rawBody.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "application/pdf"].includes(options.rawBody.type))) throw new ApiError("INVALID_INPUT", 0);
  if (method !== "GET" && !csrfToken) await getApiSession();
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const base = configuredApiBase();
    const response = await fetch(base + path, { method, credentials: "include", signal: controller.signal, headers: { Accept: "application/json", ...(options.rawBody ? { "Content-Type": options.rawBody.type } : options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}) }, body: options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined) });
    const payload: unknown = await response.json(); const envelope = apiObject(payload);
    if (!response.ok || envelope.error) {
      const error = apiObject(envelope.error ?? {}); const requestId = typeof apiObject(envelope.meta ?? {}).requestId === "string" ? apiString(apiObject(envelope.meta ?? {}).requestId, 100) : "";
      throw new ApiError(typeof error.code === "string" ? error.code : "REQUEST_FAILED", response.status, requestId);
    }
    const result = decode(envelope.data);
    if (path.startsWith("/auth/") && envelope.data && typeof envelope.data === "object") { const data = apiObject(envelope.data); if (typeof data.csrfToken === "string") csrfToken = data.csrfToken; }
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ApiError("TIMEOUT", 0);
    if (error instanceof SyntaxError) throw new ApiError("INVALID_RESPONSE", 0);
    throw new ApiError("NETWORK_ERROR", 0);
  } finally { clearTimeout(timeout); }
}
export function getApiSession(): Promise<ApiSession> { return apiRequest("/auth/session", {}, decodeSession); }
export function safeApiMessage(error: unknown): string { return error instanceof ApiError ? `${error.message}${error.requestId ? ` 문의 식별자: ${error.requestId}` : ""}` : "작업을 완료할 수 없습니다. 현재 입력을 보관하고 다시 확인하세요."; }

export function apiId(value: unknown): string { const id = apiString(value, 100); if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new ApiError("INVALID_RESPONSE", 0); return id; }
export type AiCitation = { recordId: string; sectionId: string };
export type AiResponse = { text: string; citations: AiCitation[] };
export function decodeAiResponse(value: unknown): AiResponse { const data = apiObject(value); return { text: apiString(data.text, 40000), citations: apiItems(data.citations).map(value => { const citation = apiObject(value); return { recordId: apiId(citation.recordId), sectionId: apiId(citation.sectionId) }; }) }; }
export function validateAiCitations(answer: AiResponse, records: { id: string; sections: { id: string }[] }[], selectedIds: string[]): boolean { return answer.citations.every(citation => selectedIds.includes(citation.recordId) && records.some(record => record.id === citation.recordId && record.sections.some(section => section.id === citation.sectionId))); }
export type ServiceDefinition = { description: string; audience: string; deliverables: string[]; rightsStatement: string; deliveryDays: number; supportPolicy: string };
export type PaymentProduct = { id: string; title: string; amountMinor: number; currency: string; serviceDefinition?: ServiceDefinition };
export type PaymentOrder = { id: string; productId: string; amountMinor: number; refundedMinor: number; currency: string; status: string; checkoutUrl: string; refundRequests: RefundRequest[] };
export type PaymentOrderReceipt = { orderId: string; status: string; checkoutUrl: string };
export type RefundRequest = { requestId: string; orderId: string; amountMinor: number; status: string; reason: string };
function paymentCurrency(value: unknown): string { const currency = apiString(value, 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw new ApiError("INVALID_RESPONSE", 0); return currency; }
export function decodePaymentProduct(value: unknown): PaymentProduct { const data = apiObject(value); let serviceDefinition: ServiceDefinition | undefined; if (data.serviceDefinition !== undefined) { const service = apiObject(data.serviceDefinition); const deliveryDays = apiNumber(service.deliveryDays); if (deliveryDays < 1 || deliveryDays > 3650) throw new ApiError("INVALID_RESPONSE", 0); const deliverables = apiItems(service.deliverables).map(item => apiString(item, 2000)); if (deliverables.length > 100) throw new ApiError("INVALID_RESPONSE", 0); serviceDefinition = { description: apiString(service.description, 10000), audience: apiString(service.audience, 2000), deliverables, rightsStatement: apiString(service.rightsStatement, 10000), deliveryDays, supportPolicy: apiString(service.supportPolicy, 10000) }; } return { id: apiId(data.id), title: apiString(data.title, 200), amountMinor: apiNumber(data.amountMinor), currency: paymentCurrency(data.currency), ...(serviceDefinition ? { serviceDefinition } : {}) }; }
export function decodePaymentOrder(value: unknown): PaymentOrder { const data = apiObject(value); const amountMinor = apiNumber(data.amountMinor); const refundedMinor = apiNumber(data.refundedMinor); if (refundedMinor > amountMinor) throw new ApiError("INVALID_RESPONSE", 0); return { id: apiId(data.id), productId: apiId(data.productId), amountMinor, refundedMinor, currency: paymentCurrency(data.currency), status: apiString(data.status, 80), checkoutUrl: typeof data.checkoutUrl === "string" ? apiString(data.checkoutUrl, 4000) : "", refundRequests: apiItems(data.refundRequests ?? []).map(decodeRefundRequest) }; }
export function decodeOrderReceipt(value: unknown): PaymentOrderReceipt { const data = apiObject(value); return { orderId: apiId(data.orderId), status: apiString(data.status, 80), checkoutUrl: apiString(data.checkoutUrl ?? data.url ?? "", 4000) }; }
export function decodeRefundRequest(value: unknown): RefundRequest { const data = apiObject(value); return { requestId: apiId(data.requestId), orderId: typeof data.orderId === "string" ? apiId(data.orderId) : "", amountMinor: apiNumber(data.amountMinor), status: apiString(data.status, 80), reason: typeof data.reason === "string" ? apiString(data.reason, 2000) : "" }; }
export function verifiedCheckoutUrl(raw: string): string | null { try { const url = new URL(raw); return url.protocol === "https:" && url.hostname === "checkout.stripe.com" && !url.username && !url.password && !url.port ? url.href : null; } catch { return null; } }
export type CmsAttachment = { attachmentId: string; recordId: string; sourceId: string; contentType: string; size: number; sha256: string; rights: string; createdAt: string; scanStatus?:"unknown"|"clean"|"rejected";scanner?:string|null;scannedAt?:string|null };
export function decodeAttachment(value: unknown): CmsAttachment { const data = apiObject(value); const contentType = apiString(data.contentType, 100); const sha256 = apiString(data.sha256, 100); const size = apiNumber(data.size); if (!["image/png", "image/jpeg", "application/pdf"].includes(contentType) || !/^[a-f0-9]{64}$/i.test(sha256) || size > 5 * 1024 * 1024) throw new ApiError("INVALID_RESPONSE", 0); if(data.scanStatus!==undefined&&(typeof data.scanStatus!=="string"||!["unknown","clean","rejected"].includes(data.scanStatus)))throw new ApiError("INVALID_RESPONSE",0);const scanStatus=data.scanStatus===undefined?undefined:data.scanStatus as "unknown"|"clean"|"rejected";return { ...(scanStatus?{scanStatus}:{}),...(data.scanner!==undefined?{scanner:data.scanner===null?null:apiString(data.scanner,200)}:{}),...(data.scannedAt!==undefined?{scannedAt:data.scannedAt===null?null:apiString(data.scannedAt,100)}:{}), attachmentId: apiId(data.attachmentId), recordId: apiId(data.recordId), sourceId: apiId(data.sourceId), contentType, size, sha256, rights: apiString(data.rights, 5000), createdAt: apiString(data.createdAt, 100) }; }
export async function downloadCmsAttachment(id: string): Promise<Blob> {
  if (!apiAvailable) throw new ApiError("API_NOT_CONFIGURED", 0); const safeId = apiId(id); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try { const response = await fetch(`${configuredApiBase()}/cms/attachments/${safeId}`, { credentials: "include", signal: controller.signal, headers: { Accept: "application/pdf,image/png,image/jpeg" } });
    if (!response.ok) { const envelope = apiObject(await response.json()); const error = apiObject(envelope.error); throw new ApiError(typeof error.code === "string" ? error.code : "REQUEST_FAILED", response.status); }
    const type = response.headers.get("Content-Type")?.split(";")[0]; if (!type || !["image/png", "image/jpeg", "application/pdf"].includes(type)) throw new ApiError("INVALID_RESPONSE", 0); const blob = await response.blob(); if (blob.size > 5 * 1024 * 1024) throw new ApiError("INVALID_RESPONSE", 0); return blob;
  } catch (error) { if (error instanceof ApiError) throw error; if (error instanceof Error && error.name === "AbortError") throw new ApiError("TIMEOUT", 0); throw new ApiError("NETWORK_ERROR", 0); } finally { clearTimeout(timeout); }
}
