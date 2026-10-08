import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveEvents } from "../../../lib/archive-data";
import { publicKnowledge } from "../../../lib/knowledge-data";
import { fullLocaleRoutes, getFullLocalization } from "../../../lib/knowledge-localization";
import { ArchiveFooter, ArchiveShell } from "../../components/archive-shell";
import { getSiteUrl, makePageMetadata } from "../../site-config";
import styles from "../../components/knowledge-refinement.module.css";

export const dynamicParams = false;
export function generateStaticParams() { return [{ path: [] }, ...fullLocaleRoutes(publicKnowledge, archiveEvents).map(route => ({ path: [route.locale, route.recordId] }))]; }
export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }): Promise<Metadata> {
  const { path = [] } = await params;
  if (!path.length) return makePageMetadata("검수한 언어별 읽기", "실제 승인된 본문·메뉴·도움말 번역만 제공합니다.", "/read/");
  const [locale, id] = path; const record = archiveEvents.find(item => item.id === id); const localized = record && getFullLocalization(publicKnowledge, record, locale);
  if (!record || !localized || path.length !== 2) return { robots: { index: false, follow: false } };
  const url = `${getSiteUrl()}/read/${locale}/${id}/`;
  const languages = Object.fromEntries(fullLocaleRoutes(publicKnowledge, archiveEvents).filter(route => route.recordId === id).map(route => [route.locale, `${getSiteUrl()}${route.href}`]));
  languages.ko = `${getSiteUrl()}/archive/${id}/`;
  return { title: localized.title, description: localized.summary, alternates: { canonical: url, languages }, openGraph: { title: localized.title, description: localized.summary, url, locale: locale.replace("-", "_"), type: "article" } };
}
export default async function LocalizedReadingPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  if (!path.length) { const routes = fullLocaleRoutes(publicKnowledge, archiveEvents); return <ArchiveShell pageClassName="recordRoutePage"><article className="recordSheet"><h1>검수한 언어별 읽기</h1><p>전체 본문·메뉴·오류 안내·도움말의 번역과 원본 문단 버전을 확인한 언어 경로만 제공합니다. 제목·요약 번역은 전체 번역으로 표시하지 않습니다.</p>{routes.length ? <ul>{routes.map(route => <li key={route.href}><Link href={route.href}>{route.locale} · {archiveEvents.find(record => record.id === route.recordId)?.title}</Link></li>)}</ul> : <p>현재 공개할 수 있는 승인된 전체 번역은 0개입니다. 검수하지 않은 외국어 초안은 노출하지 않습니다.</p>}<Link href="/archive/">현재 한국어 공개 기록 보기 →</Link></article><ArchiveFooter /></ArchiveShell>; }
  if (path.length !== 2) notFound();
  const [locale, id] = path; const record = archiveEvents.find(item => item.id === id); const localized = record && getFullLocalization(publicKnowledge, record, locale);
  if (!record || !localized) notFound();
  const full = localized.full; const ui = full.ui;
  const menu = [["home", "/"], ["archive", "/archive/"], ["explore", "/explore/"], ["timeline", "/timeline/"], ["collections", "/collections/"], ["stories", "/stories/"]] as const;
  return <main className="archiveApp archivePage" lang={locale}><article className="recordSheet"><nav aria-label={ui.archive} className={styles.row}>{menu.map(([key, href]) => <Link key={key} href={href} hrefLang="ko">{ui[key]}</Link>)}</nav><h1>{localized.title}</h1><p className="recordLead">{localized.summary}</p><section className={styles.panel}><h2>{ui.review}</h2><p>{ui.scopeHelp}</p><p>{ui.translator}: {full.translator} · {ui.reviewer}: {full.reviewer} · {full.approvedAt}</p><p>{localized.review.note}</p></section><nav aria-label={ui.archive}><ol>{full.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav>{full.sections.map(section => <section id={section.id} key={section.id} className={styles.panel}><h2>{section.title}</h2>{section.paragraphs.map((paragraph, index) => <p id={`${section.id}-paragraph-${index + 1}`} key={index}>{paragraph}</p>)}<p>{ui.evidence}: {record.sections.find(item => item.id === section.id)?.sourceIds.map(sourceId => <Link key={sourceId} href={`/sources/${sourceId}/`} hrefLang="ko">{record.sources.find(source => source.id === sourceId)?.title} → </Link>)}</p></section>)}{full.chronology.length ? <section className={styles.panel}><h2>{ui.timeline}</h2>{full.chronology.map(moment => <div key={moment.index}><h3>{moment.title}</h3><p>{record.chronology[moment.index].date}</p><p>{moment.text}</p></div>)}</section> : null}<section className={styles.panel}><h2>{ui.limitations}</h2><ul>{full.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul><p>{ui.rightsHelp}</p></section><section className={styles.panel}><h2>{ui.sources}</h2>{record.sources.map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer noopener">{source.title} ↗</a></p>)}</section><Link href={`/archive/${record.id}/`} hrefLang="ko">{ui.back}</Link></article></main>;
}
