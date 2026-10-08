# 공개 데이터 계약

`web/lib/archive-types.ts`가 웹·모바일의 공통 타입입니다. `archive-domain.ts`는 외부 값의 런타임 검사와 공개 경계를 제공합니다.

## 기록

ArchiveRecord는 불변 id, 제목·요약·지역·언어·자료 유형, 명시적 역사 날짜와 정밀도, 인물·장소의 별칭, 출처, 문단별 근거, 연표별 근거, 한계, 연관 기록, 컬렉션 관계, 발행·수정일, 정정 이력을 포함합니다. 공개 정적 계약과 별도로 계정·협업·검수·거래 API는 SQLite와 001–011 마이그레이션을 사용합니다. 공개 산출물에 사용자/초안/인증 정보를 포함하지 않습니다.

출처에는 기관·작성자·제목·원문 URL·자료 위치·자료 유형·언어·사용권·확인일·독립성 그룹이 있습니다. sourceCount는 고유 등록 출처 수입니다. 자료의 사실 정확도에 대한 통계 확률이 아닙니다.

공개 조건은 유효 스키마, source-checked/실제 approved 상태, 중복 없는 출처 ID, 유효한 공개 원문 URL, 모든 문단·연표의 등록 근거 연결입니다. 사람이 검수하지 않은 approved는 거절됩니다.

자동 발행 파일의 완전한 ArchiveRecord(v2 공개 계약)는 기존 단일 객체 또는 items 형식으로 누적할 수 있습니다. 공통 parseArchivePayload/mergeArchiveRecords가 legacy·완전한 신규 기록·편집 overlay를 병합합니다. overlay가 우선하며 legacy는 근거 대조 전까지 보류 안내만 제공합니다. 웹·검색·모바일·RSS·공유 이미지·검수 큐가 동일한 합본과 공개 경계를 사용합니다. malformed v2를 legacy로 낮춰서 처리하지 않습니다.

## 검색 데이터

`/data/search-index.json`은 `{version:1,contentHash,records:SearchRecord[]}`입니다. SearchRecord는 검색·필터·결과 목록에 필요한 공개 필드만 포함하며 원문 전체와 편집 내부 메모는 포함하지 않습니다.

## 모바일 데이터

`/data/mobile-index.json`은 `{version:1,siteUrl,contentHash,generatedAt,records:ArchiveRecord[]}`입니다. 공개 선정 기록만 제공합니다. 모바일은 응답 버전·SHA256 형태의 해시·날짜·기록 스키마·공개 상태·설정된 사이트 일치를 검증합니다. 클라이언트 보관본은 같은 사이트의 마지막 유효 응답으로 한정합니다. 네트워크 실패 시 오래된 캐시라는 상태를 표시합니다.

캐시는 공개 자료이며 인증 토큰을 저장하지 않습니다. 모바일 저장 기록은 해당 기기에 유지됩니다. 웹은 선택형 로그인 후 별도 API에서 버전 확인·충돌 선택·서버 저장을 제공하며 자동 동기화하지 않습니다. 캐시 손상과 저장 실패를 사용자에게 표시합니다.

## 배포 데이터

`/release.json`은 `{version:1,gitSha,contentHash,generatedAt,siteUrl,basePath,recordCount,mode}`입니다. gitSha는 빌드 checkout, contentHash는 공개 기록의 SHA256입니다. generatedAt은 빌드 시각이며 자료의 역사적 날짜나 마지막 편집일이 아닙니다. 로컬 변경이 있는 산출물의 gitSha만으로 커밋과 내용이 동일하다고 판단하면 안 됩니다.

`/feed.xml`은 최근 발행 공개 기록을 최대 50개 제공하는 RSS입니다. pubDate는 기록의 publishedAt입니다. sitemap의 기록 lastModified는 실제 updatedAt에서 생성합니다.
