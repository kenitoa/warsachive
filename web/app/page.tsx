import Link from "next/link";
import type { CSSProperties } from "react";
import { archiveEvents } from "../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "./components/archive-shell";
import { getSiteUrl } from "./site-config";

const siteUrl = getSiteUrl();
const publicBasePath = new URL(siteUrl).pathname.replace(/\/$/, "");
const archiveHeroImage = `${publicBasePath}/images/archive-gallery-hero.png`;

const collectionCards = [
  ["ARCHIVE", "아카이브", "문서, 사진, 증언을 한곳에서 읽고 기록의 근거까지 확인합니다.", "/archive/", "archive"],
  ["EXPLORE", "주제 탐색", "사건과 인물, 장소의 연결을 따라 새로운 맥락을 발견합니다.", "/explore/", "explore"],
  ["TIMELINE", "연표", "시대의 흐름을 한눈에 보고 기록 사이의 시간을 이어 봅니다.", "/timeline/", "timeline"],
  ["STORY", "기록의 목소리", "자료 속 개인과 공동체의 이야기를 천천히 만나 봅니다.", "/stories/", "story"]
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": `${siteUrl}/#collection`,
  url: siteUrl,
  name: "전쟁 역사 아카이브",
  inLanguage: "ko-KR"
};

export default function Home() {
  const featuredRecords = archiveEvents.slice(0, 3);
  const sourceTotal = archiveEvents.reduce((total, event) => total + event.sourceCount, 0);
  const pageStyle = { "--archive-hero-image": `url("${archiveHeroImage}")` } as CSSProperties;

  return <ArchiveShell pageClassName="museumHome" pageStyle={pageStyle}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <section className="museumHero" aria-labelledby="hero-title">
      <div className="heroShade" />
      <div className="heroContent">
        <p className="museumKicker">WAR HISTORY ARCHIVE / OPEN COLLECTION</p>
        <h1 id="hero-title">기록은 과거를,<br />기억은 역사를 만듭니다</h1>
        <p className="museumLead">흩어진 시간의 조각을 모아<br />더 깊이, 더 오래, 더 넓게 기억합니다.</p>
        <Link className="scrollPrompt" href="/explore/"><span />SCROLL TO EXPLORE</Link>
      </div>
      <Link className="heroMenu" href="/archive/" aria-label="아카이브로 이동"><span aria-hidden="true"><i /><i /></span><small>MENU</small></Link>
      <aside className="heroTimeline" aria-label="주요 연표">
        <p>TIMELINE</p><div className="timelineRange"><span>1895</span><strong>1953</strong></div><div className="timelineLine" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="timelineRecord"><div className="recordThumbnail" aria-hidden="true" /><p><b>1945</b><span>광복</span><small>새로운 질서가 시작되며, 기억은 서로 다른 목소리로 남았습니다.</small></p></div>
      </aside>
    </section>
    <section className="museumCollections" aria-label="아카이브 탐색 영역">
      {collectionCards.map(([eyebrow, title, description, href, className]) => <Link className={`collectionCard ${className}`} href={href} key={eyebrow}><span className="cardEyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p><b aria-hidden="true">→</b></Link>)}
    </section>
    <section className="museumRecords" aria-labelledby="records-title">
      <div className="recordsHeading"><div><p className="museumKicker">THE COLLECTION</p><h2 id="records-title">현재 열람 가능한 기록</h2></div><p>모든 기록에는 원문으로 이어지는 출처와<br />아카이브 정리 정보가 함께 남아 있습니다.</p></div>
      <div className="recordGrid">{featuredRecords.map((record, index) => <Link className="museumRecord" href={`/archive/${record.id}/`} key={record.id}><span>RECORD {String(index + 1).padStart(2, "0")}</span><p>{record.period} · {record.region}</p><h3>{record.title}</h3><small>{record.summary}</small><b>기록 읽기 <i aria-hidden="true">→</i></b></Link>)}</div>
      <div className="archiveSummary"><span>ARCHIVE INDEX</span><strong>{String(archiveEvents.length).padStart(2, "0")}</strong><small>기록</small><strong>{String(sourceTotal).padStart(2, "0")}</strong><small>출처</small><Link href="/archive/">전체 기록 보기 →</Link></div>
    </section>
    <section className="museumStory" aria-labelledby="story-title"><p className="museumKicker">WHY WE ARCHIVE</p><h2 id="story-title">기록은 사라지지 않도록<br />보존하는 일입니다.</h2><p>사건을 단정하지 않고, 서로 다른 자료가 남긴 흔적을 연결합니다. 기록의 출처와 맥락을 함께 보존해 다음 세대가 다시 읽을 수 있도록 합니다.</p></section>
    <ArchiveFooter />
  </ArchiveShell>;
}
