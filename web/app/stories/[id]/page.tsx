import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveEvents, editorialStories, storyRouteEntries } from "../../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../../components/archive-shell";
import { getSiteUrl, makePageMetadata, sitePath } from "../../site-config";
import { SourceLink } from "../../components/reading-tools";
import { ReadingPurpose } from "../../components/knowledge-reading-guide";
import { WorkBasket } from "../../components/knowledge-basket";
import { EditorialHolding, editorialHoldingMetadata } from "../../components/editorial-holding";

export const dynamicParams = false;
export function generateStaticParams() { return storyRouteEntries.map((story) => ({ id: story.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const story = editorialStories.find((item) => item.id === id);
  const retained=storyRouteEntries.find(item=>item.id===id);
  return story ? makePageMetadata(story.title, story.deck, `/stories/${story.id}/`) : retained ? editorialHoldingMetadata(retained.title,`/stories/${id}/`) : {};
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = editorialStories.find((item) => item.id === id);
  if (!story) {const retained=storyRouteEntries.find(item=>item.id===id);if(retained)return <EditorialHolding title={retained.title}/>;notFound();}
  const records = archiveEvents.filter((record) => story.recordIds.includes(record.id));
  const sources = Array.from(new Map(records.flatMap((record) => record.sources.filter((source) => story.sourceIds.includes(source.id)).map((source) => [source.id, source] as const))).values());
  const structuredData = { "@context": "https://schema.org", "@type": "Article", headline: story.title, description: story.deck, url: `${getSiteUrl()}/stories/${story.id}/`, dateModified: story.updatedAt, inLanguage: "ko-KR", isPartOf: { "@type": "WebSite", name: "전쟁 역사 아카이브", url: getSiteUrl() } };
  return <ArchiveShell pageClassName="routePage editorialDetail"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /><article className="editorialSheet storySheet"><nav className="breadcrumbs" aria-label="현재 위치"><Link href="/">홈</Link><span aria-hidden="true">/</span><Link href="/stories/">스토리</Link><span aria-hidden="true">/</span><span aria-current="page">{story.title}</span></nav><header className="editorialHeader"><p className="routeEyebrow">EDITORIAL STORY / 편집 해설</p><h1>{story.title}</h1><p className="storyDeck">{story.deck}</p><div className="editorialFacts"><span>약 {story.readingMinutes}분</span><span>편집 · {story.author}</span><span>수정 <time dateTime={story.updatedAt}>{story.updatedAt.slice(0, 10)}</time></span></div></header><div className="editorialNotice"><p>{story.reviewNote}</p><p>아래 설명은 자료를 연결하는 편집 해설입니다. 직접 인용한 증언으로 제시하지 않습니다.</p></div><ReadingPurpose records={records} title={story.title} questions={story.learningQuestions} /><WorkBasket records={records.map(record => ({ id: record.id, title: record.title }))} returnTo={sitePath(`/stories/${story.id}/`)} /><nav className="editorialContents" aria-label="이야기 목차"><h2>목차</h2><ol>{story.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}<li><a href="#story-sources">연결 자료와 근거</a></li><li><a href="#learning-questions">함께 생각할 질문</a></li></ol></nav><p className="storyIntroduction">{story.introduction}</p>{story.sections.map((section) => <section className="editorialProse" id={section.id} key={section.id}><p className="editorialEyebrow">{section.interpretation ? "편집 해석" : "자료에 따른 설명"}</p><h2>{section.title}</h2>{section.paragraphs.map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}<div className="sectionSourceLinks">{section.sourceIds.map((sourceId) => { const source = sources.find((item) => item.id === sourceId); return source ? <a href={`#story-source-${source.id}`} key={source.id}>자료 근거 · {source.title}</a> : null; })}</div></section>)}<section className="editorialNotice" id="learning-questions"><h2>함께 생각할 질문</h2><ul>{story.learningQuestions.map((question) => <li key={question}>{question}</li>)}</ul></section><section className="storySourceList" id="story-sources"><h2>연결 자료와 근거</h2><p>연결 자료에는 원문과 현대 기관 해설이 포함될 수 있습니다. 각 자료의 설명과 제공 범위, 이용 조건을 확인하세요. 외부 자료는 새 창에서 열립니다.</p><ol>{sources.map((source) => <li id={`story-source-${source.id}`} key={source.id}><SourceLink href={source.url}>{source.title} ↗</SourceLink><p>{source.creator} · {source.institution}</p><p>{source.location}</p><small>이용 조건 · {source.rights}</small></li>)}</ol></section><section className="editorialRelated" id="related-records"><h2>사건과 사료를 더 읽기</h2><ul className="editorialRecordList">{records.map((record) => <li key={record.id}><Link href={`/archive/${record.id}/?returnTo=${encodeURIComponent(sitePath(`/stories/${story.id}/#related-records`))}`}><span>{record.period}</span><strong>{record.title}</strong><p>{record.summary}</p><span>전체 기록과 한계 확인 →</span></Link></li>)}</ul></section><div className="editorialActions"><Link href="/stories/">다른 이야기 보기 →</Link><Link href="/about/#corrections">정정 안내 →</Link></div></article><ArchiveFooter /></ArchiveShell>;
}

