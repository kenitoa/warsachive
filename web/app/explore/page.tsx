import Link from "next/link";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { archiveEvents } from "../../lib/archive-data";

export default function ExplorePage() {
  const topics = Array.from(new Set(archiveEvents.flatMap((event) => event.labels ?? [])));
  return <ArchiveShell pageClassName="routePage">
    <section className="routeIntro dark"><p className="routeEyebrow">EXPLORE / THEMES</p><h1>기록 사이의<br />연결을 따라갑니다.</h1><p>서로 다른 사건과 자료를 주제별로 모아 읽습니다.</p></section>
    <section className="topicGrid">{topics.map((topic, index) => <Link href="/archive/" key={topic}><span>THEME {String(index + 1).padStart(2, "0")}</span><h2>{topic}</h2><b>기록 보기 →</b></Link>)}</section>
    <ArchiveFooter />
  </ArchiveShell>;
}
