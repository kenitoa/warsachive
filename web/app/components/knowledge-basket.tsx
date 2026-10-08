"use client";
import Link from "next/link";
import { useState } from "react";
import { parseWorkspace, workspaceKey, type WorkspaceState } from "../../lib/workspace-domain";
import styles from "./knowledge-refinement.module.css";

export type BasketContext = { record?: string; section?: string; source?: string; locator?: string; quoteKind?: "editorial" | "source-link" };
export function WorkBasket({ records, returnTo, context }: { records: { id: string; title: string }[]; returnTo: string; context?: BasketContext }) {
  const [opened, setOpened] = useState(false); const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [destination, setDestination] = useState("research:new"); const [error, setError] = useState("");
  const [readingReturn, setReadingReturn] = useState(returnTo);
  function open() {
    setOpened(previous => !previous); setError("");
    if (context) setReadingReturn(window.location.pathname + window.location.search + window.location.hash);
    try { setWorkspace(parseWorkspace(window.localStorage.getItem(workspaceKey))); }
    catch { setWorkspace(null); setError("기기의 기존 작업 목록을 읽지 못했습니다. 기존 저장은 변경하지 않았습니다. 작업공간에서 복구할 수 있습니다."); }
  }
  const params = new URLSearchParams({ records: records.map(record => record.id).join(","), returnTo: context ? readingReturn : returnTo });
  const [kind, id] = destination.split(":");
  if (id !== "new") params.set(kind === "research" ? "project" : "plan", id);
  for (const [key, value] of Object.entries(context ?? {})) if (value) params.set(key, value);
  return <section className={styles.basket} aria-label="선택 자료 작업에 담기"><button type="button" onClick={open} disabled={!records.length} aria-expanded={opened}>작업에 담기 · {records.length}개 기록</button>{opened ? <div>
    <p>선택 자료: {records.map(record => record.title).join(" · ")}</p><p>다음 화면에서 확인하고 저장합니다. 이 버튼만으로 기존 연구나 수업을 덮어쓰지 않습니다.</p>
    {error ? <p role="alert">{error}</p> : null}
    <label>담을 작업<select value={destination} onChange={event => setDestination(event.target.value)}><option value="research:new">새 연구</option><option value="teaching:new">새 수업 경로</option>{workspace?.projects.map(project => <option key={project.id} value={`research:${project.id}`}>기존 연구 · {project.title || "제목 없음"}</option>)}{workspace?.plans.map(plan => <option key={plan.id} value={`teaching:${plan.id}`}>기존 수업 · {plan.title || "제목 없음"}</option>)}</select></label>
    <Link href={`${kind === "research" ? "/workspace/" : "/teach/"}?${params.toString()}`}>선택한 작업에서 확인하기 →</Link>
  </div> : null}</section>;
}
