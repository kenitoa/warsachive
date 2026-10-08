import { archiveEvents } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { CorrectionsManager } from "../components/expansion-corrections";
import { makePageMetadata } from "../site-config";
export const metadata = { ...makePageMetadata("정정 접수와 상태 확인", "자료의 오류와 근거를 제안하고 실제 연결 서비스의 접수 번호로 상태를 확인합니다.", "/corrections/"), robots: { index: false, follow: true } };
export default function CorrectionsPage() { return <ArchiveShell pageClassName="correctionsRoute"><section className="routeIntro"><p className="routeEyebrow">CORRECTIONS / CHECK AGAIN</p><h1>문제와 근거를 남기고,<br />처리 상태를 확인합니다.</h1><p>개인정보와 비공개 자료는 제안 본문에 넣지 마세요. 실제 접수 번호와 기기 초안을 구분합니다.</p></section><section className="routeContent"><CorrectionsManager records={archiveEvents.map(record => ({ id: record.id, title: record.title }))} /></section><ArchiveFooter /></ArchiveShell>; }
