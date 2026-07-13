import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { EventArchive } from "../event-archive";

export default function ArchivePage() {
  return <ArchiveShell pageClassName="readingRoomPage">
    <section className="routeIntro">
      <p className="routeEyebrow">ARCHIVE / READING ROOM</p>
      <h1>기록을 읽는<br />공개 열람실</h1>
      <p>사건, 인물, 장소로 자료를 찾고 출처와 해설을 함께 확인합니다.</p>
    </section>
    <section className="catalogue routeCatalogue" aria-label="아카이브 검색"><EventArchive /></section>
    <ArchiveFooter />
  </ArchiveShell>;
}
