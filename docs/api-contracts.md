# API v1 계약

확장 고도화에서 추가한 업무 scope·MFA·재인증·과제/피드백 이력·사전 검사·발행 증거·사용권 범위·기관 문의/이행·서명 수신 계약도 같은 API v1의 하위 호환 추가다. 최신 상세 상태/입력 한도/외부 인수 조건은 [고도화 운영](refinement-operations.md)과 [AI 평가 운영](ai-operations.md)을 따른다. 권한과 추가 인증을 UI 숨김으로 대신하지 않는다.

기계 판독 스펙은 `api/openapi.json`과 `GET /api/v1/openapi.json`이다. `scripts/generate-api-contracts.mjs`가 경로·기본 입력·보안 계약을 생성한다. 편집 기록의 전체 형식은 `web/lib/archive-types.ts`와 기존 [데이터 계약](data-contracts.md), 연구 자료는 `web/lib/workspace-domain.ts`를 따른다. 실제 입력 검사와 상태 전이는 API application/domain 계층에서 다시 수행한다.

## 요청·응답과 인증

모든 응답은 `{ data, error, meta: { requestId } }` 형식이다. 성공은 `error: null`, 실패는 `data: null`과 사용자에게 안전한 `{ code, message }`를 반환한다. 내부 예외·SQL·공급자 응답은 클라이언트에 그대로 노출하지 않는다. 입력 400, 로그인 401, 권한·CSRF·origin 403, 없음 404, 버전 충돌 409, 속도 제한 429, 미설정 공급자 503을 구분한다.

`GET /auth/session`으로 세션과 CSRF 값을 받은 뒤, 변경 요청에 허용된 `Origin`, `Content-Type: application/json`, `X-CSRF-Token`을 보낸다. 브라우저는 `credentials: include`를 사용한다. 쿠키는 HttpOnly, SameSite=Strict이며 운영은 Secure와 `__Host-` 접두사를 사용한다. 프론트엔드의 메뉴 숨김과 역할 표시는 보안 경계가 아니다. 서버에서 역할·소유권·참여자 권한을 검사한다.

웹과 API는 같은 사이트에서 운영해야 한다. 별개의 github.io 사이트와 무관한 API 도메인을 연결했다고 Strict 쿠키가 동작하지 않는다. 운영 API는 같은 사이트의 서브도메인 또는 HTTPS 역방향 프록시로 연결하고 origin 허용 목록을 정확히 설정한다. `/health/metrics`는 관리자만 열람한다.

## 공개 API와 정적 자료

`GET /public/records?page=1&limit=50`은 공개 자료와 total/page/limit를 반환한다. page는 양의 정수, limit은 1~100이다. 보류·초안은 목록과 개별 조회 모두 제외한다. `GET /public/records/:recordId`는 공개된 개별 기록을 반환한다. 날짜와 갱신 시점은 기존 공개 계약을 유지한다. 하위 호환 변경은 v1 안에서 추가하고 깨지는 변경은 새 버전으로 분리한다.

정적 사이트의 `/data/catalog-v2.json`은 검색·목록과 해시별 상세 위치를 제공한다. `/data/records/:id-:sha256.json`은 해시와 UTF-8 바이트 수로 검증한다. `/data/knowledge-v1.json`은 공개 기록에 닫힌 관계·서지·구조화 데이터·승인된 언어/미디어만 포함한다. 기존 `/data/mobile-index.json` v1은 호환을 위해 유지한다. 승인·보류 뒤 재생성된 catalog와 release의 콘텐츠 해시가 일치해야 한다.

## 계정과 공동 작업

가입·로그인·비밀번호 변경은 세션을 회전한다. 비밀번호 원문을 정규화하거나 앞뒤 공백을 제거하지 않는다. 재설정은 실제 전달 어댑터가 켜진 환경에서 짧은 기한·일회용 토큰으로 동작한다. 비밀번호 변경/재설정은 이전 세션을 폐기한다. 계정 삭제는 현재 비밀번호를 확인하고 공동 공간 소유권 이전을 요구한다.

보관함 PUT은 `{ version, payload: { bookmarks, notes } }`이고 개인 연구의 POST/PUT은 검증 가능한 workspace payload와 현재 version을 사용한다. stale write는 409이며 브라우저에서 선택하기 전 덮어쓰지 않는다. 수업/연구 공동 공간의 owner/editor/viewer 역할은 전역 관리자 역할과 별개다. 초대는 기한과 사용 횟수를 제한하고 소유권 이전은 서버에서 확인한다. 제출물은 본인과 수업 관리 역할만 열람하며 피드백은 해당 제출 버전에 결합한다.

## 편집과 정정

CMS 변경에는 현재 version을 보낸다. 승인에는 최신 contentHash를 함께 보내고 작성자와 다른 검수자가 수행한다. 수정·복구하면 기존 승인은 무효가 된다. publish는 별도 서명 설정과 승인된 정확한 버전이 필요하며 worker가 실행 시 다시 확인한다. 공개된 버전과 초안의 수정은 분리한다. withhold는 즉시 공개 API에서 제거하고 보류 ID를 다음 서명 파일에 포함한다.

정정 접수는 recordId/category/proposal/consent와 선택적 evidenceUrl/contactEmail을 받는다. 서버가 만든 receiptId를 보관한다. 익명 번호 조회는 처리 상태만 반환하며 본문과 이메일은 공개하지 않는다. 검수자가 상태를 변경하고 감사 로그를 남긴다.

## 결제·AI·외부 전달

상품 금액·통화는 서버 설정에서만 읽는다. orderId, 공급자 checkout sessionId, refundId를 구분한다. checkout/환불 요청은 안정적인 idempotencyKey를 사용한다. checkout 복귀 URL은 결제 성공의 증거가 아니다. raw webhook은 서명·타임스탬프·live/test 모드·공급자 서버 조회·금액/통화를 확인하고 중복 및 역순 이벤트를 처리한다. 미확정 외부 결과는 성공으로 바꾸지 않고 공급자 조회/웹훅/운영 복구 대상에 남긴다.

AI는 로그인·허용 역할·평가 gate를 확인하고 공개 recordIds 1~8개와 question을 받는다. 인용이 실제 선택 기록의 sectionId에 속하는지 다시 검사한다. 공급자의 답변이 역사적으로 정확하다는 의미는 아니다. `store: false`, 출력 토큰 상한, 타임아웃, 사용자별 요청 제한을 사용하며 개인 연구 메모와 비공개 CMS 초안을 전송하지 않는다.

알림 전달은 허용한 HTTPS 공급자 host와 검증된 공개 IP에만 연결하고 타임아웃·서명·멱등성을 사용한다. reset 전달 payload는 outbox에 처리 상태와 함께 저장하며 운영 DB 접근 권한과 보관 기간을 엄격히 관리한다.
