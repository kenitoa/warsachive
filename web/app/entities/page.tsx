import Link from "next/link";
import { publicKnowledge } from "../../lib/knowledge-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { KnowledgeCatalogue } from "../components/knowledge-catalogue";
import { KnowledgeReviewNotice } from "../components/knowledge-view";
import { makePageMetadata } from "../site-config";

export const metadata = makePageMetadata("인물·기관·장소", "확인된 명칭과 출처를 통해 공개 전쟁사 기록을 연결합니다.", "/entities/");
export default function EntitiesPage() {
  const items = publicKnowledge.entities.map(entity => ({ id: entity.id, kind: entity.kind, title: entity.name, aliases: entity.aliases, description: entity.description, href: `/entities/${entity.id}/`, recordCount: entity.recordIds.length }));
  return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><nav className="breadcrumbs" aria-label="현재 위치"><Link href="/archive/">아카이브</Link> / 인물·기관·장소</nav><p className="sectionNumber">CONNECTED NAMES</p><h1>인물·기관·장소</h1><p className="recordLead">같은 이름의 표기와 연결 기록을 함께 확인합니다. 기관의 자료 제공·실물 소장·이 사이트와의 협력은 구분합니다.</p><KnowledgeReviewNotice /><KnowledgeCatalogue items={items} categories={[{ value: "person", label: "인물" }, { value: "organization", label: "기관" }, { value: "place", label: "장소" }]} searchLabel="명칭·확인된 별칭 검색" /></article><ArchiveFooter /></ArchiveShell>;
}
