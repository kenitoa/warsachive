import { archiveEvents } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { WorkspaceManager } from "../components/expansion-workspace";
import { makePageMetadata, getSiteUrl } from "../site-config";
export const metadata = { ...makePageMetadata("연구 작업공간", "연구 질문, 주장과 자료 근거를 기기 안에 보관하고 선택적으로 동기화합니다.", "/workspace/"), robots: { index: false, follow: true } };
export default function WorkspacePage() { return <ArchiveShell pageClassName="workspaceRoute"><section className="routeIntro"><p className="routeEyebrow">RESEARCH / YOUR QUESTIONS</p><h1>질문에서 시작해<br />근거를 함께 남깁니다.</h1><p>직접 인용과 내 해석, 자료의 위치와 버전을 구분하며 연구 작업을 보관합니다.</p></section><section className="routeContent"><WorkspaceManager records={archiveEvents} publicUrl={getSiteUrl()} /></section><ArchiveFooter /></ArchiveShell>; }
