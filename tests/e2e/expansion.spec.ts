import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const apiEnabled = process.env.ARCHIVE_TEST_API === "true";
async function register(page: Page, prefix: string) {
  const unique = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${unique}@example.test`; const name = `검증 ${prefix}`; const password = "Archive-test-password-2026!";
  await page.goto("/account/");
  await page.getByRole("button", { name: "계정 만들기", exact: true }).first().click();
  const form = page.locator(".expansionManager form").first();
  await form.getByRole("textbox", { name: "표시 이름", exact: true }).fill(name);
  await form.getByRole("textbox", { name: "이메일", exact: true }).fill(email);
  await form.getByLabel("비밀번호", { exact: true }).fill(password);
  await form.getByRole("button", { name: "계정 만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${name}의 계정`, exact: true })).toBeVisible();
  return { email, name, password };
}

test("research question, direct evidence, limits and private draft survive save and reload", async ({ page }) => {
  await page.goto("/workspace/?record=imjin-war");
  await expect(page.getByRole("textbox", { name: "연구 제목", exact: true })).toHaveValue("자료에서 시작한 연구");
  await expect(page.getByRole("group", { name: "함께 읽을 기록", exact: true }).getByRole("checkbox", { name: "임진왜란", exact: true })).toBeChecked();
  await page.getByRole("textbox", { name: "연구 제목", exact: true }).fill("자료 근거 검증 연구");
  await page.getByRole("textbox", { name: "연구 질문", exact: true }).fill("전쟁 시기와 기록 작성 시기의 차이는 무엇인가?");
  await page.getByRole("textbox", { name: "연구 메모", exact: true }).fill("비공개 비교 메모 <script>literal</script>");
  await page.getByRole("textbox", { name: "검토할 주장", exact: true }).fill("작성자의 시선은 기록의 목적에 따라 달라진다.");
  await page.getByRole("button", { name: "주장 추가", exact: true }).click();
  await page.getByRole("textbox", { name: "한계와 반대 근거", exact: true }).fill("이 자료만으로 당시의 모든 시선을 설명할 수 없다.");
  await page.getByRole("combobox", { name: "연결 자료", exact: true }).selectOption({ index: 1 });
  await page.getByRole("combobox", { name: "구분", exact: true }).selectOption("quote");
  await page.getByRole("textbox", { name: "실제 열람 위치", exact: true }).fill("실록 기사 날짜 및 두 번째 문단");
  await page.getByRole("textbox", { name: "내용", exact: true }).fill("테스트에서 사용자가 확인했다고 입력한 인용 예문");
  await page.getByRole("button", { name: "근거 추가", exact: true }).click();
  await page.getByRole("button", { name: "이 기기에 연구 저장", exact: true }).click();
  await expect(page.getByText("이 기기에 저장했습니다.", { exact: true })).toBeVisible();
  await page.goto("/workspace/");
  await page.getByRole("button", { name: "자료 근거 검증 연구", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "연구 질문", exact: true })).toHaveValue("전쟁 시기와 기록 작성 시기의 차이는 무엇인가?");
  await expect(page.getByRole("textbox", { name: "연구 메모", exact: true })).toHaveValue("비공개 비교 메모 <script>literal</script>");
  await expect(page.getByText("직접 인용", { exact: true })).toBeVisible();
  await expect(page.getByText(/위치 실록 기사 날짜 및 두 번째 문단/)).toBeVisible();
  await expect(page.getByRole("link", { name: "선택 자료 최대 3개 비교 →", exact: true })).toHaveAttribute("href", /compare=imjin-war/);
});

test("corrupt research storage stays intact and its original can be downloaded", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("war-archive.workspace.v1", "broken-private-original"));
  await page.goto("/workspace/");
  await expect(page.getByRole("button", { name: "새 연구 만들기", exact: true })).toBeDisabled();
  await expect(page.getByText(/기존 작업공간이 손상되어 자동 저장을 중단/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "손상된 원본 파일 보관", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("workspace-original-recovery.json");
  expect(await page.evaluate(() => localStorage.getItem("war-archive.workspace.v1"))).toBe("broken-private-original");
});

test("account-free teaching path preserves order, questions, print content and share link", async ({ page }) => {
  await page.goto("/teach/");
  await page.getByRole("button", { name: "새 수업 경로", exact: true }).click();
  await page.getByRole("textbox", { name: "수업 제목", exact: true }).fill("두 자료의 시선 비교");
  await page.getByRole("textbox", { name: "학습 목표", exact: true }).fill("사료의 작성 시점과 제공 범위를 구분한다.");
  const records = page.getByRole("group", { name: "읽을 자료 선택", exact: true });
  await records.getByRole("checkbox", { name: "임진왜란", exact: true }).check();
  await records.getByRole("checkbox", { name: "난중일기", exact: true }).check();
  await page.locator(".readingPath > li").first().getByRole("button", { name: "아래로", exact: true }).click();
  await expect(page.locator(".readingPath > li").first().getByRole("heading")).toHaveText("난중일기");
  await page.getByRole("textbox", { name: "추가할 질문", exact: true }).fill("각 연결 자료의 설명 범위는 어디까지인가?");
  await page.getByRole("button", { name: "질문 추가", exact: true }).click();
  await page.getByRole("button", { name: "기기 저장", exact: true }).click();
  await expect(page.getByText("이 기기에 저장했습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "공유 주소 만들기", exact: true }).click();
  const share = await page.getByRole("textbox", { name: "직접 복사할 수업 경로 주소", exact: true }).inputValue();
  expect(share).toContain("?plan=");
  await page.getByRole("textbox", { name: "학습 목표", exact: true }).fill("기기의 다른 수업 목표를 보존한다.");
  await page.getByRole("button", { name: "기기 저장", exact: true }).click();
  await page.goto(share);
  await page.getByRole("button", { name: "기기 저장", exact: true }).click();
  await expect(page.getByText("공유 경로를 새 기기 사본으로 보관했습니다. 기존 수업 경로는 유지했습니다.", { exact: true })).toBeVisible();
  const goals = await page.evaluate(() => JSON.parse(localStorage.getItem("war-archive.workspace.v1")!).plans.map((plan: { goal: string }) => plan.goal));
  expect(goals).toEqual(["기기의 다른 수업 목표를 보존한다.", "사료의 작성 시점과 제공 범위를 구분한다."]);
  await page.evaluate(() => localStorage.removeItem("war-archive.workspace.v1"));
  await page.goto(share);
  await expect(page.getByRole("textbox", { name: "수업 제목", exact: true })).toHaveValue("두 자료의 시선 비교");
  await expect(page.locator(".readingPath > li").first().getByRole("heading")).toHaveText("난중일기");
  await expect(page.getByText("각 연결 자료의 설명 범위는 어디까지인가?", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("war-archive.workspace.v1"))).toBeNull();
  const populatedWorksheet = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(populatedWorksheet.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".printOnly")).toContainText("사료의 작성 시점과 제공 범위를 구분한다.");
  await expect(page.getByRole("textbox", { name: "수업 제목", exact: true })).toBeHidden();
  await expect(page.locator(".answerSpace")).toBeVisible();
});

test("registration, explicit shelf sync and logout preserve local private data", async ({ page }) => {
  test.skip(!apiEnabled, "실제 테스트 API에 연결한 빌드에서만 계정 흐름을 실행합니다.");
  const credentials = await register(page, "shelf");
  await page.goto("/archive/imjin-war/");
  await page.getByRole("button", { name: "기록 저장", exact: true }).click();
  await page.getByText("내 메모", { exact: true }).click();
  await page.getByRole("textbox", { name: "이 기록에 남길 메모", exact: true }).fill("기기와 계정 보관함 검증 메모");
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await page.goto("/account/");
  await page.getByRole("button", { name: "서버 보관함 확인", exact: true }).click();
  await expect(page.getByText(/서버 버전 0/)).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "기기 보관함 서버에 저장", exact: true }).click();
  await expect(page.getByText("서버가 보관함의 새 버전을 저장했습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByText(/로그아웃했습니다. 이 기기의 메모는 유지/)).toBeVisible();
  await page.goto("/saved/");
  await expect(page.getByRole("region", { name: "개인 메모", exact: true }).locator(".savedNote")).toHaveText("기기와 계정 보관함 검증 메모");
  await page.goto("/account/");
  const form = page.locator(".expansionManager form").first();
  await form.getByRole("textbox", { name: "이메일", exact: true }).fill(credentials.email);
  await form.getByLabel("비밀번호", { exact: true }).fill(credentials.password);
  await form.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${credentials.name}의 계정`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "서버 보관함 확인", exact: true }).click();
  await expect(page.getByText(/서버 버전 1 · 저장 기록 1개/)).toBeVisible();
});

test("study space tasks, own submissions and teacher feedback use actual versions", async ({ page }) => {
  test.skip(!apiEnabled, "테스트 API 연결이 필요합니다."); test.setTimeout(60_000);
  await register(page, "teacher");
  await page.goto("/teach/");
  const title = `근거 읽기 수업 ${Date.now()}`;
  await page.getByRole("textbox", { name: "수업 이름", exact: true }).fill(title);
  await page.getByRole("textbox", { name: "수업 설명", exact: true }).fill("실제 계정 과제 제출 검증");
  await page.getByRole("button", { name: "공간 만들기", exact: true }).click();
  await expect(page.getByText("서버에 수업 공간을 만들었습니다.", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "과제 제목", exact: true }).fill("자료의 출처를 설명하세요");
  await page.getByRole("textbox", { name: "질문과 설명", exact: true }).fill("기관 설명과 1차 자료를 구분하여 답하세요.");
  await page.getByRole("group", { name: "질문 자료", exact: true }).getByRole("checkbox", { name: "임진왜란", exact: true }).check();
  await page.getByRole("button", { name: "과제 등록", exact: true }).click();
  await expect(page.getByText("과제를 등록했습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "이 질문에 답 작성", exact: true }).click();
  await page.getByRole("textbox", { name: "내 답", exact: true }).fill("직접 읽은 자료의 범위를 바탕으로 작성한 답입니다.");
  await page.getByRole("textbox", { name: "확인한 근거와 위치", exact: true }).fill("실록 해당 기사 날짜와 배경 문단");
  await page.getByRole("button", { name: "답 제출·새 버전 저장", exact: true }).click();
  await expect(page.getByText("서버가 본인 답을 접수했습니다.", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "교사 피드백", exact: true }).fill("출처의 제작 시점도 추가로 비교해 보세요.");
  await page.getByRole("button", { name: "교사 피드백 저장", exact: true }).click();
  await expect(page.getByText("검토 의견을 저장했습니다.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "내 수업 공간 확인", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByText("받은 피드백: 출처의 제작 시점도 추가로 비교해 보세요.", { exact: true })).toBeVisible();
});

test("shared research persists selected claims and invitation viewers cannot edit", async ({ page, browser }) => {
  test.skip(!apiEnabled, "테스트 API 연결이 필요합니다."); test.setTimeout(60_000);
  await register(page, "research-owner");
  await page.goto("/workspace/?record=imjin-war");
  await page.getByRole("textbox", { name: "연구 제목", exact: true }).fill("공유할 연구 자료");
  await page.getByRole("textbox", { name: "연구 질문", exact: true }).fill("검증 가능한 연구 질문은 무엇인가?");
  await page.getByRole("button", { name: "이 기기에 연구 저장", exact: true }).click();
  await page.getByRole("textbox", { name: "공동 연구 이름", exact: true }).fill(`공동 연구 ${Date.now()}`);
  await page.getByRole("textbox", { name: "공동 연구 설명", exact: true }).fill("참여자 역할 검증 공간");
  await page.getByRole("button", { name: "공간 만들기", exact: true }).click();
  await expect(page.getByText("서버에 공동 연구 공간을 만들었습니다.", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "공유할 기기 작업 선택", exact: true }).selectOption({ label: "공유할 연구 자료" });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "공유 작업 새 버전 저장", exact: true }).click();
  await expect(page.getByText("서버가 공유 작업의 새 버전을 저장했습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "선택 역할 초대 코드 만들기", exact: true }).click();
  const code = await page.locator(".studySpaces strong").textContent(); expect(code).toBeTruthy();
  const guestContext = await browser.newContext({ baseURL: "http://127.0.0.1:4173" }); const guest = await guestContext.newPage();
  try {
    await guest.goto("http://127.0.0.1:4173/account/");
    const guestCredentials = await register(guest, "research-viewer");
    expect(guestCredentials.email).toContain("research-viewer");
    await guest.goto("http://127.0.0.1:4173/workspace/");
    await guest.getByRole("textbox", { name: "공동 연구 초대 코드", exact: true }).fill(code!);
    await guest.getByRole("button", { name: "코드로 참여", exact: true }).click();
    await expect(guest.getByText(/열람·본인 답 제출 역할/)).toBeVisible();
    await expect(guest.getByRole("textbox", { name: "공유 연구 제목", exact: true })).toHaveValue("공유할 연구 자료");
    await expect(guest.getByRole("textbox", { name: "공유 연구 제목", exact: true })).toBeDisabled();
    await expect(guest.getByRole("button", { name: "공유 작업 새 버전 저장", exact: true })).toBeDisabled();
    await expect(guest.getByRole("button", { name: "선택 역할 초대 코드 만들기", exact: true })).toBeDisabled();
  } finally { await guestContext.close(); }
});

test("anonymous correction returns a real receipt and status without private proposal", async ({ page }) => {
  test.skip(!apiEnabled, "테스트 API 연결이 필요합니다.");
  await page.goto("/corrections/?record=imjin-war");
  await expect(page.getByRole("combobox", { name: "정정할 기록", exact: true })).toHaveValue("imjin-war");
  await page.getByRole("textbox", { name: "문제 항목과 수정 근거", exact: true }).fill("설명 문장의 근거 위치를 더 구체적으로 확인해 주세요.");
  await page.getByRole("textbox", { name: "확인할 공개 자료 주소", exact: true }).fill("https://sillok.history.go.kr/id/kna_12601011_013");
  await page.getByRole("checkbox", { name: /제안 검토를 위해 입력 내용을 서버에 전달/ }).check();
  await page.getByRole("button", { name: "실제 정정 제안 접수", exact: true }).click();
  await expect(page.getByText("서버가 정정 제안을 접수했습니다. 접수 번호를 보관하세요.", { exact: true })).toBeVisible();
  const receiptId = await page.getByRole("textbox", { name: "보관한 접수 번호", exact: true }).inputValue();
  expect(receiptId).toMatch(/^[a-zA-Z0-9_-]+$/);
  await page.getByRole("button", { name: "상태 확인", exact: true }).click();
  await expect(page.getByText("서버에서 현재 상태를 확인했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `접수 번호 ${receiptId}`, exact: true })).toBeVisible();
  await expect(page.getByText("상태: 접수됨", { exact: true })).toBeVisible();
});

test("member accounts see restricted admin and unavailable AI/payment capabilities", async ({ page }) => {
  test.skip(!apiEnabled, "테스트 API 연결이 필요합니다.");
  await register(page, "member");
  await page.goto("/admin/");
  await expect(page.getByText(/이 화면은 해당 역할의 계정에만 제공/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "기록 JSON", exact: true })).toHaveCount(0);
  await page.goto("/assist/");
  await expect(page.getByText(/공개 답변 평가와 운영 설정이 활성화되지 않아/)).toBeVisible();
  await page.getByRole("checkbox", { name: "임진왜란", exact: true }).check();
  await page.getByRole("textbox", { name: "자료에 관한 질문", exact: true }).fill("이 자료의 설명 범위는 어디까지인가요?");
  await expect(page.getByRole("button", { name: "선택 자료로 질문", exact: true })).toBeDisabled();
  await page.goto("/services/");
  await page.getByRole("button", { name: "실제 기관 상품 확인", exact: true }).click();
  await expect(page.getByText(/현재 운영자가 등록한 기관 상품이 없습니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: "서버 주문 만들기", exact: true })).toHaveCount(0);
});

test("staff saves a draft and uploads private evidence as raw bytes with authenticated download", async ({ page }) => {
  test.skip(!apiEnabled, "격리된 테스트 전용 관리자와 API 연결이 필요합니다."); test.setTimeout(60_000);
  await page.goto("/account/");
  const form = page.locator(".expansionManager form").first();
  await form.getByRole("textbox", { name: "이메일", exact: true }).fill("fixture-admin@example.org");
  await form.getByLabel("비밀번호", { exact: true }).fill("fixture-password-only-123");
  await form.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser fixture admin의 계정", exact: true })).toBeVisible();
  await page.goto("/admin/");
  await page.getByRole("combobox", { name: "현재 공개 기록을 편집 시작점으로 선택", exact: true }).selectOption("imjin-war");
  await page.getByText("고급 JSON 가져오기·내보내기", { exact: true }).click();
  const jsonField = page.getByRole("textbox", { name: "기록 JSON", exact: true });
  const parsed: unknown = JSON.parse(await jsonField.inputValue());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("공개 기록의 편집 시작점을 확인할 수 없습니다.");
  const record = parsed as Record<string, unknown>;
  record.id = `ui-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  record.title = "격리된 브라우저 검증용 초안";
  await jsonField.fill(JSON.stringify(record, null, 2));
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  await expect(page.getByText("서버에 초안 버전 1을 저장했습니다. 검수와 공개 발행은 아직입니다.", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "파일을 연결할 자료", exact: true }).selectOption({ index: 1 });
  await page.getByRole("textbox", { name: "파일 이용 범위와 보관 근거 (1,000자 이하)", exact: true }).fill("테스트 전용 프로젝트 이미지의 비공개 검수 보관입니다. 공개 발행용 허가를 주장하지 않습니다.");
  await page.getByLabel("비공개 근거 파일", { exact: true }).setInputFiles("web/public/images/archive-gallery-hero.png");
  await page.getByRole("button", { name: "비공개 근거 파일 업로드", exact: true }).click();
  await expect(page.getByText("서버가 비공개 근거 파일을 저장하고 실제 파일 해시를 반환했습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "이 기록의 근거 파일 목록 확인", exact: true }).click();
  const originalBytes = await readFile("web/public/images/archive-gallery-hero.png");
  await expect(page.getByText(`image/png · ${originalBytes.length.toLocaleString("ko-KR")}바이트`, { exact: false })).toBeVisible();
  await expect(page.locator(".hashValue").filter({ hasText: /^SHA-256 / })).toHaveText(`SHA-256 ${createHash("sha256").update(originalBytes).digest("hex")}`);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "권한 확인 후 비공개 파일 내려받기", exact: true }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/^[a-zA-Z0-9_-]+\.png$/);
  const downloadedPath = await download.path(); expect(downloadedPath).toBeTruthy();
  expect(await readFile(downloadedPath!)).toEqual(originalBytes);
  await expect(page.getByText("권한을 확인한 비공개 검수 파일을 내려받았습니다.", { exact: true })).toBeVisible();
  await expect(page.getByText("상태 초안 · 서버 버전 1 · 편집 기준 버전 1", { exact: true })).toBeVisible();
});

for (const route of ["/workspace/", "/teach/", "/account/", "/corrections/", "/assist/", "/services/", "/admin/"]) {
  test("utility accessibility and 320px reflow: " + route, async ({ page }, testInfo) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 320, height: 720 }); await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (route === "/workspace/") await page.getByRole("button", { name: "새 연구 만들기", exact: true }).click();
    if (route === "/teach/") await page.getByRole("button", { name: "새 수업 경로", exact: true }).click();
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("utility-full.png"), fullPage: true });
  });
}
