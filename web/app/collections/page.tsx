import Link from "next/link";
import { getPlannedCollections } from "../../lib/archive-planning";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";

export default function CollectionsPage() {
  const collections = getPlannedCollections();

  return <ArchiveShell pageClassName="routePage collectionsRoute">
    <section className="routeIntro">
      <p className="routeEyebrow">COLLECTIONS / REGIONS & SOURCES</p>
      <h1>지역과 출처를 기준으로<br />기록을 묶습니다.</h1>
      <p>같은 공간에서 생산된 사건 기록과 문헌을 하나의 연구 컬렉션으로 정리합니다.</p>
    </section>
    <section className="collectionShelf" aria-label="지역별 기록 컬렉션">
      {collections.map((collection) => <article className="plannedCollection" key={collection.id}>
        <div className="collectionIdentity">
          <p>{collection.id.toUpperCase()}</p>
          <h2>{collection.title}</h2>
          <span>{collection.region}</span>
        </div>
        <div className="collectionDescription">
          <p>{collection.description}</p>
          <dl>
            <div><dt>시기</dt><dd>{collection.period}</dd></div>
            <div><dt>기록</dt><dd>{collection.records.length}건</dd></div>
            <div><dt>문헌</dt><dd>{collection.documentCount}건</dd></div>
            <div><dt>출처</dt><dd>{collection.sourceCount}건</dd></div>
          </dl>
        </div>
        <div className="collectionRecords">
          {collection.records.map((record) => <Link href={`/archive/${record.id}/`} key={record.id}><span>{record.period}</span>{record.title}<b>→</b></Link>)}
        </div>
      </article>)}
    </section>
    <ArchiveFooter />
  </ArchiveShell>;
}
