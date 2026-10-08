import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.skip(process.env.ARCHIVE_TEST_API !== "true", "Needs the isolated API fixture for real login and draft saves.");
type SavedDraft = { id: string; version: number; contentHash: string; record: { id: string } };
async function saveDraft(page: Page, recordId: string, title: string): Promise<SavedDraft> {
  await page.getByRole("combobox", { name: "현재 공개 기록을 편집 시작점으로 선택" }).selectOption("");
  await page.getByRole("combobox", { name: "현재 공개 기록을 편집 시작점으로 선택" }).selectOption("imjin-war");
  await page.locator("#cms-id").fill(recordId);
  await page.locator("#cms-title").fill(title);
  const response = page.waitForResponse(item => item.url().endsWith("/api/v1/cms/drafts") && item.request().method() === "POST");
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  const saved = await response;
  expect(saved.ok()).toBe(true);
  const body = await saved.json() as { data: SavedDraft };
  await expect(page.getByText(/서버에 초안 버전 1을 저장했습니다/)).toBeVisible();
  return body.data;
}

test("publication UI fixture keeps release identities together across selection, refresh and draft changes", async ({ page }, testInfo) => {
  // These stage receipts test the browser presentation only. They do not prove
  // signed ingestion, independent approval, a real build, or a deployment.
  test.setTimeout(60_000);
  await page.goto("/account/");
  const form = page.locator(".expansionManager form").first();
  await form.getByRole("textbox", { name: "이메일", exact: true }).fill("fixture-admin@example.org");
  await form.getByLabel("비밀번호", { exact: true }).fill("fixture-password-only-123");
  await form.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser fixture admin의 계정", exact: true })).toBeVisible();
  await page.goto("/admin/");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const draft = await saveDraft(page, `fixture-release-${suffix}`, "릴리스 표시 UI 회귀 자료");
  const shaA = "a".repeat(40), shaB = "b".repeat(40), artifactA = "a".repeat(64), artifactB = "b".repeat(64);
  const receipt = (id: string, stage: string, commitSha: string | null, artifactHash: string, minute: number, revision = draft.version) => ({ id, stage, commitSha, artifactHash, revision, contentHash: draft.contentHash, url: null, observedAt: `2026-10-08T00:${String(minute).padStart(2, "0")}:00Z`, evidenceSource: "explicit-browser-ui-fixture" });
  const common = receipt("ui-export", "export", null, "e".repeat(64), 0);
  const partial = receipt("ui-b-build", "build", shaB, artifactB, 4);
  let response = { recordId: draft.record.id, revision: draft.version, contentHash: draft.contentHash, stages: [partial, receipt("ui-a-feed", "feed", shaA, artifactA, 3), receipt("ui-a-build", "build", shaA, artifactA, 1), receipt("ui-old-revision-feed", "feed", shaB, artifactB, 9, draft.version + 1), receipt("ui-a-deploy", "deploy", shaA, artifactA, 2), common] };
  await page.route("**/api/v1/cms/drafts/*/publication", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4173", "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify({ data: response, error: null, meta: {} }) }));
  const panel = page.getByRole("heading", { name: "실제 발행 단계 확인", exact: true }).locator("..");
  const selector = panel.getByRole("combobox", { name: "표시할 릴리스", exact: true });
  const steps = panel.locator(":scope > ol > li");
  await panel.getByRole("button", { name: "발행 단계 증거 확인", exact: true }).click();
  await expect(selector).toHaveValue(`${shaB}:${artifactB}`);
  await expect(selector.locator("option")).toHaveCount(2);
  await expect(steps.nth(0)).toContainText("ui-export");
  await expect(steps.nth(1)).toContainText("ui-b-build");
  await expect(steps.nth(2)).toContainText("선택 릴리스 확인 증거 없음");
  await expect(steps.nth(3)).toContainText("선택 릴리스 확인 증거 없음");
  await expect(panel).not.toContainText("ui-old-revision-feed");
  await selector.selectOption(`${shaA}:${artifactA}`);
  await expect(steps.nth(0)).toContainText("ui-export");
  await expect(steps.nth(1)).toContainText("ui-a-build");
  await expect(steps.nth(2)).toContainText("ui-a-deploy");
  await expect(steps.nth(3)).toContainText("ui-a-feed");
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await panel.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -110));
  await page.screenshot({ path: testInfo.outputPath("publication-release-320.png") });
  response = { ...response, stages: [partial, common] };
  await panel.getByRole("button", { name: "발행 단계 증거 확인", exact: true }).click();
  await expect(selector).toHaveValue(`${shaB}:${artifactB}`);
  await expect(selector.locator("option")).toHaveCount(1);
  await expect(steps.nth(3)).toContainText("선택 릴리스 확인 증거 없음");
  await expect(panel).not.toContainText("ui-a-feed");
  const other = await saveDraft(page, `fixture-release-next-${suffix}`, "다른 초안 릴리스 초기화 자료");
  await expect(selector).toHaveCount(0);
  await expect(panel).not.toContainText("ui-b-build");
  response = { recordId: other.record.id, revision: other.version, contentHash: other.contentHash, stages: [] };
  await panel.getByRole("button", { name: "발행 단계 증거 확인", exact: true }).click();
  await expect(panel).toContainText("현재 버전의 빌드·배포·모바일 자료 릴리스 증거가 없습니다.");
  await expect(selector).toHaveCount(0);
  await expect(steps).toHaveCount(4);
  for (const step of await steps.all()) await expect(step).toContainText("현재 버전 확인 증거 없음");
});
