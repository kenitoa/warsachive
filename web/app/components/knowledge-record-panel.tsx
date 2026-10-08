import Link from "next/link";
import { getKnowledgeForRecord } from "../../lib/knowledge-data";
import { KnowledgeDateList, KnowledgeEvidence, KnowledgeMaterials } from "./knowledge-view";
import styles from "./knowledge-styles.module.css";
import { WorkBasket } from "./knowledge-basket";

export function KnowledgeRecordPanel({ recordId }: { recordId: string }) {
  const knowledge = getKnowledgeForRecord(recordId);
  if (!knowledge.sources.length) return null;
  return <section id="knowledge" className={styles.panel} tabIndex={-1}>
    <h2>자료의 연결과 확인 범위</h2>
    <p>{knowledge.collectionLevel?.label} · 자료 연결 검수: {knowledge.sources.every(source => source.review.status === "approved" && source.review.humanReviewed) ? "사람 승인 완료" : "AI 출처 대조 · 사람 최종 검수 대기"}</p>
    <nav aria-label="연결한 인물·장소·기관" className={styles.links}>{knowledge.entities.map(entity => <Link key={entity.id} href={`/entities/${entity.id}/`}>{entity.name}</Link>)}<Link href="/places/">장소 목록</Link><Link href="/sources/">출처 목록</Link></nav>
    {knowledge.dates.length ? <details><summary>사건·기사·제작·등재 날짜 구분</summary><KnowledgeDateList dates={knowledge.dates} /></details> : null}
    <details><summary>작품·판본·소장 정보</summary><KnowledgeMaterials ids={knowledge.materials.map(material => material.id)} /></details>
    <details><summary>근거가 연결된 설명 {knowledge.claims.length}건</summary><div className={styles.grid}>{knowledge.claims.map(claim => <article id={claim.id} tabIndex={-1} key={claim.id} className={styles.card}><h3>{claim.text}</h3><p>{claim.qualification}</p><p>{claim.review.humanReviewed ? "이 설명의 사람 검수 완료" : "이 설명의 사람 검수 대기"} · 대조 {claim.review.checkedAt}</p><KnowledgeEvidence references={claim.evidence} /><WorkBasket records={[{ id: recordId, title: claim.text }]} returnTo={`/archive/${recordId}/#${claim.id}`} context={{ record: recordId, source: claim.evidence[0]?.sourceId, locator: claim.evidence[0]?.locator, quoteKind: "source-link" }} /></article>)}</div></details>
    {knowledge.disagreements.map(disagreement => <details key={disagreement.id}><summary>{disagreement.title} · 검토 중</summary><p>{disagreement.question}</p><div className={styles.grid}>{disagreement.positions.map(position => <article key={position.label} className={styles.card}><h3>{position.label}</h3><p>{position.description}</p><KnowledgeEvidence references={position.evidence} /></article>)}</div><p className={styles.notice}>같은 기관 항목이 병기한 설명입니다. 독립 자료 두 건으로 계산하지 않으며 판본 대조와 사람 검토 전에는 결론을 내리지 않습니다.</p></details>)}
    <p className={styles.muted}>번역 상태: 한국어 편집문은 출처 대조 상태입니다. 검수하지 않은 외국어 초안은 공개하지 않습니다.</p>
  </section>;
}
