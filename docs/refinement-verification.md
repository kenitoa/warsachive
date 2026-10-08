# 확장 버전 고도화 검증

2026-10-08. 승인된 30개 항목의 구현은 [반영표](refinement-implementation.md), 실행·복구·외부 인수 조건은 [운영 문서](refinement-operations.md)를 따른다. 이 보고서는 이번 고도화 검증이며 이전 단계의 `verification-report.md` 및 `expansion-verification.md`와 구분한다.

## 자동 검사

Windows 로컬, 저장소 npm lockfile, 실제 Next 정적 산출물 및 격리 SQLite/HTTP fixture를 사용했다. 기존 로그인 속도 제한을 유지하며 브라우저 API 테스트마다 파일·프로필별 새 fixture를 시작했다.

| 명령 | 결과 |
| --- | --- |
| `npm.cmd run lint` | 성공. 생산 소스·설정·테스트를 검사하며 생성된 `artifacts/`는 제외한다. |
| `npm.cmd run typecheck` | 웹·모바일·API 모두 성공. |
| `npm.cmd run test` | **225/225 성공**: 웹 121, 모바일 21, API 83. 실패·건너뜀 0. |
| `npm.cmd run content:gate` | 성공. 출처 대조 공개 기록 4개. 사람 승인 생성 없음. |
| `npm.cmd run build` | API 타입 빌드·Next production 정적 빌드 성공, 클라이언트 RSC 경로 80개 보정. |
| `npm.cmd run test:static` | 공개 경로 47개와 비공개 utility noindex, canonical/OG, sitemap, 피드·상세 shard hash/byte, 이미지 예산, RSC 경로 80개 확인. |
| `npm.cmd run test:withdrawal` | 성공. 임시 서명 승인 자료 실제 Next 빌드/관측 → 전체 보류(공개 0개, 경로 13개) → 정상 공개 4개/경로 47개 복귀 확인. |

로그는 `artifacts/refinement-{lint,typecheck,unit,content-gate,build,static}.log`에 남겼다. `artifacts/`와 DB/백업/생성 산출물은 Git에서 제외한다. Node SQLite experimental 경고와 Playwright 색상 환경 경고는 실제 종료 코드와 별도로 확인했다.

## 브라우저와 화면

| 범위 | 통과 | 확인 내용 |
| --- | --- | --- |
| 기존 공개 아카이브 | 42/42 | 검색·URL·출처·보관함·손상 복구·검수·키보드·좁은 화면의 기존 계약 |
| 기존 확장 기능 | 32/32 | 실제 등록/세션/선택 공유·협업 역할·교사/학생 제출·비공개 첨부 원본 byte/hash/download |
| 공개 콘텐츠 고도화 | 16/16 | 기존 연구/수업 내용 보존·근거 전달·claim 열기/포커스/110px 정렬·번역/좌표 보류·320px |
| 개인 작업 고도화 | 18/18 | 복구 입력·오류 보존·로그인 작업 복귀·수업 재사용·비공개 답안 제외·학습자 초안/제출 |
| 관리자 고도화 | 8/8 | 일반 CMS 폼·다중 줄 복구·불변 버전·필드 오류·독자 미리보기·실제 기관 문의·권리 전담 scope |
| 릴리스 표시 고도화 | 2/2 | 실제 로그인/초안 저장, UI 증거 fixture의 SHA+산출물별 단계 선택·새로고침·초안 변경 초기화 |

담당 검사에서 Axe 위반 0과 가로 넘침 없음을 확인하고 실제 스크린샷을 열어 검토했다. 학습자 자료 링크는 WCAG 2.2 target-size 검사에서 발견한 문제를 수정해 최소 높이 44px와 링크 간격을 적용했다. 관리자 미리보기의 글자 대비도 실제 실패를 수정한 뒤 재검증했다.

각 파일은 데스크톱과 Pixel 7 에뮬레이션을 사용한다. 모바일 viewport·자동 Axe·스크린샷은 실물 휴대전화, 실제 스크린리더, 사람의 사용성 조사 증거가 아니다. 공개 콘텐츠 및 개인 흐름의 상세 로그/스크린샷 경로는 [콘텐츠 기록](content-refinement-implementation.md)과 [개인 기록](refinement-personal.md)에 남겼다. 관리자·기존 확장 기능의 최종 로그는 `artifacts/refinement-admin-expansion-final.log`이다.

## 발행·보류와 복구

API 회귀는 서명 수입·불변 버전·독립 승인·출처 identity·배포 단계 순서·정정 종결·과제/피드백 이력·파일 검사/알림 서명·범위 취소·MFA/재인증·복구 원장을 실제 HTTP와 SQLite에서 검사했다. 동일 승인 본문을 두 SHA로 재배포하고 단계가 교차 도착해도 릴리스별 이력을 보존하며 잘못된 SHA/산출물 해시는 거절한다. 011은 이전 증거와 정정 외래 키를 보존한다.

공개 HTML은 서명된 실제 승인 revision과 public projection SHA256을 article 속성에 렌더한다. 빌드/배포 관측은 모바일 피드·shard뿐 아니라 HTML의 ID/revision/hash도 대조한다. 사람 검수 전 기록과 보류 안내에는 승인 표식이 없고, RSC·script·주석의 문자열을 승인 표식으로 인정하지 않는다.

로컬 실행 전 기존 DB(001–006 적용)와 비공개 파일의 online bundle을 새 `backups/refinement-prelaunch-2026-10-08T13-51-30-988Z/`에 생성했다. DB 무결성 성공, 첨부 0개를 확인했다. 원본 DB를 읽기 전용으로 열어 백업했으므로 백업 전에 추가 마이그레이션을 적용하지 않았다.

## 성능과 의존성

`npm.cmd run test:performance`가 성공했으며 데스크톱과 CPU 4배 지연·네트워크 150ms/1.6Mbps 조건에서 5개 경로를 각 3회, 총 30회 측정했다. 데스크톱 경로별 synthetic p75 LCP는 136–272ms, 제한 모바일은 2,712–2,924ms였다. CLS 최대 0.005406, 가로 넘침 0/30이다. 검색 완료 시간은 각각 125ms/341ms이며 이를 INP라고 표시하지 않는다. **제한 모바일 LCP는 제안한 2.5초 목표를 충족하지 못했다.** 현장 Core Web Vitals 및 실제 기기 증거는 false이다. 운영 캐시·압축·네트워크 및 실제 사용자 조건에서 후속 측정·개선이 필요하다. 원시 결과는 `artifacts/refinement-performance.json`, 로그는 `artifacts/refinement-performance.log`다.

최종 `npm.cmd audit --omit=dev --workspace @war-archive/web` 및 API 검사는 각각 취약점 0이다. 전체 `npm.cmd audit`는 **28개(moderate 5, high 23)**로 실패 상태다. 주로 Expo/Metro/빌드 도구의 기존 전이 의존성 경로이며 강제 주요 버전 교체로 호환성을 깨지 않았다. 노출 경로·후속 조건은 [보안 문서](security.md)에 기록했고, 감사 JSON은 `artifacts/refinement-audit-{web,api,all}.json`에 남겼다.

## 외부 인수 조건

실제 운영 CI/CD·Linux Docker/TLS/volume, 외부 공개 배포 SHA/HTML/피드, 전문가 역사 검수, 기관 사용권·실계약·상품 가격·납품, Stripe sandbox/live 결제·환불, 파일 검사기, 알림 실제 전달, 유료 AI 모델 평가와 사람 승인, 모바일 실물 기기·스토어, 스크린리더·현장 성능은 미검증이다. 관련 어댑터·gate·서명·운영 절차를 구현한 것과 실제 외부 서비스가 검증된 것은 구분한다.

운영 데이터의 전체 승인 번역·검수 좌표·IIIF·사람 최종 승인을 임의로 만들지 않았다. 현재 공개 4개·보류 27개·수집 원본 28개와 기존 ID/URL/저장 키를 유지한다. 실제 공급자 키가 없는 상태에서는 해당 기능을 출시 완료로 표시하지 않는다. 커밋·push·외부 배포는 수행하지 않았다.

## 최종 인수 기록

- 브라우저 총 **118/118**: 기존 공개 42 + 확장 32 + 콘텐츠 16 + 개인 18 + 관리자 8 + 릴리스 UI 2. 릴리스 UI는 실제 로그인·초안 저장을 사용하고 발행 조회만 명시적인 UI fixture로 대체했다. SHA/산출물별 선택, 부족 단계, 사라진 선택 새로고침과 초안 변경 초기화, 320px/WCAG 2.2 Axe 위반 0을 확인했다. 이는 실제 배포 증거와 별도다. 로그는 `artifacts/refinement-publication-browser.log`, 화면은 `artifacts/browser-results/refinement-publication-{desktop,mobile}/`다.
- `test:withdrawal`의 긍정 fixture는 임시 서명 파일의 canonical 공개 기록 1개·revision 7·테스트 검수자·테스트 SHA·가상 HTTPS 주소를 사용했다. 실제 Next가 만든 article revision/hash와 관측 CLI의 서명 JSON이 일치했으며 나머지 기록에는 승인 표식이 없었다. 전체 보류 때 공개 데이터·관계·shard가 0개이고 기존 기록/기획 주소는 noindex 안내로 유지됐다. finally에서 정상 공개 4개·경로 47개·RSC 80개를 복구했다. 원본 콘텐츠·실제 API·외부 배포에는 fixture를 등록하지 않았다. 로그는 `artifacts/refinement-withdrawal.log`다.
- `start.cmd`에서 API·worker·Next 실행과 기본 브라우저 열기 호출을 확인했다. Ctrl+C 종료에서 API `shutdown:complete`와 3000/4200 listener 제거, 해당 API/worker 종료를 확인했다. Windows 배치의 Ctrl+C 종료 코드는 정상 시작 명령의 실패로 해석하지 않는다. 기본 지식 레지스트리 연결 후 다시 실행했으며 `knowledgePreflight:true`를 확인했다. 실제 관리자/사용자 계정과 사람 승인은 생성하지 않았다.
- 실제 로컬 DB의 001–006을 유지하고 **007–011 추가 적용**을 확인했다. 실행 전 bundle을 절대 경로로 지정해 `db:restore-bundle`로 새 `backups/refinement-restored-verification-20261008/`에 복구했다. 복구 DB는 migrations 11, 공개 기록 4, 사용자/세션 0, quick_check ok, foreign_key_check 오류 0이다. 원본 DB와 파일은 보존했다. 로그는 `artifacts/refinement-restore.log`, 집계는 `artifacts/refinement-restore-check.json`이다. 최신 보류/삭제/권한 취소 사례는 별도 API fixture 회귀에서 확인했다.
- 이 PC에 Docker CLI가 없어 실제 Linux 컨테이너 검증은 실행하지 못했다. CI 정의 작성과 실제 GitHub 실행/공개 배포는 별도이며 이번에는 commit/push/deploy를 수행하지 않았다.
- 최종 실제 실행 주소 **`http://127.0.0.1:3000/`**에서 홈 4개 카드 → 난중일기 검색 1건 → 상세 3문단/출처 2개/유효한 근거 링크 4개 → 검색 조건 복귀를 확인했다. `pageErrors=[]`, `consoleErrors=[]`이며 읽기 전용 DB 전후 집계는 migrations 11/공개 4/사용자 0/quick_check ok/외래 키 오류 0으로 같았다. 실제 API ready와 지식 사전 검사 true, 외부 공급자 false를 확인했다. 실행 증거는 `artifacts/refinement-local-start.json/.log`, 직접 검토한 홈/상세/근거 화면은 같은 이름의 PNG 및 `-detail.png`, `-evidence.png`다. 검증 후 3000/4200 서비스는 실행 상태로 두었다. 이 주소는 같은 PC에서 접근하며 LAN/외부 공개 배포 주소가 아니다.
