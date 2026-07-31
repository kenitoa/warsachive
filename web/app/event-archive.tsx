"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { archiveEvents } from "../lib/archive-data";

type SortMode = "archive" | "title" | "quality";

const allLabel = "전체";

export function EventArchive() {
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState(allLabel);
  const [sortMode, setSortMode] = useState<SortMode>("archive");

  const labels = useMemo(() => {
    const uniqueLabels = new Set<string>();
    archiveEvents.forEach((event) => event.labels?.forEach((label) => uniqueLabels.add(label)));
    return [allLabel, ...Array.from(uniqueLabels)];
  }, []);

  const filteredEvents = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    const filtered = archiveEvents.filter((event) => {
      const searchableText = [
        event.title,
        event.period,
        event.region,
        event.summary,
        event.curator?.context,
        ...(event.labels ?? [])
      ].join(" ").toLocaleLowerCase("ko");

      const matchesKeyword = !keyword || searchableText.includes(keyword);
      const matchesLabel = selectedLabel === allLabel || event.labels?.includes(selectedLabel);
      return matchesKeyword && matchesLabel;
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === "title") return left.title.localeCompare(right.title, "ko");
      if (sortMode === "quality") return (right.qualityScore ?? 0) - (left.qualityScore ?? 0);
      return archiveEvents.findIndex((event) => event.id === left.id)
        - archiveEvents.findIndex((event) => event.id === right.id);
    });
  }, [query, selectedLabel, sortMode]);

  const resetFilters = () => {
    setQuery("");
    setSelectedLabel(allLabel);
    setSortMode("archive");
  };

  return (
    <div className="archiveBrowser">
      <section className="archiveToolbar" aria-label="기록 검색과 필터">
        <label className="archiveSearch">
          <span>기록 검색</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="사건, 인물, 지역을 검색하세요"
          />
        </label>

        <div className="archiveFilterRow">
          <label>
            <span>주제</span>
            <select value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value)}>
              {labels.map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>정렬</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="archive">등록순</option>
              <option value="title">이름순</option>
              <option value="quality">자료 품질순</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters}>초기화</button>
          <p><strong>{filteredEvents.length}</strong>개의 기록</p>
        </div>
      </section>

      {filteredEvents.length > 0 ? (
        <section className="simpleEventList" aria-label="아카이브 기록 목록">
          {filteredEvents.map((event, index) => (
            <article className="simpleEventCard" key={event.id}>
              <Link href={`/archive/${event.id}/`}>
                <div className="simpleEventIndex">
                  <span>RECORD {String(index + 1).padStart(2, "0")}</span>
                  <span>{event.period}</span>
                </div>
                <p className="simpleEventRegion">{event.region}</p>
                <h2>{event.title}</h2>
                <p className="simpleEventSummary">{event.summary}</p>
                <div className="simpleEventFooter">
                  <span>출처 {event.sourceCount}건</span>
                  <span>상세 기록 보기 →</span>
                </div>
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="simpleEmptyState">
          <h2>일치하는 기록이 없습니다.</h2>
          <p>검색어나 주제 필터를 변경해 보세요.</p>
          <button type="button" onClick={resetFilters}>전체 기록 보기</button>
        </section>
      )}
    </div>
  );
}
