import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { ApiConfig } from "../config.ts";
import { Store, hash } from "../infrastructure/database.ts";
import { hashPassword, verifyPassword } from "../infrastructure/passwords.ts";
import { check } from "../domain/errors.ts";
import { email, text, password, object, credential } from "../domain/validation.ts";
import { legacyScopes,requirePermission,type Scope } from "../domain/permissions.ts";
import { recoveryEvent } from "./security.ts";
import { invalidateResetNotifications } from "./reset-notifications.ts";
export type UserRole = "member" | "editor" | "reviewer" | "publisher" | "admin";
export type User = { id: string; email: string; name: string; role: UserRole; scopes?: import('../domain/permissions.ts').Scope[] };
export type Session = { token: string; csrfToken: string; user: User | null };
const roles: UserRole[] = ["member", "editor", "reviewer", "publisher", "admin"];
export function requireUser(user: User | null): User { check(user, 401, "AUTH_REQUIRED", "로그인이 필요합니다."); return user; }
export function requireRole(user: User | null, allowed: UserRole[]): User { const account = requireUser(user); check(account.role === "admin" || allowed.includes(account.role), 403, "FORBIDDEN", "이 작업의 권한이 없습니다."); return account; }
export class AuthService {
  readonly store: Store; readonly config: ApiConfig;
  constructor(store: Store, config: ApiConfig) { this.store = store; this.config = config; }
  csrf(token: string): string { return createHmac("sha256", this.config.sessionSecret).update(`csrf:${token}`).digest("hex"); }
  createSession(user: User | null, oldToken?: string): Session {
    const token = randomBytes(32).toString("base64url"); const now = new Date();
    this.store.transaction(() => {
      if (oldToken) this.store.run("DELETE FROM sessions WHERE token_hash=?", hash(oldToken));
      this.store.run("INSERT INTO sessions VALUES (?,?,?,?)", hash(token), user?.id ?? null, new Date(now.getTime() + (user ? this.config.sessionHours * 3600000 : 1800000)).toISOString(), now.toISOString());
    });
    if(user){const setting=this.store.get("SELECT scopes FROM user_scope_settings WHERE user_id=?",user.id);if(setting)user={...user,scopes:JSON.parse(String(setting.scopes)) as import("../domain/permissions.ts").Scope[]};}
    return { token, csrfToken: this.csrf(token), user };
  }
  session(token: string | undefined): Session | null {
    if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
    const entry = this.store.get("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?", hash(token), new Date().toISOString());
    if (!entry) return null;
    let user: User | null = null;
    if (typeof entry.user_id === "string") {
      const account = this.store.get("SELECT id,email,name,role FROM users WHERE id=? AND deactivated=0", entry.user_id);
      if (!account) return null;
      user = { id: String(account.id), email: String(account.email), name: String(account.name), role: account.role as UserRole };
      const setting=this.store.get('SELECT scopes FROM user_scope_settings WHERE user_id=?',user.id);if(setting)user.scopes=JSON.parse(String(setting.scopes)) as import('../domain/permissions.ts').Scope[];
    }
    return { token, csrfToken: this.csrf(token), user };
  }
  verifyCsrf(session: Session | null, token: string | undefined): void {
    check(session && typeof token === "string" && /^[a-f0-9]{64}$/.test(token), 403, "CSRF_REJECTED", "요청 확인값이 필요합니다.");
    check(timingSafeEqual(Buffer.from(session.csrfToken), Buffer.from(token)), 403, "CSRF_REJECTED", "요청 확인값이 올바르지 않습니다.");
  }
  async register(value: unknown, oldToken: string, requestId: string): Promise<Session> {
    const input = object(value); const address = email(input.email); const name = text(input.name, "이름", 100); const pass = password(input.password);
    const encoded = await hashPassword(pass); const id = randomUUID();
    check(!this.store.get("SELECT id FROM users WHERE email=?", address), 409, "REGISTRATION_UNAVAILABLE", "이 정보로 계정을 만들 수 없습니다.");
    this.store.run("INSERT INTO users VALUES (?,?,?,?,?,?,0)", id, address, name, encoded, "member", new Date().toISOString());
    this.store.audit(id, "account.register", id, requestId);
    return this.createSession({ id, email: address, name, role: "member" }, oldToken);
  }
  async login(value: unknown, oldToken: string, requestId: string): Promise<Session> {
    const input = object(value); const address = email(input.email); const pass = credential(input.password);
    const account = this.store.get("SELECT * FROM users WHERE email=? AND deactivated=0", address);
    const valid = await verifyPassword(pass, account ? String(account.password_hash) : "disabled");
    if (!account || !valid) { this.store.audit(null, "account.login", null, requestId, "denied"); check(false, 401, "INVALID_CREDENTIALS", "로그인 정보를 확인해 주세요."); }
    const user: User = { id: String(account.id), email: String(account.email), name: String(account.name), role: account.role as UserRole };
    this.store.audit(user.id, "account.login", user.id, requestId);
    return this.createSession(user, oldToken);
  }
  logout(session: Session, requestId: string): Session {
    this.store.audit(session.user?.id ?? null, "account.logout", session.user?.id ?? null, requestId);
    return this.createSession(null, session.token);
  }
  async changePassword(user: User | null, value: unknown, token: string, requestId: string): Promise<Session> {
    const account = requireUser(user); const input = object(value);
    const row = this.store.get("SELECT password_hash FROM users WHERE id=?", account.id);
    check(row && await verifyPassword(credential(input.currentPassword), String(row.password_hash)), 401, "INVALID_CREDENTIALS", "현재 비밀번호를 확인해 주세요.");
    const encoded = await hashPassword(password(input.password));
    this.store.transaction(() => { this.store.run("UPDATE users SET password_hash=? WHERE id=?", encoded, account.id); this.store.run("DELETE FROM sessions WHERE user_id=?", account.id); invalidateResetNotifications(this.store, account.id); this.store.run("DELETE FROM password_resets WHERE user_id=?", account.id); this.store.audit(account.id, "account.password_change", account.id, requestId); });
    return this.createSession(account, token);
  }
  setRole(actor: User | null, userId: string, value: unknown, requestId: string): User {
    const admin = requirePermission(actor,'security:manage');
    const input = object(value); check(roles.includes(input.role as UserRole), 400, "INVALID_INPUT", "역할을 확인해 주세요.");
    const target = this.store.get("SELECT * FROM users WHERE id=? AND deactivated=0", userId); check(target, 404, "RESOURCE_NOT_FOUND", "계정을 찾을 수 없습니다.");
    if (target.role === "admin" && input.role !== "admin") check(Number(this.store.get("SELECT count(*) AS count FROM users WHERE role='admin' AND deactivated=0")?.count) > 1, 409, "LAST_ADMIN", "마지막 관리자를 해제할 수 없습니다.");
    const existingScopes=this.store.get('SELECT scopes FROM user_scope_settings WHERE user_id=?',userId),newScopes=existingScopes?(JSON.parse(String(existingScopes.scopes)) as Scope[]).filter(scope=>legacyScopes(input.role as UserRole).includes(scope)):null;
    this.store.transaction(() => { this.store.run("UPDATE users SET role=? WHERE id=?", String(input.role), userId);if(newScopes)this.store.run('UPDATE user_scope_settings SET scopes=?,updated_at=? WHERE user_id=?',JSON.stringify(newScopes),new Date().toISOString(),userId); this.store.run("DELETE FROM sessions WHERE user_id=?", userId); recoveryEvent(this.store,"role",userId,{role:input.role,scopes:newScopes}); this.store.audit(admin.id, "account.role_change", userId, requestId); });
    return { id: userId, name: String(target.name), email: String(target.email), role: input.role as UserRole };
  }
  async bootstrapAdmin(address: string, name: string, pass: string): Promise<User> {
    const normalized = email(address); const display = text(name, "이름", 100); const encoded = await hashPassword(password(pass));
    check(!this.store.get("SELECT id FROM users WHERE role='admin' AND deactivated=0"), 409, "ADMIN_EXISTS", "최초 관리자는 이미 생성되었습니다.");
    const id = randomUUID();
    this.store.transaction(() => { this.store.run("INSERT INTO users VALUES (?,?,?,?,?,?,0)", id, normalized, display, encoded, "admin", new Date().toISOString()); this.store.audit(id, "account.bootstrap_admin", id, "cli"); });
    return { id, email: normalized, name: display, role: "admin" };
  }
  exportAccount(user: User | null): Record<string, unknown> {
    const account = requireUser(user);
    return {
      user: account,
      shelf: this.store.get("SELECT version,payload,updated_at FROM shelves WHERE user_id=?", account.id) ?? null,
      workspaces: this.store.all("SELECT id,version,payload,updated_at FROM workspaces WHERE user_id=?", account.id),
      corrections: this.store.all("SELECT id,record_id,category,proposal,evidence_url,status,created_at,updated_at FROM corrections WHERE user_id=?", account.id),
      submissions: this.store.all("SELECT id,task_id,version,payload,feedback,updated_at FROM submissions WHERE user_id=?", account.id),
      orders: this.store.all("SELECT id,product_id,amount_minor,currency,status,refunded_minor,created_at,updated_at FROM orders WHERE user_id=?", account.id),
      refundRequests: this.store.all("SELECT r.id,r.order_id,r.amount_minor,r.status,n.reason,n.updated_at FROM refund_requests r JOIN orders o ON o.id=r.order_id LEFT JOIN refund_notes n ON n.request_id=r.id WHERE o.user_id=?", account.id),
      memberships: this.store.all("SELECT m.space_id,m.role,s.kind,s.title,s.owner_id FROM space_members m JOIN spaces s ON s.id=m.space_id WHERE m.user_id=?", account.id),
      ownedSpaces: this.store.all("SELECT id,kind,title,description,version,payload,updated_at FROM spaces WHERE owner_id=?", account.id),
      serviceRequests: this.store.all('SELECT id,version,title,audience,deliverables,rights,deadline,status,quote_note,evidence,created_at,updated_at FROM service_requests WHERE user_id=?',account.id),
      fulfillment: this.store.all('SELECT f.order_id,f.version,f.status,f.delivery_note,f.delivery_url,f.updated_at,f.confirmed_at FROM order_fulfillments f JOIN orders o ON o.id=f.order_id WHERE o.user_id=?',account.id),
      submissionHistory: this.store.all('SELECT h.submission_id,h.version,h.task_version,h.payload,h.created_at FROM submission_history h JOIN submissions s ON s.id=h.submission_id WHERE s.user_id=?',account.id),
      feedbackHistory: this.store.all('SELECT h.submission_id,h.submission_version,h.feedback_version,h.feedback,h.created_at FROM feedback_history h JOIN submissions s ON s.id=h.submission_id WHERE s.user_id=?',account.id),
      attachments: this.store.all("SELECT id AS attachmentId,record_id AS recordId,source_id AS sourceId,content_type AS contentType,size,sha256,rights,created_at AS createdAt FROM attachments WHERE owner_id=?", account.id)
    };
  }
  async deleteAccount(user: User | null, value: unknown, requestId: string): Promise<void> {
    const account = requireUser(user); const input = object(value); const row = this.store.get("SELECT password_hash FROM users WHERE id=?", account.id);
    check(row && await verifyPassword(credential(input.password), String(row.password_hash)), 401, "INVALID_CREDENTIALS", "비밀번호를 확인해 주세요.");
    if (account.role === "admin") check(Number(this.store.get("SELECT count(*) AS count FROM users WHERE role='admin' AND deactivated=0")?.count) > 1, 409, "LAST_ADMIN", "다른 관리자를 지정해야 합니다.");
    check(!this.store.get("SELECT s.id FROM spaces s JOIN space_members m ON m.space_id=s.id WHERE s.owner_id=? AND m.user_id<>? LIMIT 1", account.id, account.id), 409, "OWNERSHIP_TRANSFER_REQUIRED", "공동 공간의 소유권을 먼저 이전해 주세요.");
    this.store.transaction(() => {
      invalidateResetNotifications(this.store, account.id);
      this.store.run("DELETE FROM sessions WHERE user_id=?", account.id); this.store.run("DELETE FROM password_resets WHERE user_id=?", account.id); this.store.run("DELETE FROM shelves WHERE user_id=?", account.id); this.store.run("DELETE FROM workspaces WHERE user_id=?", account.id); this.store.run("DELETE FROM submissions WHERE user_id=?", account.id); this.store.run("DELETE FROM spaces WHERE owner_id=?", account.id); this.store.run("DELETE FROM space_members WHERE user_id=?", account.id); this.store.run("UPDATE corrections SET user_id=NULL,contact_email=NULL WHERE user_id=?", account.id);
      this.store.run("UPDATE users SET deactivated=1,email=?,name='탈퇴 사용자',password_hash='disabled' WHERE id=?", `deleted-${account.id}@invalid.local`, account.id); recoveryEvent(this.store,"delete-account",account.id,{}); this.store.run("DELETE FROM user_mfa WHERE user_id=?",account.id); this.store.audit(account.id, "account.delete", account.id, requestId);
    });
  }
}
