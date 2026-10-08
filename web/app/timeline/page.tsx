import Link from "next/link";
import { archiveEvents } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { makePageMetadata, sitePath } from "../site-config";
import { publicKnowledge } from "../../lib/knowledge-data";
import { KnowledgeChronology } from "../components/knowledge-chronology";
import { SourceLink } from "../components/reading-tools";

export const metadata = makePageMetadata("연표", "확인된 연대에 따라 사건과 사료의 시간을 비교하고 날짜가 확인되지 않은 항목을 구분합니다.", "/timeline/");

function formatYear(year: number) { return year < 0 ? `기원전 ${Math.abs(year)}년` : `${year}년`; }

export default function TimelinePage() {
  const moments = archiveEvents.flatMap((record) => record.chronology.map((moment, index) => ({ ...moment, record, key: `${record.id}-${index}` })));
  const known = moments.filter((moment) => moment.year !== null).sort((left, right) => (left.year ?? 0) - (right.year ?? 0));
  const unknown = moments.filter((moment) => moment.year === null);
  const years = Array.from(new Set(known.map((moment) => moment.year).filter((year): year is number => year !== null)));
  const unknownMomentRecordIds = new Set(unknown.map((moment) => moment.record.id));
  const undatedRecords = archiveEvents.filter((record) => record.date.precision === "unknown" && !unknownMomentRecordIds.has(record.id));
  const comparable = archiveEvents.filter((record) => record.kind === "event").slice(0, 2);
  return <ArchiveShell pageClassName="routePage timelineRoute">
    <section className="routeIntro"><p className="routeEyebrow">TIMELINE / CHRONOLOGY</p><h1>사건의 시작보다<br />변화의 순서를 봅니다.</h1><p>확인된 연대와 연결 자료를 따라 사건의 전개를 읽습니다. 사료의 작성 시점과 사료가 다룬 시기는 다를 수 있습니다.</p><Link className="editorialTextLink" href="/places/">시기와 장소의 근거 함께 보기 →</Link></section>
    <section className="timelineNarrative"><KnowledgeChronology dates={publicKnowledge.dates} /><nav className="yearJump" aria-label="연도로 이동">{years.map((year) => <a href={`#year-${year}`} key={year}>{formatYear(year)}</a>)}{unknown.length + undatedRecords.length > 0 ? <a href="#unknown-dates">연대 미확인</a> : null}</nav>
      {comparable.length === 2 ? <div className="editorialNotice"><h2>두 사건을 나란히 읽기</h2><p>배경, 기간, 주요 전개와 자료의 차이를 확인하세요.</p><Link className="editorialTextLink" href={`/saved/?compare=${comparable.map((record) => record.id).join(",")}`}>{comparable.map((record) => record.title).join(" · ")} 비교 →</Link></div> : null}
      <ol className="datedTimeline">{known.map((moment, index) => <li key={moment.key} id={known[index - 1]?.year !== moment.year ? `year-${moment.year}` : undefined}><div className="momentDate"><span>{formatYear(moment.year ?? 0)}</span><small>{moment.date}</small></div><div><p className="editorialEyebrow">{moment.record.kind === "source" ? "사료의 기록" : "사건의 전개"} · {moment.record.title}</p><h2>{moment.title}</h2><p>{moment.text}</p><div className="momentLinks"><Link href={`/archive/${moment.record.id}/?returnTo=${encodeURIComponent(sitePath(`/timeline/#year-${moment.year}`))}#chronology`}>기록의 전체 연대 보기 →</Link>{moment.sourceIds.map((id) => { const source = moment.record.sources.find((item) => item.id === id); return source ? <SourceLink href={source.url} key={id}>{source.kind === "primary" ? "원문 근거" : "기관 자료"}: {source.title} ↗</SourceLink> : null; })}</div></div></li>)}</ol>
      {unknown.length + undatedRecords.length > 0 ? <section className="editorialNotice" id="unknown-dates"><h2>연대를 확인 중인 기록</h2><p>순서를 임의로 추정하지 않습니다. 확인되지 않은 날짜는 시간축에서 분리합니다.</p><ul>{unknown.map((moment) => <li key={moment.key}><Link href={`/archive/${moment.record.id}/?returnTo=${encodeURIComponent(sitePath("/timeline/#unknown-dates"))}`}>{moment.record.title} · {moment.title}</Link><p>{moment.text}</p></li>)}{undatedRecords.map((record) => <li key={record.id}><Link href={`/archive/${record.id}/?returnTo=${encodeURIComponent(sitePath("/timeline/#unknown-dates"))}`}>{record.title}</Link></li>)}</ul></section> : null}
      <p className="editorialMuted">공개 기록의 연표이며 전쟁사 전체를 포괄하는 연표가 아닙니다. <Link href="/about/#scope">수집 범위 확인 →</Link></p>
    </section><ArchiveFooter />
  </ArchiveShell>;
}
