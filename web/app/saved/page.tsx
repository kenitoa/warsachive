import type { Metadata } from "next";
import { archiveEvents, archiveRecords } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { ShelfManager } from "../components/reading-tools";
import { getSiteUrl } from "../site-config";

export const metadata: Metadata = { title: "내 보관함과 자료 비교 | 전쟁 역사 아카이브", description: "이 브라우저의 저장 기록, 개인 메모와 읽기 위치를 관리하고 공개 자료를 비교합니다.", alternates: { canonical: `${getSiteUrl()}/saved/` }, robots: { index: false, follow: true } };
export default function SavedPage() { return <ArchiveShell pageClassName="savedRoute"><section className="routeIntro"><p className="routeEyebrow">READ AGAIN / PERSONAL SHELF</p><h1>다시 읽을 기록을<br />이곳에 보관합니다.</h1><p>개인 메모와 읽기 위치는 이 브라우저에만 남습니다. 원문과 확인 범위를 비교하며 이어 읽습니다.</p></section><section className="routeContent"><ShelfManager records={archiveEvents} retainedIds={archiveRecords.map(record => record.id)} basePath={new URL(getSiteUrl()).pathname.replace(/\/$/, "")} /></section><ArchiveFooter /></ArchiveShell>; }
