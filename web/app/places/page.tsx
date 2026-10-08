import Link from "next/link";
import { publicKnowledge } from "../../lib/knowledge-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { VerifiedPlacesMap } from "../components/knowledge-chronology";
import { verifiedCoordinates } from "../../lib/knowledge-reading";
import { KnowledgeCatalogue } from "../components/knowledge-catalogue";
import { KnowledgeEvidence, KnowledgeRecordLinks, KnowledgeReviewNotice } from "../components/knowledge-view";
import { makePageMetadata } from "../site-config";
import styles from "../components/knowledge-styles.module.css";

export const metadata = makePageMetadata("역사 장소와 위치", "좌표와 시대별 경계의 검수 상태를 구분하고 목록으로 장소를 찾습니다.", "/places/");
export default function PlacesPage() {
  const locations = publicKnowledge.locations;
  const positioned = verifiedCoordinates(locations, publicKnowledge.sources);
  const items = locations.map(location => {
    const entity = publicKnowledge.entities.find(entry => entry.id === location.entityId);
    return { id: location.id, kind: location.kind, title: location.label, aliases: entity?.aliases ?? [], description: location.uncertainty, href: `/entities/${location.entityId}/`, recordCount: location.recordIds.length };
  });
  return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><nav className="breadcrumbs" aria-label="현재 위치"><Link href="/archive/">아카이브</Link> / 역사 장소</nav><p className="sectionNumber">PLACES AND UNCERTAINTY</p><h1>역사 장소와 위치</h1><p className="recordLead">전투의 장소, 역사적 지역, 자료의 소장 장소를 구분합니다. 확인한 좌표가 없는 항목은 목록으로 탐색합니다.</p><KnowledgeReviewNotice /><p className={styles.notice}>등록 장소 {locations.length}곳 · 검증한 좌표 {positioned.length}곳. 현재 자료에서 좌표·시대별 국경을 확정하지 않았습니다. 현재 지명으로 당시 경계를 그리거나 소장기관 위치를 전투 위치로 대체하지 않습니다.</p>
    <VerifiedPlacesMap locations={locations} sources={publicKnowledge.sources} />
    <KnowledgeCatalogue items={items} categories={[{ value: "historical-region", label: "역사적 지역" }, { value: "battle-reference", label: "전투 관련 장소" }, { value: "custodian-location", label: "소장 안내 장소" }]} searchLabel="장소·표기 검색" />
    <section className={styles.panel}><h2>장소별 위치 근거</h2>{locations.map(location => <article key={location.id} className={styles.card}><h3><Link href={`/entities/${location.entityId}/`}>{location.label}</Link></h3><p>좌표: {positioned.some(item => item.id === location.id) && location.coordinate ? `${location.coordinate.latitude}, ${location.coordinate.longitude} · ${location.coordinate.precision === "site" ? "해당 위치" : "근사 위치"}` : "공개 근거·검수 미확인"}</p><p>{location.boundary.note}</p><KnowledgeEvidence references={location.evidence} /><KnowledgeRecordLinks ids={location.recordIds} /></article>)}</section>
  </article><ArchiveFooter /></ArchiveShell>;
}
