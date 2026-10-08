import Link from "next/link";
import { archiveEvents } from "../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "./components/archive-shell";
import { ContextualResume } from "./components/personal-context";
import { getSiteUrl, makePageMetadata } from "./site-config";

export const metadata = makePageMetadata("전쟁 역사 아카이브", "전쟁의 사건과 원문 사료를 출처와 맥락 속에서 읽고, 주제·연표·기획 컬렉션으로 탐색합니다.", "/");

const collectionCards = [
  ["ARCHIVE", "아카이브", "찾는 사건과 사료가 있다면 검색하고 원자료를 확인하세요.", "/archive/", "archive"],
  ["EXPLORE", "주제 탐색", "질문과 관점을 따라 기록 사이의 연결을 발견하세요.", "/explore/", "explore"],
  ["TIMELINE", "연표", "사건의 선후 관계와 사료가 기록한 시간을 비교하세요.", "/timeline/", "timeline"],
  ["STORY", "기록의 목소리", "원문과 편집 해설을 구분하며 이야기를 읽어 보세요.", "/stories/", "story"]
] as const;

export default function Home() {
  const featuredRecords = archiveEvents.filter((record) => record.featuredReason).slice(0, 3);
  const sourceTotal = new Set(archiveEvents.flatMap((record) => record.sources.map((source) => source.url))).size;
  const institutionTotal = new Set(archiveEvents.flatMap((record) => record.sources.map((source) => source.institution))).size;
  const knownYears = archiveEvents.flatMap((record) => [record.date.startYear, record.date.endYear]).filter((year): year is number => year !== null);
  const formatYear = (year: number) => year < 0 ? `기원전 ${Math.abs(year)}` : String(year);
  const siteUrl = getSiteUrl();
  const structuredData = { "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${siteUrl}/#collection`, url: `${siteUrl}/`, name: "전쟁 역사 아카이브", inLanguage: "ko-KR" };

  return <ArchiveShell pageClassName="museumHome">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <section className="museumHero" aria-labelledby="hero-title"><div className="heroShade" /><div className="heroContent">
      <p className="museumKicker">WAR HISTORY ARCHIVE / OPEN COLLECTION</p>
      <h1 id="hero-title">기록은 과거를,<br />기억은 역사를 만듭니다</h1>
      <p className="museumLead">흩어진 시간의 조각을 모아<br />더 깊이, 더 오래, 더 넓게 기억합니다.</p>
      <p className="heroScope">{archiveEvents.length ? "현재는 임진왜란·정유재란과 관련 사료를 출처 확인 상태와 함께 공개합니다." : "공개 자료의 출처와 이용 조건을 다시 확인하고 있습니다. 검토가 끝난 자료부터 공개합니다."}</p>
      <Link className="scrollPrompt" href="/explore/"><span aria-hidden="true" />주제 탐색하기 →</Link>
    </div><Link className="heroMenu" href="/archive/"><span aria-hidden="true"><i /><i /></span><small>기록 찾기</small></Link>
    <aside className="heroTimeline" aria-label="공개 기록의 시간 범위"><p>PUBLIC TIMELINE</p>{knownYears.length > 0 ? <div className="timelineRange"><span>{formatYear(Math.min(...knownYears))}</span><strong>{formatYear(Math.max(...knownYears))}</strong></div> : <p>연대를 확인하고 있습니다.</p>}<div className="timelineLine" aria-hidden="true"><i /><i /><i /><i /><i /></div><p className="heroTimelineNote">사건이 일어난 시기와 자료에 기록된 시기를 구분해 읽습니다.</p><Link className="editorialTextLink" href="/timeline/">공개 기록 연표 보기 →</Link></aside></section>
    <section className="museumCollections" aria-label="아카이브 탐색 영역">{collectionCards.map(([eyebrow, title, description, href, className]) => <Link className={`collectionCard ${className}`} href={href} key={eyebrow}><span className="cardEyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p><b aria-hidden="true">→</b></Link>)}</section>
    <section className="museumRecords" aria-labelledby="records-title"><div className="recordsHeading"><div><p className="museumKicker">THE COLLECTION</p><h2 id="records-title">처음 읽을 기록</h2></div><p>선정 이유와 확인 가능한 근거를 함께 제공합니다.<br />출처 확인은 역사 해석의 최종 승인을 뜻하지 않습니다.</p></div>
      {!featuredRecords.length ? <p role="status">추천 기록을 다시 검토하고 있습니다. 공개 가능한 자료가 준비되면 이곳에서 안내합니다.</p> : null}<div className="recordGrid">{featuredRecords.map((record, index) => <Link className="museumRecord" href={`/archive/${record.id}/`} key={record.id}><span>RECORD {String(index + 1).padStart(2, "0")}</span><p>{record.period} · {record.region}</p><h3>{record.title}</h3><small>{record.summary}</small><p className="featuredReason">추천 이유 · {record.featuredReason}</p><b>기록 읽기 <i aria-hidden="true">→</i></b></Link>)}</div>
      <div className="archiveSummary"><span>PUBLIC INDEX</span><strong>{archiveEvents.length}</strong><small>공개 기록</small><strong>{sourceTotal}</strong><small>고유 자료</small><strong>{institutionTotal}</strong><small>기관</small><Link href="/archive/">전체 기록 보기 →</Link></div>
      <div className="entryPaths"><Link href="/collections/"><strong>처음 읽기</strong><span>기획 컬렉션의 순서로 근거를 확인하세요 →</span></Link><Link href="/sources/"><strong>자료 찾기</strong><span>원문·판본·번역과 제공 범위를 확인하세요 →</span></Link><Link href="/teach/"><strong>수업 준비</strong><span>자료와 질문을 묶어 학습지를 구성하세요 →</span></Link><Link href="/workspace/"><strong>근거 비교</strong><span>연구 질문과 자료 위치를 함께 남기세요 →</span></Link></div>
    </section>
    <ContextualResume />
    <section className="museumStory" aria-labelledby="story-title"><p className="museumKicker">WHY WE ARCHIVE</p><h2 id="story-title">기록은 사라지지 않도록<br />보존하는 일입니다.</h2><p>사건을 단정하지 않고, 서로 다른 자료가 남긴 흔적을 연결합니다. 기록의 출처와 한계를 함께 보존해 다음 독자가 다시 검토할 수 있도록 합니다.</p></section>
    <ArchiveFooter />
  </ArchiveShell>;
}
