import { archiveEvents } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { ArchiveAssistant } from "../components/expansion-assist";
import { makePageMetadata } from "../site-config";
export const metadata = { ...makePageMetadata("근거를 확인하는 자료 도우미", "선택한 공개 자료의 범위에서 질문하고 실제 근거와 답변의 한계를 확인합니다.", "/assist/"), robots: { index: false, follow: true } };
export default function AssistPage() { return <ArchiveShell pageClassName="assistRoute"><section className="routeIntro"><p className="routeEyebrow">ASSIST / SOURCES FIRST</p><h1>질문을 하되,<br />근거를 직접 확인합니다.</h1><p>선택한 자료의 범위를 넘는 설명은 답변하지 않습니다. AI 답변은 역사 전문가의 검수나 원문을 대신하지 않습니다.</p></section><section className="routeContent"><ArchiveAssistant records={archiveEvents} /></section><ArchiveFooter /></ArchiveShell>; }
