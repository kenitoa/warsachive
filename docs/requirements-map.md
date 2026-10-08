# 고도화 요구사항 대응표

이 표는 최초 정적 고도화 범위다. 이후 확장 버전 고도화 30개 항목의 현재 구현과 검증은 [최신 반영표](refinement-implementation.md)와 [검증 결과](refinement-verification.md)를 따른다.

| 기획 영역 | 구현 경로 | 제공 범위와 검증 한계 |
| --- | --- | --- |
| 기존 틀·브랜드 유지 | archive-shell, globals/architecture/editorial CSS | 기존 좌측 메뉴·박물관형 히어로·기록물 표현 유지 |
| 홈페이지 진입 | app/page.tsx, archive-domain counts | 실제 공개 기록과 구분된 출처·검수 상태로 집계 |
| 검색·필터·결과 | event-archive.tsx, lib/search.ts | 별칭·인물·기관·날짜·필터·URL 복원·빈 결과 |
| 상세 열람 | archive/[id], reading-tools | 주장별 출처·원문·연표·한계·정정·기기 저장·인용 |
| 주제 탐색 | explore, editorial themes | 실제 질문·자료 연결·학습 질문 |
| 연표 | timeline, structured date/chronology | 사건 날짜와 자료 작성 시기를 구분하며 미확인 연대 보류 |
| 기획 컬렉션 | collections/[id], editorial collections | 선정 기준·한계·단계별 읽기 경로 |
| 기획 스토리 | stories/[id], editorial stories | 별도 서사·근거·관점·학습 질문 |
| 보관함·재방문 | saved, shelf-storage | 브라우저 저장·메모·최근 열람·백업/복원; 계정 화면에서 선택형 서버 동기화 제공 |
| 접근성·반응형 | semantic UI/CSS, Playwright axe | 자동 모바일·키보드 검사; 실제 스크린리더·기기 검수 별도 |
| 모바일 실제 콘텐츠 | mobile/App.tsx, archive-client | 공개 fetch·형식 검증·검색·상세·원문·공유·AsyncStorage·오프라인 |
| 검색 노출·공유 | metadata helpers, sitemap/robots/manifest, JSON-LD | URL·수정일·구조화 데이터; 검색 순위 보장 없음 |
| 새 기록 구독 | public feed.xml 생성 | RSS; 메일·push 구독 계정 없음 |
| 기록 품질·발행 경계 | archive-domain, editorial, content audit | 관련성·근거·인적 검수 구분·원본 보존; 사람의 검수 발명 없음 |
| 관리자 검수 운영 | review/gate/link CLI, PR template, operations | 실제 파일/PR 기반 큐·검수; 비공개 웹 관리자와 독립 승인·이력·발행 API 제공 |
| 분석·KPI | shelf local metrics, operations | 기기 안의 집계; 외부 서비스 전체 분석은 연결 후 검증 |
| 배포·복구 | validate/pages/source-links workflows, release/hash smoke | 실행 가능한 CI/CD·이전 승인 SHA 재빌드; 실제 권한/배포 미검증 |
| 문서·환경 | README, docs, .env.example | 계약·운영·출시·복구·필요 변수·서버 의존 범위 |
| 계정·제보·기여·업로드 | service-boundaries.md | 접수·계정·권한·협업 API 구현; 공개 파일은 권리 확인 후 노출 |
| 결제·AI·다국어 | service-boundaries.md | 실 공급자 어댑터·계약과 검수 gate 구현; 실제 공급자 검증·승인 번역은 별도 |

26개 확장안의 실제 구현 경로와 외부 출시 조건은 [확장안 구현 대응표](expansion-implementation.md)를 따릅니다. API 구현과 실제 외부 공급자·전문가·운영 배포 검증은 구분합니다.
