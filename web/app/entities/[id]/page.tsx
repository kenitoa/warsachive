import Link from "next/link";
import { notFound } from "next/navigation";
import { knowledgeRegistry, publicKnowledge } from "../../../lib/knowledge-data";
import { archiveEvents } from "../../../lib/archive-data";
import { buildKnowledgeJsonLd } from "../../../lib/knowledge-domain";
import { ArchiveFooter, ArchiveShell } from "../../components/archive-shell";
import { KnowledgeEvidence, KnowledgeMaterials, KnowledgeRecordLinks, KnowledgeReviewNotice } from "../../components/knowledge-view";
import { getSiteUrl, makePageMetadata } from "../../site-config";
import { ReturnToResults } from "../../components/reading-tools";
import { WorkBasket } from "../../components/knowledge-basket";
import styles from "../../components/knowledge-styles.module.css";

export const dynamicParams = false;
export function generateStaticParams() { return knowledgeRegistry.entities.map(entity => ({ id: entity.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const entity = publicKnowledge.entities.find(entry => entry.id === id);
  return entity ? makePageMetadata(entity.name, entity.description, `/entities/${id}/`) : { title: "자료 연결 검토 안내 | 전쟁 역사 아카이브", robots: { index: false, follow: true } };
}
export default async function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const entity = publicKnowledge.entities.find(entry => entry.id === id);
  if (!entity) {
    if (!knowledgeRegistry.entities.some(entry => entry.id === id)) notFound();
    return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><p className="sectionNumber">REVIEW NOTICE</p><h1>자료 연결을 검토하고 있습니다.</h1><p>연결한 공개 기록이나 출처의 상태가 바뀌어 이 항목의 공개 설명을 보류했습니다. 기존 주소는 유지합니다.</p><Link href="/entities/">현재 공개 항목 보기 →</Link><Link href="/archive/">공개 기록 보기 →</Link></article><ArchiveFooter /></ArchiveShell>;
  }
  const materials = publicKnowledge.materials.filter(material => material.creatorIds.includes(id) || publicKnowledge.editions.some(edition => edition.materialId === material.id && edition.custodianId === id));
  const sources = publicKnowledge.sources.filter(source => source.providerId === id);
  const relations = publicKnowledge.relations.filter(relation => relation.subjectId === id || relation.objectId === id);
  const graph = buildKnowledgeJsonLd(publicKnowledge, getSiteUrl());
  const structured = { "@context": graph["@context"], "@graph": graph["@graph"].filter(node => node["@id"] === `${getSiteUrl()}/entities/${id}/`) };
  const label = { person: "인물", organization: "기관", place: "장소" }[entity.kind];
  const relationTarget = (target: string): { label: string; href: string | null } => {
    const targetEntity = publicKnowledge.entities.find(entry => entry.id === target);
    if (targetEntity) return { label: targetEntity.name, href: `/entities/${target}/` };
    const targetSource = publicKnowledge.sources.find(entry => entry.id === target);
    if (targetSource) return { label: targetSource.title, href: `/sources/${target}/` };
    const targetMaterial = publicKnowledge.materials.find(entry => entry.id === target);
    if (targetMaterial) { const materialSource = publicKnowledge.sources.find(entry => entry.materialIds.includes(target)); return { label: targetMaterial.title, href: materialSource ? `/sources/${materialSource.id}/#${target}` : null }; }
    const targetRecord = archiveEvents.find(entry => entry.id === target);
    if (targetRecord) return { label: targetRecord.title, href: `/archive/${target}/` };
    const targetEdition = publicKnowledge.editions.find(entry => entry.id === target);
    if (targetEdition) return { label: targetEdition.title, href: null };
    const targetTranslation = publicKnowledge.translations.find(entry => entry.id === target);
    return { label: targetTranslation?.title ?? target, href: null };
  };
  return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><nav className="breadcrumbs" aria-label="현재 위치"><Link href="/entities/">인물·기관·장소</Link> / {entity.name}</nav><p className="sectionNumber">{label} · {entity.id}</p><h1>{entity.name}</h1><p className="recordLead">{entity.description}</p><KnowledgeReviewNotice review={entity.review} />
    <WorkBasket records={archiveEvents.filter(record => entity.recordIds.includes(record.id) || record.sources.some(source => sources.some(item => item.id === source.id))).map(record => ({ id: record.id, title: record.title }))} returnTo={`/entities/${id}/`} />
    <dl className={styles.facts}><div><dt>다른 표기</dt><dd>{entity.aliases.join(" · ") || "등록된 다른 표기 없음"}</dd></div><div><dt>검수 범위</dt><dd>이름과 자료 연결 · 생몰년·좌표·협약 여부는 별도 검수 필요</dd></div></dl><h2>명칭·연결 근거</h2><KnowledgeEvidence references={entity.evidence} />{entity.externalAuthorityUrls.length ? <details><summary>공식 기관의 명칭 표기 자료</summary><p>확인한 영문 표기를 추적하는 링크입니다. 별개의 역사 증언이나 이 사이트의 협력기관 수에 더하지 않습니다.</p><ul className={styles.evidence}>{entity.externalAuthorityUrls.map((url, index) => <li key={url}><a href={url} target="_blank" rel="noreferrer noopener">명칭 표기 근거 {index + 1} · {new URL(url).hostname} ↗</a></li>)}</ul></details> : null}<section className={styles.panel}><h2>관련 공개 기록</h2><KnowledgeRecordLinks ids={entity.recordIds} /></section>
    {materials.length ? <section className={styles.panel}><h2>작성·소장 안내가 연결된 작품</h2><KnowledgeMaterials ids={materials.map(material => material.id)} /></section> : null}
    {sources.length ? <section className={styles.panel}><h2>제공한 자료</h2><div className={styles.links}>{sources.map(source => <Link key={source.id} href={`/sources/${source.id}/`}>{source.title}</Link>)}</div></section> : null}
    <section className={styles.panel}><h2>관계의 의미와 근거</h2>{relations.length ? relations.map(relation => { const subject = relationTarget(relation.subjectId); const target = relationTarget(relation.objectId); return <article key={relation.id} className={styles.card}><h3>{{ authored: "작성", "provided-by": "자료 제공", "held-by": "소장 안내", "edition-of": "작품·판본", "translation-of": "원자료·국역", "represented-by": "디지털 표현", mentions: "자료 언급", "associated-place": "기록·장소" }[relation.predicate]}</h3><p>{subject.href ? <Link href={subject.href}>{subject.label}</Link> : subject.label} → {target.href ? <Link href={target.href}>{target.label}</Link> : target.label}</p><p>{relation.note}</p><KnowledgeEvidence references={relation.evidence} /></article>; }) : <p>아직 검수한 추가 관계가 없습니다.</p>}</section>
    {entity.kind === "place" ? <p className={styles.notice}>좌표·역사적 경계를 확인하기 전에는 지도 위치를 추정하지 않습니다. <Link href="/places/">장소 목록에서 확인하기 →</Link></p> : null}
    <ReturnToResults basePath={new URL(getSiteUrl()).pathname.replace(/\/$/, "")} />
  </article><ArchiveFooter /></ArchiveShell>;
}
