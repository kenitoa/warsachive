# 개인 연구·협업·교육 고도화

2026-10-07 승인한 30개 항목 중 1–7, 12–15의 개인 작업 경로를 보강한다. 주요 메뉴 6개와 홈 카드 4개는 유지하고 기존 보관함·연구/수업 데이터 키와 version 1 형식을 유지한다. 새 서버 저장은 자동 실행하지 않는다.

## 항목과 작동 경로

| 항목 | 실제 구현 | 주요 파일 | 확인 경로 |
| --- | --- | --- | --- |
| 1–2 | 자료 선택에서 연구/수업 ID·자료·근거 위치·복귀 URL을 전달하고 기존 작업을 이어 편집한다. 홈의 작업 제목은 사용자가 동의할 때만 표시한다. | `personal-context.tsx`, `expansion-workspace.tsx`, `expansion-teach.tsx` | 검색/상세의 작업 담기 → `/workspace/?project=…&records=…` 또는 `/teach/?plan=…&records=…` |
| 3 | 복구 초안 저장, 명시적인 기기 작업 저장, 서버 저장/제출의 상태를 구분한다. API 미설정·로그아웃·권한 부족·응답 오류는 완료로 처리하지 않는다. | `local-draft.tsx`, `expansion-common.tsx`, `api-client.ts` | 각 도구의 상태 안내와 서버 성공 응답 |
| 4 | 연구 질문/미추가 주장/근거 위치·내용, 수업 질문/교사 준비, 공동 공간 편집/개인 답안/피드백 입력을 이동·새로고침 후 복구한다. 연구·수업을 바꾸면 이전 편집 사본과 입력을 보관한다. | `local-draft-storage.ts`, `personal-recovery.ts`, `local-draft.tsx` | 입력 → 다른 작업 선택/이동 → 재접속 → 복구 초안 확인 |
| 5 | 로그인 링크는 현재 내부 작업 URL을 보존하고 가입/로그인 성공 후 해당 URL로 복귀한다. 외부 주소·역슬래시·인코딩한 경로 이동·다른 base path는 거부한다. 비밀번호·세션 토큰은 초안에 저장하지 않는다. | `personal-context.tsx`, `expansion-account.tsx`, `personal-recovery.ts` | `/account/?returnTo=…` |
| 6 | 기기/가져온 작업의 실제 제목·수정 시각·변경 필드를 보여주고 기기/가져온/두 사본 중 보존 방법을 선택한다. 공동 공간은 복구 당시 서버 버전을 유지하고 서버 버전 차이를 확인한 뒤 저장한다. | `workspace-domain.ts`, `workspace-conflict.tsx`, `expansion-workspace.tsx`, `expansion-teach.tsx` | 작업 JSON 또는 서버 버전 가져오기 → 변경 비교 → 보존 선택 |
| 7 | 통합 백업·검사 후 복구·범위별 삭제는 이 서비스가 관리하는 세 저장 키만 대상으로 한다. 손상 원본도 내보낼 수 있으며 손상 파일은 자동 복원하지 않는다. 복구 전 원본 파일을 내려받고 일부 쓰기 실패를 성공으로 표시하지 않는다. | `local-data-manager.tsx`, `local-draft-storage.ts`, `reading-tools.tsx` | `/saved/`의 기기 데이터 관리 |
| 12 | 주장마다 추가 당시 공개 기록 요약·자료 제목/주소·본문 구역·참조 버전·확인 시점을 보관한다. 직접 인용과 자기 메모를 구분하고 미확인 주장·변경/보류된 기록·다음 확인 작업을 표시한다. 원문의 인용문을 자동 생성하지 않는다. | `workspace-domain.ts`, `research-review-panel.tsx`, `expansion-workspace.tsx` | 연구 → 주장 → 자료/열람 위치/내용 → 근거 추가 |
| 13 | 공동 연구/수업은 일반 제목·질문·자료·주장·근거·학습 질문 폼으로 편집한다. JSON은 고급 영역으로 둔다. 서버의 공간 역할과 버전 검증을 그대로 사용하고 열람자는 편집 폼을 사용할 수 없다. | `shared-workspace-editor.tsx`, `expansion-teach.tsx`, `api-client.ts` | 공동 공간 → 기기 작업 선택/일반 편집 → 명시적인 공유 저장 |
| 14 | 저장한 기기 수업의 목표·자료 순서·질문·읽기 메타데이터를 실제 서버 과제로 옮긴다. 교사 메모/답안은 과제의 비공개 필드로 전달하고 공유 URL·인쇄·공유 WorkspaceState에서 제외한다. 기존 과제 수정은 서버 버전을 전달한다. | `expansion-teach.tsx`, `workspace-domain.ts`, `api-client.ts` | 기기 수업 저장 → 교사 공간 → 수업 선택 → 과제 공개 |
| 15 | 학습자의 미제출 답안/근거 메모를 계정별 기기 초안으로 복구한다. 서버 접수·피드백 대기/도착·답안/과제 참조 버전과 시각을 구분한다. 제출/피드백 이력은 실제 API로 조회하며 다른 답안에 대한 피드백을 현재 답안에 붙이지 않는다. | `expansion-teach.tsx`, `expansion-study-history.tsx`, `api-client.ts` | 과제 → 답 작성 → 재접속 → 제출 → 피드백/버전 이력 |

## 저장 범위와 복구 계약

| 키 | 범위 | 삭제 영향 |
| --- | --- | --- |
| `war-archive.shelf.v1` | 개인 보관함·메모·최근 열람·개인 설정·홈 이어 하기 동의 | 선택한 기기 보관함 범위만 비움 |
| `war-archive.workspace.v1` | 명시적으로 저장한 개인 연구·수업·교사 전용 준비 | 기기의 저장 작업만 삭제, 서버 작업은 유지 |
| `war-archive.drafts.v1` | 연구/수업/공동 편집/개인 답안 및 재사용 훅의 운영·결제 복구 입력 | 해당 키에 저장한 복구 초안 전체, 서버 요청 결과는 유지 |

`useRecoveryDraft(scope, initial, validate)`는 `value`, `setValue`, `ready`, `status`, `error`, `blocked`, `discard`, `exportCurrent`, `importCurrent`를 반환한다. `setValue`는 검증 및 실제 localStorage 쓰기 성공 시에만 `true`를 반환한다. 외부 요청의 멱등성 키를 이 훅에 보관하는 호출자는 성공을 확인한 뒤 요청한다. scope는 `영역:종류:식별자` 형식의 제한된 문법을 사용한다. 공유 작업 초안은 `shared:study:<userId>`/`shared:research:<userId>`로 계정을 구분한다.

다른 탭의 저장이나 백업 복구로 동일 scope의 내용이 바뀌면 기존 편집 화면을 유지하고 자동 쓰기를 중단한다. 저장 실패·손상은 원본을 유지하며 현재 입력 파일을 내려받을 수 있다. 현재 입력 파일은 같은 scope의 도구에서 검사 후 명시적으로 가져온다. 브라우저 저장 제한과 사본 크기 제한을 넘으면 서버 성공으로 표시하지 않는다. 전체 백업은 7MB, 개별 작업 가져오기는 2MB, 복구 entry는 512KiB로 제한한다. 브라우저 다운로드 요청은 파일의 외부 보관이나 백업 완료를 증명하지 않는다.

## 서버와 URL 계약

새 자료의 출처·본문 구역·위치에서 연구를 열면 이전에 쓰던 직접 인용은 복구 초안의 근거 입력 사본으로 보관하고, 새 문맥은 빈 메모로 시작한다. 원문 인용을 만들지 않으며 이전 입력은 별도 펼침 영역에서 이어 쓸 수 있다. 동일 입력은 중복 보관하지 않고 50개 한도에서는 오래된 사본을 버리지 않고 추가 연결을 중단한다. 손상 초안에서는 URL 자료 사전선택을 실행하지 않아 원본 보존 안내를 유지한다.

- 개인 보관함 `/shelf`, 개인 작업 `/workspaces/:id`, 공동 작업 `/spaces/:id`는 기존 버전 계약을 유지한다. PUT은 실제 참조 버전을 전달하고 409에서 입력을 버리지 않는다.
- 공동 편집의 `teacherNotes`/`answerKey`는 공개 WorkspaceState 전송 전에 제거한다. 개인 계정 작업 업로드는 교사 전용 내용까지 포함할 수 있으므로 확인 문구에 전체 범위를 밝힌다.
- 과제 POST/PUT은 `teacherNotes`, `answerKey`, `readingMetadata`를 사용한다. 서버가 학습자에게 비공개 필드를 반환하지 않는 것이 권한 경계이다.
- 제출 POST는 기존 답안 `version`을 전달한다. 피드백 PUT도 대상 답안 버전을 전달한다. `GET /spaces/:spaceId/submissions/:submissionId/history`에서 실제 제출/피드백 이력을 조회한다.
- `APIUser.scopes`가 있으면 고정 enum을 검증하고 명시적인 빈 권한 배열도 보존한다. 미제공 계정만 기존 role 호환을 사용한다. `ServiceBoundary.requiredScope`와 서버 권한 검사는 별개이며 서버를 최종 경계로 유지한다.
- 상세 복귀 URL은 `sitePath('/workspace/?project=…')` 또는 `sitePath('/teach/?space=…&task=…')`이다. 일반 연구 공간의 과제는 workspace 경로로 복귀한다. base path와 내부 경로 검증을 유지한다.

## 검증과 남은 증거

`web/scripts/workspace-recovery.test.mjs`는 복구 버전 충돌·위험/손상 입력·미완성 입력 round-trip·정확한 백업 키·개인 교사 정보 제외·필드별 충돌·안전한 복귀 URL·답안/피드백 이력·권한 enum·실제 서비스 정의/첨부 검수 상태 디코더를 검증한다. 기존 workspace/API 도메인 검사와 함께 실행한다.

`tests/e2e/refinement-personal.spec.ts`는 실제 브라우저에서 작업 전환·재접속·두 탭 보호·저장 공간 실패·통합 백업/복구·로그인 복귀·교사 수업 재사용·학습자 비공개 정보 제외·답안 복구/제출·320px 폼/자동 접근성 검사를 수행한다. 계정 흐름은 `ARCHIVE_TEST_API=true`와 격리된 실제 API fixture 빌드에서만 실행한다. 인증 속도 제한은 운영값을 유지하고 프로젝트/테스트 파일별 새 fixture로 실행한다.

2026-10-08 최종 빌드에서 다음 명령을 프로젝트별 새 API fixture로 순차 실행했다.

```powershell
$env:ARCHIVE_TEST_API = 'true'
npm.cmd run test:browser -- tests/e2e/refinement-personal.spec.ts --project=desktop --workers=2 --output=artifacts/refinement-personal-final/desktop --reporter=list
npm.cmd run test:browser -- tests/e2e/refinement-personal.spec.ts --project=mobile --workers=2 --output=artifacts/refinement-personal-final/mobile --reporter=list
```

- desktop: 9/9 성공, 45.4초.
- mobile: 9/9 성공, 37.3초. Playwright Pixel 7 설정이며 실물 기기 결과로 표현하지 않는다.
- 320px 연구 폼과 학습자 답안 폼에서 가로 넘침 없음, Axe의 WCAG 2/2.1/2.2 A·AA 자동 검사 위반 0.
- 처음 검증에서 공유 과제 자료 링크의 `target-size` 위반을 재현했다. 목록에 전용 클래스를 지정하고 링크 최소 높이 44px와 간격을 적용한 뒤 동일 검사를 통과했다. 검사 규칙과 단언은 유지했다.
- 학습자 GET 응답에서 `teacherNotes`·`answerKey`가 제외되고 자료 순서가 유지됨을 확인했다. 작성 중 답안은 재접속 후 복구되며 실제 제출 후 서버 버전 1이 표시됨을 확인했다.
- `learner-readings-320.png`와 전체 `learner-draft-320.png`를 열어 자료 링크 간격, 폼 줄바꿈, 비공개 답안 미노출을 확인했다. 로그는 `artifacts/refinement-personal-final-desktop.log`, `artifacts/refinement-personal-final-mobile.log`에 남긴다. 생성 증거는 Git에 포함하지 않는다.
- 수정한 교사 컴포넌트와 개인 E2E 파일의 ESLint 및 관련 파일 `git diff --check`가 통과했다. 전체 저장소 타입·린트·테스트·빌드 결과는 통합 검증 문서에 기록한다.

현재 운영 도메인의 API 연결, 실제 고객/교사/학습자 사용성 조사, 스크린리더·실물 기기, 외부 이메일/결제/AI 공급자 전달, 브라우저 파일의 장기 보관과 운영 백업 복구는 이 구현과 자동 fixture 검사로 검증된 것으로 표현하지 않는다. 이 개인 UI 보강 자체는 환경 변수·DB 초기화·마이그레이션을 추가하지 않는다. 교육 이력/비공개 영역의 추가 서버 스키마와 운영 권한은 API 고도화 마이그레이션 및 계약 문서에 따른다.
