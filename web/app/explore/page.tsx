import Link from "next/link";
import { ReadingPurpose } from "../components/knowledge-reading-guide";
import { archiveEvents, editorialThemes } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { makePageMetadata, sitePath } from "../site-config";

export const metadata = makePageMetadata("주제 탐색", "전투·외교·사료·인물의 질문을 따라 관련 기록과 학습 경로를 탐색합니다.", "/explore/");

export default function ExplorePage() {
  return <ArchiveShell pageClassName="routePage exploreRoute">
    <section className="routeIntro"><p className="routeEyebrow">EXPLORE / THEMATIC LENSES</p><h1>하나의 사건을<br />여러 관점으로 읽습니다.</h1><p>무엇을 알고 싶은지에서 출발해 질문, 입문 기록, 원문과 기관 해설을 연결합니다.</p></section>
    <ReadingPurpose records={archiveEvents} title="공개 자료의 관점 탐색" questions={["사건의 시기와 자료가 작성된 시기는 어떻게 다른가요?", "원문·국역·기관 해설은 어떤 확인 범위를 제공하나요?", "현재 자료에서 확인할 수 없는 관점과 다음에 찾을 근거는 무엇인가요?"]} /><section className="themeIndex" aria-label="기획 주제 목록"><header className="routeSectionHeading"><p>CURATED QUESTIONS</p><h2>{editorialThemes.length}개의 기획 관점</h2></header><div className="themeCards">
      {editorialThemes.map((theme, index) => {
        const records = theme.recordIds.flatMap((id) => archiveEvents.filter((record) => record.id === id));
        const sourceCount = new Set(records.flatMap((record) => record.sources.map((source) => source.url))).size;
        return <article className="themeCard" key={theme.id} id={theme.id}><p>THEME {String(index + 1).padStart(2, "0")}</p><h2>{theme.title}</h2><p>{theme.description}</p><h3 className="themeQuestion">{theme.question}</h3><dl><div><dt>공개 기록</dt><dd>{records.length}건</dd></div><div><dt>고유 자료</dt><dd>{sourceCount}건</dd></div></dl><div className="themeRecordLinks">{records.map((record, recordIndex) => <Link href={`/archive/${record.id}/?returnTo=${encodeURIComponent(sitePath(`/explore/#${theme.id}`))}`} key={record.id}><span>{recordIndex + 1}. {record.title}</span><span aria-hidden="true">→</span></Link>)}</div><details className="editorialQuestions"><summary>읽으면서 생각할 질문</summary><ul>{theme.learningQuestions.map((question) => <li key={question}>{question}</li>)}</ul></details><div className="themeBrowseLinks">{theme.labels.map((label) => <Link className="editorialTextLink" href={`/archive/?label=${encodeURIComponent(label)}`} key={label}>{label} 기록 더 찾기 →</Link>)}</div></article>;
      })}
    </div></section><ArchiveFooter />
  </ArchiveShell>;
}
