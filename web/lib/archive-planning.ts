import { archiveEvents, type ArchiveEvent } from "./archive-data";

const themeDescriptions: Record<string, string> = {
  "전투": "전투의 전개와 전장의 변화를 중심으로 기록을 연결합니다.",
  "지휘": "의사결정과 지휘 체계가 사건의 흐름에 미친 영향을 살핍니다.",
  "외교": "교섭과 동맹, 국가 간 관계를 통해 전쟁의 배경을 읽습니다.",
  "사료": "기록이 생산되고 전승된 근거와 출처를 중심으로 탐색합니다.",
  "인물": "사건 속 인물과 공동체가 남긴 선택과 경험을 따라갑니다."
};

function excerpt(text: string, maxLength = 150) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength).trim()}…`;
}

function periodStart(period: string) {
  const match = period.match(/\d{3,4}/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

export type PlannedTheme = {
  name: string;
  description: string;
  records: ArchiveEvent[];
  regions: string[];
  sourceCount: number;
};

export function getPlannedThemes(events: ArchiveEvent[] = archiveEvents): PlannedTheme[] {
  const labels = Array.from(new Set(events.flatMap((event) => event.labels ?? [])));
  const effectiveLabels = labels.length > 0 ? labels : ["미분류 기록"];

  return effectiveLabels.map((name) => {
    const records = events.filter((event) => name === "미분류 기록" || event.labels?.includes(name));
    return {
      name,
      description: themeDescriptions[name] ?? `${name}의 관점에서 사건과 자료 사이의 관계를 살펴봅니다.`,
      records,
      regions: Array.from(new Set(records.map((event) => event.region))),
      sourceCount: records.reduce((total, event) => total + event.sourceCount, 0)
    };
  });
}

export type PlannedCollection = {
  id: string;
  region: string;
  title: string;
  description: string;
  records: ArchiveEvent[];
  period: string;
  sourceCount: number;
  documentCount: number;
};

export function getPlannedCollections(events: ArchiveEvent[] = archiveEvents): PlannedCollection[] {
  const regions = Array.from(new Set(events.map((event) => event.region)));

  return regions.map((region, index) => {
    const records = events.filter((event) => event.region === region);
    const sorted = [...records].sort((left, right) => periodStart(left.period) - periodStart(right.period));
    return {
      id: `collection-${String(index + 1).padStart(2, "0")}`,
      region,
      title: `${region} 전쟁 기록`,
      description: excerpt(sorted[0]?.curator?.sourceBasis ?? sorted[0]?.summary ?? "지역 기록을 준비하고 있습니다."),
      records: sorted,
      period: sorted.map((event) => event.period).join(" · "),
      sourceCount: records.reduce((total, event) => total + event.sourceCount, 0),
      documentCount: records.reduce((total, event) => total + (event.documentCount ?? event.sourceCount), 0)
    };
  });
}

export type PlannedTimeline = ArchiveEvent & {
  startYear: number;
  chapters: string[];
};

export function getPlannedTimeline(events: ArchiveEvent[] = archiveEvents): PlannedTimeline[] {
  return [...events]
    .sort((left, right) => periodStart(left.period) - periodStart(right.period))
    .map((event) => ({
      ...event,
      startYear: periodStart(event.period),
      chapters: event.curator?.chronology.length
        ? event.curator.chronology
        : [event.summary]
    }));
}

export type PlannedStory = {
  id: string;
  title: string;
  deck: string;
  narrative: string;
  period: string;
  region: string;
  perspectives: string[];
  href: string;
};

export function getPlannedStories(events: ArchiveEvent[] = archiveEvents): PlannedStory[] {
  return events.map((event) => {
    const primaryTheme = event.labels?.[0] ?? "기록";
    const concisePeopleAndPlaces = (event.curator?.peopleAndPlaces ?? [])
      .filter((item) => item.trim().length <= 36);
    const perspectives = Array.from(new Set([
      ...concisePeopleAndPlaces,
      event.region,
      ...(event.labels ?? [])
    ])).slice(0, 4);

    return {
      id: event.id,
      title: `${event.title}, ${primaryTheme}의 시선으로 읽다`,
      deck: excerpt(event.curator?.keyPoints[0] ?? event.summary, 110),
      narrative: excerpt(event.curator?.context ?? event.summary, 320),
      period: event.period,
      region: event.region,
      perspectives,
      href: `/archive/${event.id}/`
    };
  });
}
