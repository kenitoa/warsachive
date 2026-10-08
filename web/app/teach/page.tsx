import { archiveEvents } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { TeachingManager } from "../components/expansion-teach";
import { makePageMetadata } from "../site-config";
export const metadata = { ...makePageMetadata("수업과 학습 경로", "계정 없이 읽기 경로와 학습 질문을 구성하고 계정 연결 시 수업을 운영합니다.", "/teach/"), robots: { index: false, follow: true } };
export default function TeachPage() { return <ArchiveShell pageClassName="teachRoute"><section className="routeIntro"><p className="routeEyebrow">TEACH / READ TOGETHER</p><h1>질문을 고르고,<br />함께 읽는 순서를 만듭니다.</h1><p>먼저 기기 안에서 수업 자료를 준비하고, 계정 서비스 연결 후 실제 과제와 피드백을 운영합니다.</p></section><section className="routeContent"><TeachingManager records={archiveEvents} /></section><ArchiveFooter /></ArchiveShell>; }
