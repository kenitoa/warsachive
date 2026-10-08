import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const existingWorkspace = { version: 1, projects: [{ id: "fixture-research", title: "기존 비교 연구", question: "기존 질문을 유지합니다.", recordIds: ["imjin-war"], claims: [], notes: "기존 메모", updatedAt: "2026-10-07T00:00:00Z" }], plans: [] };

test("typed source discovery explains matches and returns to the exact search query", async ({ page }) => {
  await page.goto("/archive/?q=Nanjung&target=source");
  await expect(page.getByRole("button", { name: "출처", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".simpleEventCard")).toHaveCount(0);
  const results = page.getByRole("region", { name: "출처·인물·장소 검색 결과" });
  await expect(results.locator("article").first()).toContainText(/일치:/);
  await results.locator("h3 a").first().click();
  await expect(page.getByRole("heading", { name: "자료 계통과 실제 제공 범위" })).toBeVisible();
  await expect(page.getByText(/미디어 직접 표시|이용 허가 미확인/).first()).toBeVisible();
  await page.getByRole("link", { name: "목록으로 돌아가기", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "기록 검색" })).toHaveValue("Nanjung");
  await expect(page.getByRole("button", { name: "출처", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload(); await expect(results.locator("article")).not.toHaveCount(0);
});

test("zero results relax one condition while preserving the question and target", async ({ page }) => {
  await page.goto("/archive/?q=Nanjung&target=source&region=없는지역");
  await expect(page.getByRole("heading", { name: "일치하는 기록이 없습니다." })).toBeVisible();
  await page.getByRole("button", { name: /지역 조건 해제 · \d+건 찾기/ }).click();
  await expect(page.getByRole("searchbox", { name: "기록 검색" })).toHaveValue("Nanjung");
  await expect(page.getByRole("button", { name: "출처", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "출처·인물·장소 검색 결과" })).toBeVisible();
  await expect(page).toHaveURL(/q=Nanjung&target=source/);
});

test("search selection enters an existing research without overwriting it before explicit save", async ({ page }) => {
  await page.goto("/archive/?q=난중일기&target=record");
  await page.evaluate(state => localStorage.setItem("war-archive.workspace.v1", JSON.stringify(state)), existingWorkspace);
  await page.getByRole("checkbox", { name: "작업 자료 선택 · 난중일기", exact: true }).check();
  const basket = page.getByRole("region", { name: "선택 자료 작업에 담기" });
  await basket.getByRole("button", { name: "작업에 담기 · 1개 기록", exact: true }).click();
  await basket.getByRole("combobox", { name: "담을 작업" }).selectOption("research:fixture-research");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("war-archive.workspace.v1")!))).toEqual(existingWorkspace);
  await basket.getByRole("link", { name: "선택한 작업에서 확인하기 →" }).click();
  await expect(page).toHaveURL(/project=fixture-research/);
  await expect(page.getByRole("textbox", { name: "연구 질문", exact: true })).toHaveValue(existingWorkspace.projects[0].question);
  const selected = page.getByRole("group", { name: "함께 읽을 기록", exact: true });
  await expect(selected.getByRole("checkbox", { name: "임진왜란", exact: true })).toBeChecked();
  await expect(selected.getByRole("checkbox", { name: "난중일기", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "이 기기에 연구 저장", exact: true }).click();
  await expect(page.getByText("이 기기에 저장했습니다.", { exact: true })).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("war-archive.workspace.v1")!));
  expect(state.projects).toHaveLength(1); expect(state.projects[0].notes).toBe("기존 메모"); expect(state.projects[0].recordIds).toEqual(["imjin-war", "nanjung-ilgi"]);
});

test("source basket reuses an existing teaching plan and preserves its private preparation", async ({ page }) => {
  const state = { ...existingWorkspace, plans: [{ id: "fixture-plan", title: "기존 수업안", goal: "기존 목표", level: "입문", recordIds: ["imjin-war"], questions: ["기존 질문"], teacherNotes: "비공개 준비", answerKey: "비공개 답안", updatedAt: "2026-10-07T00:00:00Z" }] };
  await page.goto("/sources/unesco-nanjung/?returnTo=%2Farchive%2F%3Fq%3DNanjung%26target%3Dsource");
  await page.evaluate(value => localStorage.setItem("war-archive.workspace.v1", JSON.stringify(value)), state);
  const basket = page.getByRole("region", { name: "선택 자료 작업에 담기" });
  await basket.getByRole("button", { name: "작업에 담기 · 1개 기록", exact: true }).click();
  await basket.getByRole("combobox", { name: "담을 작업" }).selectOption("teaching:fixture-plan");
  await basket.getByRole("link", { name: "선택한 작업에서 확인하기 →" }).click();
  await expect(page).toHaveURL(/plan=fixture-plan/); await expect(page).toHaveURL(/source=unesco-nanjung/);
  await expect(page.getByRole("textbox", { name: "수업 제목", exact: true })).toHaveValue("기존 수업안");
  await expect(page.getByRole("textbox", { name: "교사 메모", exact: true })).toHaveValue("비공개 준비");
  await expect(page.getByRole("textbox", { name: "교사용 답안·평가 기준", exact: true })).toHaveValue("비공개 답안");
  const selected = page.getByRole("group", { name: "읽을 자료 선택", exact: true }); await expect(selected.getByRole("checkbox", { name: "난중일기", exact: true })).toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("war-archive.workspace.v1")!))).toEqual(state);
  await page.getByRole("button", { name: "기기 저장", exact: true }).click();
  await expect(page.getByText("이 기기에 저장했습니다.", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("war-archive.workspace.v1")!));
  expect(saved.plans).toHaveLength(1); expect(saved.plans[0].recordIds).toEqual(["imjin-war", "nanjung-ilgi"]); expect(saved.plans[0].answerKey).toBe("비공개 답안");
});

test("section evidence sends an exact source location while leaving the direct quote empty", async ({ page }) => {
  await page.goto("/archive/imjin-war/?returnTo=%2Farchive%2F%3Fq%3D%EC%9E%84%EC%A7%84%EC%99%9C%EB%9E%80#background");
  await page.evaluate(value => localStorage.setItem("war-archive.workspace.v1", JSON.stringify(value)), existingWorkspace);
  const evidence = page.locator("#background details"); await evidence.locator("summary").click();
  const basket = evidence.getByRole("region", { name: "선택 자료 작업에 담기" }).first(); await basket.getByRole("button", { name: "작업에 담기 · 1개 기록", exact: true }).click();
  await basket.getByRole("combobox", { name: "담을 작업" }).selectOption("research:fixture-research");
  const href = await basket.getByRole("link", { name: "선택한 작업에서 확인하기 →" }).getAttribute("href"); const parameters = new URL(href!, "https://example.org").searchParams;
  expect(parameters.get("section")).toBe("background"); expect(parameters.get("source")).toBeTruthy(); expect(parameters.get("locator")).toBeTruthy(); expect(parameters.get("quoteKind")).toBe("source-link"); expect(parameters.get("returnTo")).toContain("#background");
  await basket.getByRole("link", { name: "선택한 작업에서 확인하기 →" }).click();
  await page.getByRole("textbox", { name: "검토할 주장", exact: true }).fill("fixture 근거의 설명 범위를 확인합니다.");
  await page.getByRole("button", { name: "주장 추가", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "연결 자료", exact: true })).toHaveValue(parameters.get("source")!);
  await expect(page.getByRole("textbox", { name: "실제 열람 위치", exact: true })).toHaveValue(parameters.get("locator")!);
  await expect(page.getByRole("combobox", { name: "구분", exact: true })).toHaveValue("note");
  await expect(page.getByRole("textbox", { name: "내용", exact: true })).toHaveValue("");
});

test("claim deep links reveal enclosing evidence and record limits stay before the body", async ({ page }) => {
  await page.goto("/archive/nanjung-ilgi/#claim-nanjung-creator");
  await expect(page.locator("#claim-nanjung-creator")).toBeVisible();
  await expect(page.locator("#claim-nanjung-creator")).toBeFocused();
  await expect(page.locator("#claim-nanjung-creator")).toBeInViewport();
  await expect.poll(() => page.locator("#claim-nanjung-creator").evaluate(node => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(90);
  await expect.poll(() => page.locator("#claim-nanjung-creator").evaluate(node => Math.abs(node.getBoundingClientRect().top - 110))).toBeLessThanOrEqual(1);
  await expect(page.getByRole("region", { name: "이 기록을 읽기 전 안내" })).toContainText("사람 최종 검수 대기");
  const ordering = await page.evaluate(() => { const guide = document.querySelector('section[aria-label="이 기록을 읽기 전 안내"]')!; const body = document.querySelector(".recordBody")!; return Boolean(guide.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING); });
  expect(ordering).toBe(true);
  await page.locator("#knowledge details").evaluateAll(nodes => nodes.forEach(node => { (node as HTMLDetailsElement).open = true; }));
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(audit.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
});

test("date purpose, missing coordinates and untranslated routes expose actual boundaries", async ({ page }) => {
  await page.goto("/timeline/");
  const chronology = page.getByRole("region", { name: "날짜 목적과 역법별 자료 연표" });
  await chronology.getByRole("combobox", { name: "날짜의 의미" }).selectOption("creation");
  await expect(chronology.getByRole("status")).toContainText(/날짜 \d+개/);
  await expect(chronology.locator("li").first()).toContainText("작성·제작 시기");
  await page.goto("/places/"); await expect(page.getByText("현재 공개 자료에 검수한 좌표가 없습니다.", { exact: false })).toBeVisible();
  await expect(page.locator("svg[aria-label='검수한 좌표의 위도·경도 분포']")).toHaveCount(0);
  await page.goto("/read/"); await expect(page.getByText(/승인된 전체 번역은 0개/)).toBeVisible();
  await expect(page.locator('a[href*="/read/en/"]')).toHaveCount(0);
  await page.goto("/archive/imjin-war/"); await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
});

test("discovery cards and source details fit a narrow screen with expanded work actions", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 780 });
  for (const [name, route] of [["search", "/archive/?q=Nanjung&target=source"], ["source", "/sources/unesco-nanjung/"], ["reading", "/read/"], ["record", "/archive/nanjung-ilgi/"]] as const) {
    await page.goto(route); await page.getByRole("heading", { level: 1 }).waitFor();
    if (name === "source" || name === "record") { await page.getByRole("button", { name: "작업에 담기 · 1개 기록", exact: true }).first().click(); }
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(audit.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })), route).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name}-320.png`), fullPage: true });
  }
});
