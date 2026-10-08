"use client";
import Link from "next/link";
import { LoginReturnLink } from "./personal-context";
import { useCallback, useEffect, useState } from "react";
import { apiAvailable, getApiSession, safeApiMessage, type ApiSession, type ApiScope } from "../../lib/api-client";
import { emptyWorkspace, parseWorkspace, workspaceKey, type WorkspaceState } from "../../lib/workspace-domain";

export function downloadExpansion(value: string, name: string, type = "application/json") { const url = URL.createObjectURL(new Blob([value], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState>(emptyWorkspace); const [ready, setReady] = useState(false); const [message, setMessage] = useState(""); const [blocked, setBlocked] = useState(false);
  useEffect(() => { const refresh = () => { try { setState(parseWorkspace(localStorage.getItem(workspaceKey))); setBlocked(false); } catch { setBlocked(true); setMessage("기존 작업공간이 손상되어 자동 저장을 중단했습니다. 파일로 복구하거나 기존 데이터를 먼저 보관하세요."); } setReady(true); }; const storage = (event: StorageEvent) => { if (event.key === workspaceKey) refresh(); }; refresh(); window.addEventListener("storage", storage); window.addEventListener("archive-workspace-change", refresh); return () => { window.removeEventListener("storage", storage); window.removeEventListener("archive-workspace-change", refresh); }; }, []);
  const save = useCallback((next: WorkspaceState, explicitRecovery = false): boolean => { if (blocked && !explicitRecovery) { setMessage("손상된 기존 데이터를 덮어쓰지 않았습니다. 명시적으로 복구할 파일을 선택하세요."); return false; } try { const checked = parseWorkspace(JSON.stringify(next)); localStorage.setItem(workspaceKey, JSON.stringify(checked)); setState(checked); setBlocked(false); window.dispatchEvent(new Event("archive-workspace-change")); setMessage("이 기기에 저장했습니다."); return true; } catch (error) { setMessage(error instanceof Error ? error.message : "저장할 수 없습니다. 내보내기로 현재 작업을 보관하세요."); return false; } }, [blocked]);
  return { state, ready, message, blocked, save, setMessage };
}
export function useApiSession() {
  const [session, setSession] = useState<ApiSession | null>(null); const [loading, setLoading] = useState(apiAvailable); const [error, setError] = useState("");
  const refresh = useCallback(async () => { if (!apiAvailable) return; setLoading(true); try { setSession(await getApiSession()); setError(""); } catch (problem) { setError(safeApiMessage(problem)); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [refresh]);
  return { session, loading, error, refresh, setSession };
}
export function ServiceBoundary({ children, requiredRole, requiredScope }: { children: React.ReactNode; requiredRole?: string[]; requiredScope?: ApiScope }) {
  const { session, loading, error, refresh } = useApiSession();
  if (!apiAvailable) return <section className="expansionNotice"><h2>계정 서비스 연결이 필요합니다</h2><p>이 배포에 API 주소가 설정되지 않았습니다. 기기 내 연구·수업 도구는 사용할 수 있으며 서버 저장이나 접수 완료로 표시하지 않습니다.</p><Link href="/workspace/">기기 내 연구 작업공간 →</Link></section>;
  if (loading) return <p role="status">서비스와 로그인 상태를 확인하고 있습니다.</p>;
  if (error) return <div role="status"><p>{error}</p><button type="button" onClick={() => void refresh()}>연결 다시 확인</button></div>;
  if (!session?.user) return <p><LoginReturnLink>로그인</LoginReturnLink> 후 사용할 수 있습니다. 기본 자료 열람은 로그인 없이 제공됩니다.</p>;
  if (requiredScope && session.user.scopes !== undefined) { if (!session.user.scopes.includes(requiredScope)) return <p>이 계정에 허용된 업무 범위에 이 기능이 없습니다. <Link href="/account/">계정과 추가 인증 확인 →</Link> 실제 권한은 서버에서 다시 확인합니다.</p>; }
  else if (requiredRole && !requiredRole.includes(session.user.role)) return <p>이 화면은 해당 역할의 계정에만 제공됩니다. 실제 권한은 서버에서 다시 확인합니다.</p>;
  return <>{children}</>;
}
