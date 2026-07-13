import Link from "next/link";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { archiveEvents } from "../../lib/archive-data";

export default function StoriesPage() {
  return <ArchiveShell pageClassName="routePage">
    <section className="routeIntro dark"><p className="routeEyebrow">STORIES</p><h1>기록 속 목소리를<br />다시 듣습니다.</h1><p>사료의 맥락과 사람들이 남긴 흔적을 함께 읽는 이야기입니다.</p></section>
    <section className="storyList">{archiveEvents.map((event) => <article key={event.id}><p>{event.period} · {event.region}</p><h2>{event.title}</h2><p>{event.curator?.context ?? event.summary}</p><Link href={`/archive/${event.id}/`}>전체 기록 읽기 →</Link></article>)}</section>
    <ArchiveFooter />
  </ArchiveShell>;
}
