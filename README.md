# 전쟁 역사 아카이브

공개 웹: https://kenitoa-warsachive.vercel.app/ · [Vercel 배포 및 복구](docs/vercel-migration.md)

기존 박물관형 화면과 정적 발행 구조를 유지하고 Vercel로 배포하는 공개 역사 자료 열람 서비스입니다. 사용자는 기록을 검색하고, 사건·인물·장소의 맥락과 주장별 출처를 읽고, 자신의 브라우저나 모바일 기기에 보관합니다.

확장 버전 고도화의 [30개 항목 반영표](docs/refinement-implementation.md), [검증 결과](docs/refinement-verification.md), [새 운영 절차와 마이그레이션](docs/refinement-operations.md)을 함께 확인하세요. 입력 복구·동일 작업 복귀·협업/교육 일반 폼·CMS 검토·기관 이행과 업무별 권한을 연결했습니다. 실제 공급자 및 운영 확인이 필요한 기능은 해당 증거가 없으면 활성화하지 않습니다.

## 구성과 공개 경계

| 위치 | 책임 |
| --- | --- |
| `web` | Next.js 정적 웹, 출처 대조 기록, 검색·연표·기획 컬렉션·스토리 |
| `api` | Node HTTP/SQLite 인증·권한·협업·검수·접수·외부 어댑터·worker |
| `mobile` | Expo / React Native, 공개 데이터 조회·검색·상세·원문·기기 보관·오프라인 캐시 |
| `web/content/archive/` | 기존 수집 자료 보존. 파일을 삭제하거나 초기화하지 않음 |
| `web/content/main.json` | 기존 수집 파일의 자동 인덱스. 직접 편집하지 않음 |
| `web/content/editorial.json` | 공개 편집 기록과 실제 기획 주제·컬렉션·스토리 |
| `web/content/audit-report.json` | 기존 수집 자료의 관련성·링크·품질 점검 결과 |

수집 자료가 자동으로 역사 기록이 되는 것은 아닙니다. 공개 기록은 스키마, 출처, 본문·연표 근거 연결, 공개 상태를 검증합니다. `needs-review`와 `withheld`는 공개하지 않습니다. `source-checked`는 출처 대조 상태이며 사람의 최종 검수와 다릅니다. 사람이 검수하지 않은 기록에 `approved` 또는 `humanReviewed: true`를 생성하지 않습니다.

## 설치·실행·검증

Node.js 22.22.3 이상과 저장소의 npm lockfile을 사용합니다. Windows에서는 `npm.cmd`를 사용할 수 있습니다.

```bash
npm ci
npm run start
npm run lint
npm run typecheck
npm run test
npm run content:gate
npm run build
npm run test:static
npx playwright install chromium
npm run test:browser
npm run test:browser:isolated
npm run test:performance
npm run preview
```

개발 주소는 `http://127.0.0.1:3000/`, 빌드 미리보기 주소는 `http://127.0.0.1:4173/`입니다. `start.cmd`를 더블클릭하면 웹·API·worker를 실행합니다. 계정 기능에는 웹과 API에 동일한 호스트 이름을 사용합니다. `npm run test:browser`는 정적 산출물을 자동으로 띄웁니다. API UI 검증은 `ARCHIVE_TEST_API=true`와 127.0.0.1:4200 API 주소로 빌드한 테스트 사이트를 사용하며 운영 DB 대신 별도 임시 DB를 생성합니다. 미리보기와 브라우저 검증 전에 `npm run build`가 필요합니다.

로컬 시작은 루트 `.env.api`를 읽고 출처 대조 공개 자료를 API에 연결합니다. CMS 사전 검사에는 기본적으로 이 프로젝트의 `web/content/knowledge.json`을 읽기 전용으로 연결하며 `ARCHIVE_KNOWLEDGE_FILE`로 명시한 경로를 우선합니다. 운영용 계정과 사람 승인 이력은 자동 생성하지 않습니다. 최초 관리자는 서버 운영 문서의 `admin:create` 절차로 생성합니다.

API 브라우저 전체 검사는 `test:browser:isolated`로 파일·화면 크기마다 새 fixture를 시작합니다. 실제 로그인 속도 제한을 완화하지 않습니다. 성능 검사는 Playwright Chromium이 설치된 미리보기 4173 서버 또는 `ARCHIVE_PERFORMANCE_SITE`의 공개 HTTPS 주소에서 30회 측정하며 현장 Core Web Vitals나 실물 기기 증거를 대신하지 않습니다.

Vercel에서는 시스템 변수로 운영 도메인과 preview 주소를 자동 계산합니다. 커스텀 도메인은 production 환경의 `NEXT_PUBLIC_SITE_URL`에 최종 HTTPS 주소를 설정합니다. 로컬에서는 localhost를 사용합니다. 실제 환경 파일은 커밋하지 않으며 `.env.example`에는 키 이름만 제공합니다.

## 발행과 검수

```bash
npm run content:audit
npm run content:review
npm run content:review -- --id imjin-war
npm run content:gate
npm run content:links
```

수집·편집·검수·승인·정정 절차는 [운영 문서](docs/operations.md)를 따릅니다. 기존 자료는 보존하며 무관하거나 미확인 자료는 공개 검색에서 보류합니다. 비공개 초안, 내부 편집 메모, 개인정보, 자격증명은 공개 Git 저장소에 올리지 않습니다. 이 저장소의 공개 편집 파일은 공개 가능한 내용만 포함합니다.

`predev`와 `prebuild`에서 인덱스와 공개 데이터 산출물을 생성합니다.

- `/data/search-index.json`: 검색에 필요한 최소 필드만 제공
- `/data/catalog-v2.json`, `/data/records/:id-:hash.json`: 경량 목록·검증 가능한 상세
- `/data/knowledge-v1.json`: 공개 관계·서지·검수 gate 적용 언어/미디어
- `/data/mobile-index.json`: 기존 공개 모바일 계약 호환
- `/feed.xml`: 공개 기록 RSS
- `/release.json`: 배포 Git SHA, 콘텐츠 해시, 사이트 주소, 기록 수
- `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`: 검색엔진과 사이트 메타

현재 매니페스트는 사이트 정보를 제공하며 웹 오프라인 동작을 보장하지 않습니다. 오프라인 읽기는 모바일 앱의 마지막 공개 보관본에 구현했습니다.

## Vercel

1. `stock-project1/kenitoa-warsachive`를 GitHub 저장소에 연결하고 Root Directory `web`, Framework `Other`, Output `out`을 사용합니다.
2. Actions 변수 `SITE_URL`은 `https://kenitoa-warsachive.vercel.app`로 설정합니다.
3. `main` push가 lint·타입 검사·테스트·콘텐츠 gate·정적 빌드·canonical 검증 후 Vercel 운영 배포를 만듭니다.
4. 배포 후 `Verify Vercel production deployment`가 실제 `/release.json`의 SHA·콘텐츠 해시와 핵심 HTTPS URL을 확인합니다.
5. 운영 설정과 복구는 [Vercel 운영 문서](docs/vercel-migration.md)를 따릅니다.

PR에는 `Validate archive changes` 워크플로가 적용됩니다. 브랜치 보호에서 검증 성공과 검수자 승인을 필수로 설정하는 작업은 저장소 관리자가 해야 합니다. 설정만 추가했다고 실제 GitHub 배포가 검증된 것은 아닙니다.

NAS 발행기는 공개 승인된 편집 자료를 저장소로 전달해야 합니다. 공개 브라우저에는 NAS 관리 주소나 자격증명을 넣지 않습니다. 자동 인덱스 커밋은 기록 관리용이며, 공개 빌드는 원래 push와 prebuild 인덱싱에 의존합니다. 봇 커밋 이후 워크플로 재실행을 가정하지 않습니다.

## 모바일 앱

```bash
# 공개 배포 주소를 설정한 뒤 실행
npm run dev:mobile
npm run typecheck --workspace @war-archive/mobile
npm run test --workspace @war-archive/mobile
npm run build:android --workspace @war-archive/mobile
```

`EXPO_PUBLIC_SITE_URL`에 공개 사이트의 HTTPS 주소를 설정합니다. 앱은 경량 `/data/catalog-v2.json`을 받고 해시별 상세를 필요할 때 읽습니다. 선택 기록·컬렉션을 묶음으로 다운로드하고 검증 후 커밋합니다. 이전 `/data/mobile-index.json`은 호환용으로 유지합니다. 네트워크 실패 시 마지막 유효 보관본을 읽습니다. 보관함은 해당 기기에만 유지되며 원문 방문에는 인터넷 연결이 필요합니다. Android 번들 생성은 앱 스토어 배포나 실제 기기 동작 검증을 대신하지 않습니다.

## 분석과 확장

브라우저 내부의 보관·최근 열람·행동 집계는 사용자가 선택한 기기에 저장됩니다. 원시 검색어·개인정보를 외부 분석 서비스에 자동 전송하지 않습니다. 검색 노출·CTR은 별도의 Search Console 소유권 설정 후 확인해야 합니다.

선택형 계정·버전 충돌 병합·개인/공동 연구·수업/제출/피드백·정정 접수·역할별 CMS·기관/권리/계약·Stripe 결제/환불·평가 gate가 있는 AI 어댑터를 실제 API에 구현했습니다. 공급자 미설정 기능은 비활성으로 표시합니다. 모든 26개 확장안의 실행 경로와 외부 출시 조건은 [확장안 대응표](docs/expansion-implementation.md)에, API 실행·마이그레이션·환경·백업은 [서버 운영 문서](docs/backend-operations.md)에 있습니다.

## 참고

- [확장안 전체 구현 대응표](docs/expansion-implementation.md)
- [확장 검증 결과](docs/expansion-verification.md)
- [API 계약](docs/api-contracts.md)
- [서버 운영·환경·복구](docs/backend-operations.md)
- [배포와 복구](docs/deployment.md)
- [운영과 검수](docs/operations.md)
- [데이터 계약](docs/data-contracts.md)
- [출시 검증](docs/release-checklist.md)
- [고도화 구현 및 검증 결과](docs/verification-report.md)
- [보안 경계와 의존성 점검](docs/security.md)
- [Next.js ESLint 안내](https://nextjs.org/docs/app/api-reference/config/eslint)
- [Playwright 접근성 검사](https://playwright.dev/docs/accessibility-testing)
- [Expo 55 AsyncStorage](https://docs.expo.dev/versions/v55.0.0/sdk/async-storage/)
