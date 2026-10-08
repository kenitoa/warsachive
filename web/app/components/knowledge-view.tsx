import Link from "next/link";
import type { EvidenceReference, HistoricalDate, KnowledgeReview } from "../../lib/knowledge-types";
import { formatHistoricalDate } from "../../lib/knowledge-domain";
import { publicKnowledge } from "../../lib/knowledge-data";
import { archiveEvents } from "../../lib/archive-data";
import styles from "./knowledge-styles.module.css";

export function KnowledgeReviewNotice({ review }: { review?: KnowledgeReview }) {
  const labels = { bibliography: "서지", locator: "원문 위치 대조", interpretation: "편집 해석", rights: "이용 권리", translation: "번역", geography: "위치" };
  return <div className={styles.notice}><p>{review?.humanReviewed ? "사람 검토 완료" : "출처 대조 · 사람 최종 검수 대기"}{review ? ` · ${review.checkedAt}` : ""}<br />{review?.note ?? publicKnowledge.scopeNote}</p>{review?.scopes?.length ? <ul>{review.scopes.map(scope => <li key={scope.kind}>{labels[scope.kind]} · {scope.status === "approved" && scope.humanReviewed ? "사람 승인" : scope.status === "source-checked" ? "출처 대조" : "검토 대기·보류"} · {scope.checkedAt}<p>{scope.note}</p></li>)}</ul> : <p>서지·원문 위치·해석·권리·번역·좌표의 개별 승인 범위는 아직 등록되지 않았습니다. 전체 출처 대조 상태를 세부 항목의 사람 승인으로 읽지 않습니다.</p>}</div>;
}
export function KnowledgeEvidence({ references }: { references: EvidenceReference[] }) {
  return <ul className={styles.evidence}>{references.map((reference, index) => {
    const source = publicKnowledge.sources.find(item => item.id === reference.sourceId);
    return <li key={`${reference.sourceId}-${index}`}>{source ? <Link href={`/sources/${source.id}/`}>{source.title}</Link> : "자료 연결 확인 중"} · {reference.locator}<br /><span className={styles.muted}>{reference.note}</span></li>;
  })}</ul>;
}
export function KnowledgeRecordLinks({ ids }: { ids: string[] }) {
  const records = archiveEvents.filter(record => ids.includes(record.id));
  return <div className={styles.links}>{records.length ? records.map(record => <Link key={record.id} href={`/archive/${record.id}/`}>{record.title} →</Link>) : <p>현재 공개된 연결 기록이 없습니다.</p>}</div>;
}
export function KnowledgeDateList({ dates }: { dates: HistoricalDate[] }) {
  return <ul className={styles.dateList}>{dates.map(date => <li key={date.id}><strong>{date.label}</strong>{formatHistoricalDate(date)}<br /><span className={styles.muted}>자료 표기: {date.originalText}{date.calendar === "lunisolar" && !date.conversion ? " · 현대 달력 환산 미확인" : ""}</span><KnowledgeEvidence references={date.evidence} /></li>)}</ul>;
}
export function KnowledgeMaterials({ ids }: { ids: string[] }) {
  const materials = publicKnowledge.materials.filter(material => ids.includes(material.id));
  return <div className={styles.grid}>{materials.map(material => <article className={styles.card} key={material.id} id={material.id}>
    <h3>{material.title}</h3><p>{material.description}</p><p className={styles.muted}>원자료 언어: {material.languageTags.join(" · ")}</p>
    <KnowledgeEvidence references={material.evidence} />
    {publicKnowledge.editions.filter(edition => edition.materialId === material.id).map(edition => <div key={edition.id}><h4>{edition.title}</h4><p>{edition.description}</p><dl className={styles.facts}><div><dt>형태·분량</dt><dd>{{ manuscript: "필사본", woodblock: "목판본", printed: "인쇄본", unknown: "형태 미확정" }[edition.form]} · {edition.extent ?? "분량 미확인"}</dd></div><div><dt>소장 안내</dt><dd>{edition.custodianId ? <Link href={`/entities/${edition.custodianId}/`}>{publicKnowledge.entities.find(entity => entity.id === edition.custodianId)?.name}</Link> : "현재 실물 소장기관 미확인"}</dd></div><div><dt>식별·청구기호</dt><dd>{edition.identifier ?? "미확인"}</dd></div></dl><KnowledgeEvidence references={edition.evidence} /></div>)}
  </article>)}</div>;
}
