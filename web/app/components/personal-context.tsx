"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseWorkspace } from "../../lib/workspace-domain";
import { workspaceKey } from "../../lib/workspace-domain";
import { parseDraftStore, draftStorageKey } from "../../lib/local-draft-storage";
import { safeInternalReturn } from "../../lib/personal-recovery";
import { sitePath } from "../site-config";
import { useShelf } from "./reading-tools";
export function LoginReturnLink({ children = "로그인" }: { children?: React.ReactNode }) { const [href, setHref] = useState("/account/"); useEffect(() => { const timer = setTimeout(() => { const current = safeInternalReturn(window.location.pathname + window.location.search, sitePath("/").replace(/\/$/, "")); setHref(current ? `/account/?returnTo=${encodeURIComponent(current)}` : "/account/"); }, 0); return () => clearTimeout(timer); }, []); return <Link href={href}>{children}</Link>; }
export function ContextReturnLink() { const [href, setHref] = useState<string | null>(null); useEffect(() => { const timer = setTimeout(() => setHref(safeInternalReturn(new URLSearchParams(window.location.search).get("returnTo"), sitePath("/").replace(/\/$/, ""))), 0); return () => clearTimeout(timer); }, []); return href ? <a href={href}>이전 작업으로 돌아가기 →</a> : null; }
export function ContextualResume() {
  const { shelf, ready, update } = useShelf(); const [items, setItems] = useState<{ title: string; href: string }[]>([]); const [message, setMessage] = useState("");
  useEffect(() => { if (!ready || !shelf.resumeConsent) return; const timer = setTimeout(() => { try { const state = parseWorkspace(localStorage.getItem(workspaceKey)); const drafts = parseDraftStore(localStorage.getItem(draftStorageKey)); setItems([...state.projects.slice(-2).reverse().map(project => ({ title: project.title || "제목 없는 연구", href: `/workspace/?project=${project.id}` })), ...state.plans.slice(-2).reverse().map(plan => ({ title: plan.title || "제목 없는 수업", href: `/teach/?plan=${plan.id}` })), ...drafts.entries.filter(item => item.scope === "workspace" || item.scope === "teach").map(item => ({ title: item.scope === "workspace" ? "작성 중인 연구 초안" : "작성 중인 수업 초안", href: item.scope === "workspace" ? "/workspace/" : "/teach/" }))]); } catch { setMessage("최근 작업을 읽지 못했습니다. 원본은 보존되어 있으며 보관함에서 백업·복구할 수 있습니다."); } }, 0); return () => clearTimeout(timer); }, [ready, shelf.resumeConsent]);
  return <section className="entryPaths" aria-label="이 기기에서 이어 하기"><div><h2>이 기기에서 이어 하기</h2><label><input type="checkbox" checked={shelf.resumeConsent === true} disabled={!ready} onChange={event => update(previous => ({ ...previous, resumeConsent: event.target.checked }))} />홈에 기기 작업 제목 표시</label><p>공용 기기에서는 끌 수 있습니다. 서버에 작업 내용을 보내지 않습니다.</p>{message ? <p role="status">{message}</p> : null}{shelf.resumeConsent ? (items.length ? <ul>{items.map((item, index) => <li key={`${item.href}-${index}`}><Link href={item.href}>{item.title}</Link></li>)}</ul> : <p>아직 이어 할 연구나 수업이 없습니다.</p>) : null}</div></section>;
}
