import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { AccountManager } from "../components/expansion-account";
import { archiveEvents } from "../../lib/archive-data";
import { makePageMetadata } from "../site-config";
export const metadata = { ...makePageMetadata("선택형 계정과 동기화", "기본 열람을 유지하며 필요한 경우 로그인, 기기 간 병합과 계정 관리를 제공합니다.", "/account/"), robots: { index: false, follow: true } };
export default function AccountPage() { return <ArchiveShell pageClassName="accountRoute"><section className="routeIntro"><p className="routeEyebrow">ACCOUNT / OPTIONAL CONNECTION</p><h1>기기의 기록을 지키며<br />필요할 때 연결합니다.</h1><p>기본 열람과 기기 저장은 계정 없이 이용합니다. 로그인만으로 기존 메모를 덮어쓰거나 서버로 전송하지 않습니다.</p></section><section className="routeContent"><AccountManager records={archiveEvents} /></section><ArchiveFooter /></ArchiveShell>; }
