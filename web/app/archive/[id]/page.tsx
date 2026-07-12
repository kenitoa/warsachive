import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBuildEvents } from "../../../lib/build-archive";
import { getSiteUrl } from "../../site-config";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getBuildEvents()).map((event) => ({ id: event.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = (await getBuildEvents()).find((item) => item.id === id);
  if (!event) return {};
  const url = `${getSiteUrl()}/archive/${event.id}/`;
  return {
    title: `${event.title} | 전쟁 역사 아카이브`,
    description: event.summary,
    alternates: { canonical: url },
    openGraph: { title: event.title, description: event.summary, type: "article", url }
  };
}

export default async function ArchiveRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = (await getBuildEvents()).find((item) => item.id === id);
  if (!event) notFound();
  const url = `${getSiteUrl()}/archive/${event.id}/`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: event.title,
    description: event.summary,
    url,
    inLanguage: "ko-KR",
    keywords: event.labels?.join(", "),
    isPartOf: { "@type": "CollectionPage", "@id": `${getSiteUrl()}/#collection` }
  };

  return (
    <main className="recordPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="recordHeader"><Link className="brand" href="/"><span className="brandMark">WA</span><span>전쟁 역사 아카이브<small>WAR HISTORY ARCHIVE</small></span></Link><span>RECORD / {event.id.toUpperCase()}</span></header>
      <article className="recordSheet">
        <p className="sectionNumber">ARCHIVE RECORD · {event.period}</p>
        <h1>{event.title}</h1>
        <dl className="recordFacts"><div><dt>시기</dt><dd>{event.period}</dd></div><div><dt>분류</dt><dd>{event.region}</dd></div><div><dt>연결 출처</dt><dd>{event.sourceCount}건</dd></div></dl>
        <div className="recordBody"><h2>기록 개요</h2><p>{event.summary}</p></div>
        <div className="recordLabels">{(event.labels ?? ["미분류"]).map((label) => <span key={label}>{label}</span>)}</div>
        <Link className="primaryAction" href="/#catalogue">← 소장 기록으로 돌아가기</Link>
      </article>
    </main>
  );
}
