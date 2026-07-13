import { EventArchive } from "./event-archive";
import { getSiteUrl } from "./site-config";

const classifications = [
  ["A", "전쟁과 전투", "전투 기록, 작전, 피해 흐름"],
  ["B", "인물과 증언", "개인 경험, 지휘관, 민간인"],
  ["C", "지도와 장소", "전장, 이동 경로, 지역 변화"],
  ["D", "조약과 외교", "교섭, 외교문서, 전후 처리"]
];

const siteUrl = getSiteUrl();
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "전쟁 역사 아카이브",
      alternateName: "War History Archive",
      inLanguage: "ko-KR",
      description: "사건, 인물, 장소와 원문 사료를 출처와 맥락 속에서 탐색하는 디지털 역사 아카이브"
    },
    {
      "@type": "CollectionPage",
      "@id": `${siteUrl}/#collection`,
      url: siteUrl,
      name: "전쟁 역사 아카이브 소장 기록",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: ["전쟁사", "전투 기록", "역사 인물", "역사 사료"],
      inLanguage: "ko-KR"
    }
  ]
};

export default function Home() {
  return (
    <main id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="siteHeader">
        <a className="brand" href="#top" aria-label="전쟁 역사 아카이브 홈">
          <span className="brandMark">WA</span>
          <span>전쟁 역사 아카이브<small>REFERENCE LIBRARY</small></span>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#catalogue">열람실</a>
          <a href="#classification">분류 서가</a>
          <a href="#principles">운영 원칙</a>
        </nav>
        <span className="headerIndex">PUBLIC READING DESK</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="heroCopy">
          <p className="eyebrow"><span /> OPEN REFERENCE ROOM</p>
          <h1 id="hero-title">사료를 찾고,<br /><span className="heroTitleLine"><em>맥락으로</em> 읽습니다.</span></h1>
          <p className="lead">전쟁 기록을 전시물처럼 바라보는 대신, 도서관 열람대에서 원문과 해제를 함께 펼쳐 읽는 공개 자료실입니다. 검색, 분류, 책갈피, 인용 복사를 한 화면에서 다룹니다.</p>
          <div className="heroActions">
            <a className="primaryAction" href="#catalogue">문헌 검색 시작</a>
            <a className="textAction" href="#classification">분류 서가 보기 <span>→</span></a>
          </div>
        </div>

        <div className="heroGallery">
          <aside className="accessionCard" aria-label="열람실 상태">
            <p className="cardLabel">TODAY'S DESK</p>
            <div className="catalogueNumber">WA-REF<br />001</div>
            <dl>
              <div><dt>자료 상태</dt><dd><span className="statusDot" /> 공개 열람</dd></div>
              <div><dt>현재 주제</dt><dd>임진왜란</dd></div>
              <div><dt>열람 도구</dt><dd>검색 · 분류 · 인용</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="archiveStats" aria-label="아카이브 현황">
        <p><span>DOCUMENTS</span><strong>01</strong><small>열람 가능한 문헌</small></p>
        <p><span>SOURCES</span><strong>02</strong><small>연결된 출처</small></p>
        <p><span>TOOLS</span><strong>08</strong><small>페이지 내 열람 기능</small></p>
        <p className="statNote">검색 결과를 누르면 열람대가 즉시 바뀌고,<br />해제와 출처 근거가 함께 갱신됩니다.</p>
      </section>

      <section className="classification" id="classification">
        <div className="sectionHeading">
          <p className="sectionNumber">분류 서가 / STACKS</p>
          <h2>자료를 찾는<br />네 개의 입구</h2>
        </div>
        <div className="classificationList">
          {classifications.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span><h3>{title}</h3><p>{description}</p><b>OPEN</b>
            </article>
          ))}
        </div>
      </section>

      <section className="catalogue" id="catalogue">
        <div className="sectionHeading horizontal">
          <div>
            <p className="sectionNumber">자료 열람실 / READING ROOM</p>
            <h2>검색하고 펼쳐 읽는 자료실</h2>
          </div>
          <p>본문 선택, 탭 전환, 글자 크기, 책갈피, 인용 복사가 모두 같은 열람대 안에서 작동합니다.</p>
        </div>
        <EventArchive />
      </section>

      <section className="principles" id="principles">
        <div className="principleIntro">
          <p className="sectionNumber">운영 원칙 / METHOD</p>
          <h2>읽을 수 있어야<br />보존된 것입니다.</h2>
        </div>
        <ol className="principleList">
          <li><span>01</span><div><strong>원문과 해제를 분리하지 않습니다</strong><p>사용자가 검색한 문헌을 읽는 동안 출처, 해제, 품질 정보를 같은 화면에 둡니다.</p></div></li>
          <li><span>02</span><div><strong>본문 자체가 인터페이스입니다</strong><p>버튼을 찾아 헤매지 않아도 문헌 카드 본문을 누르면 열람대가 갱신됩니다.</p></div></li>
          <li><span>03</span><div><strong>읽기 상태를 직접 조절합니다</strong><p>요점, 연표, 인물·장소, 출처 탭과 글자 크기 조절을 제공합니다.</p></div></li>
        </ol>
      </section>

      <footer>
        <a className="brand footerBrand" href="#top"><span className="brandMark">WA</span><span>전쟁 역사 아카이브<small>REFERENCE LIBRARY</small></span></a>
        <p>전쟁을 찬양하지 않고, 기록으로 이해합니다.</p>
        <p>© 2026 · PUBLIC REFERENCE</p>
      </footer>
    </main>
  );
}
