import Link from "next/link";
import { archiveEvents } from "../../lib/archive-data";
import { publicKnowledge } from "../../lib/knowledge-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { KnowledgeCatalogue } from "../components/knowledge-catalogue";
import { IiifManifestPreview } from "../components/knowledge-tools";
import { KnowledgeReviewNotice } from "../components/knowledge-view";
import { makePageMetadata } from "../site-config";
import styles from "../components/knowledge-styles.module.css";

export const metadata = makePageMetadata("출처와 서지", "자료의 제공 기관·판본·국역·이용 조건을 구분하고 서지를 내보냅니다.", "/sources/");
export default function SourcesPage() {
  const items = publicKnowledge.sources.map(source => ({ id: source.id, kind: source.kind, title: source.title, aliases: [], description: `${publicKnowledge.entities.find(entity => entity.id === source.providerId)?.name} · ${source.locator}`, href: `/sources/${source.id}/`, recordCount: archiveEvents.filter(record => record.sources.some(entry => entry.id === source.id)).length }));
  const groups = new Set(publicKnowledge.sources.map(source => source.provenanceGroup));
  return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><nav className="breadcrumbs" aria-label="현재 위치"><Link href="/archive/">아카이브</Link> / 출처와 서지</nav><p className="sectionNumber">SOURCE REGISTER</p><h1>출처와 서지</h1><p className="recordLead">작품·판본·번역·온라인 자료를 구분해 근거를 따라갑니다. 서지 JSON과 RIS에는 인용 위치와 확인일을 담습니다.</p><KnowledgeReviewNotice /><p className={styles.notice}>등록 출처 {publicKnowledge.sources.length}건 · 자료 계통 그룹 {groups.size}개. 그룹은 재게시·공통 자료의 관계를 표시하며 독립 증언의 수를 뜻하지 않습니다.</p><KnowledgeCatalogue items={items} categories={[{ value: "primary", label: "1차 자료 제공" }, { value: "research", label: "연구·백과사전" }, { value: "institutional", label: "기관 안내" }]} searchLabel="출처·기관·대조 위치 검색" />
    <section className={styles.panel}><h2>공통 필드 기준</h2><div className={styles.table}><table><caption>공개 데이터의 값과 불확실성 표기</caption><thead><tr><th scope="col">필드</th><th scope="col">기준</th></tr></thead><tbody><tr><th scope="row">식별자·관계</th><td>기존 기록 ID 유지, 전역 지식 ID 중복 금지, 관계 유형과 양끝 자료의 종류 검증</td></tr><tr><th scope="row">시점·역법</th><td>사건·기사·제작·간행·등재 구분. 음력 원표기 보존, 근거 없는 현대 달력 환산 금지, 미상은 null</td></tr><tr><th scope="row">판본·소장</th><td>작품과 실물 판본 분리. 제공 기관을 소장기관으로 자동 복사하지 않음</td></tr><tr><th scope="row">출처·계통</th><td>근거 ID와 대조 위치 필수. 같은 자료 계통을 독립 근거로 중복 계산하지 않음</td></tr><tr><th scope="row">권리</th><td>원문·국역·이미지·IIIF 별도 취급. 이용 근거와 사람 승인을 확인하기 전 미디어 표시·다운로드·재이용 차단</td></tr><tr><th scope="row">언어·번역</th><td>자료 언어와 편집문 언어 구분. 번역 검수 및 원본 버전 일치 전 외국어 초안 공개 제외</td></tr></tbody></table></div></section><IiifManifestPreview />
  </article><ArchiveFooter /></ArchiveShell>;
}
