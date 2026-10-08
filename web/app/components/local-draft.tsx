"use client";
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { draftStorageKey, parseDraftStore, writeDraft } from "../../lib/local-draft-storage";
import { downloadExpansion } from "./expansion-common";

export function useRecoveryDraft<T>(scope: string, initial: () => T, validate: (value: unknown) => T) {
  const [value, setLocalValue] = useState<T>(initial); const [ready, setReady] = useState(false); const [status, setStatus] = useState("복구 초안을 확인하고 있습니다.");
  const [error, setError] = useState(""); const [blocked, setBlocked] = useState(false); const [loadedScope, setLoadedScope] = useState(""); const revision = useRef(0); const storedEntry = useRef("null"); const latest = useRef(value); const config = useRef({ initial, validate });
  useEffect(() => { config.current = { initial, validate }; }, [initial, validate]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const store = parseDraftStore(localStorage.getItem(draftStorageKey)); const entry = store.entries.find(item => item.scope === scope); revision.current = entry?.revision ?? 0; storedEntry.current = JSON.stringify(entry ?? null);
        const next = entry ? config.current.validate(entry.payload) : config.current.initial(); latest.current = next; setLocalValue(next); setBlocked(false); setError(""); setStatus(entry ? "복구용 초안을 다시 열었습니다. 작업 저장과 서버 반영은 별도입니다." : "입력하면 이 기기에 복구용 초안을 저장합니다.");
      } catch { setBlocked(true); setStatus("기존 복구 초안 확인 실패 · 자동 저장 중단"); setError("기존 복구 초안을 읽지 못했습니다. 원본을 유지하고 자동 저장을 중단했습니다."); }
      setLoadedScope(scope); setReady(true);
    }, 0);
    const changed = () => { try { const entry = parseDraftStore(localStorage.getItem(draftStorageKey)).entries.find(item => item.scope === scope); if (JSON.stringify(entry ?? null) !== storedEntry.current) { setBlocked(true); setError("다른 탭이나 가져오기로 복구 초안이 변경되었습니다. 현재 입력을 먼저 내보내세요."); } } catch { setBlocked(true); setError("복구 초안이 변경되었지만 읽지 못했습니다. 현재 입력과 기존 원본을 보관하세요."); } };
    const storageChanged = (event: StorageEvent) => { if (event.key === draftStorageKey || event.key === null) changed(); };
    window.addEventListener("archive-local-data-change", changed); window.addEventListener("storage", storageChanged); return () => { clearTimeout(timer); window.removeEventListener("archive-local-data-change", changed); window.removeEventListener("storage", storageChanged); };
  }, [scope]);
  const setValue = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === "function" ? (action as (previous: T) => T)(latest.current) : action;
    latest.current = next; setLocalValue(next);
    if (!ready || loadedScope !== scope || blocked) { setError("입력은 화면에 남아 있지만 복구 초안에 저장하지 못했습니다. 현재 초안을 내보내세요."); return false; }
    try { const checked = config.current.validate(next); const current = parseDraftStore(localStorage.getItem(draftStorageKey)); if (JSON.stringify(current.entries.find(item => item.scope === scope) ?? null) !== storedEntry.current) throw new Error("복구 초안의 다른 사본이 반영되었습니다. 현재 입력을 보관하고 다른 사본을 확인하세요."); const store = writeDraft(current, scope, checked, revision.current, new Date().toISOString()); localStorage.setItem(draftStorageKey, JSON.stringify(store)); const entry = store.entries.find(item => item.scope === scope)!; revision.current = entry.revision; storedEntry.current = JSON.stringify(entry); setError(""); setStatus("복구용 초안 저장됨 · 작업 저장과 서버 반영은 별도입니다."); return true; }
    catch (problem) { setError(problem instanceof Error ? problem.message : "초안을 저장하지 못했습니다. 현재 입력을 내보내세요."); setStatus("복구 초안 저장 실패"); return false; }
  }, [blocked, ready, loadedScope, scope]);
  const discard = useCallback(() => {
    try { const store = parseDraftStore(localStorage.getItem(draftStorageKey)); const remaining = { ...store, entries: store.entries.filter(item => item.scope !== scope) }; localStorage.setItem(draftStorageKey, JSON.stringify(remaining)); revision.current = 0; storedEntry.current = "null"; const next = config.current.initial(); latest.current = next; setLocalValue(next); setError(""); setBlocked(false); setStatus("이 작업의 복구 초안을 비웠습니다. 저장한 작업은 유지됩니다."); }
    catch { setError("손상된 원본을 먼저 보관하고 보관함의 범위별 기기 삭제에서 복구 초안만 정리하세요."); }
  }, [scope]);
  const exportCurrent = useCallback(() => downloadExpansion(JSON.stringify({ type: "archive-recovery-draft", version: 1, scope, payload: latest.current }, null, 2), "current-recovery-draft.json"), [scope]);
  const importCurrent = useCallback((raw: string) => { try { if (raw.length > 2000000) throw new Error("초안 파일은 2MB 이하만 읽습니다."); const supplied: unknown = JSON.parse(raw); if (!supplied || typeof supplied !== "object" || !("type" in supplied) || supplied.type !== "archive-recovery-draft" || !("version" in supplied) || supplied.version !== 1 || !("scope" in supplied) || supplied.scope !== scope || !("payload" in supplied)) throw new Error("현재 작업 종류와 같은 복구 초안 파일을 선택하세요."); const checked = config.current.validate(supplied.payload); if (!window.confirm("파일의 초안으로 현재 편집 화면을 바꿀까요? 현재 입력이 필요하면 먼저 내보내세요.")) return; setValue(checked); } catch (problem) { setError(problem instanceof Error ? problem.message : "초안을 읽지 못했습니다."); } }, [scope, setValue]);
  return { value: loadedScope === scope ? value : initial(), setValue, ready: ready && loadedScope === scope, status, error, blocked, discard, exportCurrent, importCurrent };
}
export function RecoveryStatus({ status, error, exportCurrent, importCurrent }: { status: string; error: string; exportCurrent: () => void; importCurrent?: (raw: string) => void }) {
  return <aside className="expansionNotice" aria-label="복구 초안 상태"><p role="status">{status}</p>{error ? <p role="alert">{error}</p> : null}<details><summary>현재 입력 파일로 보관·복구</summary><button type="button" onClick={exportCurrent}>현재 초안 내보내기</button>{importCurrent ? <label>현재 작업 복구 초안 파일<input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) { if (file.size > 2000000) importCurrent(" ".repeat(2000001)); else void file.text().then(importCurrent).catch(() => importCurrent("")); } }}/></label> : null}</details></aside>;
}
