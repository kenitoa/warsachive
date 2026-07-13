"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { archiveEvents } from "../lib/archive-data";

type ReadingTab = "overview" | "timeline" | "people" | "source";
type ReaderSize = "compact" | "normal" | "large";
type SortMode = "relevance" | "title" | "quality";

export function EventArchive() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(archiveEvents[0]?.id ?? "");
  const [selectedLabel, setSelectedLabel] = useState("전체");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [readingTab, setReadingTab] = useState<ReadingTab>("overview");
  const [readerSize, setReaderSize] = useState<ReaderSize>("normal");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [citationStatus, setCitationStatus] = useState("인용 복사");

  const labels = useMemo(() => {
    const uniqueLabels = new Set<string>();
    archiveEvents.forEach((event) => event.labels?.forEach((label) => uniqueLabels.add(label)));
    return ["전체", ...Array.from(uniqueLabels)];
  }, []);

  const filteredEvents = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    const filtered = archiveEvents.filter((event) => {
      const matchesKeyword = !keyword || [
        event.title,
        event.period,
        event.region,
        event.summary,
        event.curator?.context,
        event.curator?.sourceBasis,
        ...(event.curator?.keyPoints ?? []),
        ...(event.curator?.chronology ?? []),
        ...(event.curator?.peopleAndPlaces ?? []),
        ...(event.labels ?? [])
      ]
        .join(" ")
        .toLocaleLowerCase("ko")
        .includes(keyword);
      const matchesLabel = selectedLabel === "전체" || event.labels?.includes(selectedLabel);
      const matchesBookmark = !onlyBookmarked || bookmarkedIds.includes(event.id);
      return matchesKeyword && matchesLabel && matchesBookmark;
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === "title") return left.title.localeCompare(right.title, "ko");
      if (sortMode === "quality") return (right.qualityScore ?? 0) - (left.qualityScore ?? 0);
      return archiveEvents.findIndex((event) => event.id === left.id) - archiveEvents.findIndex((event) => event.id === right.id);
    });
  }, [bookmarkedIds, onlyBookmarked, query, selectedLabel, sortMode]);

  const activeEvent = useMemo(() => {
    if (filteredEvents.length === 0) return undefined;
    return filteredEvents.find((event) => event.id === activeId) ?? filteredEvents[0];
  }, [activeId, filteredEvents]);

  const highlightedPoints = activeEvent?.curator?.keyPoints.slice(0, 2)
    ?? (activeEvent ? [activeEvent.summary] : []);
  const displayQuery = query.trim() || "검색어 대기";
  const selectRecord = (id: string) => setActiveId(id);
  const activeBookmarked = activeEvent ? bookmarkedIds.includes(activeEvent.id) : false;
  const suggestedKeywords = activeEvent ? [activeEvent.title, activeEvent.region, ...(activeEvent.labels ?? [])].slice(0, 6) : labels.slice(1, 6);
  const readingItems = activeEvent
    ? readingTab === "timeline"
      ? activeEvent.curator?.chronology ?? [activeEvent.period]
      : readingTab === "people"
        ? activeEvent.curator?.peopleAndPlaces ?? []
        : readingTab === "source"
          ? [activeEvent.curator?.sourceBasis ?? "출처 근거가 아직 등록되지 않았습니다."]
          : activeEvent.curator?.keyPoints ?? [activeEvent.summary]
    : [];

  const clearFilters = () => {
    setQuery("");
    setSelectedLabel("전체");
    setOnlyBookmarked(false);
    setSortMode("relevance");
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((currentIds) => currentIds.includes(id)
      ? currentIds.filter((currentId) => currentId !== id)
      : [...currentIds, id]);
  };

  const copyCitation = async () => {
    if (!activeEvent) return;
    const citation = `${activeEvent.title}. ${activeEvent.period}. 전쟁 역사 아카이브, 출처 ${activeEvent.sourceCount}건.`;
    try {
      await navigator.clipboard.writeText(citation);
      setCitationStatus("복사됨");
      window.setTimeout(() => setCitationStatus("인용 복사"), 1300);
    } catch {
      setCitationStatus("복사 불가");
      window.setTimeout(() => setCitationStatus("인용 복사"), 1300);
    }
  };

  return (
    <div className="archiveBrowser">
      <div className="catalogueTools">
        <label className="searchField">
          <span>문헌 검색</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사건, 인물, 지역, 사료 키워드" type="search" />
          <b aria-hidden="true">⌕</b>
        </label>
        <div className="catalogueMeta">
          <span className="connectionState live">공개 열람 가능한 소장 문헌</span>
          <span>검색 결과 {filteredEvents.length}건 · 본문을 누르면 열람대에 펼쳐집니다</span>
        </div>
      </div>

      <div className="readingControls" aria-label="열람실 도구">
        <div className="keywordChips" aria-label="빠른 검색어">
          {suggestedKeywords.map((keyword) => (
            <button type="button" key={keyword} onClick={() => setQuery(keyword)}>{keyword}</button>
          ))}
        </div>
        <div className="filterBar">
          <label>
            <span>분류</span>
            <select value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value)}>
              {labels.map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>정렬</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="relevance">등록 순</option>
              <option value="title">제목 순</option>
              <option value="quality">품질 높은 순</option>
            </select>
          </label>
          <button type="button" className={onlyBookmarked ? "isPressed" : ""} onClick={() => setOnlyBookmarked((current) => !current)}>책갈피만</button>
          <button type="button" onClick={clearFilters}>초기화</button>
        </div>
      </div>

      <section className="readingExperience" aria-label="도서관 문헌 열람대">
        <div className="readingStage">
          <div className="screenBezel">
            <div className="screenTop">
              <span>REFERENCE READING DESK</span>
              <b>{displayQuery}</b>
            </div>
            {activeEvent ? (
              <div className={`screenContent readerSize-${readerSize}`}>
                <p className="screenKicker">{activeEvent.region} · {activeEvent.period}</p>
                <h3>{activeEvent.title}</h3>
                <p>{activeEvent.curator?.context ?? activeEvent.summary}</p>
                <div className="readingTabs" role="tablist" aria-label="문헌 열람 탭">
                  <button type="button" className={readingTab === "overview" ? "isPressed" : ""} onClick={() => setReadingTab("overview")}>요점</button>
                  <button type="button" className={readingTab === "timeline" ? "isPressed" : ""} onClick={() => setReadingTab("timeline")}>연표</button>
                  <button type="button" className={readingTab === "people" ? "isPressed" : ""} onClick={() => setReadingTab("people")}>인물·장소</button>
                  <button type="button" className={readingTab === "source" ? "isPressed" : ""} onClick={() => setReadingTab("source")}>출처</button>
                </div>
                <div className="screenTimeline" aria-label="선택한 문헌 정보">
                  {readingItems.slice(0, 4).map((item, index) => (
                    <span key={`${activeEvent.id}-${readingTab}-${index}`}>{item}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="screenContent emptyScreen">
                <p className="screenKicker">NO MATCH</p>
                <h3>열람할 문헌이 없습니다</h3>
                <p>다른 사건, 인물, 지역, 사료 키워드로 다시 검색하면 관련 문헌이 열람대에 표시됩니다.</p>
              </div>
            )}
          </div>
          <div className="sourceLabel">
            <span>LIBRARIAN NOTE</span>
            <strong>{activeEvent ? `${activeEvent.title} 자료 해제` : "검색 대기"}</strong>
            <p>{activeEvent?.curator?.sourceBasis ?? "문헌 검색 결과가 선택되면 출처와 검토 근거가 이곳에 표시됩니다."}</p>
            {activeEvent ? (
              <div className="deskActions">
                <button type="button" className={activeBookmarked ? "isPressed" : ""} onClick={() => toggleBookmark(activeEvent.id)}>{activeBookmarked ? "책갈피 해제" : "책갈피 추가"}</button>
                <button type="button" onClick={copyCitation}>{citationStatus}</button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="interpretationPanel">
          <p>READING GUIDE</p>
          <h3>{activeEvent ? "이 문헌은 이렇게 읽습니다" : "문헌을 검색해 열람을 시작하세요"}</h3>
          <div className="readerTools" aria-label="본문 크기">
            <button type="button" className={readerSize === "compact" ? "isPressed" : ""} onClick={() => setReaderSize("compact")}>작게</button>
            <button type="button" className={readerSize === "normal" ? "isPressed" : ""} onClick={() => setReaderSize("normal")}>보통</button>
            <button type="button" className={readerSize === "large" ? "isPressed" : ""} onClick={() => setReaderSize("large")}>크게</button>
          </div>
          <ul>
            {highlightedPoints.map((point, index) => (
              <li key={`${activeEvent?.id ?? "empty"}-point-${index}`}>{point}</li>
            ))}
          </ul>
          {activeEvent ? (
            <div className="experienceFacts">
              <span>문헌 {activeEvent.documentCount ?? activeEvent.sourceCount}건</span>
              <span>출처 {activeEvent.sourceCount}건</span>
              <span>품질 {activeEvent.qualityScore?.toFixed(2) ?? "검토 전"}</span>
            </div>
          ) : null}
        </div>
      </section>

      {filteredEvents.length > 0 ? (
        <div className="eventGrid">
          {filteredEvents.map((event, index) => (
            <article
              className={`eventCard ${activeEvent?.id === event.id ? "isActive" : ""}`}
              key={event.id}
              data-record-id={event.id}
              role="button"
              tabIndex={0}
              aria-pressed={activeEvent?.id === event.id}
              aria-label={`${event.title} 문헌을 열람대에 펼치기`}
              onClick={() => selectRecord(event.id)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
                keyboardEvent.preventDefault();
                selectRecord(event.id);
              }}
            >
              <div className="eventCardTop"><span>WA / {String(index + 1).padStart(4, "0")}</span><span>{event.period}</span></div>
              <p className="eventRegion">{event.region}</p>
              <h3>{event.title}</h3>
              <p className="eventSummary">{event.summary}</p>
              <div className="eventFooter">
                <span>{event.labels?.[0] ?? "미분류"}</span>
                <small>출처 {event.sourceCount}건</small>
              </div>
              <div className="eventActions">
                <span>{activeEvent?.id === event.id ? "열람대에 펼쳐짐" : "본문을 눌러 열람"}</span>
                <button
                  type="button"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    toggleBookmark(event.id);
                  }}
                >
                  {bookmarkedIds.includes(event.id) ? "책갈피됨" : "책갈피"}
                </button>
                <Link className="recordOpen" href={`/archive/${event.id}/`} onClick={(clickEvent) => clickEvent.stopPropagation()}>상세 기록<span aria-hidden="true">→</span></Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="emptyArchive"><span>EMPTY DRAWER</span><strong>일치하는 기록이 없습니다.</strong><p>다른 사건명이나 지역으로 검색해 보세요.</p></div>
      )}
    </div>
  );
}
