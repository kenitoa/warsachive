import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { EventArchive } from "../event-archive";
import { archiveEvents, getSearchRecords } from "../../lib/archive-data";
import { publicKnowledge } from "../../lib/knowledge-data";
import { buildKnowledgeSearchItems } from "../../lib/knowledge-search";
import { getSiteUrl } from "../site-config";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "기록 검색 | 전쟁 역사 아카이브", description: "사건, 인물, 장소, 자료 유형과 출처 기관으로 공개 기록을 찾습니다.", alternates: { canonical: `${getSiteUrl()}/archive/` } };

export default function ArchivePage() {
  return <ArchiveShell pageClassName="readingRoomPage">
    <section className="routeIntro">
      <p className="routeEyebrow">ARCHIVE / READING ROOM</p>
      <h1>기록을 읽는<br />공개 열람실</h1>
      <p>사건, 인물, 장소로 자료를 찾고 출처와 해설을 함께 확인합니다.</p>
    </section>
    <section className="catalogue routeCatalogue" aria-label="아카이브 검색"><EventArchive events={getSearchRecords()} knowledgeItems={buildKnowledgeSearchItems(publicKnowledge, archiveEvents)} basePath={new URL(getSiteUrl()).pathname.replace(/\/$/, "")} /></section>
    <ArchiveFooter />
  </ArchiveShell>;
}
