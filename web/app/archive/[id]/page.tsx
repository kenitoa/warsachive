import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveEvents, archiveRecords, editorialCollections, editorialStories, getPublicationPageEvidence } from "../../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../../components/archive-shell";
import { CorrectionForm, ReadingTools, ReturnToResults, SaveReadingPosition, SourceLink, RelatedRecordLink } from "../../components/reading-tools";
import { getSiteUrl } from "../../site-config";
import { KnowledgeRecordPanel } from "../../components/knowledge-record-panel";
import { publicKnowledge } from "../../../lib/knowledge-data";
import { RecordReadingGuide, SectionEvidenceGuide } from "../../components/knowledge-reading-guide";
import { fullLocaleRoutes } from "../../../lib/knowledge-localization";
import { KnowledgeAnchorJump } from "../../components/knowledge-anchor";

export const dynamicParams = false;
export function generateStaticParams() { return archiveRecords.map(record => ({ id: record.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const record = archiveRecords.find(item => item.id === id);
  if (!record) return {};
  const publicRecord = archiveEvents.some(item => item.id === id);
  const url = getSiteUrl() + "/archive/" + record.id + "/";
  const imageUrl = getSiteUrl() + "/images/social/" + (publicRecord ? "archive-" + record.id : "home") + ".png";
  const translations = fullLocaleRoutes(publicKnowledge, archiveEvents).filter(route => route.recordId === id);
  const languages = translations.length ? { ko: url, ...Object.fromEntries(translations.map(route => [route.locale, getSiteUrl() + route.href])) } : undefined;
  return { title: record.title + (publicRecord ? "" : " · 검토 안내") + " | 전쟁 역사 아카이브", description: publicRecord ? record.summary : "이 기록은 제목·분류·근거의 연결을 검토하고 있습니다. 기존 기록 주소와 원본은 보존됩니다.", alternates: { canonical: url, ...(languages ? { languages } : {}) }, robots: { index: publicRecord, follow: true }, openGraph: { title: record.title, description: publicRecord ? record.summary : "기록 검토 안내", type: "article", url, images: [{ url: imageUrl, width: 1200, height: 630, alt: record.title }] }, twitter: { card: "summary_large_image", images: [imageUrl] } };
}
export default async function ArchiveRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const record = archiveRecords.find(item => item.id === id);
  if (!record) notFound();
  const isPublic = archiveEvents.some(item => item.id === id);
  const basePath = new URL(getSiteUrl()).pathname.replace(/\/$/, "");
  if (!isPublic) return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet reviewHolding">
    <nav className="breadcrumbs" aria-label="현재 위치"><Link href="/">처음</Link> / <Link href="/archive/">아카이브</Link> / 검토 안내</nav>
    <p className="sectionNumber">RECORD UNDER REVIEW · {record.id}</p><h1>{record.title}</h1><h2>이 기록은 검토 중입니다.</h2><p>{record.review.note}</p><p>원본 수집 파일과 기존 주소를 보존했습니다. 제목·본문·시기·출처가 일치하는지 확인하기 전에는 수집 요약을 사건 해설로 다시 노출하지 않습니다.</p>
    <Link className="primaryAction" href="/archive/">공개 기록 찾기</Link><Link className="secondaryAction" href="/about/#review">검수·정정 기준</Link><CorrectionForm recordId={record.id} recordTitle={record.title} />
  </article><ArchiveFooter /></ArchiveShell>;
  const url = getSiteUrl() + "/archive/" + record.id + "/";
  const structuredData = { "@context": "https://schema.org", "@type": "CreativeWork", name: record.title, description: record.summary, url, inLanguage: "ko-KR", datePublished: record.publishedAt, dateModified: record.updatedAt, keywords: record.labels.join(", "), citation: record.sources.map(source => ({ "@type": "CreativeWork", name: source.title, url: source.url })), isPartOf: { "@type": "CollectionPage", "@id": getSiteUrl() + "/#collection" } };
  const related = record.relatedIds.map(relatedId => archiveEvents.find(item => item.id === relatedId)).filter(item => item !== undefined);
  const publicationEvidence = getPublicationPageEvidence(record);
  return <ArchiveShell pageClassName="recordRoutePage">
    <KnowledgeAnchorJump />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <article className="recordSheet" data-archive-publication={publicationEvidence ? "approved" : undefined} data-archive-record-id={publicationEvidence?.recordId} data-archive-content-hash={publicationEvidence?.contentHash} data-archive-approved-revision={publicationEvidence?.revision}>
      <nav className="breadcrumbs" aria-label="현재 위치"><Link href="/">처음</Link><span aria-hidden="true"> / </span><Link href="/archive/">아카이브</Link><span aria-hidden="true"> / </span><span>{record.title}</span></nav>
      <p className="sectionNumber">{record.kind === "event" ? "EVENT / 사건 해설" : "SOURCE / 사료 안내"} · {record.period}</p><h1>{record.title}</h1>
      <dl className="recordFacts"><div><dt>시기</dt><dd>{record.period}{record.date.precision === "approximate" ? " (추정)" : ""}</dd></div><div><dt>지역</dt><dd>{record.region}</dd></div><div><dt>공개 상태</dt><dd>{record.review.status === "approved" ? "편집 승인" : "출처 대조"}{record.review.humanReviewed ? " · 사람 검토 완료" : " · 사람 검토 대기"}</dd></div></dl>
      <p className="recordLead">{record.summary}</p><ReadingTools record={record} publicPath={basePath + "/archive/" + record.id + "/"} /><div className="editorialActions"><Link href={`/workspace/?record=${record.id}`}>연구 질문과 근거 남기기 →</Link><Link href={`/teach/?records=${record.id}`}>수업 자료로 구성하기 →</Link><Link href={`/corrections/?record=${record.id}`}>정정·자료 제안 접수 →</Link></div>
      <RecordReadingGuide record={record} />
      <p><Link href="/read/">승인된 언어별 전체 읽기 확인 →</Link>{fullLocaleRoutes(publicKnowledge, archiveEvents).filter(route => route.recordId === record.id).map(route => <Link key={route.href} href={route.href} hrefLang={route.locale}> · {route.locale}</Link>)}</p>
      <nav className="recordContents" aria-label="기록 목차"><h2>이 기록에서 읽을 내용</h2><ol>{record.sections.map(section => <li key={section.id}><a href={"#" + section.id}>{section.title}</a></li>)}{record.chronology.length ? <li><a href="#chronology">시간 흐름</a></li> : null}<li><a href="#entities">인물과 장소</a></li>{publicKnowledge.recordLinks.some(link => link.recordId === record.id) ? <li><a href="#knowledge">자료의 연결과 확인 범위</a></li> : null}<li><a href="#limitations">확인 범위와 해석</a></li><li><a href="#sources">사용한 자료</a></li></ol></nav>
      <div className="recordBody">{record.sections.map(section => <section key={section.id} id={section.id} tabIndex={-1} className="recordSection"><h2>{section.title}{section.interpretation ? <small> 편집 해석</small> : null}</h2>{section.paragraphs.map((paragraph, index) => <p id={`${section.id}-paragraph-${index + 1}`} key={section.id + "-" + index}>{paragraph}</p>)}<p className="evidenceLinks">근거: {section.sourceIds.map(sourceId => { const source = record.sources.find(item => item.id === sourceId); return source ? <a key={sourceId} href={"#source-" + sourceId}>{source.title}</a> : null; })}</p><SectionEvidenceGuide record={record} sectionId={section.id} /><SaveReadingPosition recordId={record.id} sectionId={section.id} /></section>)}</div>
      {record.chronology.length ? <section className="recordSection" id="chronology" tabIndex={-1}><h2>시간 흐름</h2><ol className="detailChronology">{record.chronology.map((moment, index) => <li key={moment.date + "-" + index}><strong>{moment.date}</strong><h3>{moment.title}</h3><p>{moment.text}</p><p className="evidenceLinks">{moment.sourceIds.map(sourceId => <a key={sourceId} href={"#source-" + sourceId}>근거 자료</a>)}</p></li>)}</ol></section> : null}
      <section className="recordSection" id="entities" tabIndex={-1}><h2>인물과 장소</h2><div className="entityGroups"><div><h3>인물</h3>{record.people.length ? record.people.map(person => <Link key={person.id} href={"/archive/?q=" + encodeURIComponent(person.name)}>{person.name}</Link>) : <p>확인된 인물 항목이 없습니다.</p>}</div><div><h3>장소</h3>{record.places.length ? record.places.map(place => <Link key={place.id} href={"/archive/?q=" + encodeURIComponent(place.name)}>{place.name}</Link>) : <p>확인된 장소 항목이 없습니다.</p>}</div></div></section>
      <KnowledgeRecordPanel recordId={record.id} />
      <section className="recordSection reviewInformation" id="limitations" tabIndex={-1}><h2>확인 범위와 해석</h2><p>{record.review.note}</p><ul>{record.limitations.map(item => <li key={item}>{item}</li>)}</ul><p>대조 담당: {record.review.reviewer} · 검토 {record.review.reviewedAt.slice(0, 10)} · 수정 {record.updatedAt.slice(0, 10)}</p><p>출처 대조는 자료의 전체 사실성이나 모든 해석에 대한 사람의 승인을 뜻하지 않습니다.</p><SaveReadingPosition recordId={record.id} sectionId="limitations" /></section>
      <section className="recordSection sourceCatalogue" id="sources" tabIndex={-1}><h2>사용한 자료 {record.sources.length}건</h2><Link href="/about/#terms">사료·원문·국역 용어 안내 →</Link><p>문서·기관·독립 근거의 수는 서로 다릅니다. 같은 자료의 재게시본을 독립 근거로 계산하지 않습니다.</p>{record.sources.map(source => <article key={source.id} id={"source-" + source.id} tabIndex={-1}><h3>{source.title}</h3><dl><div><dt>작성·생산 주체</dt><dd>{source.creator}</dd></div><div><dt>제공 기관</dt><dd>{source.institution}</dd></div><div><dt>유형</dt><dd>{({ primary: "1차 자료", research: "연구", institutional: "기관 해설", testimony: "증언", media: "언론" })[source.kind]} · {source.language}</dd></div><div><dt>제작 시점</dt><dd>{source.created || "별도 확인 필요"}</dd></div><div><dt>대조 위치</dt><dd>{source.location}</dd></div><div><dt>이용 조건</dt><dd>{source.rights}</dd></div><div><dt>주소 확인</dt><dd>{source.checkedAt.slice(0, 10)}</dd></div></dl><SourceLink href={source.url}>{source.kind === "primary" ? "원문·국역 열기 ↗" : "기관 자료 안내 열기 ↗"}</SourceLink></article>)}</section>
      <div className="recordLabels">{record.labels.map(label => <Link key={label} href={"/archive/?label=" + encodeURIComponent(label)}>{label}</Link>)}</div>
      {related.length ? <section className="recordSection relatedRecords"><h2>이어 읽을 기록</h2>{related.map(item => <RelatedRecordLink key={item.id} href={"/archive/" + item.id + "/"}>{item.title}<span>{item.period} →</span></RelatedRecordLink>)}</section> : null}
      <section className="recordSection"><h2>정정과 변경 이력</h2>{record.corrections.length ? <ul>{record.corrections.map((correction, index) => <li key={correction.date + "-" + index}>{correction.date.slice(0, 10)} · {correction.reason}</li>)}</ul> : <p>공개 이후 등록된 정정 이력이 없습니다.</p>}<CorrectionForm recordId={record.id} recordTitle={record.title} /></section>
      <ReturnToResults basePath={basePath} detailPaths={[...editorialCollections.map(item => basePath + "/collections/" + item.id + "/"), ...editorialStories.map(item => basePath + "/stories/" + item.id + "/")]} />
    </article><ArchiveFooter />
  </ArchiveShell>;
}
