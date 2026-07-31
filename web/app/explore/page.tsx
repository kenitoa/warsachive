import Link from "next/link";
import { getPlannedThemes } from "../../lib/archive-planning";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";

export default function ExplorePage() {
  const themes = getPlannedThemes();

  return <ArchiveShell pageClassName="routePage exploreRoute">
    <section className="routeIntro">
      <p className="routeEyebrow">EXPLORE / THEMATIC LENSES</p>
      <h1>하나의 사건을<br />여러 관점으로 읽습니다.</h1>
      <p>전투, 인물, 외교, 사료처럼 기록에 부여된 주제를 따라 새로운 연결을 발견합니다.</p>
    </section>
    <section className="themeIndex" aria-label="기획 주제 목록">
      <header className="routeSectionHeading">
        <p>CURATED THEMES</p>
        <h2>{themes.length}개의 기획 관점</h2>
      </header>
      <div className="themeCards">
        {themes.map((theme, index) => <article className="themeCard" key={theme.name}>
          <p>THEME {String(index + 1).padStart(2, "0")}</p>
          <h2>{theme.name}</h2>
          <p>{theme.description}</p>
          <dl>
            <div><dt>기록</dt><dd>{theme.records.length}건</dd></div>
            <div><dt>지역</dt><dd>{theme.regions.length}곳</dd></div>
            <div><dt>출처</dt><dd>{theme.sourceCount}건</dd></div>
          </dl>
          <div className="themeRecordLinks">
            {theme.records.slice(0, 3).map((record) => <Link href={`/archive/${record.id}/`} key={record.id}>{record.title}<span>→</span></Link>)}
          </div>
        </article>)}
      </div>
    </section>
    <ArchiveFooter />
  </ArchiveShell>;
}
