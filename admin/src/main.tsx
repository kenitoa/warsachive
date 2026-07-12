import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Stage = {
  code: string;
  title: string;
  english: string;
  cadence: string;
  status: string;
  description: string;
  input: string;
  output: string;
};

const stages: Stage[] = [
  {
    code: "01",
    title: "역사 자료 수집",
    english: "COLLECTION",
    cadence: "30분마다 주제 1개",
    status: "자동 대기",
    description: "topics.json에서 아직 완료되지 않은 주제를 선택하고, 등록된 관련 출처를 한 번에 수집합니다.",
    input: "승인된 주제·출처 목록",
    output: "raw/documents.json"
  },
  {
    code: "02",
    title: "중복 제거·라벨링",
    english: "DEDUPLICATION & LABELING",
    cadence: "수집 직후",
    status: "연속 처리",
    description: "문서 ID, 원문 URL, 본문 해시로 중복을 제거하고 사건·인물·지역·사료 라벨을 부여합니다.",
    input: "원시 수집 문서",
    output: "labeled/documents.json"
  },
  {
    code: "03",
    title: "역사 자료 정보화",
    english: "INFORMATIONIZATION",
    cadence: "라벨링 직후",
    status: "연속 처리",
    description: "같은 주제의 문서를 하나의 기록으로 묶고 요약, 출처 수, 키워드와 수집 시각을 정리합니다.",
    input: "라벨링 완료 문서",
    output: "informationized/records.json"
  },
  {
    code: "04",
    title: "GitHub 누적 발행",
    english: "STATIC PUBLISH",
    cadence: "40분마다 기록 1개",
    status: "발행 대기",
    description: "정보화가 끝난 기록 한 건을 기존 기록 뒤에 추가하고 front 저장소 main 브랜치에 커밋합니다.",
    input: "발행 대기 기록",
    output: "web/content/archive.json"
  },
  {
    code: "05",
    title: "GitHub Pages 배포",
    english: "PAGES DEPLOYMENT",
    cadence: "push 감지 즉시",
    status: "자동 배포",
    description: "main push를 감지한 Actions가 공개 페이지, 상세 기록과 sitemap을 다시 만들어 Pages에 배포합니다.",
    input: "누적 archive.json",
    output: "kenitoa.github.io/warsachive"
  }
];

const recentRecords = [
  ["WA-0001", "전쟁 역사 자료 파이프라인 구축 기록", "디지털 아카이브", "공개"],
  ["WA-0002", "전장의 공간과 이동 경로를 읽는 법", "지도 컬렉션", "공개"],
  ["WA-0003", "증언과 사료의 출처 검토 원칙", "사료 컬렉션", "공개"]
];

function App() {
  const [selected, setSelected] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const active = stages[selected];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="shell">
      <aside>
        <div className="logo"><span>WA</span><p>전쟁 역사 아카이브<small>PROCESS CONTROL DESK</small></p></div>
        <p className="navLabel">운영 목록 / INDEX</p>
        <nav aria-label="관리 메뉴">
          <a className="active" href="#pipeline"><span>01</span>처리 흐름</a>
          <a href="#boundary"><span>02</span>데이터 경계</a>
          <a href="#records"><span>03</span>공개 기록</a>
          <a href="https://github.com/kenitoa/warsachive/actions" target="_blank" rel="noreferrer"><span>04</span>배포 기록 ↗</a>
        </nav>
        <div className="asideStamp">AUTOMATED<br /><small>30m / 40m</small></div>
        <p className="asideNote">LOCAL CONTROL · PORT 9231</p>
      </aside>

      <main>
        <header>
          <div><p className="eyebrow">ARCHIVE PIPELINE · OPERATION MAP</p><h1>자료 처리 흐름</h1></div>
          <div className="clock"><span>LOCAL TIME</span><strong>{now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</strong><small>{now.toLocaleDateString("ko-KR")}</small></div>
        </header>

        <section className="notice" aria-label="운영 방식 안내">
          <span>NOTICE</span><div><strong>NAS는 수집과 가공, GitHub는 공개 기록을 담당합니다.</strong><p>이 화면은 설정된 자동 처리 구조를 보여주는 로컬 관제도이며 NAS의 실시간 실행 로그를 표시하는 화면은 아닙니다.</p></div><b>PORT<br />9231</b>
        </section>

        <section className="metrics" aria-label="자동 처리 주기">
          <article><span>01 / COLLECTION</span><strong>30<small>MIN</small></strong><p>미수집 주제 최대 1개</p></article>
          <article><span>02 / PUBLICATION</span><strong>40<small>MIN</small></strong><p>공개 기록 최대 1건</p></article>
          <article><span>03 / REPOSITORY</span><strong>GIT<small>MAIN</small></strong><p>kenitoa / warsachive</p></article>
        </section>

        <section className="pipelineSection" id="pipeline">
          <div className="sectionHeader"><div><p>PROCESS SEQUENCE</p><h2>자동 처리 단계</h2></div><span>단계를 선택하면 입·출력 정보를 확인할 수 있습니다.</span></div>
          <div className="pipeline" role="list" aria-label="자료 처리 단계">
            {stages.map((stage, index) => (
              <button className={selected === index ? "stage active" : "stage"} key={stage.code} onClick={() => setSelected(index)} role="listitem" aria-pressed={selected === index}>
                <span className="stageCode">{stage.code}</span>
                <span className="stageStatus"><i />{stage.status}</span>
                <strong>{stage.title}</strong>
                <small>{stage.english}</small>
                <em>{stage.cadence}</em>
              </button>
            ))}
          </div>
          <article className="stageDetail" aria-live="polite">
            <div className="detailIndex"><span>SELECTED STAGE</span><strong>{active.code}</strong></div>
            <div className="detailCopy"><p>{active.english}</p><h3>{active.title}</h3><div>{active.description}</div></div>
            <dl><div><dt>입력</dt><dd>{active.input}</dd></div><div><dt>산출물</dt><dd>{active.output}</dd></div><div><dt>실행 주기</dt><dd>{active.cadence}</dd></div></dl>
          </article>
        </section>

        <section className="boundarySection" id="boundary">
          <div className="sectionHeader"><div><p>DATA BOUNDARY</p><h2>자료가 머무는 위치</h2></div></div>
          <div className="boundaryGrid">
            <article><span>PRIVATE / NAS</span><h3>수집·가공 보관소</h3><p>원시 본문, 라벨링 중간 결과, 정보화 전체 기록과 스케줄 상태는 NAS Docker 볼륨에만 보존됩니다.</p><ul><li>raw</li><li>labeled</li><li>informationized</li><li>state</li></ul></article>
            <div className="transfer"><span>40 MIN</span><b>→</b><small>공개 기록<br />한 건만 이동</small></div>
            <article><span>PUBLIC / GITHUB</span><h3>정적 공개 소장본</h3><p>검토와 정보화가 끝난 공개 기록만 JSON에 누적되고 GitHub Pages의 검색 가능한 정적 페이지가 됩니다.</p><ul><li>archive.json</li><li>record pages</li><li>sitemap.xml</li><li>GitHub Pages</li></ul></article>
          </div>
        </section>

        <section className="recordsSection" id="records">
          <div className="sectionHeader"><div><p>PUBLIC ACCESSIONS</p><h2>현재 정적 소장본</h2></div><a href="https://kenitoa.github.io/warsachive/" target="_blank" rel="noreferrer">공개 페이지 열기 →</a></div>
          <div className="recordTable" role="table" aria-label="현재 공개 기록">
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
