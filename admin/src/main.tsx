import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const sections = ["열람실 현황", "소장 기록", "인물 색인", "장소·지도", "출처 대장", "검토 대기"];
const recentRecords = [
  ["WA-0001", "전쟁 역사 자료 파이프라인 구축 기록", "디지털 아카이브", "검토 완료"],
  ["WA-0002", "전장의 공간과 이동 경로를 읽는 법", "지도 컬렉션", "분류 대기"],
  ["WA-0003", "증언과 사료의 출처 검토 원칙", "사료 컬렉션", "초안"]
];

function App() {
  return (
    <div className="shell">
      <aside>
        <div className="logo"><span>WA</span><p>전쟁 역사 아카이브<small>COLLECTION DESK</small></p></div>
        <p className="navLabel">관리 목록 / INDEX</p>
        <nav aria-label="관리 메뉴">
          {sections.map((section, index) => <button className={index === 0 ? "active" : ""} key={section}><span>0{index + 1}</span>{section}</button>)}
        </nav>
        <div className="asideStamp">ARCHIVIST<br /><small>운영자 모드</small></div>
        <p className="asideNote">COLLECTION № 001 · 2026</p>
      </aside>

      <main>
        <header>
          <div><p className="eyebrow">ARCHIVE OVERVIEW · 2026.07.12</p><h1>열람실 현황</h1></div>
          <button className="newButton">＋ 새 기록 등록</button>
        </header>

        <section className="notice"><span>NOTICE</span><div><strong>GitHub 정적 소장본 운영</strong><p>NAS에서 가공된 기록은 front 저장소에 누적된 뒤 Pages에 반영됩니다.</p></div><b>×</b></section>

        <section className="metrics" aria-label="아카이브 주요 현황">
          <article><span>01 / RECORDS</span><strong>{recentRecords.length}</strong><small>정적 소장 기록</small></article>
          <article><span>02 / STORAGE</span><strong>GIT</strong><small>누적 저장 방식</small></article>
          <article><span>03 / PUBLISH</span><strong>40m</strong><small>기록당 발행 간격</small></article>
        </section>

        <section className="recordsSection">
          <div className="sectionHeader"><div><p>RECENT ACCESSIONS</p><h2>최근 등록 기록</h2></div><button>전체 대장 열기 →</button></div>
          <div className="recordTable" role="table" aria-label="최근 등록 기록">
            <div className="recordRow tableHead" role="row"><span>관리번호</span><span>기록명</span><span>분류</span><span>상태</span></div>
            {recentRecords.map(([id, title, collection, status]) => (
              <div className="recordRow" role="row" key={id}><span>{id}</span><strong>{title}</strong><span>{collection}</span><em>{status}</em></div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
