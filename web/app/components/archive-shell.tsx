import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { sitePath } from "../site-config";
import { ArchiveNavigation, Brand } from "./navigation";

export function ArchiveShell({ children, pageClassName = "", pageStyle }: { children: ReactNode; pageClassName?: string; pageStyle?: CSSProperties }) {
  const shellStyle = { "--archive-hero-image": `url("${sitePath("/images/hero-large.webp")}")`, "--archive-hero-image-small": `url("${sitePath("/images/hero-small.webp")}")`, ...pageStyle } as CSSProperties;
  return (
    <div className="archiveApp">
      <a className="archiveSkipLink" href="#main-content">본문으로 건너뛰기</a>
      <aside className="museumRail" aria-label="사이트 탐색">
        <ArchiveNavigation />
      </aside>
      <main id="main-content" tabIndex={-1} className={`archivePage ${pageClassName}`} style={shellStyle}>{children}</main>
    </div>
  );
}

export function ArchiveFooter() {
  return <footer className="museumFooter"><Brand /><div><p>기록의 출처와 맥락을 함께 읽는 공개 아카이브입니다.</p><nav className="footerLinks" aria-label="이용 안내"><Link href="/about/#scope">수집 범위</Link><Link href="/about/#rights">자료 이용</Link><Link href="/corrections/">정정·자료 제안</Link><Link href="/saved/">이 기기 보관함</Link><Link href="/services/">기관 서비스</Link><Link href="/assist/">근거 기반 AI 보조</Link><Link href="/about/#privacy">개인정보 안내</Link><a href={sitePath("/feed.xml")} type="application/rss+xml">새 기록 RSS</a></nav></div><small>PUBLIC ARCHIVE · {new Date().getUTCFullYear()}</small></footer>;
}
