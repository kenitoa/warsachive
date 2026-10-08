import { archiveEvents } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { AdminManager } from "../components/expansion-admin";
import { makePageMetadata } from "../site-config";
export const metadata = { ...makePageMetadata("편집과 검수 운영", "권한이 있는 운영자가 초안, 출처 대조, 독립 승인과 공개 버전을 관리합니다.", "/admin/"), robots: { index: false, follow: true } };
export default function AdminPage() { return <ArchiveShell pageClassName="adminRoute"><section className="routeIntro"><p className="routeEyebrow">EDITORIAL / REVIEW OPERATIONS</p><h1>내용과 근거를 확인하고,<br />승인된 버전을 공개합니다.</h1><p>쓰기 권한과 역할은 서버에서 확인합니다. 초안 저장과 실제 공개 발행을 구분합니다.</p></section><section className="routeContent"><AdminManager records={archiveEvents} /></section><ArchiveFooter /></ArchiveShell>; }
