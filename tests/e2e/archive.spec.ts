import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("search conditions survive detail, refresh and return; aliases find related records", async ({ page }) => {
  await page.goto("/archive/?q=이순신&kind=source");
  await expect(page.getByRole("searchbox", { name: "기록 검색" })).toHaveValue("이순신");
  await page.getByRole("searchbox", { name: "기록 검색" }).fill("Yi Sun-sin");
  await expect(page.getByRole("searchbox", { name: "기록 검색" })).toHaveValue("Yi Sun-sin");
  await expect(page.locator(".simpleEventCard")).toHaveCount(1);
  await expect(page.locator(".simpleEventCard > a").first()).toHaveAttribute("href", /returnTo=.*q%3DYi/);
  await page.locator(".simpleEventCard > a").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("난중일기");
  await expect(page.locator("#sources a[target=_blank]").first()).toHaveAttribute("href", /^https:\/\//);
  await page.getByRole("link", { name: "목록으로 돌아가기" }).click();
  await expect(page.getByRole("searchbox", { name: "기록 검색" })).toHaveValue("Yi Sun-sin");
  await page.reload();
  await expect(page.locator(".simpleEventCard")).toHaveCount(1);
  await page.getByRole("searchbox", { name: "기록 검색" }).fill("없는 자료 xyz987");
  await expect(page.getByRole("heading", { name: "일치하는 기록이 없습니다." })).toBeVisible();
  await page.getByRole("button", { name: "전체 기록 보기", exact: true }).click();
  await expect(page.locator(".simpleEventCard")).toHaveCount(4);
});

test("bookmark, private note, font scale and reading position persist", async ({ page }) => {
  await page.goto("/archive/imjin-war/");
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "저장 해제", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByText("내 메모", { exact: true }).click();
  const note = "내 비교 메모 <script>alert('x')</script>";
  await page.getByLabel("이 기록에 남길 메모").fill(note);
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await page.getByLabel("글자 크기").selectOption("1.3");
  await page.locator("#background").getByRole("button", { name: "여기까지 읽음" }).click();
  await page.reload();
  await expect(page.getByLabel("글자 크기")).toHaveValue("1.3");
  await page.getByText("내 메모", { exact: true }).click();
  await expect(page.getByLabel("이 기록에 남길 메모")).toHaveValue(note);
  await page.getByRole("button", { name: "읽던 위치로 이동" }).click();
  await expect(page.locator("#background")).toBeFocused();
  await page.goto("/saved/");
  await expect(page.getByRole("heading", { name: "저장한 기록 1개" })).toBeVisible();
  await expect(page.getByRole("region", { name: "개인 메모" }).locator(".savedNote")).toHaveText(note);
});

test("comparison and correction download expose grounded records without pretending submission", async ({ page }) => {
  await page.goto("/saved/?compare=imjin-war,nanjung-ilgi");
  await expect(page.getByRole("table", { name: "선택한 기록 비교" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "임진왜란" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "난중일기" })).toBeVisible();
  await page.goto("/archive/imjin-war/");
  await page.getByText("정정 제안 작성", { exact: true }).click();
  await page.getByLabel("문제 항목").fill("배경 설명");
  await page.getByLabel("문제 내용").fill("해당 문장의 원문 근거 위치를 더 명확히 설명해 주세요.");
  await page.getByLabel("근거 자료 주소").fill("https://sillok.history.go.kr/id/kna_12601011_013");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "정정 제안 파일 내려받기" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("correction-imjin-war.json");
  await expect(page.getByText("정정 제안 파일을 만들었습니다. 접수는 아직 이루어지지 않았습니다.")).toBeVisible();
});

test("unreviewed legacy URLs remain available without repeating unrelated summaries", async ({ page }) => {
  await page.goto("/archive/bhm365-special-interview-melvin-forbes-president-and-ceo/");
  await expect(page.getByRole("heading", { name: "이 기록은 검토 중입니다." })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator(".recordSheet")).not.toContainText("1592-1598");
  await expect(page.locator(".recordSheet")).not.toContainText("일본군의 침공으로 시작");
});

test("damaged storage is preserved and disabled storage keeps an honest memory fallback", async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem("war-archive.shelf.v1", "broken-original"));
  await page.goto("/archive/imjin-war/");
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("war-archive.shelf.v1"))).toBe("broken-original");
  await expect(page.locator(".bookmarkControl").first()).toContainText(/JSON|데이터|형식/);
  await page.evaluate(() => localStorage.removeItem("war-archive.shelf.v1"));
  const denied = await context.newPage();
  await denied.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException("denied", "QuotaExceededError"); }; });
  await denied.goto("/archive/nanjung-ilgi/");
  await denied.getByRole("button", { name: "기록 저장", exact: true }).click();
  await expect(denied.getByRole("button", { name: "저장 해제", exact: true })).toBeVisible();
  await expect(denied.locator(".bookmarkControl").first()).toContainText("현재 화면에서만 유지");
  await denied.close();
});

test("six menus, mobile navigation, keyboard skip and editorial pages work", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator(".museumCollections .collectionCard")).toHaveCount(4);
  if (isMobile) {
    const heroText = await page.locator(".heroContent").boundingBox();
    const heroTimeline = await page.locator(".heroTimeline").boundingBox();
    expect(heroText && heroTimeline && heroText.y + heroText.height <= heroTimeline.y + 1).toBeTruthy();
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await expect(page.getByRole("navigation", { name: "모바일 메뉴" }).getByRole("link")).toHaveCount(6);
    await page.getByRole("navigation", { name: "모바일 메뉴" }).getByRole("link", { name: "컬렉션", exact: true }).click();
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toHaveAttribute("aria-expanded", "false");
  } else {
    await expect(page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link")).toHaveCount(6);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused();
  }
  await page.goto("/collections/");
  await page.locator(".collectionIdentity h2 a").first().click();
  await expect(page.getByRole("heading", { name: "권장 읽기 순서" })).toBeVisible();
  await page.goto("/stories/");
  await page.locator(".storyFeature h2 a").first().click();
  await expect(page.getByRole("heading", { name: "함께 생각할 질문" })).toBeVisible();
  await expect(page.locator(".storySourceList a[target=_blank]").first()).toHaveAttribute("href", /^https:\/\//);
});

test("editorial record links return to their collection step", async ({ page }) => {
  await page.goto("/collections/imjin-reading-path/");
  await page.locator(".editorialRecordList a").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("임진왜란");
  await page.getByRole("link", { name: "목록으로 돌아가기" }).click();
  await expect(page).toHaveURL(/\/collections\/imjin-reading-path\/#step-1$/);
  await expect(page.getByRole("heading", { name: "권장 읽기 순서" })).toBeAttached();
});

test("independent notes are manageable and imported unknown IDs never create broken links", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("war-archive.shelf.v1", JSON.stringify({ version: 1, bookmarks: ["no-such-record"], notes: { "imjin-war": "북마크 없이 남긴 메모" }, recent: [], fontScale: 1, metricsConsent: false, metrics: {} })));
  await page.goto("/saved/");
  await expect(page.getByRole("region", { name: "개인 메모" })).toContainText("북마크 없이 남긴 메모");
  await expect(page.locator('a[href="/archive/no-such-record/"]')).toHaveCount(0);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "이 메모 지우기" }).click();
  await expect(page.getByRole("region", { name: "개인 메모" })).not.toContainText("북마크 없이 남긴 메모");
});

test("backup restore, consent and clipboard fallback preserve user data", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new DOMException("denied", "NotAllowedError"); } }, configurable: true }));
  await page.goto("/archive/imjin-war/");
  await page.getByRole("button", { name: "인용 복사", exact: true }).click();
  await expect(page.getByLabel("직접 복사할 내용")).toHaveValue(/임진왜란\. 전쟁 역사 아카이브/);
  await page.goto("/saved/");
  await page.getByRole("checkbox", { name: "검색·열람·출처 확인 횟수를 이 브라우저에만 집계" }).check();
  await page.goto("/archive/imjin-war/");
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await page.goto("/saved/");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("war-archive.shelf.v1") ?? "{}").metrics.record_open)).toBeGreaterThan(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /내보내기/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await page.getByRole("checkbox", { name: "검색·열람·출처 확인 횟수를 이 브라우저에만 집계" }).uncheck();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("war-archive.shelf.v1") ?? "{}").metrics)).toEqual({});
  const before = await page.evaluate(() => localStorage.getItem("war-archive.shelf.v1"));
  await page.getByLabel("보관함 가져오기", { exact: true }).setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"version":999}') });
  await expect(page.locator(".shelfManager > p[role=status]")).toContainText("지원하지 않는 보관함 데이터");
  expect(await page.evaluate(() => localStorage.getItem("war-archive.shelf.v1"))).toBe(before);
  await expect(page.getByRole("heading", { name: "저장한 기록 1개" })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "이 기기 저장 데이터 지우기" }).click();
  await expect(page.getByRole("heading", { name: "저장한 기록 0개" })).toBeVisible();
  const exportedPath = await download.path();
  expect(exportedPath).toBeTruthy();
  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("보관함 가져오기", { exact: true }).setInputFiles(exportedPath!);
  await expect(page.getByRole("heading", { name: "저장한 기록 1개" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "검색·열람·출처 확인 횟수를 이 브라우저에만 집계" })).toBeChecked();
});

test("narrow reflow and reduced motion keep core content available", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/", "/archive/", "/archive/imjin-war/", "/saved/?compare=imjin-war,nanjung-ilgi", "/collections/imjin-reading-path/"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  }
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

for (const route of ["/", "/archive/", "/archive/imjin-war/", "/explore/", "/timeline/", "/collections/", "/stories/", "/about/", "/saved/", "/collections/imjin-reading-path/", "/stories/two-records-one-war/"]) {
  test("accessibility and viewport: " + route, async ({ page }, testInfo) => {
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.url().startsWith("http://127.0.0.1:4173/") && response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`); });
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (route === "/archive/imjin-war/") {
      const knowledgeTargets = page.locator("#knowledge > details > summary");
      expect(await knowledgeTargets.count()).toBeGreaterThan(0);
      for (const target of await knowledgeTargets.all()) {
        expect(await target.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      }
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
    if (route === "/" || route === "/archive/imjin-war/") { await page.screenshot({ path: testInfo.outputPath("screen.png"), fullPage: true }); await page.screenshot({ path: testInfo.outputPath("viewport.png") }); }
  });
}
