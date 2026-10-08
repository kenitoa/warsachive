import Link from "next/link";
import { archiveEvents, editorialCollections } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { makePageMetadata } from "../site-config";

export const metadata = makePageMetadata("컬렉션", "선정 기준과 읽기 순서가 있는 기획 컬렉션에서 사건과 사료를 함께 읽습니다.", "/collections/");

export default function CollectionsPage() {
  return <ArchiveShell pageClassName="routePage collectionsRoute"><section className="routeIntro"><p className="routeEyebrow">COLLECTIONS / READING PATHS</p><h1>기록을 묶고,<br />읽는 순서를 제안합니다.</h1><p>어디서 시작할지 막막할 때 사건에서 원문으로 이어지는 기획 경로를 따라가세요.</p></section><section className="collectionShelf" aria-label="기획 컬렉션 목록">
    {editorialCollections.map((collection) => { const records = archiveEvents.filter((record) => collection.recordIds.includes(record.id)); const sources = new Set(records.flatMap((record) => record.sources.map((source) => source.url))); return <article className="plannedCollection" key={collection.id}><div className="collectionIdentity"><p>READING COLLECTION</p><h2><Link href={`/collections/${collection.id}/`}>{collection.title}</Link></h2><span>{collection.region} · {collection.period}</span></div><div className="collectionDescription"><p>{collection.description}</p><dl><div><dt>공개 기록</dt><dd>{records.length}건</dd></div><div><dt>고유 자료</dt><dd>{sources.size}건</dd></div><div><dt>읽기 단계</dt><dd>{collection.steps.length}단계</dd></div></dl><p className="selectionCriteria">선정 기준 · {collection.criteria}</p></div><div className="collectionRecords">{collection.steps.map((step, index) => <Link href={`/collections/${collection.id}/#step-${index + 1}`} key={step.title}><span>STEP {index + 1}</span>{step.title}<b aria-hidden="true">→</b></Link>)}<Link href={`/collections/${collection.id}/`}><span>START</span>컬렉션 읽기 시작<b aria-hidden="true">→</b></Link></div></article>; })}
  </section><ArchiveFooter /></ArchiveShell>;
}
