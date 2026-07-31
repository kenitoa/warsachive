import Link from "next/link";
import { getPlannedStories } from "../../lib/archive-planning";
import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";

export default function StoriesPage() {
  const stories = getPlannedStories();

  return <ArchiveShell pageClassName="routePage storiesRoute">
    <section className="routeIntro">
      <p className="routeEyebrow">STORIES / PEOPLE & PLACES</p>
      <h1>사건의 이름 뒤에 있는<br />사람과 장소를 만납니다.</h1>
      <p>연대와 승패만으로는 보이지 않는 경험을 인물, 공동체, 장소의 목소리로 다시 읽습니다.</p>
    </section>
    <section className="storyFeatures" aria-label="기획 이야기">
      {stories.map((story, index) => <article className="storyFeature" key={story.id}>
        <header>
          <p>STORY {String(index + 1).padStart(2, "0")} · {story.period}</p>
          <h2>{story.title}</h2>
          <span>{story.region}</span>
        </header>
        <blockquote>{story.deck}</blockquote>
        <p>{story.narrative}</p>
        {story.perspectives.length > 0 ? <div className="storyPerspectives" aria-label="이야기에 등장하는 인물과 장소">
          {story.perspectives.map((perspective) => <span key={perspective}>{perspective}</span>)}
        </div> : null}
        <Link href={story.href}>기록 전문 읽기 →</Link>
      </article>)}
    </section>
    <ArchiveFooter />
  </ArchiveShell>;
}
