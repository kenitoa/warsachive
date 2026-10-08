import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const draftKey = "war-archive.drafts.v1";
const workspaceKey = "war-archive.workspace.v1";
const apiEnabled = process.env.ARCHIVE_TEST_API === "true";
async function register(page: Page, prefix: string, returnTo = "") {
  const name = `고도화 ${prefix}`; const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  await page.goto(`/account/${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
  await page.getByRole("button", { name: "계정 만들기", exact: true }).first().click();
  const form = page.locator(".expansionManager form").first();
  await form.getByLabel("표시 이름", { exact: true }).fill(name);
  await form.getByLabel("이메일", { exact: true }).fill(email);
  await form.getByLabel("비밀번호", { exact: true }).fill("Refinement-test-password-2026!");
  await form.getByRole("button", { name: "계정 만들기", exact: true }).click();
  if (returnTo) await expect(page).toHaveURL(new RegExp(returnTo.split("?")[0]));
  else await expect(page.getByRole("heading", { name: `${name}의 계정`, exact: true })).toBeVisible();
  return { email, name };
}

test("unsubmitted research and evidence fields recover after switching, navigation and reload", async ({ page }) => {
  await page.goto("/workspace/?record=imjin-war");
  await page.getByRole("textbox", { name: "연구 제목", exact: true }).fill("자동복구 연구 A");
  await page.getByRole("textbox", { name: "연구 질문", exact: true }).fill("작성 시점은 왜 중요한가?");
  await page.getByRole("textbox", { name: "검토할 주장", exact: true }).fill("기록의 시점을 비교한다.");
  await page.getByRole("button", { name: "주장 추가", exact: true }).click();
  await page.getByRole("textbox", { name: "검토할 주장", exact: true }).fill("추가 전 두 번째 주장");
  await page.getByRole("combobox", { name: "연결 자료", exact: true }).selectOption({ index: 1 });
  await page.getByRole("textbox", { name: "실제 열람 위치", exact: true }).fill("권·쪽 확인 중");
  await page.getByRole("textbox", { name: "내용", exact: true }).fill("근거 추가 전 내 해석");
  await expect(page.getByText(/복구용 초안 저장됨/).first()).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), workspaceKey)).toBeNull();
  await page.getByRole("button", { name: "새 연구 만들기", exact: true }).click();
  await page.getByRole("textbox", { name: "연구 제목", exact: true }).fill("자동복구 연구 B");
  await page.goto("/about/"); await page.goto("/workspace/"); await page.reload();
  await expect(page.getByRole("textbox", { name: "연구 제목", exact: true })).toHaveValue("자동복구 연구 B");
  await page.getByText(/편집하다 이동한 연구 초안/).click();
  await page.getByRole("button", { name: "자동복구 연구 A", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "연구 질문", exact: true })).toHaveValue("작성 시점은 왜 중요한가?");
  await expect(page.getByRole("textbox", { name: "검토할 주장", exact: true })).toHaveValue("추가 전 두 번째 주장");
  await expect(page.getByRole("textbox", { name: "실제 열람 위치", exact: true })).toHaveValue("권·쪽 확인 중");
  await expect(page.getByRole("textbox", { name: "내용", exact: true })).toHaveValue("근거 추가 전 내 해석");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "검토할 주장", exact: true })).toHaveValue("추가 전 두 번째 주장");
});

test("new source capture starts an empty note and preserves the previous unfinished direct quote", async ({ page }) => {
  await page.goto("/workspace/?record=imjin-war");
  await page.getByRole("textbox", { name: "검토할 주장", exact: true }).fill("출처를 바꾸기 전 주장");
  await page.getByRole("button", { name: "주장 추가", exact: true }).click();
  await page.getByRole("combobox", { name: "연결 자료", exact: true }).selectOption({ index: 1 });
  const source = await page.getByRole("combobox", { name: "연결 자료", exact: true }).inputValue();
  await page.getByRole("combobox", { name: "구분", exact: true }).selectOption("quote");
  await page.getByRole("textbox", { name: "실제 열람 위치", exact: true }).fill("기존 열람 위치");
  await page.getByRole("textbox", { name: "내용", exact: true }).fill("작성하던 직접 인용을 보존한다.");
  const project = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).entries.find((item: { scope: string }) => item.scope === "workspace").payload.draft.id, draftKey);
  await page.goto(`/workspace/?project=${project}&record=imjin-war&source=${encodeURIComponent(source)}&locator=${encodeURIComponent("새 열람 위치")}&quoteKind=source-link`);
  await expect(page.getByRole("textbox", { name: "내용", exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "구분", exact: true })).toHaveValue("note");
  await expect(page.getByRole("textbox", { name: "실제 열람 위치", exact: true })).toHaveValue("새 열람 위치");
  await page.reload();
  await page.getByText(/이전에 작성하던 근거 입력/).click();
  await expect(page.getByText("작성하던 직접 인용을 보존한다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "이 근거 입력 이어 쓰기", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "내용", exact: true })).toHaveValue("작성하던 직접 인용을 보존한다.");
  await expect(page.getByRole("textbox", { name: "실제 열람 위치", exact: true })).toHaveValue("기존 열람 위치");
  await expect(page.getByRole("combobox", { name: "구분", exact: true })).toHaveValue("quote");
});

test("teaching private preparation and pending questions recover while public shares exclude them", async ({ page }) => {
  await page.goto("/teach/?records=imjin-war,nanjung-ilgi");
  await page.getByRole("textbox", { name: "수업 제목", exact: true }).fill("복구 수업 A");
  await page.getByRole("textbox", { name: "학습 목표", exact: true }).fill("작성 목적과 제공 범위를 구분한다.");
  await page.getByRole("textbox", { name: "교사 메모", exact: true }).fill("비공개 교사 준비 내용");
  await page.getByRole("textbox", { name: "교사용 답안·평가 기준", exact: true }).fill("비공개 모범 답안");
  await page.getByRole("textbox", { name: "추가할 질문", exact: true }).fill("아직 추가하지 않은 질문");
  await page.getByRole("link", { name: "기록과 근거 읽기 →", exact: true }).first().click();
  await expect(page).toHaveURL(/\/archive\/imjin-war\//);
  const returnToPlan = page.locator('a[href^="/teach/?plan="]').first();
  await expect(returnToPlan).toBeVisible();
  await returnToPlan.click();
  await expect(page.getByRole("textbox", { name: "추가할 질문", exact: true })).toHaveValue("아직 추가하지 않은 질문");
  await expect(page.getByRole("textbox", { name: "교사 메모", exact: true })).toHaveValue("비공개 교사 준비 내용");
  await page.getByRole("button", { name: "새 수업 경로", exact: true }).click();
  await page.getByRole("textbox", { name: "수업 제목", exact: true }).fill("복구 수업 B");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "수업 제목", exact: true })).toHaveValue("복구 수업 B");
  await page.getByText(/편집하다 이동한 수업 초안/).click();
  await page.getByRole("button", { name: "복구 수업 A", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "추가할 질문", exact: true })).toHaveValue("아직 추가하지 않은 질문");
  await expect(page.getByRole("textbox", { name: "교사 메모", exact: true })).toHaveValue("비공개 교사 준비 내용");
  await page.getByRole("button", { name: "공유 주소 만들기", exact: true }).click();
  const url = await page.getByRole("textbox", { name: "직접 복사할 수업 경로 주소", exact: true }).inputValue();
  const plan = JSON.parse(new URL(url).searchParams.get("plan")!);
  expect(plan.teacherNotes).toBeUndefined(); expect(plan.answerKey).toBeUndefined();
  expect(plan.recordIds).toEqual(["imjin-war", "nanjung-ilgi"]);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByLabel("교사 메모", { exact: true })).toBeHidden();
});

test("a competing tab cannot replace a research recovery draft and both inputs survive", async ({ page, context }) => {
  await page.goto("/workspace/?record=imjin-war");
  await page.getByRole("textbox", { name: "연구 제목", exact: true }).fill("두 탭 보호 연구");
  const other = await context.newPage(); await other.goto("/workspace/");
  await expect(other.getByRole("textbox", { name: "연구 제목", exact: true })).toHaveValue("두 탭 보호 연구");
  await page.getByRole("textbox", { name: "연구 질문", exact: true }).fill("첫 탭의 새 질문");
  await expect(other.getByText(/다른 탭이나 가져오기로 복구 초안이 변경/)).toBeVisible();
  await other.getByRole("textbox", { name: "연구 질문", exact: true }).fill("다른 탭의 입력 보존");
  await expect(other.getByRole("textbox", { name: "연구 질문", exact: true })).toHaveValue("다른 탭의 입력 보존");
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).entries.find((item: { scope: string }) => item.scope === "workspace").payload.draft.question, draftKey);
  expect(stored).toBe("첫 탭의 새 질문");
  await other.close();
});

test("corrupt recovery originals stay intact and quota failure is never displayed as saved", async ({ page }) => {
  await page.addInitScript(key => { if (!sessionStorage.getItem("test-corrupt-recovery-injected")) { localStorage.setItem(key, "corrupt-recovery-original"); sessionStorage.setItem("test-corrupt-recovery-injected", "true"); } }, draftKey);
  await page.goto("/workspace/?record=imjin-war");
  await expect(page.getByText(/기존 복구 초안을 읽지 못했습니다/)).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe("corrupt-recovery-original");
  await page.evaluate(key => localStorage.removeItem(key), draftKey);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "연구 제목", exact: true })).toBeVisible();
  await page.evaluate(key => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (name: string, value: string) { if (name === key) throw new DOMException("quota", "QuotaExceededError"); original.call(this, name, value); }; }, draftKey);
  await page.getByRole("textbox", { name: "연구 질문", exact: true }).fill("저장 실패해도 유지되는 입력");
  await expect(page.getByText("복구 초안 저장 실패", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "연구 질문", exact: true })).toHaveValue("저장 실패해도 유지되는 입력");
  await page.getByText("현재 입력 파일로 보관·복구", { exact: true }).first().click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "현재 초안 내보내기", exact: true }).first().click();
  const file = await downloaded; const payload = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(payload.payload.draft.question).toBe("저장 실패해도 유지되는 입력");
});

test("unified backup and scoped deletion cover local work and recovery without touching another app", async ({ page }) => {
  await page.goto("/workspace/?record=imjin-war");
  await page.getByRole("textbox", { name: "연구 제목", exact: true }).fill("백업할 연구");
  await page.getByRole("textbox", { name: "연구 질문", exact: true }).fill("복구 범위는 무엇인가?");
  await page.getByRole("button", { name: "이 기기에 연구 저장", exact: true }).click();
  await page.evaluate(() => localStorage.setItem("another-app", "preserve"));
  await page.goto("/saved/");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "선택 범위 통합 백업", exact: true }).click();
  const file = await downloaded; const path = (await file.path())!; const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.items.map((item: { key: string }) => item.key).sort()).toEqual(["war-archive.shelf.v1", workspaceKey, draftKey].sort());
  expect(backup.items.find((item: { key: string }) => item.key === workspaceKey).raw).toContain("백업할 연구");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "이 기기 저장 데이터 지우기", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), workspaceKey)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("another-app"))).toBe("preserve");
  await page.getByLabel("통합 백업 파일 확인", { exact: true }).setInputFiles(path);
  await expect(page.getByRole("heading", { name: "복구 전 범위 확인", exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "표시 범위 복구 실행", exact: true }).click();
  await page.goto("/workspace/");
  await expect(page.getByRole("textbox", { name: "연구 제목", exact: true })).toHaveValue("백업할 연구");
  expect(await page.evaluate(() => localStorage.getItem("another-app"))).toBe("preserve");
});

test("valid login return resumes the unsaved question without adding a manual saved project", async ({ page }) => {
  test.skip(!apiEnabled, "실제 테스트 API 로그인 복귀를 확인합니다.");
  await page.goto("/workspace/?record=imjin-war&returnTo=%2Fexplore%2F%3Fq%3D%25EC%259E%2584%25EC%25A7%2584");
  await page.getByRole("textbox", { name: "연구 제목", exact: true }).fill("로그인 후 이어갈 연구");
  await page.getByRole("textbox", { name: "연구 질문", exact: true }).fill("입력한 질문이 돌아와도 남는가?");
  const returnTo = await page.evaluate(() => location.pathname + location.search);
  await register(page, "resume", returnTo);
  await expect(page.getByRole("textbox", { name: "연구 질문", exact: true })).toHaveValue("입력한 질문이 돌아와도 남는가?");
  expect(await page.evaluate(key => localStorage.getItem(key), workspaceKey)).toBeNull();
  await expect(page.getByRole("link", { name: "이전 작업으로 돌아가기 →", exact: true })).toHaveAttribute("href", "/explore/?q=%EC%9E%84%EC%A7%84");
});

test("teacher reuses the local plan and learners cannot read private keys while answer drafts recover", async ({ page, browser }, testInfo) => {
  test.skip(!apiEnabled, "실제 API 교사·학습자 영역 검증입니다."); test.setTimeout(90_000);
  await register(page, "reuse-teacher"); await page.goto("/teach/?records=imjin-war,nanjung-ilgi");
  await page.getByRole("textbox", { name: "수업 제목", exact: true }).fill("실제 재사용 수업");
  await page.getByRole("textbox", { name: "학습 목표", exact: true }).fill("기관의 설명 범위를 비교한다.");
  await page.getByRole("textbox", { name: "교사 메모", exact: true }).fill("교사만 볼 비공개 준비");
  await page.getByRole("textbox", { name: "교사용 답안·평가 기준", exact: true }).fill("교사만 볼 비공개 답안");
  await page.getByRole("textbox", { name: "추가할 질문", exact: true }).fill("두 자료의 작성 목적은 어떻게 다른가?");
  await page.getByRole("button", { name: "질문 추가", exact: true }).click();
  await page.getByRole("button", { name: "기기 저장", exact: true }).click();
  await page.getByRole("textbox", { name: "수업 이름", exact: true }).fill("실제 재사용 수업 공간");
  await page.getByRole("button", { name: "공간 만들기", exact: true }).click();
  await page.getByRole("combobox", { name: "과제로 공개할 기기 수업", exact: true }).selectOption({ label: "실제 재사용 수업" });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "선택한 수업으로 과제 공개", exact: true }).click();
  await expect(page.getByText(/기기 수업을 자료 순서와 교사 전용 내용이 분리된 과제로 공개/)).toBeVisible();
  await page.getByRole("button", { name: "선택 역할 초대 코드 만들기", exact: true }).click();
  const code = (await page.locator(".studySpaces strong").textContent())!;
  const learnerContext = await browser.newContext({ baseURL: "http://127.0.0.1:4173" }); const learner = await learnerContext.newPage();
  try {
    await register(learner, "reuse-learner"); await learner.goto("/teach/");
    await learner.getByRole("textbox", { name: "수업 초대 코드", exact: true }).fill(code);
    const result = learner.waitForResponse(response => /\/spaces\/[A-Za-z0-9_-]+$/.test(new URL(response.url()).pathname) && response.request().method() === "GET");
    await learner.getByRole("button", { name: "코드로 참여", exact: true }).click();
    const envelope = await (await result).json();
    expect(envelope.data.tasks[0].teacherNotes).toBeUndefined(); expect(envelope.data.tasks[0].answerKey).toBeUndefined();
    expect(envelope.data.tasks[0].recordIds).toEqual(["imjin-war", "nanjung-ilgi"]);
    await expect(learner.getByText("교사만 볼 비공개 답안", { exact: true })).toHaveCount(0);
    await learner.getByRole("button", { name: "이 질문에 답 작성", exact: true }).click();
    await learner.getByRole("textbox", { name: "내 답", exact: true }).fill("제출 전 작성 중인 답");
    await learner.getByRole("textbox", { name: "확인한 근거와 위치", exact: true }).fill("기사 날짜를 다시 확인 중");
    await learner.setViewportSize({ width: 320, height: 780 });
    expect(await learner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page: learner }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(accessibility.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
    await learner.screenshot({ path: testInfo.outputPath("learner-draft-320.png"), fullPage: true });
    await learner.locator(".studyTaskReadings").screenshot({ path: testInfo.outputPath("learner-readings-320.png") });
    await learner.reload();
    await expect(learner.getByRole("textbox", { name: "내 답", exact: true })).toHaveValue("제출 전 작성 중인 답");
    await learner.getByRole("button", { name: "답 제출·새 버전 저장", exact: true }).click();
    await expect(learner.getByText("서버가 본인 답을 접수했습니다.", { exact: true })).toBeVisible();
    await learner.reload();
    await expect(learner.getByText(/서버 제출 버전 1/)).toBeVisible();
  } finally { await learnerContext.close(); }
});

test("populated recovery forms fit 320 pixels and expose no automated accessibility violations", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/workspace/?records=imjin-war,nanjung-ilgi");
  await page.getByRole("textbox", { name: "연구 질문", exact: true }).fill("작은 화면에서도 이 질문을 작성할 수 있는가?");
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
