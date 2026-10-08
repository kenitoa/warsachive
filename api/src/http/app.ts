import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { ApiConfig } from "../config.ts";
import type { Adapters } from "../adapters/contracts.ts";
import { disabledAdapters } from "../adapters/contracts.ts";
import { Store } from "../infrastructure/database.ts";
import { AppError, check } from "../domain/errors.ts";
import { object, identifier } from "../domain/validation.ts";
import { AuthService, requireUser, type Session } from "../application/auth.ts";
import { CollaborationService } from "../application/collaboration.ts";
import { EditorialService } from "../application/editorial.ts";
import { InstitutionService } from "../application/institutions.ts";
import { CommerceService } from "../application/commerce.ts";
import { ResetService } from "../application/resets.ts";
import { JobWorker } from "../application/jobs.ts";
import { ProviderError } from "../adapters/provider-http.ts";
import { AttachmentService } from "../application/attachments.ts";
import { AiService } from "../application/ai.ts";
import { ServiceRequestService } from '../application/services.ts';
import { SecurityService } from '../application/security.ts';
import { OperationsService,preflight } from '../application/operations.ts';
import { ReceiptService } from '../application/receipts.ts';
import { MetricsService } from '../application/metrics.ts';
import { requirePermission,permissions } from '../domain/permissions.ts';
type AppOptions = { store: Store; config: ApiConfig; adapters?: Adapters; log?: (entry: Record<string, unknown>) => void };
class RateLimits {
  readonly entries = new Map<string, { count: number; until: number }>();
  consume(key: string, limit: number, period: number): void {
    const now = Date.now(); const previous = this.entries.get(key); const entry = previous && previous.until > now ? previous : { count: 0, until: now + period };
    entry.count++; this.entries.set(key, entry); if (this.entries.size > 10000) for (const [name, item] of this.entries) if (item.until <= now) this.entries.delete(name);
    check(entry.count <= limit, 429, "RATE_LIMITED", "요청이 많습니다. 잠시 뒤 다시 시도해 주세요.");
  }
}
async function body(request: IncomingMessage, raw = false, maxBytes = 2097152): Promise<unknown | Buffer> {
  if (!raw) check(request.headers["content-type"]?.split(";")[0] === "application/json", 415, "UNSUPPORTED_MEDIA_TYPE", "JSON 요청이 필요합니다.");
  if (request.headers["content-length"]) check(Number(request.headers["content-length"]) <= maxBytes, 413, "PAYLOAD_TOO_LARGE", "요청 크기가 허용 범위를 초과했습니다.");
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { const buffer: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string); size += buffer.length; check(size <= maxBytes, 413, "PAYLOAD_TOO_LARGE", "요청 크기가 허용 범위를 초과했습니다."); chunks.push(buffer); }
  const content = Buffer.concat(chunks); if (raw) return content;
  try { return object(JSON.parse(content.toString("utf8")) as unknown); } catch (error) { if (error instanceof AppError) throw error; throw new AppError(400, "INVALID_JSON", "JSON 형식을 확인해 주세요."); }
}
function cookie(request: IncomingMessage, name: string): string | undefined { return request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1); }
export function createApp(options: AppOptions) {
  const attachments = new AttachmentService(options.store, options.config);
  const { store, config } = options; const adapters = options.adapters || disabledAdapters(); const auth = new AuthService(store, config); const collaboration = new CollaborationService(store); const editorial = new EditorialService(store, adapters,config); const institutions = new InstitutionService(store); const commerce = new CommerceService(store, adapters, config); const resets = new ResetService(store, adapters, config); const worker = new JobWorker(store, adapters, config); const limits = new RateLimits(); const stats = { requests: 0, errors: 0, totalDurationMs: 0 }; const cookieName = config.secureCookies ? "__Host-war_session" : "war_session";
  const security=new SecurityService(store,config),operations=new OperationsService(store,config),receipts=new ReceiptService(store,config),metrics=new MetricsService(store),services=new ServiceRequestService(store);
  const ai = new AiService(store, adapters, config, editorial);
  const capabilities = () => ({ payments: adapters.payments.enabled && config.products.length > 0, ai: adapters.ai.enabled && adapters.ai.publicEnabled !== false, aiAssist: adapters.ai.enabled, notifications: adapters.notifications.enabled, passwordReset: resets.enabled(), accounts: true, cms: true, publishing: config.publicationSecret.length >= 32, publicationEnabled: config.publicationSecret.length >= 32, corrections: true, collaboration: true, privateAttachments: true,staffMfaRequired:config.staffMfaRequired,recentReauthRequired:config.recentReauthRequired,knowledgePreflight:Boolean(config.knowledgeFile),fileScanning:Boolean(config.fileScanSecret),notificationReceipts:Boolean(config.notificationReceiptSecret),deploymentEvidence:Boolean(config.deploymentEvidenceSecret) });
  function setSession(response: ServerResponse, session: Session): void { response.setHeader("Set-Cookie", `${cookieName}=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${session.user ? config.sessionHours * 3600 : 1800}${config.secureCookies ? "; Secure" : ""}`); }
  const handler = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const requestId = randomUUID(); const started = Date.now(); stats.requests++;
    let status = 200; let errorCode: string | null = null;
    const method = request.method || "GET"; let path = "";
    response.setHeader("Content-Type", "application/json; charset=utf-8"); response.setHeader("Cache-Control", "no-store"); response.setHeader("X-Content-Type-Options", "nosniff"); response.setHeader("Referrer-Policy", "no-referrer"); response.setHeader("X-Frame-Options", "DENY"); response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"); response.setHeader("X-Request-Id", requestId); if (config.secureCookies) response.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      const url = new URL(request.url || "/", "http://api.local"); path = url.pathname.replace(/\/$/, "") || "/";
      check(path.startsWith("/api/v1/") || ["/health/live", "/health/ready", "/health/metrics"].includes(path), 404, "RESOURCE_NOT_FOUND", "요청 경로를 찾을 수 없습니다.");
      const origin = request.headers.origin; if (origin) { check(config.allowedOrigins.includes(origin), 403, "ORIGIN_REJECTED", "허용되지 않은 요청 출처입니다."); response.setHeader("Access-Control-Allow-Origin", origin); response.setHeader("Vary", "Origin"); response.setHeader("Access-Control-Allow-Credentials", "true"); }
      if (method === "OPTIONS") { check(origin, 403, "ORIGIN_REJECTED", "요청 출처가 필요합니다."); response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS"); response.setHeader("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token"); response.statusCode = 204; response.end(); return; }
      check(["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method), 405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다.");
      limits.consume(`request:${request.socket.remoteAddress || "unknown"}`, 240, 60000);
      let session = auth.session(cookie(request, cookieName));
      const webhook = method === "POST" && ["/api/v1/payments/webhook", "/api/v1/payments/webhook/stripe"].includes(path);
      const signedReceipt=method==='POST'&&['/api/v1/notifications/receipts','/api/v1/operations/file-scan-receipts'].includes(path);
      if (!["GET"].includes(method) && !webhook&&!signedReceipt) { check(origin && config.allowedOrigins.includes(origin), 403, "ORIGIN_REJECTED", "변경 요청의 출처가 필요합니다."); const csrf = request.headers["x-csrf-token"]; auth.verifyCsrf(session, typeof csrf === "string" ? csrf : undefined); }
      const user = session?.user || null; let data: unknown; const segments = path.split("/").filter(Boolean); const resource = segments[2]; const id = segments[3]; const action = segments[4];
      if(!signedReceipt&&(['cms','admin','rights','organizations','contracts','jobs','operations'].includes(resource)||path==='/health/metrics'))security.staff(session);
      if(resource==='cms')requirePermission(user,'content:read');
      if(resource==='service-requests'&&method==='GET'&&user&&permissions(user).includes('finance:read'))security.staff(session);
      if(resource==='corrections'&&(method==='GET'&&!id&&user&&permissions(user).includes('content:read')||method==='POST'&&id))security.staff(session);
      if(resource==='payments'&&(id==='refund-requests'||id==='orders'&&segments[5]==='fulfillment')&&user)security.staff(session);
      if(resource==='admin')requirePermission(user,'security:manage');
      if(method!=='GET'&&!signedReceipt&&(resource==='admin'||resource==='rights'||resource==='contracts'||resource==='service-requests'&&method==='PUT'||resource==='cms'&&(['approve','publish','withhold'].includes(segments[5]||'')||id==='import')||resource==='jobs'&&action==='retry'||resource==='payments'&&id==='orders'&&['refunds','fulfillment'].includes(segments[5]||'')&&segments[6]!=='confirm'))security.sensitive(session);
      if (method === "GET" && path === "/health/live") data = { status: "alive" };
      else if (method === "GET" && path === "/health/ready") { store.get("SELECT 1 AS ready"); data = { status: "ready", capabilities: capabilities() }; }
      else if (method === "GET" && ["/health/metrics","/api/v1/operations/metrics"].includes(path)) { requirePermission(user,'analytics:read'); data = { ...stats,...metrics.summary(), jobs: store.all("SELECT status,count(*) AS count FROM jobs GROUP BY status"), publicRecordCount: Number(store.get("SELECT count(*) AS count FROM public_records")?.count), aiDailyUsage: store.get("SELECT date,reserved_calls AS reservedCalls,input_tokens AS inputTokens,output_tokens AS outputTokens FROM ai_daily_usage WHERE date=?", new Date().toISOString().slice(0, 10)) || null, aiDailyRequestLimit: config.aiDailyRequestLimit }; }
      else if (method === "GET" && path === "/api/v1/capabilities") data = capabilities();
      else if (method === "GET" && path === "/api/v1/openapi.json") data = object(JSON.parse(await readFile(new URL("../../openapi.json", import.meta.url), "utf8")) as unknown);
      else if (method === "GET" && path === "/api/v1/auth/session") { session ||= auth.createSession(null); setSession(response, session); data = { user: session.user, csrfToken: session.csrfToken, capabilities: capabilities() }; }
      else if (method === "POST" && ["/api/v1/auth/register", "/api/v1/auth/login"].includes(path)) { limits.consume(`auth:${request.socket.remoteAddress}`, 15, 600000); check(session, 403, "CSRF_REJECTED", "세션을 먼저 확인해 주세요."); const input = await body(request); const result = path.endsWith("register") ? await auth.register(input, session.token, requestId) : await auth.login(input, session.token, requestId); setSession(response, result); data = { user: result.user, csrfToken: result.csrfToken, capabilities: capabilities() }; }
      else if (method === "POST" && path === "/api/v1/auth/logout") { check(session, 401, "AUTH_REQUIRED", "세션이 필요합니다."); const result = auth.logout(session, requestId); setSession(response, result); data = { user: null, csrfToken: result.csrfToken }; }
      else if(resource==='auth'&&['reauth','mfa'].includes(id)){check(session,401,'AUTH_REQUIRED','로그인이 필요합니다.');if(method==='POST')limits.consume(`security:${user?.id||request.socket.remoteAddress}`,10,600000);if(id==='reauth'&&method==='POST')data=await security.reauth(session,await body(request),requestId);else if(id==='mfa'&&method==='GET')data=security.status(session);else if(id==='mfa'&&method==='POST'&&action==='enroll')data=await security.enroll(session,await body(request),requestId);else if(id==='mfa'&&method==='POST'&&['confirm','challenge'].includes(action))data=security.challenge(session,await body(request),action==='confirm',requestId);else throw new AppError(404,'RESOURCE_NOT_FOUND','보안 경로를 확인해 주세요.');}
      else if (method === "POST" && path === "/api/v1/auth/password/change") { check(session, 401, "AUTH_REQUIRED", "로그인이 필요합니다."); const result = await auth.changePassword(user, await body(request), session.token, requestId); setSession(response, result); data = { user: result.user, csrfToken: result.csrfToken }; }
      else if (method === "POST" && path === "/api/v1/auth/password/reset/request") { limits.consume(`reset:${request.socket.remoteAddress}`, 5, 3600000); data = resets.request(await body(request), requestId); }
      else if (method === "POST" && path === "/api/v1/auth/password/reset/complete") { limits.consume(`reset-complete:${request.socket.remoteAddress}`, 10, 3600000); data = await resets.complete(await body(request), requestId); }
      else if (method === "GET" && path === "/api/v1/auth/export") data = auth.exportAccount(user);
      else if (method === "DELETE" && path === "/api/v1/auth/account") { await auth.deleteAccount(user, await body(request), requestId); check(session, 401, "AUTH_REQUIRED", "세션이 필요합니다."); const result = auth.logout(session, requestId); setSession(response, result); data = { deleted: true, csrfToken: result.csrfToken }; }
      else if (method === "GET" && path === "/api/v1/admin/users") { requirePermission(user,'security:manage'); data = { items: store.all("SELECT id,email,name,role,created_at AS createdAt FROM users WHERE deactivated=0 LIMIT 500") }; }
      else if (method === "PUT" && resource === "admin" && id === "users" && segments[5] === "role") data = auth.setRole(user, identifier(action), await body(request), requestId);
      else if(resource==='admin'&&id==='users'&&action&&segments[5]==='scopes'){if(method==='GET')data=security.scopeSettings(user,identifier(action));else if(method==='PUT')data=security.setScopes(user,identifier(action),await body(request),requestId);else throw new AppError(405,'METHOD_NOT_ALLOWED','지원하지 않는 요청입니다.');}
      else if(resource==='admin'&&id==='users'&&action&&segments[5]==='offboard'&&method==='POST')data=security.offboard(user,identifier(action),requestId);
      else if(resource==='operations'&&id==='assignees'&&method==='GET')data=operations.assignees(user);
      else if(resource==='operations'&&id==='workboard'){if(method==='GET'&&!action)data=operations.workboard(user);else if(method==='PUT'&&action&&segments[5])data=operations.workItem(user,identifier(action),identifier(segments[5]),await body(request),requestId);else throw new AppError(404,'RESOURCE_NOT_FOUND','업무 경로를 확인해 주세요.');}
      else if(signedReceipt){const input=await body(request);data=resource==='notifications'?receipts.notification(input,request.headers['x-archive-signature']):receipts.scan(input,request.headers['x-archive-signature']);}
      else if(resource==='service-requests'){if(method==='GET')data=id?services.get(user,identifier(id)):services.list(user);else if(method==='POST'&&!id)data=services.create(user,await body(request),requestId);else if(method==='PUT'&&id)data=services.update(user,identifier(id),await body(request),requestId);else throw new AppError(405,'METHOD_NOT_ALLOWED','지원하지 않는 요청입니다.');}
      else if (resource === "shelf" && segments.length === 3) { if (method === "GET") data = collaboration.shelf(user); else if (method === "PUT") data = collaboration.putShelf(user, await body(request), requestId); else throw new AppError(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다."); }
      else if (resource === "workspaces" && segments.length <= 4) { if (method === "GET") data = id ? collaboration.workspace(user, identifier(id)) : collaboration.workspaces(user); else if (method === "POST" && !id) data = collaboration.saveWorkspace(user, null, await body(request), requestId); else if (method === "PUT" && id) data = collaboration.saveWorkspace(user, identifier(id), await body(request), requestId); else if (method === "DELETE" && id) { collaboration.deleteWorkspace(user, identifier(id), requestId); data = { deleted: true }; } else throw new AppError(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다."); }
      else if (resource === "spaces") {
        if (method === "GET" && segments.length <= 4) data = id ? collaboration.space(user, identifier(id)) : collaboration.spaces(user);
        else if (method === "POST" && !id) data = collaboration.createSpace(user, await body(request), requestId);
        else if (method === "POST" && id === "join") data = collaboration.join(user, await body(request), requestId);
        else if (method === "PUT" && id && !action) data = collaboration.putSpace(user, identifier(id), await body(request), requestId);
        else if (method === "POST" && id && action === "members") data = collaboration.addMember(user, identifier(id), await body(request), requestId);
        else if (method === "DELETE" && id && action === "members" && segments[5]) { collaboration.removeMember(user, identifier(id), identifier(segments[5]), requestId); data = { deleted: true }; }
        else if (method === "POST" && id && action === "invitations") data = collaboration.invite(user, identifier(id), await body(request), requestId);
        else if (method === "POST" && id && action === "transfer") data = collaboration.transfer(user, identifier(id), await body(request), requestId);
        else if (method === "POST" && id && action === "tasks" && !segments[5]) data = collaboration.task(user, identifier(id), await body(request), requestId);
        else if(method==='PUT'&&id&&action==='tasks'&&segments[5]&&!segments[6])data=collaboration.task(user,identifier(id),await body(request),requestId,identifier(segments[5]));
        else if(method==='GET'&&id&&action==='submissions'&&segments[5]&&segments[6]==='history')data=collaboration.submissionHistory(user,identifier(id),identifier(segments[5]));
        else if (method === "POST" && id && action === "tasks" && segments[5] && segments[6] === "submissions") data = collaboration.submit(user, identifier(id), identifier(segments[5]), await body(request), requestId);
        else if (method === "PUT" && id && action === "submissions" && segments[5] && segments[6] === "feedback") data = collaboration.feedback(user, identifier(id), identifier(segments[5]), await body(request), requestId);
        else throw new AppError(404, "RESOURCE_NOT_FOUND", "요청 경로를 찾을 수 없습니다.");
      }
      else if (resource === "corrections") { if (method === "GET") data = id ? editorial.receipt(identifier(id)) : editorial.corrections(user); else if (method === "POST" && !id) { limits.consume(`correction:${request.socket.remoteAddress}`, 10, 3600000); data = editorial.correction(user, await body(request), requestId); status = 201; } else if (method === "POST" && id && action === "status") data = editorial.moderate(user, identifier(id), await body(request), requestId); else throw new AppError(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다."); }
      else if (resource === "cms") {
        if (id === "attachments" && method === "POST" && !action) { requirePermission(user,'content:read'); const raw = await body(request, true, 5 * 1024 * 1024); check(Buffer.isBuffer(raw), 400, "INVALID_INPUT", "파일 원문이 필요합니다."); data = await attachments.upload(user, { recordId: url.searchParams.get("recordId"), sourceId: url.searchParams.get("sourceId"), rights: url.searchParams.get("rights") }, raw, request.headers["content-type"]?.split(";")[0] || "", requestId); status = 201; }
        else if (id === "attachments" && method === "GET") { if (action) { const file = await attachments.download(user, identifier(action), requestId); response.setHeader("Content-Type", file.contentType); response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`); response.setHeader("Content-Length", String(file.bytes.length)); response.end(file.bytes); return; } data = attachments.list(user, url.searchParams.get("recordId") || undefined); }
        else if (id === "drafts" && method === "GET") data = action ? segments[5] === 'preflight' ? preflight(store,config,identifier(action)) : segments[5]==='publication'?operations.publication(user,identifier(action)):segments[5] === "revisions" ? editorial.revisions(user, identifier(action)) : editorial.draft(user, identifier(action)) : editorial.drafts(user);
        else if (id === "drafts" && method === "POST" && !action) data = editorial.save(user, null, await body(request), requestId);
        else if (id === "drafts" && method === "PUT" && action && !segments[5]) data = editorial.save(user, identifier(action), await body(request), requestId);
        else if (id === "drafts" && method === "POST" && action && segments[5]) { if (segments[5] === "publish") check(config.publicationSecret.length >= 32, 503, "PUBLICATION_DISABLED", "별도 발행 서명을 설정해야 합니다."); data = segments[5] === "restore" ? editorial.restore(user, identifier(action), await body(request), requestId) : editorial.transition(user, identifier(action), segments[5], await body(request), requestId); }
        else if (id === "import" && method === "POST") data = editorial.importStatic(user, await body(request), requestId);
        else if (id === "export" && method === "GET") { requirePermission(user,'content:read'); data = { version: 1, records: editorial.publicRecords() }; }
        else if (id === "dashboard" && method === "GET") { requirePermission(user,'content:read'); data = { counts: { drafts: Number(store.get("SELECT count(*) AS count FROM drafts")?.count), submitted: Number(store.get("SELECT count(*) AS count FROM drafts WHERE state='submitted'")?.count), approved: Number(store.get("SELECT count(*) AS count FROM drafts WHERE state='approved'")?.count), corrections: Number(store.get("SELECT count(*) AS count FROM corrections WHERE status NOT IN ('resolved','rejected')")?.count), jobs: Number(store.get("SELECT count(*) AS count FROM jobs WHERE status IN ('pending','running')")?.count) }, capabilities: capabilities() }; }
        else throw new AppError(404, "RESOURCE_NOT_FOUND", "CMS 요청 경로를 찾을 수 없습니다.");
      }
      else if (["organizations", "rights", "contracts"].includes(resource) && segments.length <= 4) { const target = resource as "organizations" | "rights" | "contracts"; if (method === "GET" && !id) data = institutions.list(user, target); else if ((method === "POST" && !id) || (method === "PUT" && id)) data = institutions.save(user, target, id ? identifier(id) : null, await body(request), requestId); else throw new AppError(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청입니다."); }
      else if (resource === "jobs" && method === "GET") { check(user&&(permissions(user).includes('content:read')||permissions(user).includes('operations:manage')),403,'FORBIDDEN','큐 조회 권한이 필요합니다.'); store.run("UPDATE notification_deliveries SET status='expired',updated_at=? WHERE status='accepted' AND expires_at<=?",new Date().toISOString(),new Date().toISOString()); data = { items: store.all("SELECT j.id,j.kind,j.status,j.attempts,j.next_at AS nextAt,j.error_code AS errorCode,j.created_at AS createdAt,j.completed_at AS completedAt,d.status AS deliveryStatus,d.accepted_at AS providerAcceptedAt,d.updated_at AS receiptAt FROM jobs j LEFT JOIN notification_deliveries d ON d.job_id=j.id ORDER BY j.created_at DESC LIMIT 500") }; }
      else if (resource === "jobs" && method === "POST" && id && action === "retry") { const actor = requirePermission(user,'operations:manage'); check(store.run("UPDATE jobs SET status='pending',attempts=0,error_code=NULL,next_at=? WHERE id=? AND status='failed' AND payload<>'{\"redacted\":true}'", new Date().toISOString(), identifier(id)) === 1, 409, "JOB_NOT_RETRYABLE", "실패한 작업만 다시 요청할 수 있습니다. 폐기된 재설정 안내는 새로 요청해야 합니다."); store.audit(actor.id, "job.retry", id, requestId); data = { jobId: id, status: "pending" }; }
      else if (resource === "public" && id === "records" && method === "GET") data = action ? editorial.publicRecordById(identifier(action)) : editorial.publicPage(Number(url.searchParams.get("page") || 1), Number(url.searchParams.get("limit") || 50));
      else if (resource === "payments") {
        if (method === "GET" && id === "products") data = commerce.products();
        else if (method === "GET" && id === "orders" && !action) data = commerce.orders(user);
        else if (method === "GET" && id === "orders" && action && !segments[5]) data = commerce.order(user, identifier(action));
        else if(id==='orders'&&action&&segments[5]==='fulfillment'){if(method==='GET')data=operations.fulfillment(user,identifier(action));else if(method==='PUT'&&!segments[6])data=operations.fulfill(user,identifier(action),await body(request),requestId);else if(method==='POST'&&segments[6]==='confirm')data=operations.fulfill(user,identifier(action),await body(request),requestId,true);else throw new AppError(405,'METHOD_NOT_ALLOWED','지원하지 않는 요청입니다.');}
        else if (method === "POST" && id === "orders" && !action) data = await commerce.checkout(user, await body(request), requestId);
        else if (method === "POST" && id === "orders" && action && segments[5] === "refunds") data = await commerce.refund(user, identifier(action), await body(request), requestId);
        else if (method === "POST" && id === "orders" && action && segments[5] === "refund-requests") data = commerce.requestRefund(user, identifier(action), await body(request), requestId);
        else if (method === "GET" && id === "refund-requests" && !action) data = commerce.refundRequests(user);
        else if (method === "POST" && id === "refund-requests" && action && segments[5] === "reject") data = commerce.rejectRefund(user, identifier(action), await body(request), requestId);
        else if (webhook) { const signature = request.headers["stripe-signature"]; check(typeof signature === "string", 400, "SIGNATURE_REQUIRED", "공급자 서명이 필요합니다."); const raw = await body(request, true); check(Buffer.isBuffer(raw), 400, "INVALID_INPUT", "원문 요청이 필요합니다."); data = await commerce.webhook(raw, signature); }
        else throw new AppError(404, "RESOURCE_NOT_FOUND", "결제 요청 경로를 찾을 수 없습니다.");
      }
      else if (resource === "ai" && id === "answer" && method === "POST") {
        const account = requireUser(user); limits.consume(`ai:${account.id}`, 10, 3600000); const input=object(await body(request));if(input.mode==='assist')security.staff(session);data = await ai.answer(account,input, requestId);
      }
      else throw new AppError(404, "RESOURCE_NOT_FOUND", "요청 경로를 찾을 수 없습니다.");
      response.statusCode = status; response.end(JSON.stringify({ data, error: null, meta: { requestId } }));
    } catch (error) {
      stats.errors++; const expected = error instanceof AppError; const external = error instanceof ProviderError; const webhook = path.startsWith("/api/v1/payments/webhook"); status = expected ? error.status : external ? webhook && error.code === "INVALID_RESPONSE" ? 400 : error.code === "CONFIGURATION" ? 503 : 502 : 500; errorCode = expected ? error.code : external ? webhook && error.code === "INVALID_RESPONSE" ? "WEBHOOK_REJECTED" : `EXTERNAL_${error.code}` : "INTERNAL_ERROR";
      response.statusCode = status; if (status === 429) response.setHeader("Retry-After", "60"); response.end(JSON.stringify({ data: null, error: { code: errorCode, message: expected ? error.message : "요청을 처리하지 못했습니다. 문의 시 요청 ID를 알려 주세요." }, meta: { requestId } }));
    } finally { const durationMs = Date.now() - started; stats.totalDurationMs += durationMs;try{metrics.observe(durationMs,status);}catch{options.log?.({timestamp:new Date().toISOString(),level:'error',service:'archive-api',operation:'metrics.storage_failure',requestId,errorCode:'METRICS_STORAGE_FAILURE'});} options.log?.({ timestamp: new Date().toISOString(), level: status >= 500 ? "error" : "info", service: "archive-api", operation: `${method}:${path.split("/").slice(0, 4).join("/")}`, requestId, durationMs, status, errorCode }); }
  };
  return { handler, auth, collaboration, editorial, institutions, commerce, resets, worker, attachments, ai,security,operations,receipts,metrics,services, capabilities };
}
