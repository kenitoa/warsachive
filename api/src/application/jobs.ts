import { randomUUID, createHmac } from "node:crypto";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import type { Adapters } from "../adapters/contracts.ts";
import type { ApiConfig } from "../config.ts";
import { Store, hash } from "../infrastructure/database.ts";
import { check, AppError } from "../domain/errors.ts";
import { checkedPublicRecord } from "../domain/archive.ts";
import { object } from "../domain/validation.ts";
import { preflight,addPublicationStage } from './operations.ts';
import { requirePermission,type Scope } from '../domain/permissions.ts';
import type { User } from './auth.ts';
export function enqueue(store: Store, kind: "publish" | "export" | "notification", key: string, payload: unknown): string {
  const existing = store.get("SELECT id FROM jobs WHERE job_key=?", key); if (existing) return String(existing.id);
  const id = randomUUID(); const now = new Date().toISOString();
  store.run("INSERT INTO jobs (id,job_key,kind,payload,status,next_at,created_at) VALUES (?,?,?,?,?,?,?)", id, key, kind, JSON.stringify(payload), "pending", now, now); return id;
}
export class JobWorker {
  readonly store: Store; readonly adapters: Adapters; readonly config: ApiConfig;
  constructor(store: Store, adapters: Adapters, config: ApiConfig) { this.store = store; this.adapters = adapters; this.config = config; }
  async tick(): Promise<boolean> {
    const now = new Date().toISOString();this.store.run("UPDATE notification_deliveries SET status='expired',updated_at=? WHERE status='accepted' AND expires_at<=?",now,now); const stale = new Date(Date.now() - 300000).toISOString();
    const job = this.store.transaction(() => {
      this.store.run("UPDATE jobs SET status='pending',locked_at=NULL WHERE status='running' AND locked_at<?", stale);
      const row = this.store.get("SELECT * FROM jobs WHERE status='pending' AND next_at<=? AND (kind='notification' OR NOT EXISTS(SELECT 1 FROM jobs running WHERE running.status='running' AND running.kind IN ('publish','export'))) ORDER BY created_at,id LIMIT 1", now); if (!row) return undefined;
      this.store.run("UPDATE jobs SET status='running',locked_at=?,attempts=attempts+1 WHERE id=? AND status='pending'", now, String(row.id)); return row;
    });
    if (!job) return false;
    try {
      const data = object(JSON.parse(String(job.payload)) as unknown);
      if (job.kind === "publish") {
        this.store.transaction(() => {
          const draft = this.store.get("SELECT * FROM drafts WHERE id=?", String(data.draftId));
          check(draft && draft.state === "approved" && draft.approved_hash === draft.content_hash && draft.content_hash === data.contentHash, 409, "APPROVAL_STALE", "승인한 기록 버전이 변경되었습니다.");
          if(this.config.knowledgeFile){const result=preflight(this.store,this.config,String(draft.id)),bound=this.store.get('SELECT registry_hash FROM draft_knowledge_checks WHERE draft_id=? AND revision=? AND content_hash=?',String(draft.id),Number(draft.version),String(draft.content_hash));check(result.ready&&bound?.registry_hash===result.registryHash,409,'KNOWLEDGE_APPROVAL_STALE','지식 레지스트리를 다시 검토해야 합니다.');}
          const record = checkedPublicRecord(JSON.parse(String(draft.payload)) as unknown);
          check(record.review.status === "approved" && record.review.humanReviewed && typeof draft.approved_by === "string", 409, "APPROVAL_REQUIRED", "실제 검수 승인이 필요합니다.");
          const approver=this.store.get('SELECT id,email,name,role FROM users WHERE id=? AND deactivated=0',String(draft.approved_by));check(approver,409,'APPROVAL_REVIEWER_UNAVAILABLE','승인자의 활성 권한을 다시 확인해야 합니다.');const assigned=this.store.get('SELECT scopes FROM user_scope_settings WHERE user_id=?',String(draft.approved_by));requirePermission({id:String(approver.id),email:String(approver.email),name:String(approver.name),role:approver.role as User['role'],...assigned?{scopes:JSON.parse(String(assigned.scopes)) as Scope[]}:{}} ,'content:review');
          this.store.run("INSERT INTO public_records VALUES (?,?,?,?,?) ON CONFLICT(record_id) DO UPDATE SET payload=excluded.payload,content_hash=excluded.content_hash,origin=excluded.origin,updated_at=excluded.updated_at", record.id, JSON.stringify(record), String(draft.content_hash), "cms", new Date().toISOString());
          this.store.run("INSERT OR IGNORE INTO publication_evidence VALUES (?,?,?,?,?)", record.id, String(draft.content_hash), String(draft.approved_by), record.review.reviewedAt, Number(draft.version));
          this.store.run("DELETE FROM publication_withheld WHERE record_id=?", record.id);
          enqueue(this.store, "export", `export:${String(job.id)}`, {});
          this.store.audit(String(draft.approved_by), "cms.published", record.id, "worker");
        });
      } else if (job.kind === "export") {
        check(this.config.publicationSecret.length >= 32, 503, "PUBLICATION_DISABLED", "발행 서명이 설정되지 않았습니다.");
        const rows = this.store.all("SELECT * FROM public_records WHERE origin='cms' ORDER BY record_id");
        const records = rows.map((row) => checkedPublicRecord(JSON.parse(String(row.payload)) as unknown));
        const approvals = rows.map((row) => { const evidence = this.store.get("SELECT * FROM publication_evidence WHERE record_id=? AND content_hash=?", String(row.record_id), String(row.content_hash)); check(evidence, 409, "APPROVAL_REQUIRED", "발행 승인 증거를 확인할 수 없습니다."); return { recordId: String(evidence.record_id), contentHash: String(evidence.content_hash), reviewerId: String(evidence.reviewer_id), approvedAt: String(evidence.approved_at), revision: Number(evidence.revision) }; });
        const withheldIds = this.store.all("SELECT record_id FROM publication_withheld ORDER BY record_id").map((row) => String(row.record_id));
        const contentHash = hash(JSON.stringify(records)); const generatedAt = new Date().toISOString(); const signedBody = { version: 1, generatedAt, contentHash, items: records, approvals, withheldIds };
        const payloadHash = hash(JSON.stringify(signedBody));
        const output = { ...signedBody, publication: { algorithm: "hmac-sha256", payloadHash, signature: createHmac("sha256", this.config.publicationSecret).update(payloadHash).digest("hex") } };
        await mkdir(this.config.exportDirectory, { recursive: true });
        const destination = resolve(this.config.exportDirectory, "approved.json"); const temporary = resolve(this.config.exportDirectory, `approved-${String(job.id)}.tmp`);
        await writeFile(temporary, JSON.stringify(output, null, 2), { flag: "w", mode: 0o600 }); await rename(temporary, destination);
        this.store.run("INSERT INTO artifacts VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,content_hash=excluded.content_hash,generated_at=excluded.generated_at", "latest", JSON.stringify(output), contentHash, generatedAt);
        for(const approval of approvals)addPublicationStage(this.store,{recordId:approval.recordId,revision:approval.revision,contentHash:approval.contentHash,stage:'export',artifactHash:payloadHash,observedAt:generatedAt,evidenceSource:'signed-local-export'});
      } else if (job.kind === "notification") {
        check(this.adapters.notifications.enabled, 503, "NOTIFICATION_DISABLED", "알림 공급자가 설정되지 않았습니다.");
        const event = data.event; check(event === "correction_received" || event === "correction_updated" || event === "password_reset", 400, "INVALID_JOB", "알림 작업이 올바르지 않습니다.");
        const fields = object(data.data); check(Object.values(fields).every((entry) => typeof entry === "string"), 400, "INVALID_JOB", "알림 자료가 올바르지 않습니다.");
        if (event === "password_reset") check(typeof fields.expiresAt === "string" && Date.parse(fields.expiresAt) > Date.now(), 400, "RESET_EXPIRED", "재설정 안내가 만료되었습니다.");
        await this.adapters.notifications.send({ eventId: String(job.id), event, ...(typeof data.recipient === "string" ? { recipient: data.recipient } : {}), data: fields as Record<string, string> });
        const acceptedAt=new Date().toISOString(),expiresAt=event==='password_reset'?String(fields.expiresAt):new Date(Date.now()+86400000).toISOString();this.store.run("INSERT INTO notification_deliveries VALUES (?,'accepted',NULL,?,?,?,NULL) ON CONFLICT(job_id) DO NOTHING",String(job.id),acceptedAt,acceptedAt,expiresAt);
      } else throw new AppError(400, "INVALID_JOB", "작업 유형이 올바르지 않습니다.");
      this.store.run("UPDATE jobs SET status='completed',completed_at=?,locked_at=NULL,error_code=NULL,payload=CASE WHEN kind='notification' THEN '{\"providerAccepted\":true}' ELSE payload END WHERE id=? AND status='running'", new Date().toISOString(), String(job.id));
    } catch (error) {
      const attempts = Number(job.attempts) + 1; const code = error instanceof AppError ? error.code : "WORKER_OPERATION_FAILED";
      const terminal = attempts >= 5 || ["APPROVAL_STALE", "APPROVAL_REQUIRED","KNOWLEDGE_APPROVAL_STALE","APPROVAL_REVIEWER_UNAVAILABLE","FORBIDDEN", "INVALID_JOB", "INVALID_RECORD", "NOT_PUBLIC", "RESET_EXPIRED"].includes(code);
      const redactReset = terminal && job.kind === "notification" && String(job.job_key).startsWith("reset:");
      this.store.run("UPDATE jobs SET status=?,next_at=?,locked_at=NULL,error_code=?,payload=CASE WHEN ? THEN '{\"redacted\":true}' ELSE payload END WHERE id=? AND status='running'", terminal ? "failed" : "pending", new Date(Date.now() + Math.min(300000, 1000 * 2 ** attempts)).toISOString(), code, redactReset ? 1 : 0, String(job.id));
    }
    return true;
  }
}
