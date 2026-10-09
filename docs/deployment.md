# 배포·설정·복구

현재 공개 웹의 운영 배포는 [Vercel 이관 및 운영](vercel-migration.md)을 따른다. 서명 검증·발행 증거·API 영속성 계약을 유지하며, 공개 정적 웹은 Vercel Git 연동으로 자동 배포한다.

## 승인 자료의 발행 확인 증거

Vercel에 서명된 승인 export를 사용할 때는 보호된 production 환경 변수와 동일한 GitHub Secrets `ARCHIVE_APPROVED_EXPORT_JSON`, `ARCHIVE_PUBLICATION_VERIFY_SECRET`, `ARCHIVE_DEPLOYMENT_EVIDENCE_SECRET` 세 개를 함께 설정한다. JSON은 현재 보류 목록까지 포함한 최신 worker export 원문이며 다른 비밀값과 분리된 검증/관측 키를 사용한다. 일부만 설정하면 배포를 거절한다. 공급자의 환경 변수 크기 한도를 넘는 운영 자료는 안전한 별도 승인 artifact 전달 경로를 마련한 뒤 기존 file 계약에 연결해야 한다. 공개 저장소에 private export를 커밋하지 않는다.

Vercel 빌드는 private 임시 파일을 검증해 정적 산출물을 만든다. `.github/workflows/vercel.yml`은 성공한 production 배포의 동일 SHA를 확인하고, 선택형 서명 export가 설정된 경우 재빌드하여 승인 버전/본문 해시·catalog 상세 바이트·릴리스 SHA를 관측한다. 공개 HTTPS 페이지/피드의 실제 바이트와 SHA를 대조하고 `signed-publication-vercel` private artifact로 3일 보관한다. 서명 export가 없는 기본 배포는 공개 release와 핵심 URL만 검증하며 사람 승인 증거를 만들지 않는다.

승인 상세 페이지의 HTML article은 검증된 서명 export의 승인 revision과 실제 public record hash를 포함한다. build와 공개 URL 관측은 해당 표식을 대조하며 feed만 최신이고 HTML이 구형인 혼합 배포는 거절한다. 사람 검수 전 기록·보류 안내에는 승인 표식을 만들지 않는다. HTML을 받았다는 사실이나 페이지 크기만으로 현재 승인 버전의 배포를 인정하지 않는다.

서버의 publication 진행 화면에 등록하려면 보호된 실제 운영 환경에서 같은 릴리스의 build artifact와 deploy/feed artifact를 순서대로 수입한다. CLI는 최신 승인·동일 SHA·동일 산출물 해시·허용 공개 origin·최근 시각을 다시 확인한다.

```bash
node --env-file-if-exists=.env.api --experimental-strip-types api/src/cli.ts deployment-evidence <signed-build.json>
node --env-file-if-exists=.env.api --experimental-strip-types api/src/cli.ts deployment-evidence <signed-deploy-feed.json>
```

artifact 관측은 배포 완료를 추측하는 표시가 아니다. 승인 export가 설정되지 않은 기본 출처 대조 배포는 사람 승인/단계 증거를 만들지 않는다. 복구에도 최신 보류 목록을 사용하고 오래된 승인 파일로 보류 자료를 다시 공개하지 않는다. 공개 웹 이관은 서버 artifact 수입을 대신하지 않는다.

## 환경 변수

| 키 | 용도 | 비밀 |
| --- | --- | --- |
| NEXT_PUBLIC_SITE_URL | 공개 웹·canonical·RSS·release의 최종 HTTPS 주소. Vercel에서는 시스템 환경 변수로 자동 결정 가능 | 아니오 |
| EXPO_PUBLIC_SITE_URL | 모바일 앱에서 조회하는 공개 사이트 주소 | 아니오 |
| ARCHIVE_SOURCE_HOSTS | 링크 검사에 허용할 호스트 쉼표 목록. 생략 시 명시적 기관 목록 사용 | 아니오 |
| ARCHIVE_RELEASE_SHA | CI에서 기록할 실제 checkout SHA. 배포 워크플로 자동 설정 | 아니오 |
| ARCHIVE_PREVIEW_PORT | loopback 정적 미리보기 포트, 기본 4173 | 아니오 |
| ARCHIVE_PREVIEW_BASE_PATH | 명시적으로 설정한 앱 하위 경로 산출물을 미리보기할 때 설정 | 아니오 |
| ARCHIVE_BUILD_PROFILE | CI/local 검증은 preview, 명시적 운영 검증은 production. 미지정 시 기존 실행 환경으로 판단 | 아니오 |
| VERCEL/VERCEL_ENV/VERCEL_URL/VERCEL_PROJECT_PRODUCTION_URL | Vercel이 제공하는 환경과 배포 주소 정보 | 아니오 |

실제 .env 파일은 커밋하지 않습니다. 클라이언트 변수에는 공개 주소만 넣습니다. 관리자 자격증명·NAS 비밀키·결제 비밀키를 추가하지 않습니다.

PR 검증은 preview 프로필로 loopback 사이트를 빌드합니다. 공급자가 관리하는 시스템 환경 변수를 덮어쓰지 않습니다. preview 주소에 하위 경로를 넣으면 경로 불일치를 막기 위해 실패합니다. 운영 빌드는 최종 주소에 HTTPS를 요구합니다. production 프로필 또는 실제 CI 운영 환경에서 공개 주소나 유효한 Vercel 배포 주소가 없으면 localhost로 발행하지 않고 실패합니다. 명시한 공개 URL의 pathname을 공유 설정 계층에서 Next basePath·assetPrefix와 metadata에 맞춥니다.

## 배포 순서

1. Vercel에 Git 저장소와 `web` Root Directory를 연결하고 Actions 변수 SITE_URL을 운영 주소로 설정합니다.
2. 브랜치 보호에서 검증 체크와 PR 승인을 요구하도록 설정합니다. 파일 추가만으로 저장소 권한 설정이 적용되지는 않습니다.
3. main push는 lint/typecheck/test/content gate/build/정적 검증을 통과한 산출물만 Vercel 운영 도메인에 반영합니다.
4. 공개 산출물에는 release.json의 실제 checkout SHA, 콘텐츠 hash, 사이트 URL이 포함됩니다.
5. 배포 후 smoke가 공개 release.json과 기대 SHA를 비교하고 홈페이지·목록·대표 상세·sitemap·robots·RSS·모바일/검색 데이터를 확인합니다.
6. 검증 실패 시 성공 배포로 보고하지 않습니다. Actions 로그와 사이트 URL, SHA, 시간, 영향받는 경로를 확인합니다.

공개 정적 사이트는 DB 없이 배포하며 별도 API/worker는 영속 SQLite와 001–011 마이그레이션을 사용합니다. 기존 001–006을 수정하지 않고 007–011을 추가 적용합니다. 웹과 모바일의 공개 탐색은 public export를 읽고, 선택형 인증 기능은 환경에 연결한 별도 API를 사용합니다. 배포 순서와 복구 원장은 [고도화 운영](refinement-operations.md)을 따릅니다.

## 복구

- 콘텐츠 오류는 원본을 지우지 않고 정정 또는 공개 상태 보류를 새 커밋으로 반영합니다.
- 화면/배포 장애는 이전에 성공한 승인 release SHA를 확인합니다. 운영 문서와 Actions 기록에 SHA를 남깁니다.
- 검증된 이전 Vercel production 배포를 Promote하거나 오류 커밋을 되돌리는 새 커밋을 main에 push합니다.
- 콘텐츠 보류 목록이 바뀌었다면 과거 산출물 승격 대신 최신 보류 목록을 사용하여 재빌드합니다.
- 운영 데이터 삭제, git reset --hard, 저장소 clean, 콘텐츠 폴더 초기화는 복구 절차에 포함하지 않습니다.
- 복구도 공개 release SHA와 핵심 URL 확인까지 완료되어야 합니다.

## 운영 한계

Vercel은 공개 정적 웹을 제공하며 계정·공동 작업·접수·업로드·결제·관리자 세션은 별도 API가 담당합니다. API 구현은 [서버 운영 문서](backend-operations.md)를 따릅니다. Strict 세션 쿠키가 필요하므로 운영 웹/API는 같은 사이트의 HTTPS 주소 또는 역방향 프록시로 구성합니다. 서로 무관한 웹/API 도메인은 CORS 허용만으로 계정이 연결되지 않습니다. NAS 자동 발행기, GitHub 브랜치 보호, Search Console 소유권, 외부 분석 계정, 앱 스토어 배포는 이 코드만으로 설정되었다고 간주할 수 없습니다. 실제 권한과 환경에서 별도 검증해야 합니다.

Android export는 JavaScript 번들 검증이며 APK/IPA 빌드, 실제 기기, 스토어 승인과 다릅니다.

## Windows 정적 RSC 경로

Next.js 16.4.0 로컬 Windows 빌드에서 `archive/__next.archive/__PAGE__.txt`가 생성되지만 브라우저는 `archive/__next.archive.__PAGE__.txt`를 요청하는 오류를 재현했습니다. [공식 Next.js 이슈](https://github.com/vercel/next.js/issues/92339)와 설치된 export 코드에서 같은 경로 변환을 확인했습니다.

postbuild의 normalize-rsc-paths.mjs는 out 안의 중첩된 __next.* TXT만 점으로 연결한 실제 정적 자산으로 복사합니다. 원본을 삭제하지 않고 심볼릭 링크·범위 이탈·내용 충돌을 거절합니다. 이미 평평한 Linux 출력에서는 작업하지 않습니다. 미리보기 서버의 가상 경로 수정에 의존하지 않으며 static 검증에서 실제 요청 파일을 확인합니다.
