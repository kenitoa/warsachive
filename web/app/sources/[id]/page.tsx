import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveEvents } from "../../../lib/archive-data";
import { knowledgeRegistry, publicKnowledge } from "../../../lib/knowledge-data";
import { bibliographicJson, bibliographicRis, buildKnowledgeJsonLd, getMediaControls, publicResourceLink } from "../../../lib/knowledge-domain";
import { ArchiveFooter, ArchiveShell } from "../../components/archive-shell";
import { BibliographyDownload } from "../../components/knowledge-tools";
import { KnowledgeEvidence, KnowledgeMaterials, KnowledgeRecordLinks, KnowledgeReviewNotice } from "../../components/knowledge-view";
import { getSiteUrl, makePageMetadata } from "../../site-config";
import { sourceAvailability, sourceIndependence } from "../../../lib/knowledge-reading";
import { WorkBasket } from "../../components/knowledge-basket";
import { ReturnToResults } from "../../components/reading-tools";
import { IiifResourcePresentation } from "../../components/knowledge-iiif";
import styles from "../../components/knowledge-styles.module.css";

export const dynamicParams = false;
export function generateStaticParams() { return knowledgeRegistry.sources.map(source => ({ id: source.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const source = publicKnowledge.sources.find(entry => entry.id === id);
  return source ? makePageMetadata(source.title, source.locator, `/sources/${id}/`) : { title: "출처 공개 검토 안내 | 전쟁 역사 아카이브", robots: { index: false, follow: true } };
}
export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const source = publicKnowledge.sources.find(entry => entry.id === id);
  if (!source) {
    if (!knowledgeRegistry.sources.some(entry => entry.id === id)) notFound();
    return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><p className="sectionNumber">REVIEW NOTICE</p><h1>출처의 공개 상태를 검토하고 있습니다.</h1><p>연결 기록이나 자료 검수 상태의 변경으로 이 출처의 공개 설명과 내보내기를 보류했습니다. 기존 주소는 유지합니다.</p><Link href="/sources/">현재 공개 출처 보기 →</Link><Link href="/archive/">공개 기록 보기 →</Link></article><ArchiveFooter /></ArchiveShell>;
  }
  const provider = publicKnowledge.entities.find(entity => entity.id === source.providerId);
  const recordIds = archiveEvents.filter(record => record.sources.some(entry => entry.id === id)).map(record => record.id);
  const graph = buildKnowledgeJsonLd(publicKnowledge, getSiteUrl());
  const structured = { "@context": graph["@context"], "@graph": graph["@graph"].filter(node => node["@id"] === `${getSiteUrl()}/sources/${id}/`) };
  const independence = sourceIndependence(source, publicKnowledge);
  const availability = sourceAvailability(source.id, publicKnowledge);
  const claims = publicKnowledge.claims.filter(claim => claim.evidence.some(reference => reference.sourceId === id));
  const resources = publicKnowledge.resources.filter(resource => source.resourceIds.includes(resource.id));
  const linkedEditorial = archiveEvents.filter(record => recordIds.includes(record.id)).flatMap(record => record.sections.filter(section => section.sourceIds.includes(id)).map(section => ({ recordId: record.id, recordTitle: record.title, section })));
  return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><nav className="breadcrumbs" aria-label="현재 위치"><Link href="/sources/">출처와 서지</Link> / 자료 상세</nav><p className="sectionNumber">BIBLIOGRAPHY · {source.id}</p><h1>{source.title}</h1><KnowledgeReviewNotice review={source.review} />
    <dl className={styles.facts}><div><dt>작성·생산</dt><dd>{source.creator}</dd></div><div><dt>자료 제공</dt><dd><Link href={`/entities/${source.providerId}/`}>{provider?.name}</Link></dd></div><div><dt>자료 언어</dt><dd>{source.languageTags.join(" · ")}</dd></div><div><dt>대조 위치</dt><dd>{source.locator}</dd></div><div><dt>현대 페이지 발행일</dt><dd>{source.publicationDate ?? "확인하지 않음; 역사 자료의 기사 날짜와 구분"}</dd></div><div><dt>접근·대조일</dt><dd>{source.accessedAt}</dd></div><div><dt>자료 계통</dt><dd>{source.provenanceGroup} · 독립 증언 수로 자동 계산하지 않음</dd></div></dl>
    <a href={source.url} target="_blank" rel="noreferrer noopener">제공 기관 페이지 열기 ↗</a><KnowledgeEvidence references={source.evidence} /><BibliographyDownload sourceId={source.id} json={JSON.stringify(bibliographicJson(source), null, 2)} ris={bibliographicRis(source)} />
    <section className={styles.panel}><h2>자료 계통과 실제 제공 범위</h2><p>{independence.note}</p><p>등록 계통: {independence.group}</p>{independence.shared.length ? <ul>{independence.shared.map(item => <li key={item.id}><Link href={`/sources/${item.id}/`}>{item.title}</Link> · 같은 계통</li>)}</ul> : <p>현재 공개 목록에서 같은 계통의 다른 안내가 없습니다. 이것만으로 다른 출처와 독립적인 증언임을 확정하지 않습니다.</p>}{availability.map((item, index) => <article key={index}><h3>{item.label}</h3><p>{item.note}</p>{item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener">실제 제공 기관에서 범위 확인 ↗</a> : <p>직접 표시·원문 제공 여부는 공개 근거를 확인해야 합니다.</p>}</article>)}<WorkBasket records={archiveEvents.filter(record => recordIds.includes(record.id)).map(record => ({ id: record.id, title: record.title }))} returnTo={`/sources/${id}/`} context={{ source: id, locator: source.locator, quoteKind: "source-link" }} /></section>
    <section className={styles.panel}><h2>연결 공개 기록</h2><KnowledgeRecordLinks ids={recordIds} /></section>
    <section className={styles.panel}><h2>이 자료에 근거를 연결한 설명</h2>{claims.length ? claims.map(claim => <article className={styles.card} key={claim.id} id={claim.id}><h3>{claim.text}</h3><p>{claim.qualification}</p><p>{claim.review.humanReviewed ? "이 설명의 사람 검수 완료" : "이 설명의 사람 검수 대기"} · 대조 {claim.review.checkedAt}</p><KnowledgeEvidence references={claim.evidence} />{claim.recordIds.map(recordId => <Link key={recordId} href={`/archive/${recordId}/#${claim.id}`}>연결 기록에서 설명·한계 함께 확인 → </Link>)}</article>) : <p>이 출처를 연결한 추가 설명 항목은 아직 등록되지 않았습니다.</p>}</section>
    <section className={styles.panel}><h2>이 출처를 이용한 편집문</h2><p>공개 기록에서 이 자료를 근거로 연결한 설명입니다. 기관 원문·국역의 인용문이나 전체 전사를 재현한 본문이 아닙니다.</p>{linkedEditorial.map(({ recordId, recordTitle, section }) => <article key={`${recordId}-${section.id}`} className={styles.card}><h3>{section.title}{section.interpretation ? " · 편집 해석" : ""}</h3>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<Link href={`/archive/${recordId}/#${section.id}`}>{recordTitle}에서 맥락과 함께 읽기 →</Link></article>)}</section>
    {source.materialIds.length ? <section className={styles.panel}><h2>작품·판본 구분</h2><KnowledgeMaterials ids={source.materialIds} /></section> : null}
    <section className={styles.panel}><h2>디지털 표현과 이용 조건</h2>{resources.map(resource => {
      const rights = publicKnowledge.rights.find(right => right.id === resource.rightsId);
      const controls = rights ? getMediaControls(rights) : null;
      const url = publicResourceLink(resource, publicKnowledge);
      return <article key={resource.id} className={styles.card}><h3>{resource.kind === "original-and-translation" ? "기관 제공 원문·국역" : resource.kind === "iiif" ? "IIIF 디지털 표현" : "기관 자료 안내"}</h3><p>{resource.description}</p><p>{rights?.statement}</p><p className={styles.muted}>미디어 권리 상태: {rights?.status === "unknown" ? "개별 이용 허가 미확인" : rights?.status}</p><p>{controls?.reason}</p><div className={styles.links}>{url ? <a href={url} target="_blank" rel="noreferrer noopener">기관 자료에서 확인 ↗</a> : <span>미디어 직접 표시 보류</span>}</div><p>이 사이트의 미디어 표시: {controls?.display ? "허용" : "보류"} · 다운로드: {controls?.download ? "허용" : "보류"} · 재이용: {controls?.reuse ? "확인" : "미확인"}</p><p>검증한 IIIF Manifest: {resource.iiifManifest ? <a href={resource.iiifManifest} target="_blank" rel="noreferrer noopener">Manifest 링크 ↗</a> : "등록되지 않음"}</p><IiifResourcePresentation resource={resource} registry={publicKnowledge} />{rights ? <KnowledgeEvidence references={rights.evidence} /> : null}</article>;
    })}</section>
    {publicKnowledge.translations.some(translation => translation.resourceIds.some(resourceId => source.resourceIds.includes(resourceId))) ? <section className={styles.panel}><h2>기관 국역과 편집 번역</h2>{publicKnowledge.translations.filter(translation => translation.resourceIds.some(resourceId => source.resourceIds.includes(resourceId))).map(translation => <article key={translation.id}><h3>{translation.title}</h3><p>{translation.scope}</p><p>제공: <Link href={`/entities/${translation.providerId}/`}>{publicKnowledge.entities.find(entity => entity.id === translation.providerId)?.name}</Link> · 개별 번역자: {translation.translatorIds.length ? translation.translatorIds.map(target => publicKnowledge.entities.find(entity => entity.id === target)?.name).join(" · ") : "미확인"}</p><KnowledgeEvidence references={translation.evidence} /></article>)}<p className={styles.notice}>기관이 제공하는 역사 자료 국역과 이 사이트의 외국어 편집문은 다른 번역입니다. 이 사이트의 검수하지 않은 영어 초안은 공개하지 않습니다.</p></section> : null}
    <ReturnToResults basePath={new URL(getSiteUrl()).pathname.replace(/\/$/, "")} detailPaths={archiveEvents.map(record => new URL(getSiteUrl()).pathname.replace(/\/$/, "") + `/archive/${record.id}/`)} />
  </article><ArchiveFooter /></ArchiveShell>;
}
