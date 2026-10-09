# Vercel 이관 및 운영

공개 웹 전체와 GitHub 자동 배포를 Vercel로 이관한다. API/SQLite/worker 및 로컬 운영 데이터는 이번 이관 범위에 포함하지 않는다.

## 프로젝트 설정

| 설정 | 값 |
| --- | --- |
| 프로젝트 | `stock-project1/kenitoa-warsachive` |
| 공개 주소 | `https://kenitoa-warsachive.vercel.app/` |
| Git 저장소 / 운영 브랜치 | `kenitoa/warsachive` / `main` |
| Root Directory / Framework | `web` / `Other` |
| Node.js | `22.x` |
| Install Command | `cd .. && npm ci` |
| Build Command | `node ../scripts/build-vercel.mjs` |
| Output Directory | `out` |

설정은 [Vercel monorepo 문서](https://vercel.com/docs/monorepos)를 따른다. `web/vercel.json`으로 Next.js 정적 export만 배포한다. 저장소의 `api` 디렉터리는 Vercel 함수로 배포하지 않는다.

Git 연결이 `main` push를 운영 배포하고 다른 브랜치와 PR은 preview로 배포한다. 빌드마다 lint/typecheck/test/content gate/build/static 검증을 수행한다. 실패한 빌드는 운영 도메인으로 승격되지 않는다.

production은 Vercel의 고정 프로젝트 주소, preview는 해당 배포 주소를 사용한다. canonical·RSS·sitemap·공개 JSON·정적 자산 주소를 같은 설정으로 계산한다. `release.json`은 `VERCEL_GIT_COMMIT_SHA`를 기록한다. 기록 ID와 URL 경로를 유지한다.

## 환경 변수

| 키 | 용도 | 비밀 |
| --- | --- | --- |
| NEXT_PUBLIC_SITE_URL | 선택형 명시적 공개 주소. 커스텀 도메인은 production 환경에만 지정 | 아니오 |
| EXPO_PUBLIC_SITE_URL | 모바일 앱 발행 시 Vercel 운영 주소 지정 | 아니오 |
| NEXT_PUBLIC_API_URL | 별도 API를 실제 배포한 경우에만 연결. 이번에는 미설정 | 아니오 |
| VERCEL / VERCEL_ENV | Vercel 자동 제공 실행 환경 | 아니오 |
| VERCEL_URL / VERCEL_PROJECT_PRODUCTION_URL | Vercel 자동 제공 preview/production hostname | 아니오 |
| VERCEL_GIT_COMMIT_SHA | Vercel 자동 제공 배포 소스 SHA | 아니오 |
| ARCHIVE_RELEASE_SHA | 로컬/CI 명시적 검증 SHA | 아니오 |
| ARCHIVE_APPROVED_EXPORT_JSON | 선택형 서명 승인 export. 검증/증거 키와 함께 설정 | 예 |
| ARCHIVE_APPROVED_EXPORT_FILE | 로컬/CI private 승인 export 파일 경로 | 예 |
| ARCHIVE_PUBLICATION_VERIFY_SECRET | 선택형 export 서명 검증 키 | 예 |
| ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET | 선택형 발행 관측 서명 키 | 예 |

GitHub Actions 저장소 변수 `SITE_URL`은 `https://kenitoa-warsachive.vercel.app`로 설정한다. `.env`와 `.vercel` 파일은 커밋하지 않는다. Vercel 시스템 변수는 직접 추가할 필요가 없다. API·결제·관리자 비밀키는 웹 배포에 필요하지 않다.

Vercel 주소를 도출하지 못하면 Pages나 localhost 주소로 잘못 발행하지 않고 실패한다. 로컬/PR 검증은 기존 preview 프로필과 loopback 주소를 사용한다.

## 승인 자료와 발행 증거

서명 export를 사용한다면 `ARCHIVE_APPROVED_EXPORT_JSON`, `ARCHIVE_PUBLICATION_VERIFY_SECRET`, `ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET`을 보호된 Vercel production 환경 변수와 동일한 GitHub Secrets에 함께 설정한다. JSON은 최신 보류 목록까지 포함한 worker export이며 일부만 설정하면 빌드를 거절한다. 환경 변수 한도를 넘는 자료는 안전한 별도 전달 경로를 마련해 기존 file 계약에 연결한다.

빌드는 export를 private 임시 파일에 쓰고 기존 서명 검증으로 읽는다. 종료 시 정리하며 정적 산출물에 원본 export나 키를 복사하지 않는다. GitHub 배포 확인은 동일 SHA를 재빌드해 승인 버전·본문 해시·catalog 바이트를 확인한 뒤 공개 HTTPS 페이지/피드와 대조한다. `signed-publication-vercel` private artifact로 3일 보관한다.

서명 export가 없는 기본 출처 대조 배포는 승인 관측 단계가 생략되며 사람 승인 증거를 만들지 않는다. 서버 publication 화면에 등록하는 artifact 수입은 [기존 발행 증거 계약](deployment.md)을 따르는 별도 운영 작업이다. 웹 이관만으로 서버 증거 수입이 실행되지는 않는다.

## 배포와 검증

1. Vercel에 Git 저장소와 `web` Root Directory를 연결한다.
2. GitHub Actions `SITE_URL`을 운영 주소로 갱신한다.
3. `main` push 후 Vercel 빌드 검증과 운영 도메인 승격을 확인한다.
4. 공개 `release.json`의 `gitSha`를 실제 push SHA와 비교한다.
5. `.github/workflows/vercel.yml`이 production 성공 `deployment_status` 후 운영 HTTPS와 해당 SHA를 검증한다. 수동 실행은 선택한 브랜치의 현재 SHA를 확인한다.
6. 공개 화면·상세·검색·sitemap·RSS·정적 자산을 확인한 뒤 기존 GitHub Pages를 Unpublish한다.

기존 `pages.yml`은 제거하여 Pages 자동 발행을 중단한다. `github.io` 주소는 Vercel에서 제어할 수 없으므로 새 주소로 자동 HTTP 리다이렉트되지는 않는다. 외부에 공유한 링크는 새 주소로 갱신한다.

## 복구와 운영 경계

- 검증된 이전 Vercel production 배포를 Promote하거나 원인 변경을 되돌리는 새 커밋을 `main`에 push한다.
- 콘텐츠 보류 목록이 바뀌었다면 과거 산출물을 승격하지 말고 최신 보류 목록으로 재빌드한다. 오래된 승인 파일로 보류 자료를 다시 공개하지 않는다.
- 복구 후에도 공개 SHA와 핵심 URL을 확인한다. DB 초기화나 운영 데이터 삭제는 필요하지 않다.
- Pages 복구가 필요하면 이관 전 workflow와 설정을 승인된 복구 커밋으로 복원하고 다시 발행한다.
- DB 마이그레이션은 없다. 기존 로컬 API·SQLite·worker를 유지한다. 계정·관리자·결제 서버의 외부 운영 배포는 이번 범위 밖이다.
- Linux 검증에서 발견한 초기 WAL 전환 경합은 SQLITE_BUSY에만 최대 5초 재시도한다. 마이그레이션 파일은 수정하지 않으며 기존 초기화 실패는 그대로 보고한다.
- `.gitattributes`가 원본 archive JSON의 바이트를 운영체제 간 보존한다. 기존 원본 체크섬은 변경하지 않는다.
- 별도 API를 연결할 때는 Strict 세션 쿠키에 맞는 같은 사이트 HTTPS 또는 역방향 프록시가 필요하다. 무관한 API 도메인은 CORS 허용만으로 연결되지 않는다.
- Search Console·외부 분석·앱 스토어·실제 기기 검증은 별도 작업이다.
