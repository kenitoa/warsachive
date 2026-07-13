import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";

export default function AboutPage() {
  return <ArchiveShell pageClassName="routePage">
    <section className="routeIntro dark"><p className="routeEyebrow">ABOUT THE ARCHIVE</p><h1>기록의 출처와 맥락을<br />함께 보존합니다.</h1><p>전쟁사를 단정된 하나의 서사가 아닌, 확인 가능한 자료의 연결로 읽습니다.</p></section>
    <section className="aboutPrinciples"><article><span>01</span><h2>출처를 남깁니다</h2><p>모든 공개 기록은 원자료에 닿을 수 있는 근거를 함께 보관합니다.</p></article><article><span>02</span><h2>맥락을 붙입니다</h2><p>자료가 만들어진 시점과 배경을 살펴 기록을 단편으로 두지 않습니다.</p></article><article><span>03</span><h2>공개적으로 읽습니다</h2><p>누구나 기록을 읽고 다시 검토할 수 있는 공개 아카이브를 지향합니다.</p></article></section>
    <ArchiveFooter />
  </ArchiveShell>;
}
