import { EventArchive } from "./event-archive";
import { getSiteUrl } from "./site-config";

const classifications = [
  ["01", "전쟁과 전투", "War & Conflict"],
  ["02", "인물과 증언", "People & Testimony"],
  ["03", "지도와 장소", "Maps & Places"],
  ["04", "조약과 외교", "Treaties & Diplomacy"]
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
          <span>전쟁 역사 아카이브<small>WAR HISTORY ARCHIVE</small></span>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#catalogue">소장 기록</a>
          <a href="#classification">분류 체계</a>
          <a href="#principles">기록 원칙</a>
        </nav>
        <span className="headerIndex">ARCHIVE № 001</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="heroCopy">
          <p className="eyebrow"><span /> DIGITAL COLLECTION · EST. 2026</p>
          <h1 id="hero-title">전쟁의 기록을<br /><em>기억의 질서</em>로.</h1>
          <p className="lead">전투의 결과만이 아니라 그 전후의 사람, 장소, 사료와 증언을 연결합니다. 흩어진 기록을 출처와 맥락 속에서 다시 읽는 디지털 역사 보관소입니다.</p>
          <div className="heroActions">
            <a className="primaryAction" href="#catalogue">소장 기록 열람</a>
            <a className="textAction" href="#principles">아카이브 소개 <span>→</span></a>
          </div>
        </div>

        <aside className="accessionCard" aria-label="대표 소장 기록 정보">
          <div className="cardTape" />
          <p className="cardLabel">ACCESSION RECORD</p>
          <div className="catalogueNumber">WA–2026<br />COL. 001</div>
          <dl>
            <div><dt>수집 범위</dt><dd>고대 — 현대</dd></div>
            <div><dt>자료 유형</dt><dd>사건 · 인물 · 사료</dd></div>
            <div><dt>공개 상태</dt><dd><span className="statusDot" /> 열람 가능</dd></div>
          </dl>
          <div className="stamp">ARCHIVED<br /><small>검토 기록</small></div>
        </aside>
      </section>

      <section className="archiveStats" aria-label="아카이브 현황">
        <p><span>COLLECTION</span><strong>01</strong><small>구축 중인 컬렉션</small></p>
        <p><span>SOURCES</span><strong>01</strong><small>검토된 출처</small></p>
        <p><span>PERIOD</span><strong>∞</strong><small>시대를 잇는 기록</small></p>
        <p className="statNote">기록은 완결된 결론이 아니라<br />새로운 사료와 함께 갱신됩니다.</p>
      </section>

      <section className="classification" id="classification">
        <div className="sectionHeading">
          <p className="sectionNumber">분류 체계 / CLASSIFICATION</p>
          <h2>기록으로 들어가는<br />네 개의 서랍</h2>
        </div>
        <div className="classificationList">
          {classifications.map(([number, title, english]) => (
            <article key={number}>
              <span>{number}</span><h3>{title}</h3><p>{english}</p><b>↗</b>
            </article>
          ))}
        </div>
      </section>

      <section className="catalogue" id="catalogue">
        <div className="sectionHeading horizontal">
          <div>
            <p className="sectionNumber">소장 기록 / CATALOGUE</p>
            <h2>최근 등록 기록</h2>
          </div>
          <p>각 기록에는 출처와 수정 이력이 함께 보존됩니다.</p>
        </div>
        <EventArchive />
      </section>

      <section className="principles" id="principles">
        <div className="principleIntro">
          <p className="sectionNumber">기록 원칙 / ARCHIVAL PRINCIPLES</p>
          <h2>보존한다는 것은<br />맥락을 남기는 일입니다.</h2>
        </div>
        <ol className="principleList">
          <li><span>01</span><div><strong>출처를 먼저 봅니다</strong><p>모든 주장에 근거가 되는 원문, 사료와 검토 상태를 연결합니다.</p></div></li>
          <li><span>02</span><div><strong>하나의 시선으로 단정하지 않습니다</strong><p>승패 뒤에 가려진 여러 집단과 개인의 경험을 함께 기록합니다.</p></div></li>
          <li><span>03</span><div><strong>변경도 역사가 됩니다</strong><p>기록이 수정된 이유와 검토 과정을 지우지 않고 남깁니다.</p></div></li>
        </ol>
      </section>

      <footer>
        <a className="brand footerBrand" href="#top"><span className="brandMark">WA</span><span>전쟁 역사 아카이브<small>WAR HISTORY ARCHIVE</small></span></a>
        <p>전쟁을 찬양하지 않고, 기록으로 이해합니다.</p>
        <p>© 2026 · DIGITAL ARCHIVE</p>
      </footer>
    </main>
  );
}
