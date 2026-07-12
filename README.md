# 전쟁 역사 아카이브 프런트엔드

GitHub Pages에 배포되는 공개 Next.js 사이트, React 관리자 화면, React Native 모바일 앱을 함께 관리합니다.

## 구성

| 위치 | 책임 |
| --- | --- |
| `web` | Next.js 공개 아카이브. Pages 루트에 정적 배포 |
| `admin` | React.js 관리자 화면. Pages의 `/admin/`에 배포 |
| `mobile` | React Native 모바일 앱. Pages 배포 대상 아님 |

## 설치와 검증

```bash
npm install
npm run typecheck
npm run build
```

## GitHub Pages

이 `front` 폴더를 프런트엔드 GitHub 저장소의 루트로 사용합니다. `.github/workflows/pages.yml`이 `main` 브랜치 변경을 감지해 공개 사이트와 관리자 화면을 하나의 Pages 산출물로 배포합니다.

1. 저장소의 **Settings → Pages → Source**를 **GitHub Actions**로 설정합니다.
2. Actions 변수 `SITE_URL`에 최종 Pages 주소를 등록합니다.
3. `main` 브랜치에 푸시하거나 Pages 워크플로를 수동 실행합니다.

로컬 환경에서는 사이트 주소만 설정하면 됩니다.

```dotenv
NEXT_PUBLIC_SITE_URL=https://kenitoa.github.io/warsachive
```

공개 사이트는 `web/content/archive.json`만 읽는 완전한 정적 사이트입니다. NAS 주소, 공개 API, CORS 설정은 필요하지 않습니다.

## 검색 노출과 CTR

공개 빌드는 다음 검색엔진 파일을 자동 생성합니다.

- `sitemap.xml`: 공개 canonical URL 전달
- `robots.txt`: 공개 사이트 허용, `/admin/` 제외
- `manifest.webmanifest`: 사이트 이름과 테마 전달
- JSON-LD: `WebSite`와 `CollectionPage` 구조화 데이터

배포 후 Google Search Console에 `SITE_URL/sitemap.xml`을 제출하고 실제 노출수·클릭수·검색 CTR을 확인합니다. 사이트맵과 구조화 데이터는 검색엔진 이해를 돕지만 상위 노출을 보장하지는 않습니다.

NAS 발행 스케줄러는 40분마다 정보화 기록 한 건을 `web/content/archive.json`에 누적 커밋합니다. 이 push가 `pages.yml`을 자동 실행하고 `/archive/기록ID/` 상세 페이지와 sitemap을 다시 생성합니다. 기존 기록은 삭제하거나 교체하지 않습니다.

GitHub Pages 자체에는 쓰기 가능한 서버가 없으므로 NAS API 기반 노출·클릭 집계는 사용하지 않습니다. 실제 검색 노출과 CTR은 Google Search Console 등 Pages와 독립된 분석 도구에서 확인합니다.
