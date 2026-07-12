"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { archiveEvents } from "../lib/archive-data";

export function EventArchive() {
  const [query, setQuery] = useState("");

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

      {filteredEvents.length > 0 ? (
        <div className="eventGrid">
          {filteredEvents.map((event, index) => (
            <article className="eventCard" key={event.id} data-record-id={event.id}>
              <div className="eventCardTop"><span>WA / {String(index + 1).padStart(4, "0")}</span><span>{event.period}</span></div>
              <p className="eventRegion">{event.region}</p>
              <h3>{event.title}</h3>
              <p className="eventSummary">{event.summary}</p>
              <div className="eventFooter">
                <span>{event.labels?.[0] ?? "미분류"}</span>
                <small>출처 {event.sourceCount}건</small>
              </div>
              <Link className="recordOpen" href={`/archive/${event.id}/`}>기록 열람<span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="emptyArchive"><span>EMPTY DRAWER</span><strong>일치하는 기록이 없습니다.</strong><p>다른 사건명이나 지역으로 검색해 보세요.</p></div>
      )}
    </div>
  );
}
