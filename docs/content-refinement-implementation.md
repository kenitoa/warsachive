# 콘텐츠·읽기·모바일 고도화 구현 기록

이 문서는 `refinement-plan.md`의 8–11, 16–18, 25–26, 29 중 콘텐츠 담당 구현을 추적한다. 원본 `archive/*.json` 28건과 공개 기록 4개의 ID·기존 주소는 변경하지 않았다. 보류 기록 27건도 유지했다. 실제 공개 기록은 출처 대조 상태이며 사람 최종 검수 완료로 표시하지 않는다. 운영 데이터의 사람 최종 승인, 승인된 전체 외국어 번역, 검수한 좌표, IIIF Manifest는 각각 0개다. 아래 테스트의 번역·좌표·미디어 허가는 명시적 fixture이며 운영 자료에 추가하지 않았다.

| 계획 | 실제 동작 | 주요 파일 | 완료 기준·검증 |
|---|---|---|---|
| 8 통합 검색 | 기록·출처·인물/기관·장소 분류, 확인된 별칭 및 제목/제공기관/대조 위치의 일치 이유. 기존 기록 필터는 연결 공개 기록에 적용. 0건이면 질문을 유지하며 조건 하나를 해제하는 후보를 제시 | `knowledge-search.ts`, `event-archive.tsx`, `archive/page.tsx` | 공개 자료만 검색 DTO에 포함, 보류시 연결 결과 제거. 분류·필터·질문 URL 유지 회귀 |
| 9 검색→작업 | 개별 기록 또는 출처/명칭의 연결 기록을 선택, 새 연구/수업 또는 기존 기기 작업을 선택. 다음 화면에서 확인·명시 저장 | `knowledge-basket.tsx`, workspace/teach 담당 연동 | 작업 담기만으로 저장하지 않음. 기존 연구의 질문/메모 보존. `returnTo`와 `records`, `project`/`plan`, 근거 위치 전달 |
| 10 상세 읽기 | 본문 전 읽기 범위·첫 한계·자료 계통·원문/국역 링크수·사람 검수 상태, 설명별 접힌 근거 안내 | `knowledge-reading.ts`, `knowledge-reading-guide.tsx`, `archive/[id]/page.tsx` | 원문 직접 인용과 자체 편집문 구별. 출처 수를 독립 증언 수·정확도 점수로 부르지 않음 |
| 11 근거 연결 | 출처 상세에서 제공 기관·자료 계통·같은 계통 출처·작품/판본·국역 관계·claim 및 원문 접근 종류 확인. claim 주소가 접힌 기록 영역을 펼치고 해당 항목으로 이동 | `sources/[id]/page.tsx`, `knowledge-record-panel.tsx`, `knowledge-anchor.tsx` | 기존 claim ID·자료 locator 유지. 기관 해설 URL을 원문 전문 제공으로 단정하지 않음. 실제 제공 링크와 미디어 허가 구분 |
| 16 읽기 경로 | 컬렉션·스토리의 목적·입문→작성 맥락→근거/이견 비교 순서와 질문. 민간인·외교·보급·전후복구 관점은 실제 분류와 연결된 기록만 제시 | collections/stories/explore, `ReadingPurpose` | 현재 자료에 없는 관점은 빈 상태와 다음 근거 확인 안내. 새로운 역사 서술·증언을 생성하지 않음 |
| 17 날짜/장소 | 날짜 목적·역법 조건, 원자료 표기·정밀도·환산 미확인 표시. 좌표는 사람 승인과 실제 evidence/source가 모두 있을 때만 분포도로 표시 | `knowledge-chronology.tsx`, timeline/places | 기사·제작·간행·등재일을 사건 발생일과 구분. 좌표 0이면 장소 목록. 윤곽 원을 실제 오차 반경·국경으로 설명하지 않음 |
| 18 검수 세분화 | 서지/대조 위치/해석/권리/번역/지리 review scope 선택적 계약과 실제 상태 UI. 좁은 범위의 보류는 번역·권리·지도 관련 포괄 승인을 덮어씀 | `knowledge-types.ts`, `knowledge-domain.ts`, `knowledge-review.ts`, `knowledge-view.tsx` | 없는 scope 검수는 등록하지 않음. `approved`+`humanReviewed=false`·중복 scope 거부. 실제 공개 기록 4개·연결 출처 8개의 humanfalse 보존 |
| 26 전체 번역 | 승인 전체본문·연표 설명·한계·6개 메뉴·오류/도움말 문자열·번역자/검수자·승인일·원본 문단 버전/내용 해시의 일치 필요 | `knowledge-localization.ts`, `/read/[[...path]]`, 원본 metadata | 제목/요약 승인을 전체 번역으로 공개하지 않음. 당일 본문·근거·날짜 수정도 stale. 실제 전체 승인이 있을 때만 경로·hreflang 생성. 현재 `/read/`는 0개 안내 |
| 18·21 공개 권리/IIIF | 기관 안내, 원문/국역, 이미지, IIIF를 구분. Manifest 구조/공개 URL/Canvas target 검증 후 자원 및 개별 이용권리 사람 승인까지 확인. requiredStatement는 HTML 없이 표시 | `knowledge-iiif.tsx`, `knowledge-iiif-viewer.tsx`, domain | 외부 이미지는 사용자 요청 이후에만 요청. 이미지 실패시 다시 열기. 다운로드 허가와 표시 허가 분리. 운영 IIIF 0개 |
| 25 모바일 | 다운로드 전 개수/실제 byte 합계/목록 버전 확인, 개별 자료 hash·byte 검증, 전체 확인 후 묶음 marker commit. 실패 진행/재시도/이전 버전/보류 상태 | `mobile/catalog-client.ts`, `mobile/App.tsx` | 부분 실패시 이전 marker 유지. 최신 목록에서 제외되면 캐시 fallback 차단. 오프라인은 마지막 온라인 확인시각과 즉시 보류 감지 불가를 표시 |
| 25 계정 공유 | API가 설정된 경우 선택적 로그인 및 명시적 북마크 합치기. HttpOnly 쿠키 기반 요청·메모 보존·expected version·409 재조회 | `mobile/account-client.ts`, `mobile/account-panel.tsx` | 비밀번호/CSRF를 AsyncStorage에 쓰지 않음. 자동 덮어쓰기 없음. 계정 미연결에서도 기기 열람/다운로드 사용. 실제 native cookie jar·장치 동기화는 별도 검증 필요 |
| 29 접근성/성능 | 시맨틱 region·label·focus·state, claim hash 펼침, 좁은 화면, 공개 검색 metadata DTO. 원본 registry 전체·초안은 서버 전용 | scoped CSS/component, E2E | 실제 320px 페이지 overflow·Axe·스크린샷 및 키보드 흐름. 아래 실행 이력 구분 |

## 연동 계약

- 작업 담기에는 새 웹 localStorage 키가 없다. 기존 `war-archive.workspace.v1`을 `parseWorkspace`로 읽기만 한다. 읽지 못하면 원본 값을 유지하고 복구 안내를 표시한다.
- `/workspace/?records=a,b&project=<id>&returnTo=<same-site-path>` 또는 `/teach/?records=a,b&plan=<id>&returnTo=...`. 선택 근거가 있으면 `record`, `section`, `source`, `locator`, `quoteKind=editorial|source-link`를 전달한다. 원문 인용문을 자동 생성하지 않는다.
- `KnowledgeReview.scopes?`는 검수 범위의 실제 등록 상태이며 일반 검수의 상세 설명을 위한 선택 필드다. 권리·번역·지리 작업에서 해당 scope가 보류이면 포괄 승인만으로 실행할 수 없다.
- `DigitalResource.iiifManifestJson?`는 등록 자원의 Manifest와 동일 identity를 가진 구조 검증 입력이다. 공개 권한이 없으면 projection이 JSON·미디어 URL을 제거한다. URL만 등록한 입력 미리보기는 기관 인증·권리 허가가 아니다.
- `KnowledgeLocalization.full?`는 전체 번역 계약이다. `fullLocaleRoutes`/`getFullLocalization`은 승인·원본 identity·모든 문단 hash/version·연표/한계 대응·18개 UI 문자열을 함께 확인한다. 기존 제목/요약 locale 계약은 유지하지만 전체 읽기 route의 근거로 사용하지 않는다.
- 모바일의 `EXPO_PUBLIC_API_URL`은 선택값이다. `EXPO_PUBLIC_SITE_URL`과 API의 native Origin 허용 목록이 일치해야 한다. 실제 장치의 쿠키 처리·HTTPS 연결과 모바일 운영 배포는 Android 번들 생성으로 검증된 것이 아니다.
- 모바일에는 기존 catalog/detail/download marker 저장 키를 유지하고 `war-archive:catalog:v2:<encoded-site>:checked-at` 확인시각 키만 추가했다. 계정 비밀번호·세션·CSRF의 저장 키는 없다. 웹 통합 기기 백업/삭제 registry에 해당 모바일 키를 섞지 않는다.

## 실행 이력

- 콘텐츠 scoped 단위 회귀: 기존 knowledge 18개, refinement 12개, search/storage 7개. 새 회귀는 검색 projection/조건 완화/부분·전체 보류/권리 및 translation scope 보류/동일 날짜 내용 변경/없는 좌표/IIIF identity를 검사한다.
- 모바일 단위 회귀 21개 통과: 선택 저장 실패/변경 버전/온라인 보류/응답·디스크 저장 중 보류/byte 진행/마지막 확인시각/CSRF·version·메모 보존·공백 비밀번호/허용 URL.
- 웹·모바일 `tsc --noEmit` 및 담당 전체 eslint를 실행했다. 최종 재실행 및 브라우저 결과는 통합 보고에서 명령·결과를 확인한다.
- `npm run build:android --workspace @war-archive/mobile`의 Expo Android export를 실행했다. 설치 APK 생성·실제 Android/iOS 기기·네이티브 접근성·운영 API 로그인은 이 결과에 포함하지 않는다.
- 공개 콘텐츠 브라우저 회귀는 `tests/e2e/refinement-content.spec.ts`에 있으며 API fixture를 사용하지 않는다. 실제 정적 production build가 완료된 뒤 실행하고 스크린샷을 직접 확인한다.
- 2026-10-08 최종 정적 빌드에서 공개 콘텐츠 회귀 **16개(데스크톱/모바일 각 8개)가 통과**했다. 실행 명령은 PowerShell에서 `$env:ARCHIVE_TEST_API='false'; npm.cmd run test:browser -- tests/e2e/refinement-content.spec.ts --workers=2 --output=artifacts/refinement-content-final-resume --reporter=list`이며 Playwright 종료 코드 0, 실행 시간 42.3초를 확인했다. 출력 로그는 `artifacts/refinement-content-final-resume.log`에 보존했다. API fixture와 4200 포트를 사용하지 않았다.
- 최종 회귀는 질문·검색 종류·조건을 유지하는 돌아가기, 0건 조건 해제, 기존 연구의 질문·메모 보존, 기존 수업의 비공개 교사 메모·답안 보존, 명시적 저장 전 원본 작업 유지, 정확한 source/section/locator 전달과 자동 원문 인용 금지까지 확인한다. 승인 없는 전체 번역 경로·hreflang과 좌표 지도가 나오지 않는 것도 검사했다.
- 근거 claim 직접 주소는 접힌 영역 펼침, 해당 claim 포커스, viewport 내 노출과 고정 메뉴 아래 **110px ±1px** 정렬을 데스크톱/모바일에서 확인했다. hydration 뒤 native fragment 이동 및 load·폰트 로딩 후 레이아웃에 맞춰 다시 정렬하는 구현을 포함한 최종 빌드를 사용했다.
- 320px 검색/출처/읽기/기록 경로의 펼친 작업 버튼에서 Axe(WCAG 2 A/AA, 2.1 AA, 2.2 AA) 위반 0건과 가로 overflow 없음을 확인했다. 각 경로의 실제 전체 스크린샷 및 출처·기록의 원본 크기 확대 이미지를 직접 검토했다. 스크린샷은 `artifacts/refinement-content-final-resume/`, 확대본은 `artifacts/refinement-content-final-crops/`에 남긴다. 자동 검사와 화면 검토는 실제 사용자 연구·스크린리더·네이티브 기기 접근성 검증을 대신하지 않는다.

## 되돌리기 및 실제 공개 조건

원본 자료를 삭제하지 않았고 새 계약 필드는 선택적이다. UI/새 helper/새 route를 이전 상태로 되돌려도 기존 기록 ID와 개인 보관함·작업공간 키가 유지된다. 모바일 다운로드 실패는 기존 selection marker를 유지한다. 다만 데이터의 실제 인간 검수·번역·기관 이용 허가를 대신할 수 없으므로 이 정보가 없는 자료를 fixture로 채워 출시하지 않는다. 실제 새 번역·좌표·IIIF 자료 등록은 출처/권리·사람 검수·현재 원본 버전 확인 및 브라우저/장치 검증을 별도로 요구한다.
