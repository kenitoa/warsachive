import Link from "next/link";
import { getPlannedTimeline } from "../../lib/archive-planning";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";

export default function TimelinePage() {
  const timeline = getPlannedTimeline();

  return <ArchiveShell pageClassName="routePage timelineRoute">
    <section className="routeIntro">
      <p className="routeEyebrow">TIMELINE / CHRONOLOGY</p>
      <h1>사건의 시작보다<br />변화의 순서를 봅니다.</h1>
      <p>각 기록의 연대 항목을 단계별로 펼쳐 전쟁이 어떻게 전개되고 변화했는지 읽습니다.</p>
    </section>
    <section className="timelineNarrative" aria-label="사건 연표">
      {timeline.map((event, eventIndex) => <article className="timelineEvent" key={event.id}>
        <header>
          <p>CHRONICLE {String(eventIndex + 1).padStart(2, "0")}</p>
          <h2>{event.title}</h2>
          <span>{event.period} · {event.region}</span>
        </header>
        <ol>
          {event.chapters.map((chapter, chapterIndex) => <li key={`${event.id}-${chapterIndex}`}>
            <span>{String(chapterIndex + 1).padStart(2, "0")}</span>
            <p>{chapter}</p>
          </li>)}
        </ol>
        <Link href={`/archive/${event.id}/`}>전체 기록 읽기 →</Link>
      </article>)}
    </section>
    <ArchiveFooter />
  </ArchiveShell>;
}
