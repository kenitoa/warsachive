"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  ["/archive/", "아카이브"],
  ["/explore/", "주제 탐색"],
  ["/timeline/", "연표"],
  ["/collections/", "컬렉션"],
  ["/stories/", "스토리"],
  ["/about/", "소개"]
] as const;

export function Brand() {
  return <Link className="museumBrand" href="/" aria-label="전쟁 역사 아카이브 처음으로"><span className="museumMark" aria-hidden="true"><i /><i /></span><span>HISTORY<br />ARCHIVE</span></Link>;
}

export function ArchiveNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => pathname === href.slice(0, -1) || pathname?.includes(href);
  const links = navigation.map(([href, label]) => <Link href={href} key={href} aria-current={active(href) ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>);

  return <>
    <div className="desktopBrand"><Brand /></div>
    <nav className="museumNav" aria-label="주요 메뉴">{links}</nav>
    <div className="railUtility"><Link href="/archive/"><span className="searchIcon" aria-hidden="true" />기록 찾기</Link><Link href="/saved/">이 기기 보관함</Link><Link href="/workspace/">연구 작업공간</Link><Link href="/teach/">수업 준비</Link><Link href="/account/">계정과 동기화</Link><span lang="ko">한국어</span></div>
    <div className="mobileNavigation">
      <div className="mobileNavigationBar"><Brand /><button type="button" aria-expanded={open} aria-controls="mobile-menu mobile-menu-utility" onClick={() => setOpen(!open)}><span className="mobileMenuIcon" aria-hidden="true" /><span>{open ? "메뉴 닫기" : "메뉴 열기"}</span></button></div>
      <nav id="mobile-menu" aria-label="모바일 메뉴" hidden={!open}>{links}</nav>
      <div id="mobile-menu-utility" className="mobileMenuUtility" hidden={!open}><Link href="/saved/" onClick={() => setOpen(false)}>이 기기 보관함</Link><Link href="/workspace/" onClick={() => setOpen(false)}>연구 작업공간</Link><Link href="/teach/" onClick={() => setOpen(false)}>수업 준비</Link><Link href="/account/" onClick={() => setOpen(false)}>계정과 동기화</Link></div>
    </div>
  </>;
}
