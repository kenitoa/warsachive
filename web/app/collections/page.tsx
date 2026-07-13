import Link from "next/link";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { archiveEvents } from "../../lib/archive-data";

export default function CollectionsPage() {
  return <ArchiveShell pageClassName="routePage">
    <section className="routeIntro dark"><p className="routeEyebrow">COLLECTIONS</p><h1>하나의 주제를<br />여러 기록으로 봅니다.</h1><p>자료의 성격과 출처를 기준으로 만든 읽기 묶음입니다.</p></section>
    <section className="collectionList">{archiveEvents.map((event) => <Link href={`/archive/${event.id}/`} key={event.id}><span>{event.region}</span><h2>{event.title}</h2><p>{event.summary}</p><small>출처 {event.sourceCount}건 · {event.period}</small></Link>)}</section>
    <ArchiveFooter />
  </ArchiveShell>;
}
