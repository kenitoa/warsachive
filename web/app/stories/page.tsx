import Link from "next/link";
import { editorialStories } from "../../lib/archive-data";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { makePageMetadata } from "../site-config";

export const metadata = makePageMetadata("스토리", "사건과 사료를 연결하는 독립 편집 해설을 학습 질문과 연결 자료의 근거와 함께 읽습니다.", "/stories/");

export default function StoriesPage() {
  return <ArchiveShell pageClassName="routePage storiesRoute"><section className="routeIntro"><p className="routeEyebrow">STORIES / EDITORIAL READING</p><h1>사건의 이름 뒤에 있는<br />맥락을 읽습니다.</h1><p>사료를 어떻게 읽고 비교할지 안내하는 편집 해설입니다. 실제 증언의 직접 인용과 구분해 제공합니다.</p></section><section className="storyFeatures" aria-label="기획 이야기 목록">{editorialStories.map((story, index) => <article className="storyFeature" key={story.id}><header><p>STORY {String(index + 1).padStart(2, "0")} · 편집 해설</p><h2><Link href={`/stories/${story.id}/`}>{story.title}</Link></h2><span>약 {story.readingMinutes}분 · 수정 {story.updatedAt.slice(0, 10)}</span></header><p className="storyDeck">{story.deck}</p><p>{story.introduction}</p><div className="storyPerspectives">{story.sections.map((section) => <span key={section.id}>{section.title}</span>)}</div><Link href={`/stories/${story.id}/`}>이야기 전문 읽기 →</Link></article>)}</section><ArchiveFooter /></ArchiveShell>;
}
