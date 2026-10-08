"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ArchiveRecord } from "../../lib/archive-types";
import { emptyShelf, incrementMetric, parseShelf, recordVisit, setNote, shelfKey, toggleBookmark, type ShelfState } from "../../lib/shelf-storage";
import { LocalDataManager } from "./local-data-manager";
import { safeReturnPath } from "../../lib/search";

const shelfEvent = "archive-shelf-change";
let memoryShelf = emptyShelf();
let memoryOnly = false;
function currentShelf(): ShelfState {
  if (memoryOnly) return memoryShelf;
  return parseShelf(window.localStorage.getItem(shelfKey));
}
export function useShelf() {
  const [shelf, setShelf] = useState<ShelfState>(emptyShelf);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    const refresh = () => {
      try { const next = currentShelf(); memoryShelf = next; setShelf(next); setWarning(memoryOnly ? "브라우저 저장이 제한되어 현재 화면에서만 유지됩니다. 내보내기로 보관할 수 있습니다." : ""); }
      catch { setShelf(memoryShelf); setWarning("저장 데이터를 읽을 수 없습니다. 기존 데이터는 덮어쓰지 않습니다. 다른 파일을 가져와 복구하거나 브라우저 저장 설정을 확인하세요."); }
      setReady(true);
    };
    const onStorage = (event: StorageEvent) => { if (event.key === shelfKey || event.key === null) refresh(); };
    refresh(); window.addEventListener("storage", onStorage); window.addEventListener(shelfEvent, refresh);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(shelfEvent, refresh); };
  }, []);
  const update = useCallback((change: (previous: ShelfState) => ShelfState, replace = false): boolean => {
    try {
      let previous = memoryShelf;
      if (!replace) {
        try { previous = currentShelf(); }
        catch (error) {
          if (error instanceof SyntaxError || (error instanceof Error && error.name !== "SecurityError" && error.name !== "QuotaExceededError")) throw error;
          memoryOnly = true;
        }
      }
      const next = parseShelf(JSON.stringify(change(previous)));
      try { window.localStorage.setItem(shelfKey, JSON.stringify(next)); memoryOnly = false; }
      catch { memoryOnly = true; }
      memoryShelf = next; setShelf(next); window.dispatchEvent(new Event(shelfEvent));
      setWarning(memoryOnly ? "브라우저 저장이 제한되어 현재 화면에서만 유지됩니다. 내보내기로 보관할 수 있습니다." : "");
      return true;
    } catch (error) { setWarning(error instanceof Error ? error.message : "저장 작업을 완료할 수 없습니다."); return false; }
  }, []);
  return { shelf, ready, warning, update };
}
export function BookmarkButton({ id }: { id: string }) {
  const { shelf, ready, warning, update } = useShelf();
  const saved = shelf.bookmarks.includes(id);
  return <span className="bookmarkControl"><button type="button" disabled={!ready} aria-pressed={saved} onClick={() => update(previous => incrementMetric(toggleBookmark(previous, id), "bookmark"))}>{saved ? "저장 해제" : "기록 저장"}</button>{warning ? <small role="status">{warning}</small> : null}</span>;
}
export function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  const { update } = useShelf();
  return <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => update(previous => incrementMetric(previous, "source_open"))}>{children}<span className="srOnly"> (새 창)</span></a>;
}
export function RelatedRecordLink({ href, children }: { href: string; children: React.ReactNode }) {
  const { update } = useShelf();
  return <Link href={href} onClick={() => update(previous => incrementMetric(previous, "related_open"))}>{children}</Link>;
}
const subscribeLocation = (callback: () => void) => { window.addEventListener("popstate", callback); return () => window.removeEventListener("popstate", callback); };
function useLocationSearch() { return useSyncExternalStore(subscribeLocation, () => window.location.search, (): string | null => null); }
export function ReturnToResults({ basePath = "", detailPaths = [] }: { basePath?: string; detailPaths?: string[] }) {
  const search = useLocationSearch();
  if (search === null) return <span className="secondaryAction" role="status">복귀 경로를 확인하고 있습니다.</span>;
  const href = safeReturnPath(new URLSearchParams(search).get("returnTo"), basePath, detailPaths) ?? `${basePath}/archive/`;
  // The validated URL includes the public prefix; Next Link adds that prefix itself.
  const applicationHref = basePath ? href.slice(basePath.length) : href;
  const returningToWork = href.startsWith(`${basePath}/workspace/`) || href.startsWith(`${basePath}/teach/`);
  return <Link className="secondaryAction" href={applicationHref}>{returningToWork ? "작업으로 돌아가기" : "목록으로 돌아가기"}</Link>;
}
function downloadFile(value: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ReadingTools({ record, publicPath }: { record: ArchiveRecord; publicPath: string }) {
  const { shelf, ready, warning, update } = useShelf();
  const [message, setMessage] = useState("");
  const [copyText, setCopyText] = useState("");
  const [note, setNoteText] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [sensitiveVisible, setSensitiveVisible] = useState(!record.sensitivity);
  const visited = useRef("");
  useEffect(() => {
    if (!ready || visited.current === record.id) return;
    visited.current = record.id;
    const previous = shelf.recent.find(item => item.id === record.id);
    update(state => incrementMetric(recordVisit(state, record.id, previous?.sectionId ?? ""), "record_open"));
  }, [ready, record.id, shelf.recent, update]);
  useEffect(() => { document.documentElement.style.setProperty("--reading-scale", String(shelf.fontScale)); }, [shelf.fontScale]);
  const storedNote = shelf.notes[record.id] ?? "";
  const noteValue = noteDirty ? note : storedNote;
  const previousPosition = shelf.recent.find(item => item.id === record.id)?.sectionId;
  async function copy(value: string, success: string) {
    try { await navigator.clipboard.writeText(value); setMessage(success); setCopyText(""); return true; }
    catch { setCopyText(value); setMessage("자동 복사가 제한되었습니다. 아래 내용을 선택해 복사하세요."); return false; }
  }
  const citation = () => `${record.title}. 전쟁 역사 아카이브. 수정 ${record.updatedAt.slice(0, 10)}. ${window.location.origin}${publicPath} (열람 ${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })}).`;
  async function share() {
    const url = `${window.location.origin}${publicPath}`;
    if (navigator.share) {
      try { await navigator.share({ title: record.title, url }); setMessage("공유 창에서 작업을 완료했습니다."); }
      catch (error) { if (!(error instanceof Error && error.name === "AbortError")) await copy(url, "기록 주소를 복사했습니다."); }
    } else await copy(url, "기록 주소를 복사했습니다.");
  }
  return <section className="readingTools" aria-label="읽기와 개인 저장 도구">
    <div className="readingToolActions"><BookmarkButton id={record.id} /><button type="button" onClick={async () => { if (await copy(citation(), "인용 정보를 복사했습니다.")) update(state => incrementMetric(state, "citation_copy")); }}>인용 복사</button><button type="button" onClick={share}>링크 공유</button><button type="button" onClick={() => window.print()}>인쇄</button><Link href="/saved/">보관함·비교</Link></div>
    <label className="fontSelector">글자 크기 <select value={shelf.fontScale} disabled={!ready} onChange={event => update(state => ({ ...state, fontScale: Number(event.target.value) }))}><option value={0.9}>작게</option><option value={1}>기본</option><option value={1.15}>크게</option><option value={1.3}>더 크게</option></select></label>
    {previousPosition ? <button type="button" onClick={() => { const section = document.getElementById(previousPosition); if (section) { section.scrollIntoView({ behavior: "instant" }); section.focus(); } else setMessage("이전 읽기 위치의 항목이 수정되었습니다. 목차에서 다시 선택하세요."); }}>읽던 위치로 이동</button> : null}
    <p className="toolMessage" role="status">{message || "저장과 메모는 이 브라우저에 보관됩니다. 다른 기기와 자동 동기화되지 않습니다."}{warning ? <span> {warning}</span> : null}</p>
    {copyText ? <label className="manualCopy">직접 복사할 내용<textarea readOnly value={copyText} onFocus={event => event.currentTarget.select()} /></label> : null}
    {record.sensitivity ? <div className="sensitivityNotice"><p>{record.sensitivity}</p><button type="button" aria-pressed={sensitiveVisible} onClick={() => setSensitiveVisible(value => !value)}>{sensitiveVisible ? "민감 자료 안내 닫기" : "민감 자료 안내 확인"}</button>{sensitiveVisible ? <p>외부 원문은 해당 기관의 열람 기준을 따릅니다. 이미지·영상은 이 화면에서 자동 재생하지 않습니다.</p> : null}</div> : null}
    <details className="personalNote"><summary>내 메모</summary><label>이 기록에 남길 메모<textarea maxLength={4000} value={noteValue} onChange={event => { setNoteText(event.target.value); setNoteDirty(true); }} /></label><p>{noteValue.length}/4,000자 · 서버로 전송하지 않습니다.</p><button type="button" disabled={!ready} onClick={() => { if (update(state => setNote(state, record.id, noteValue))) { setNoteDirty(false); setMessage("메모를 저장했습니다."); } }}>메모 저장</button></details>
  </section>;
}
export function SaveReadingPosition({ recordId, sectionId }: { recordId: string; sectionId: string }) {
  const { ready, update } = useShelf(); const [message, setMessage] = useState("");
  return <span className="readingPosition"><button type="button" disabled={!ready} onClick={() => { if (update(state => recordVisit(state, recordId, sectionId))) setMessage("읽기 위치 저장됨"); }}>여기까지 읽음</button><small role="status">{message}</small></span>;
}
export function ShelfManager({ records, retainedIds = [], basePath = "" }: { records: ArchiveRecord[]; retainedIds?: string[]; basePath?: string }) {
  const { shelf, ready, warning, update } = useShelf();
  const [selectedOverride, setSelected] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const search = useLocationSearch();
  const ids = (new URLSearchParams(search ?? "").get("compare") ?? "").split(",").filter(id => records.some(record => record.id === id)).slice(0, 3);
  const selected = selectedOverride ?? [...new Set(ids)];
  const byId = new Map(records.map(record => [record.id, record]));
  const bookmarked = shelf.bookmarks.map(id => byId.get(id)).filter((record): record is ArchiveRecord => !!record);
  const compared = selected.map(id => byId.get(id)).filter((record): record is ArchiveRecord => !!record);
  const unavailable = shelf.bookmarks.filter(id => !byId.has(id));
  const pendingId = unavailable.find(id => retainedIds.includes(id));
  const recent = shelf.recent.filter(item => byId.has(item.id));
  function select(id: string) {
    const next = selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id].slice(0, 3);
    setSelected(next); const url = new URL(window.location.href); if (next.length) url.searchParams.set("compare", next.join(",")); else url.searchParams.delete("compare"); window.history.replaceState(null, "", url.pathname + url.search);
  }
  async function importShelf(file?: File) {
    if (!file) return;
    if (file.size > 600000) { setMessage("가져올 파일은 600KB 이하의 보관함 JSON이어야 합니다."); return; }
    try {
      const imported = parseShelf(await file.text());
      if (!window.confirm("이 파일의 보관함과 메모로 현재 보관함을 교체할까요? 먼저 내보내기로 현재 데이터를 보관할 수 있습니다.")) return;
      if (update(() => imported, true)) setMessage("보관함을 가져왔습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "파일을 가져올 수 없습니다."); }
  }
  return <div className="shelfManager">
    <div className="shelfActions"><button type="button" disabled={!ready} onClick={() => downloadFile(JSON.stringify(shelf, null, 2), "archive-shelf.json")}>보관함·메모 내보내기</button><label className="fileImport">보관함 가져오기<input type="file" accept="application/json,.json" onChange={event => { void importShelf(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
    <p role="status">{message || "이 브라우저의 저장 기록과 메모입니다. 내보내기 파일에는 개인 메모가 포함됩니다."}{warning ? <span> {warning}</span> : null}</p>
    <section aria-labelledby="bookmarks-title"><h2 id="bookmarks-title">저장한 기록 {bookmarked.length}개</h2>{bookmarked.length ? <ul className="shelfList">{bookmarked.map(record => <li key={record.id}><Link href={`/archive/${record.id}/?returnTo=${encodeURIComponent(`${basePath}/saved/`)}`}>{record.title}</Link><span>{record.period}</span><BookmarkButton id={record.id} /><button type="button" aria-pressed={selected.includes(record.id)} disabled={!selected.includes(record.id) && selected.length >= 3} onClick={() => select(record.id)}>{selected.includes(record.id) ? "비교 해제" : "비교 선택"}</button>{shelf.notes[record.id] ? <p className="savedNote">{shelf.notes[record.id]}</p> : null}</li>)}</ul> : <p>상세 화면의 ‘기록 저장’으로 다시 읽을 기록을 모아보세요. <Link href="/archive/">기록 찾기 →</Link></p>}{unavailable.length ? <p>현재 공개 목록에 없는 저장 기록 {unavailable.length}개가 있습니다. 저장 정보와 메모는 보존됩니다. {pendingId ? <Link href={`/archive/${pendingId}/`}>기존 기록 검토 안내</Link> : "다른 사이트 또는 존재하지 않는 ID가 포함되었을 수 있습니다."}</p> : null}</section>
    <section aria-labelledby="recent-title"><h2 id="recent-title">최근 열람</h2><ul className="shelfList">{recent.map(item => <li key={item.id}><Link href={`/archive/${item.id}/`}>{byId.get(item.id)?.title}</Link><span>{new Date(item.visitedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })}</span>{item.sectionId ? <Link href={`/archive/${item.id}/#${item.sectionId}`}>읽던 위치</Link> : null}</li>)}</ul>{!recent.length ? <p>현재 공개 기록의 열람 이력이 없습니다. 기록을 읽으면 이곳에서 다시 찾을 수 있습니다.</p> : <button type="button" onClick={() => { if (window.confirm("이 브라우저의 최근 열람 기록을 지울까요? 저장 기록과 메모는 유지됩니다.")) update(state => ({ ...state, recent: [] })); }}>최근 열람 지우기</button>}</section>
    <section aria-labelledby="notes-title"><h2 id="notes-title">개인 메모</h2>{Object.keys(shelf.notes).length ? <ul className="shelfList">{Object.entries(shelf.notes).map(([id, text]) => <li key={id}>{byId.has(id) || retainedIds.includes(id) ? <Link href={`/archive/${id}/`}>{byId.get(id)?.title ?? id}</Link> : <strong>{id} · 미확인 기록</strong>}<p className="savedNote">{text}</p><button type="button" onClick={() => { if (window.confirm("이 기록의 개인 메모를 지울까요?")) update(state => setNote(state, id, "")); }}>이 메모 지우기</button></li>)}</ul> : <p>상세 화면에서 남긴 메모를 여기에서 확인하고 정리할 수 있습니다.</p>}</section>
    <section aria-labelledby="compare-title"><h2 id="compare-title">자료 비교</h2><p>최대 세 개 기록의 시기, 설명, 근거와 한계를 나란히 확인합니다. 선택 주소에는 개인 메모가 포함되지 않습니다.</p><label>비교할 기록 찾기<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="compareChoices">{records.filter(record => record.title.toLocaleLowerCase("ko").includes(query.toLocaleLowerCase("ko"))).map(record => <button key={record.id} type="button" aria-pressed={selected.includes(record.id)} disabled={!selected.includes(record.id) && selected.length >= 3} onClick={() => select(record.id)}>{record.title}</button>)}</div>{compared.length ? <div className="compareOverflow"><table><caption>선택한 기록 비교</caption><thead><tr><th scope="col">항목</th>{compared.map(record => <th scope="col" key={record.id}><Link href={`/archive/${record.id}/`}>{record.title}</Link></th>)}</tr></thead><tbody><tr><th scope="row">시기·지역</th>{compared.map(record => <td key={record.id}>{record.period} · {record.region}</td>)}</tr><tr><th scope="row">개요</th>{compared.map(record => <td key={record.id}>{record.summary}</td>)}</tr><tr><th scope="row">근거</th>{compared.map(record => <td key={record.id}>{record.sources.map(source => <p key={source.id}><SourceLink href={source.url}>{source.title}</SourceLink></p>)}</td>)}</tr><tr><th scope="row">확인 범위</th>{compared.map(record => <td key={record.id}>{record.limitations.join(" ")}</td>)}</tr></tbody></table></div> : <p>기록을 선택하면 비교 표가 표시됩니다.</p>}</section>
    <section aria-labelledby="metrics-title"><h2 id="metrics-title">이 기기의 이용 집계</h2><label><input type="checkbox" checked={shelf.metricsConsent} disabled={!ready} onChange={event => update(state => ({ ...state, metricsConsent: event.target.checked, metrics: event.target.checked ? state.metrics : {} }))} /> 검색·열람·출처 확인 횟수를 이 브라우저에만 집계</label><p>선택 사항입니다. 검색어 원문, 개인 메모와 이용 횟수를 외부로 전송하지 않습니다. 끄면 집계가 지워집니다.</p>{shelf.metricsConsent ? <dl className="localMetrics">{Object.entries(shelf.metrics).map(([key, count]) => <div key={key}><dt>{({ search: "검색", no_results: "결과 없음", record_open: "기록 열람", source_open: "출처 열람", related_open: "관련 기록", bookmark: "저장 변경", citation_copy: "인용 복사" } as Record<string, string>)[key]}</dt><dd>{count}</dd></div>)}</dl> : null}</section>
    <LocalDataManager />
  </div>;
}
export function CorrectionForm({ recordId, recordTitle }: { recordId: string; recordTitle: string }) {
  const [message, setMessage] = useState("");
  return <details className="correctionForm"><summary>정정 제안 작성</summary><p>문제 항목과 근거를 파일로 정리합니다. 이 화면은 서버에 제보를 접수하지 않습니다. 운영자가 실제 문의 창구를 제공한 경우 파일을 그 경로로 전달하세요.</p><form onSubmit={event => {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const problem = String(values.get("problem") ?? "").trim(); const evidence = String(values.get("evidence") ?? "").trim();
    if (problem.length < 10) { setMessage("문제 내용을 10자 이상 구체적으로 작성하세요."); return; }
    try { const url = new URL(evidence); if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch { setMessage("근거는 공개된 http 또는 https 자료 주소를 입력하세요."); return; }
    downloadFile(JSON.stringify({ version: 1, recordId, recordTitle, recordUrl: window.location.origin + window.location.pathname, section: String(values.get("section") ?? "").trim(), problem, suggestion: String(values.get("suggestion") ?? "").trim(), evidence, draftedAt: new Date().toISOString(), status: "draft" }, null, 2), `correction-${recordId}.json`);
    setMessage("정정 제안 파일을 만들었습니다. 접수는 아직 이루어지지 않았습니다.");
  }}><label>문제 항목<input name="section" maxLength={100} placeholder="예: 사건 시기, 배경 설명" /></label><label>문제 내용<textarea name="problem" minLength={10} maxLength={2000} required /></label><label>수정 제안<textarea name="suggestion" maxLength={2000} /></label><label>근거 자료 주소<input name="evidence" type="url" maxLength={1000} required /></label><button type="submit">정정 제안 파일 내려받기</button><p role="status">{message}</p></form></details>;
}
