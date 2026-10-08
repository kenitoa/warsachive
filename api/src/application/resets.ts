import { randomBytes } from "node:crypto";
import type { Adapters } from "../adapters/contracts.ts";
import type { ApiConfig } from "../config.ts";
import { Store, hash } from "../infrastructure/database.ts";
import { hashPassword } from "../infrastructure/passwords.ts";
import { object, email, password, text } from "../domain/validation.ts";
import { check } from "../domain/errors.ts";
import { enqueue } from "./jobs.ts";
import { invalidateResetNotifications } from "./reset-notifications.ts";
export class ResetService {
  readonly store: Store; readonly adapters: Adapters; readonly config: ApiConfig;
  constructor(store: Store, adapters: Adapters, config: ApiConfig) { this.store = store; this.adapters = adapters; this.config = config; }
  enabled(): boolean { return this.config.passwordResetEnabled && this.adapters.notifications.enabled; }
  request(value: unknown, requestId: string): Record<string, unknown> {
    check(this.enabled(), 503, "PASSWORD_RESET_DISABLED", "실제 메일 전달 경로가 설정되어야 비밀번호 재설정을 사용할 수 있습니다."); const input = object(value); const address = email(input.email); const account = this.store.get("SELECT id FROM users WHERE email=? AND deactivated=0", address);
    if (account) {
      const token = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + 1200000).toISOString();
      this.store.transaction(() => { invalidateResetNotifications(this.store, String(account.id)); this.store.run("DELETE FROM password_resets WHERE user_id=?", String(account.id)); this.store.run("INSERT INTO password_resets VALUES (?,?,?,NULL)", hash(token), String(account.id), expiresAt); enqueue(this.store, "notification", `reset:${hash(token)}`, { event: "password_reset", recipient: address, data: { resetUrl: `${this.config.publicUrl}/account/#reset=${token}`, expiresAt } }); });
    }
    this.store.audit(null, "account.reset_request", null, requestId);
    return { accepted: true, message: "해당 계정이 있다면 재설정 안내를 전달합니다." };
  }
  async complete(value: unknown, requestId: string): Promise<Record<string, unknown>> {
    check(this.enabled(), 503, "PASSWORD_RESET_DISABLED", "비밀번호 재설정이 비활성 상태입니다."); const input = object(value); const tokenHash = hash(text(input.token, "재설정 코드", 100)); const encoded = await hashPassword(password(input.password));
    this.store.transaction(() => { const entry = this.store.get("SELECT * FROM password_resets WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?", tokenHash, new Date().toISOString()); check(entry, 400, "RESET_UNAVAILABLE", "재설정 코드가 유효하지 않습니다."); this.store.run("UPDATE users SET password_hash=? WHERE id=? AND deactivated=0", encoded, String(entry.user_id)); invalidateResetNotifications(this.store, String(entry.user_id)); this.store.run("UPDATE password_resets SET consumed_at=? WHERE user_id=?", new Date().toISOString(), String(entry.user_id)); this.store.run("DELETE FROM sessions WHERE user_id=?", String(entry.user_id)); this.store.audit(String(entry.user_id), "account.reset_complete", String(entry.user_id), requestId); }); return { reset: true };
  }
}
