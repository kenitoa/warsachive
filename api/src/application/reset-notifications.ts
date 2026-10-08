import { Store } from "../infrastructure/database.ts";

/** Call inside the same transaction that consumes, replaces or revokes reset tokens. */
export function invalidateResetNotifications(store: Store, userId: string): void {
  store.run("UPDATE jobs SET payload='{\"redacted\":true}',status=CASE WHEN status IN ('pending','running') THEN 'failed' ELSE status END,error_code='RESET_REVOKED',locked_at=NULL WHERE kind='notification' AND job_key IN (SELECT 'reset:' || token_hash FROM password_resets WHERE user_id=?)", userId);
}
