import Link from "next/link";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { archiveEvents } from "../../lib/archive-data";

export default function TimelinePage() {
  return <ArchiveShell pageClassName="routePage">
    <section className="routeIntro dark"><p className="routeEyebrow">TIMELINE</p><h1>시간은 흩어져도<br />기록은 이어집니다.</h1><p>아카이브에 축적된 기록을 시간의 흐름으로 정리합니다.</p></section>
    <ol className="routeTimeline">{archiveEvents.map((event, index) => <li key={event.id}><span>{String(index + 1).padStart(2, "0")}</span><p>{event.period}</p><h2>{event.title}</h2><Link href={`/archive/${event.id}/`}>기록 읽기 →</Link></li>)}</ol>
    <ArchiveFooter />
  </ArchiveShell>;
}
