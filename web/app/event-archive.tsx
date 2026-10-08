"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { SearchRecord } from "../lib/archive-types";
import { matchingContext, pageSize, searchRecords, type SearchState } from "../lib/search";
import { defaultUnifiedSearch, parseUnifiedSearch, relaxedSearchSuggestions, searchKnowledge, searchTargetLabels, serializeUnifiedSearch, type KnowledgeSearchItem, type UnifiedSearchState } from "../lib/knowledge-search";
import { incrementMetric } from "../lib/shelf-storage";
import { BookmarkButton, useShelf } from "./components/reading-tools";
import { WorkBasket } from "./components/knowledge-basket";
import styles from "./components/knowledge-refinement.module.css";

export function EventArchive({ events, knowledgeItems = [], basePath = "" }: { events: SearchRecord[]; knowledgeItems?: KnowledgeSearchItem[]; basePath?: string }) {
  const [state, setState] = useState<UnifiedSearchState>(defaultUnifiedSearch);
  const [basketIds, setBasketIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const urlTimer = useRef<number | undefined>(undefined);
  const leavingResults = useRef(false);
  const { shelf, ready, update } = useShelf();
  useEffect(() => {
    const readUrl = () => { setState(parseUnifiedSearch(new URLSearchParams(window.location.search))); setInitialized(true); };
    readUrl(); window.addEventListener("popstate", readUrl);
    try {
      const scroll = sessionStorage.getItem("archive-scroll:" + window.location.pathname + window.location.search);
      if (scroll && Number.isFinite(Number(scroll))) window.setTimeout(() => window.scrollTo({ top: Number(scroll), behavior: "instant" }), 100);
    } catch { /* Session storage is optional; URL state remains available. */ }
    return () => window.removeEventListener("popstate", readUrl);
  }, []);
  useEffect(() => {
    if (!initialized || leavingResults.current) return;
    const pathname = window.location.pathname;
    const timer = window.setTimeout(() => {
      if (leavingResults.current || window.location.pathname !== pathname) return;
      const query = serializeUnifiedSearch(state);
      const url = pathname + (query ? "?" + query : "");
      const currentQuery = serializeUnifiedSearch(parseUnifiedSearch(new URLSearchParams(window.location.search)));
      if (query !== currentQuery) window.history.replaceState(null, "", url);
    }, 200);
    urlTimer.current = timer;
    return () => window.clearTimeout(timer);
  }, [state, initialized]);
  const results = useMemo(() => state.target === "all" || state.target === "record" ? searchRecords(events, state, shelf.bookmarks) : [], [events, state, shelf.bookmarks]);
  const knowledgeResults = useMemo(() => searchKnowledge(knowledgeItems, events, state, shelf.bookmarks), [knowledgeItems, events, state, shelf.bookmarks]);
  const relaxed = useMemo(() => relaxedSearchSuggestions(events, knowledgeItems, state, shelf.bookmarks), [events, knowledgeItems, state, shelf.bookmarks]);
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const page = Math.min(state.page, pages);
  const records = results.slice((page - 1) * pageSize, page * pageSize);
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "ko"));
  function change(patch: Partial<UnifiedSearchState>) { leavingResults.current = false; setState(previous => ({ ...previous, ...patch, page: patch.page ?? 1 })); }
  function select(ids: string[]) { setBasketIds(previous => ids.every(id => previous.includes(id)) ? previous.filter(id => !ids.includes(id)) : [...new Set([...previous, ...ids])].slice(0, 100)); }
  function rememberScroll(event: MouseEvent<HTMLAnchorElement>) {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      leavingResults.current = true;
      window.clearTimeout(urlTimer.current);
    }
    try { const query = serializeUnifiedSearch(state); sessionStorage.setItem("archive-scroll:" + window.location.pathname + (query ? "?" + query : ""), String(window.scrollY)); }
    catch { /* Browsers may deny optional session persistence. */ }
  }
  const queryString = serializeUnifiedSearch(state);
  const returnTo = basePath + "/archive/" + (queryString ? "?" + queryString : "");
  const eraLabels: Record<string, string> = { ancient: "고대", medieval: "중세", "early-modern": "근세", modern: "근현대", unknown: "미상" };
  const selections: [keyof SearchState, string][] = [];
  if (state.label) selections.push(["label", "주제: " + state.label]);
  if (state.region) selections.push(["region", "지역: " + state.region]);
  if (state.kind) selections.push(["kind", "유형: " + (state.kind === "event" ? "사건 해설" : "사료 안내")]);
  if (state.institution) selections.push(["institution", "기관: " + state.institution]);
  if (state.era) selections.push(["era", "시대: " + eraLabels[state.era]]);
  return <div className="archiveBrowser">
    <section className="archiveToolbar" aria-label="기록 검색과 필터">
      <form onSubmit={event => {
        event.preventDefault();
        window.history.pushState(null, "", window.location.pathname + (queryString ? "?" + queryString : ""));
        update(previous => incrementMetric(incrementMetric(previous, "search"), results.length + knowledgeResults.length ? "" : "no_results"));
      }}>
        <label className="archiveSearch"><span>기록 검색</span><input type="search" maxLength={160} value={state.q} onChange={event => change({ q: event.target.value })} placeholder="사건, 인물, 장소, 출처 기관" aria-describedby="search-help" /></label>
        <button type="submit" className="searchSubmit">검색</button>
        <p id="search-help" className="searchHelp">한국어·원어 명칭과 연결된 인물·장소를 함께 찾습니다. 예: 임진왜란, 이순신, 난중일기</p>
      </form>
      <div className={styles.tabs} role="group" aria-label="검색 자료 분류">{(["all", "record", "source", "entity", "place"] as const).map(target => <button key={target} type="button" aria-pressed={state.target === target} onClick={() => change({ target })}>{searchTargetLabels[target]}</button>)}</div>
      <details className="searchFilterDetails"><summary>검색 조건 펼치기</summary><div className="archiveFilterRow">
        <label><span>주제</span><select value={state.label} onChange={event => change({ label: event.target.value })}><option value="">전체</option>{unique(events.flatMap(record => record.labels)).map(label => <option key={label}>{label}</option>)}</select></label>
        <label><span>지역</span><select value={state.region} onChange={event => change({ region: event.target.value })}><option value="">전체</option>{unique(events.map(record => record.region)).map(region => <option key={region}>{region}</option>)}</select></label>
        <label><span>유형</span><select value={state.kind} onChange={event => change({ kind: event.target.value })}><option value="">전체</option><option value="event">사건 해설</option><option value="source">사료 안내</option></select></label>
        <label><span>시대</span><select value={state.era} onChange={event => change({ era: event.target.value })}><option value="">전체</option><option value="ancient">고대 (499년까지)</option><option value="medieval">중세 (500–1499)</option><option value="early-modern">근세 (1500–1799)</option><option value="modern">근현대 (1800년부터)</option><option value="unknown">시기 미상</option></select></label>
        <label><span>출처 기관</span><select value={state.institution} onChange={event => change({ institution: event.target.value })}><option value="">전체</option>{unique(events.flatMap(record => record.institutions)).map(institution => <option key={institution}>{institution}</option>)}</select></label>
        <label><input type="checkbox" checked={state.original} onChange={event => change({ original: event.target.checked })} /> 원문 안내가 있는 기록</label>
        <label><input type="checkbox" checked={state.saved} disabled={!ready} onChange={event => change({ saved: event.target.checked })} /> 저장한 기록</label>
      </div><p className="searchHelp">시대 구간은 탐색을 위한 편의 분류입니다. 사건 기간이 구간에 걸치면 양쪽에 포함됩니다.</p></details>
      <div className="archiveFilterRow"><label><span>정렬</span><select value={state.sort} onChange={event => change({ sort: event.target.value as SearchState["sort"] })}><option value="relevance">관련도</option><option value="date">사건 시간순</option><option value="updated">최근 수정순</option><option value="title">이름순</option></select></label><button type="button" onClick={() => setState(defaultUnifiedSearch)}>전체 초기화</button><p role="status" aria-live="polite"><strong>{results.length}</strong>개의 기록 · {page}/{pages}페이지 · 출처·인물·장소 {knowledgeResults.length}건</p></div>
      <div className="selectedFilters" aria-label="선택한 검색 조건">{selections.map(([key, label]) => <button key={key} type="button" aria-label={label + " 해제"} onClick={() => change({ [key]: "" })}>{label} ×</button>)}{state.original ? <button type="button" onClick={() => change({ original: false })}>원문 조건 해제 ×</button> : null}{state.saved ? <button type="button" onClick={() => change({ saved: false })}>저장 조건 해제 ×</button> : null}</div>
    </section>
    <WorkBasket records={events.filter(record => basketIds.includes(record.id)).map(record => ({ id: record.id, title: record.title }))} returnTo={returnTo} />
    {results.length ? <section className="simpleEventList" aria-label="아카이브 기록 목록">{records.map((record, index) => <article className="simpleEventCard" key={record.id}>
      <Link href={"/archive/" + record.id + "/?returnTo=" + encodeURIComponent(returnTo)} onClick={rememberScroll}><div className="simpleEventIndex"><span>RECORD {String((page - 1) * pageSize + index + 1).padStart(2, "0")}</span><span>{record.kind === "event" ? "사건 해설" : "사료 안내"}</span></div><p className="simpleEventRegion">{record.period} · {record.region}</p><h2>{record.title}</h2><p className="simpleEventSummary">{matchingContext(record, state.q)}</p><div className="simpleEventFooter"><span>연결 자료 {record.sourceCount}건 · 약 {record.readingMinutes}분</span><span>기록 읽기 →</span></div></Link>
      <div className="resultMeta"><span>{record.reviewStatus === "approved" ? "편집 승인" : "출처 대조 · 사람 검토 대기"}</span><span>수정 {record.updatedAt.slice(0, 10)}</span><BookmarkButton id={record.id} /><label><input type="checkbox" checked={basketIds.includes(record.id)} onChange={() => select([record.id])} /> 작업 자료 선택 · {record.title}</label></div>
    </article>)}</section> : null}
    {knowledgeResults.length ? <section className={styles.panel} aria-label="출처·인물·장소 검색 결과"><h2>연결 자료와 명칭</h2><p>기록 조건은 연결된 공개 기록에 적용됩니다. 출처와 명칭의 날짜 정렬은 이름순이며 역사 날짜를 임의 생성하지 않습니다.</p><div className={styles.grid}>{knowledgeResults.map(item => <article key={`${item.target}-${item.id}`} className={styles.panel}><p>{searchTargetLabels[item.target]} · {item.review === "approved" ? "사람 승인" : "출처 대조 · 사람 검수 대기"}</p><h3><Link href={`${item.href}?returnTo=${encodeURIComponent(returnTo)}`} onClick={rememberScroll}>{item.title}</Link></h3><p>{item.why}</p><p>{item.description}</p><label><input type="checkbox" checked={item.recordIds.every(id => basketIds.includes(id))} onChange={() => select(item.recordIds)} /> 연결 기록 {item.recordIds.length}개를 작업 자료로 선택</label></article>)}</div></section> : null}
    {!results.length && !knowledgeResults.length ? <section className="simpleEmptyState"><h2>일치하는 기록이 없습니다.</h2><p>{state.q ? "‘" + state.q + "’" : "선택한 조건"}에 맞는 공개 자료를 찾지 못했습니다. 검토 중인 자료는 검색 결과에 포함하지 않습니다.</p>{relaxed.map(option => <button key={option.label} type="button" onClick={() => setState(option.state)}>{option.label} · {option.count}건 찾기</button>)}<button type="button" onClick={() => setState(defaultUnifiedSearch)}>전체 기록 보기</button><Link href="/explore/">주제에서 시작하기 →</Link></section> : null}
    {pages > 1 ? <nav className="pagination" aria-label="검색 결과 페이지"><button disabled={page === 1} type="button" onClick={() => change({ page: page - 1 })}>이전</button><span>{page}/{pages}</span><button disabled={page === pages} type="button" onClick={() => change({ page: page + 1 })}>다음</button></nav> : null}
    <p className="publicReviewNotice">출처를 대조한 편집 기록을 제공합니다. 자동 수집 원본은 별도 검토 대상이며, 사람의 검수 여부와 확인 범위는 각 상세 기록에서 확인할 수 있습니다. <Link href="/about/">편집 기준 →</Link></p>
  </div>;
}
