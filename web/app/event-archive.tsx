"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { archiveEvents } from "../lib/archive-data";

export function EventArchive() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(archiveEvents[0]?.id ?? "");

  const filteredEvents = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    if (!keyword) return archiveEvents;
    return archiveEvents.filter((event) => [
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
      .includes(keyword));
  }, [query]);

  const activeEvent = useMemo(() => {
    if (filteredEvents.length === 0) return undefined;
    return filteredEvents.find((event) => event.id === activeId) ?? filteredEvents[0];
  }, [activeId, filteredEvents]);

  const highlightedPoints = activeEvent?.curator?.keyPoints.slice(0, 2)
    ?? (activeEvent ? [activeEvent.summary] : []);
  const displayQuery = query.trim() || "검색어 대기";

  return (
    <div className="archiveBrowser">
      <div className="catalogueTools">
        <label className="searchField">
          <span>기록 검색</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사건, 인물, 지역, 키워드" type="search" />
          <b aria-hidden="true">⌕</b>
        </label>
        <div className="catalogueMeta">
          <span className="connectionState live">GitHub 정적 소장본</span>
          <span>NAS 가공 기록 누적 · 검색 결과 {filteredEvents.length}건</span>
        </div>
      </div>

      <section className="readingExperience" aria-label="문헌 가상 열람 화면">
        <div className="readingStage">
          <div className="screenBezel">
            <div className="screenTop">
              <span>VIRTUAL DOCUMENT SCREEN</span>
              <b>{displayQuery}</b>
            </div>
            {activeEvent ? (
              <div className="screenContent">
                <p className="screenKicker">{activeEvent.region} · {activeEvent.period}</p>
                <h3>{activeEvent.title}</h3>
                <p>{activeEvent.curator?.context ?? activeEvent.summary}</p>
                <div className="screenTimeline" aria-label="시간 흐름">
                  {(activeEvent.curator?.chronology ?? [activeEvent.period]).slice(0, 2).map((item, index) => (
                    <span key={`${activeEvent.id}-timeline-${index}`}>{item}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="screenContent emptyScreen">
                <p className="screenKicker">NO MATCH</p>
                <h3>전시 화면이 비어 있습니다</h3>
                <p>다른 사건, 인물, 지역, 사료 키워드로 다시 검색하면 관련 문헌 화면이 표시됩니다.</p>
              </div>
            )}
          </div>
          <div className="sourceLabel">
            <span>CURATOR NOTE</span>
            <strong>{activeEvent ? `${activeEvent.title} 해설` : "검색 대기"}</strong>
            <p>{activeEvent?.curator?.sourceBasis ?? "문헌 검색 결과가 선택되면 출처와 검토 근거가 이곳에 표시됩니다."}</p>
          </div>
        </div>

        <div className="interpretationPanel">
          <p>EXHIBIT INTERPRETATION</p>
          <h3>{activeEvent ? "이 기록은 이렇게 읽습니다" : "문헌을 검색해 전시 해설을 시작하세요"}</h3>
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
            <article className={`eventCard ${activeEvent?.id === event.id ? "isActive" : ""}`} key={event.id} data-record-id={event.id}>
              <div className="eventCardTop"><span>WA / {String(index + 1).padStart(4, "0")}</span><span>{event.period}</span></div>
              <p className="eventRegion">{event.region}</p>
              <h3>{event.title}</h3>
              <p className="eventSummary">{event.summary}</p>
              <div className="eventFooter">
                <span>{event.labels?.[0] ?? "미분류"}</span>
                <small>출처 {event.sourceCount}건</small>
              </div>
              <div className="eventActions">
                <button type="button" onClick={() => setActiveId(event.id)}>전시 화면 보기</button>
                <Link className="recordOpen" href={`/archive/${event.id}/`}>기록 열람<span aria-hidden="true">→</span></Link>
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
