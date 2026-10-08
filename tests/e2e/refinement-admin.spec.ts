import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.skip(process.env.ARCHIVE_TEST_API !== "true", "Needs the isolated API fixture.");
async function login(page: Page) {
  await page.goto("/account/"); const form = page.locator(".expansionManager form").first();
  await form.getByRole("textbox", { name: "이메일", exact: true }).fill("fixture-admin@example.org");
  await form.getByLabel("비밀번호", { exact: true }).fill("fixture-password-only-123");
  await form.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser fixture admin의 계정", exact: true })).toBeVisible();
}
test("normal editorial form recovers multiline input and saves a real version", async ({ page }) => {
  await login(page); await page.goto("/admin/");
  await page.getByRole("combobox", { name: "현재 공개 기록을 편집 시작점으로 선택" }).selectOption("imjin-war");
  const title = page.locator("#cms-title");
  await title.fill("임진왜란 편집 복구 검증");
  const limitations = page.getByRole("textbox", { name: /한계.*한 줄/ });
  await limitations.fill("첫 번째 검토 한계\n두 번째 검토 한계");
  await page.reload(); await expect(title).toHaveValue("임진왜란 편집 복구 검증");
  await expect(limitations).toHaveValue("첫 번째 검토 한계\n두 번째 검토 한계");
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  await expect(page.getByText(/서버에 초안 버전 1을 저장했습니다/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /현재 버전 1의 본문/ })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /승인 해시/ })).toHaveCount(0);
  await page.getByRole("button", { name: "자료 일치·변경 영향 사전 확인", exact: true }).click();
  await expect(page.getByText(/검사 결과|연결 레지스트리|사전 검사|설정/).first()).toBeVisible();
  await page.getByText("독자 화면 미리보기", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "임진왜란 편집 복구 검증", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: "artifacts/refinement-admin-mobile.png", fullPage: true });
  await page.locator("#cms-basics").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/refinement-admin-viewport.png" });
});
test("invalid editorial input stays editable with a focusable error summary", async ({ page }) => {
  await login(page); await page.goto("/admin/");
  await page.getByRole("button", { name: "새 자료 작성", exact: true }).click();
  await page.getByRole("textbox", { name: "자료 제목", exact: true }).fill("검증 중인 미완성 초안");
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  await expect(page.locator("#cms-errors")).toBeFocused();
  await expect(page.getByRole("textbox", { name: "자료 제목", exact: true })).toHaveValue("검증 중인 미완성 초안");
  await page.reload(); await expect(page.getByRole("textbox", { name: "자료 제목", exact: true })).toHaveValue("검증 중인 미완성 초안");
});
test("institution inquiry uses real receipt and queued workflow", async ({ page }) => {
  await login(page); await page.goto("/services/");
  await page.getByRole("textbox", { name: /요청 제목/ }).fill("학교 자료 비교 수업 문의");
  await page.getByRole("textbox", { name: /이용 대상과 목적/ }).fill("고등학교 자료 비교 수업에서 사용하려 합니다.");
  await page.getByRole("textbox", { name: /필요한 결과물/ }).fill("두 기록 비교 수업 자료\n출처와 인용 안내");
  await page.getByRole("textbox", { name: /필요한 이용 범위/ }).fill("비공개 수업 배포 범위 확인이 필요합니다.");
  await page.getByRole("button", { name: /기관 요청 접수/ }).click();
  await expect(page.getByText(/서버에 접수했습니다/).first()).toBeVisible();
  await page.getByRole("button", { name: /내 요청·관리 가능한 진행 목록 확인/ }).click();
  await expect(page.getByRole("heading", { name: "학교 자료 비교 수업 문의", exact: true })).toBeVisible();
});
test("rights staff can reach the permitted panel without gaining editorial access", async ({ page, browser, playwright }) => {
  await login(page);
  const origin = "http://127.0.0.1:4173"; const api = "http://127.0.0.1:4200/api/v1";
  const account = await playwright.request.newContext({ extraHTTPHeaders: { Origin: origin } });
  const initial = await (await account.get(`${api}/auth/session`)).json() as { data: { csrfToken: string } };
  const email = `rights-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const created = await account.post(`${api}/auth/register`, { headers: { "X-CSRF-Token": initial.data.csrfToken }, data: { email, name: "권리 전담 직원", password: "scoped-rights-password-2026!" } });
  expect(created.ok()).toBe(true); const user = await created.json() as { data: { user: { id: string } } };
  const admin = await (await page.request.get(`${api}/auth/session`)).json() as { data: { csrfToken: string } };
  const policy = await page.request.put(`${api}/admin/users/${user.data.user.id}/scopes`, { headers: { Origin: origin, "X-CSRF-Token": admin.data.csrfToken }, data: { scopes: ["rights:manage"] } });
  expect(policy.ok()).toBe(true); await account.dispose();
  const context = await browser.newContext();
  try {
    const staff = await context.newPage(); await staff.goto(`${origin}/account/`); const form = staff.locator(".expansionManager form").first();
    await form.getByRole("textbox", { name: "이메일", exact: true }).fill(email);
    await form.getByLabel("비밀번호", { exact: true }).fill("scoped-rights-password-2026!");
    await form.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(staff.getByRole("heading", { name: "권리 전담 직원의 계정", exact: true })).toBeVisible();
    await staff.goto(`${origin}/admin/`);
    await expect(staff.getByRole("heading", { name: "기관·이용 허가·계약", exact: true })).toBeVisible();
    await expect(staff.getByRole("button", { name: "초안 저장", exact: true })).toHaveCount(0);
    await expect(staff.getByText("직원 업무 범위·인수인계·접근 종료", { exact: true })).toHaveCount(0);
    await staff.getByRole("button", { name: "목록 확인", exact: true }).click();
    await expect(staff.getByText(/실제 권한이 필요|권한을 확인/)).toHaveCount(0);
  } finally { await context.close(); }
});
