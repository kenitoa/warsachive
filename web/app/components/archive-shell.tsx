import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { getSiteUrl } from "../site-config";

const navigation = [
  ["/archive/", "아카이브"],
  ["/explore/", "주제 탐색"],
  ["/timeline/", "연표"],
  ["/collections/", "컬렉션"],
  ["/stories/", "스토리"],
  ["/about/", "소개"]
] as const;

function Brand() {
  return <Link className="museumBrand" href="/" aria-label="전쟁 역사 아카이브 처음으로"><span className="museumMark" aria-hidden="true"><i /><i /></span><span>HISTORY<br />ARCHIVE</span></Link>;
}

export function ArchiveShell({ children, pageClassName = "", pageStyle }: { children: ReactNode; pageClassName?: string; pageStyle?: CSSProperties }) {
  const publicBasePath = new URL(getSiteUrl()).pathname.replace(/\/$/, "");
  const shellStyle = { "--archive-hero-image": `url("${publicBasePath}/images/archive-gallery-hero.png")`, ...pageStyle } as CSSProperties;
  return (
    <div className="archiveApp">
      <aside className="museumRail" aria-label="사이트 탐색">
        <div className="desktopBrand"><Brand /></div>
        <nav className="museumNav" aria-label="주요 메뉴">
          {navigation.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="railUtility"><Link href="/archive/" aria-label="기록 찾기"><span className="searchIcon" aria-hidden="true" />기록 찾기</Link><span>KO <b aria-hidden="true">⌄</b></span></div>
        <details className="mobileNavigation">
          <summary><Brand /><span aria-hidden="true" className="mobileMenuIcon" /></summary>
          <nav aria-label="모바일 메뉴">{navigation.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</nav>
        </details>
      </aside>
      <main className={`archivePage ${pageClassName}`} style={shellStyle}>{children}</main>
    </div>
  );
}

export function ArchiveFooter() {
  return <footer className="museumFooter"><Brand /><p>기록을 통해 과거를 이해하고, 기억을 통해 역사를 이어갑니다.</p><small>PUBLIC ARCHIVE · 2026</small></footer>;
}
