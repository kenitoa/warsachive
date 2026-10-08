import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveEvents, editorialCollections, collectionRouteEntries } from "../../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../../components/archive-shell";
import { makePageMetadata, sitePath } from "../../site-config";
import { EditorialHolding, editorialHoldingMetadata } from "../../components/editorial-holding";
import { ReadingPurpose } from "../../components/knowledge-reading-guide";
import { WorkBasket } from "../../components/knowledge-basket";

export const dynamicParams = false;
export function generateStaticParams() { return collectionRouteEntries.map((collection) => ({ id: collection.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const collection = editorialCollections.find((item) => item.id === id);
  const retained=collectionRouteEntries.find(item=>item.id===id);
  return collection ? makePageMetadata(collection.title, collection.description, `/collections/${collection.id}/`) : retained ? editorialHoldingMetadata(retained.title,`/collections/${id}/`) : {};
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = editorialCollections.find((item) => item.id === id);
  if (!collection) {const retained=collectionRouteEntries.find(item=>item.id===id);if(retained)return <EditorialHolding title={retained.title}/>;notFound();}
  const records = collection.recordIds.flatMap((recordId) => archiveEvents.filter((record) => record.id === recordId));
  const sourceTotal = new Set(records.flatMap((record) => record.sources.map((source) => source.url))).size;
  const readingMinutes = records.reduce((total, record) => total + record.readingMinutes, 0);
  return <ArchiveShell pageClassName="routePage editorialDetail"><article className="editorialSheet"><nav className="breadcrumbs" aria-label="현재 위치"><Link href="/">홈</Link><span aria-hidden="true">/</span><Link href="/collections/">컬렉션</Link><span aria-hidden="true">/</span><span aria-current="page">{collection.title}</span></nav><header className="editorialHeader"><p className="routeEyebrow">CURATED COLLECTION / READING PATH</p><h1>{collection.title}</h1><p>{collection.description}</p><div className="editorialFacts"><span>{collection.period} · {collection.region}</span><span>{records.length}개의 기록 · 고유 자료 {sourceTotal}건</span><span>전체 기록 약 {readingMinutes}분</span></div></header><section className="editorialNotice"><h2>이 컬렉션의 선정 기준</h2><p>{collection.criteria}</p></section><ReadingPurpose records={records} title={collection.title} questions={collection.steps.map(step => step.description)} /><WorkBasket records={records.map(record => ({ id: record.id, title: record.title }))} returnTo={sitePath(`/collections/${collection.id}/`)} /><nav className="editorialContents" aria-label="읽기 경로"><h2>권장 읽기 순서</h2><ol>{collection.steps.map((step, index) => <li key={step.title}><a href={`#step-${index + 1}`}>{step.title}</a></li>)}</ol></nav><div className="readingSteps">{collection.steps.map((step, index) => <section id={`step-${index + 1}`} className="readingStep" key={step.title}><p className="editorialEyebrow">STEP {String(index + 1).padStart(2, "0")}</p><h2>{step.title}</h2><p>{step.description}</p><ul className="editorialRecordList">{step.recordIds.flatMap((recordId) => archiveEvents.filter((record) => record.id === recordId)).map((record) => <li key={record.id}><Link href={`/archive/${record.id}/?returnTo=${encodeURIComponent(sitePath(`/collections/${collection.id}/#step-${index + 1}`))}`}><span>{record.period} · {record.kind === "source" ? "사료 안내" : "사건 해설"} · 약 {record.readingMinutes}분</span><strong>{record.title}</strong><p>{record.summary}</p><span>기록과 연결 자료 읽기 →</span></Link></li>)}</ul></section>)}</div><section className="editorialNotice"><h2>읽을 때 유의할 한계</h2><p>{collection.limitations}</p></section><div className="editorialActions"><Link href="/collections/">다른 컬렉션 보기 →</Link><Link href="/archive/">전체 기록 찾기 →</Link></div></article><ArchiveFooter /></ArchiveShell>;
}
