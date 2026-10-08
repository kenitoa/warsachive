import Link from "next/link";
import type { ArchiveRecord } from "../../lib/archive-types";
import { publicKnowledge } from "../../lib/knowledge-data";
import { recordTrustSummary, sourceAvailability, readingLens } from "../../lib/knowledge-reading";
import { WorkBasket } from "./knowledge-basket";
import { getSiteUrl } from "../site-config";
import styles from "./knowledge-refinement.module.css";

export function RecordReadingGuide({ record }: { record: ArchiveRecord }) {
  const trust = recordTrustSummary(record, publicKnowledge);
  return <section className={styles.panel} aria-label="이 기록을 읽기 전 안내"><h2>이 기록에서 확인할 수 있는 것</h2><p>{trust.scope}입니다. {trust.reviewLabel}입니다.</p>
    <dl className={styles.scope}><div><dt>읽기 범위</dt><dd>설명 {trust.sections}개 · 약 {record.readingMinutes}분</dd></div><div><dt>자료 연결</dt><dd>출처 {trust.linkedSources}건 · 자료 계통 {trust.provenanceGroups}개</dd></div><div><dt>원문 접근</dt><dd>기관 원문·국역 링크 {trust.originalLinks}개</dd></div><div><dt>편집 해석</dt><dd>해석으로 표시한 설명 {trust.interpretationSections}개</dd></div></dl>
    <p><strong>먼저 알아둘 한계:</strong> {trust.firstLimitation}</p><p className={styles.muted}>{trust.disclaimer}</p><div className={styles.row}><a href="#sources">출처와 대조 위치 확인</a><a href="#limitations">검수 범위와 한계 읽기</a></div>
    <WorkBasket records={[{ id: record.id, title: record.title }]} returnTo={`/archive/${record.id}/`} context={{ record: record.id, quoteKind: "editorial" }} />
  </section>;
}
export function SectionEvidenceGuide({ record, sectionId }: { record: ArchiveRecord; sectionId: string }) {
  const section = record.sections.find(item => item.id === sectionId);
  if (!section) return null;
  const recordPath = new URL(getSiteUrl()).pathname.replace(/\/$/, "") + `/archive/${record.id}/#${sectionId}`;
  return <details className={styles.panel}><summary>이 설명의 근거 위치와 확인 범위</summary><p>이 설명은 {section.interpretation ? "자료를 연결한 편집 해석" : "출처를 대조한 자체 편집문"}입니다. 기관 원문을 직접 인용한 문장이 아닙니다.</p>
    {section.sourceIds.map(id => { const source = record.sources.find(item => item.id === id); if (!source) return null; const available = sourceAvailability(id, publicKnowledge);
      return <article key={id}><h3>{source.title}</h3><p>대조 위치: {source.location}</p><p>{source.creator} · {source.institution} · 확인 {source.checkedAt}</p>{available.map((item, index) => <p key={index}>{item.label} · {item.note}</p>)}<div className={styles.row}><a href={`#source-${id}`}>이 기록의 출처 설명</a>{publicKnowledge.sources.some(item => item.id === id) ? <Link href={`/sources/${id}/?returnTo=${encodeURIComponent(recordPath)}`}>서지·판본·이용 조건</Link> : null}</div><WorkBasket records={[{ id: record.id, title: record.title }]} returnTo={recordPath} context={{ record: record.id, section: sectionId, source: id, locator: source.location, quoteKind: "source-link" }} /></article>;
    })}
  </details>;
}
export function ReadingPurpose({ records, title, questions }: { records: ArchiveRecord[]; title: string; questions: string[] }) {
  const lenses = ["민간인", "외교", "보급", "전후 복구"].map(label => readingLens(records, label));
  return <section className={styles.panel}><h2>이 읽기 경로의 목적</h2><p>{title}의 설명과 사료 안내를 구분하고, 자료마다 확인한 범위와 남은 질문을 비교합니다.</p><p>권장 수준: 사건 흐름 입문 → 자료의 작성 맥락 → 근거·이견 비교. 순서는 학습 안내이며 전문가 검수 수준이나 자료의 진실성 순위가 아닙니다.</p><ol className={styles.list}>{questions.map(question => <li key={question}>{question}</li>)}</ol><div className={styles.grid}>{lenses.map(lens => <div key={lens.label}><h3>{lens.label}의 관점</h3><p>{lens.note}</p>{lens.records.map(record => <Link key={record.id} href={`/archive/${record.id}/`}>{record.title} → </Link>)}</div>)}</div></section>;
}
