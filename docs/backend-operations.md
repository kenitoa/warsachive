# API 운영·보안·복구

확장 버전 고도화에서 추가한 007–011·업무 범위·MFA·재인증·최신 보류/삭제/권한 원장 복구·파일/알림 서명 증거는 [refinement-operations.md](refinement-operations.md)를 함께 적용한다. 운영 환경에는 새 인증 키와 읽기 전용 지식 레지스트리 설정이 필요하다. 외부 AI 평가 절차는 [ai-operations.md](ai-operations.md)를 따른다.

## 구성과 실행

Node.js 22.22.3 이상을 사용한다. API는 추가 HTTP/ORM 라이브러리 없이 Node HTTP, crypto/scrypt, node:sqlite를 사용한다. 현재 규모에서는 모듈화한 단일 API와 durable worker를 유지하며 트래픽·DB 대기·큐 적체를 측정한 뒤 PostgreSQL/별도 큐로 이관한다. SQLite는 WAL·외래 키·busy timeout을 적용한다. node:sqlite의 실험적 경고와 단일 DB 운영 특성은 출시 때 확인한다.

`npm run dev:api`, `npm run worker`, `npm run admin:create -- <email> <name>`, `npm run content:import -- <absolute-json-path>`를 사용한다. API workspace 명령은 루트 `.env.api`를 선택적으로 읽는다. 루트 `start.cmd`는 기존 DB를 초기화하지 않고 세 프로세스를 띄운다. 기본 DB/export 경로는 실행한 cwd와 무관하게 저장소의 `api/data`다.

로컬 시작기는 현재 공개 파일에서 `source-checked`이며 사람 승인 전인 자료만 골라 `api/data/local-static-snapshot.json`을 준비한다. 이를 시작 시 수입하므로 제보와 서버 보관 기능을 바로 연결할 수 있다. 계정이나 승인 이력은 만들지 않으며 CMS 발행 자료와 보류 기록을 덮어쓰지 않는다. 별도 운영 환경에서는 `ARCHIVE_API_STATIC_IMPORT_FILE`에 신뢰하는 출처 대조 전용 로컬 snapshot을 명시하거나 관리자가 수입한다. 이 설정은 기본으로 꺼져 있으며 HTTP 요청으로 지정할 수 없다. 승인 자료가 섞인 전체 피드는 초기 수입에 사용하지 않는다.

로컬 시작기는 loopback 호스트와 설정된 API 포트로 상태 주소를 계산한다. 웹/API에 같은 호스트 이름을 사용하고 허용 origin에 실제 웹 주소를 포함해야 한다. API·worker·Next CLI를 직접 실행하며 종료 때 IPC로 정리를 요청한 뒤 최대15초를 기다린다. 그 뒤에도 종료하지 않은 실행기 소유 프로세스만 강제 종료한다. 운영 환경은 컨테이너·별도 서버 명령을 사용한다.

최초 관리자는 실제 이메일·이름·12자 이상 비밀번호로 생성한다. 비밀번호는 stdin 또는 일시적 `ARCHIVE_BOOTSTRAP_PASSWORD`로 전달하고 생성 후 해당 변수를 제거한다. 운영 seed 계정과 데모 주문은 생성하지 않는다. 이후 전역 역할은 관리자 계정으로 서버에서 부여한다. editor, reviewer, publisher를 분리하고 자기 초안을 승인할 수 없도록 유지한다.

## 환경 변수

`.env.example`은 이름만 제공한다. 실제 파일은 커밋하지 않는다.

| 변수 | 의미와 운영 조건 |
| --- | --- |
| NEXT_PUBLIC_API_URL | 공개 웹에서 접근하는 API 기본 주소. 브라우저에 공개되므로 비밀값 금지 |
| ARCHIVE_API_HOST / PORT | 바인딩; 로컬 127.0.0.1:4200, 컨테이너 내부 0.0.0.0 |
| ARCHIVE_API_DB_PATH / EXPORT_DIR | 영구 DB·승인 산출물 경로. 운영 bind/volume으로 보존 |
| ARCHIVE_API_PRIVATE_STORAGE_DIR | 비공개 근거 파일 경로. web/public/out/export와 분리; 컨테이너 /data/private |
| ARCHIVE_API_STATIC_IMPORT_FILE | 신뢰하는 출처 대조 전용 v1 snapshot의 로컬 경로. 기본 없음; CMS·보류 상태와 사람 승인을 바꾸지 않음 |
| ARCHIVE_API_ALLOWED_ORIGINS | 허용 origin 목록, 운영은 명시적 HTTPS |
| ARCHIVE_API_SESSION_SECRET | 32자 이상 비밀값. 운영 필수; 로컬 미설정 시 임시 값 |
| ARCHIVE_API_SECURE_COOKIES | 운영은 항상 Secure; HTTPS 역방향 프록시 필요 |
| ARCHIVE_API_PUBLIC_URL | 비밀번호/checkout 복귀용 공개 웹 주소 |
| ARCHIVE_API_INLINE_WORKER | API 내 worker. 별도 worker와 실행하면 false |
| ARCHIVE_PUBLICATION_SECRET | 32자 이상 별도 발행 서명 키; 미설정 시 새 CMS 발행 비활성 |
| ARCHIVE_APPROVED_EXPORT_FILE / PUBLICATION_VERIFY_SECRET | 빌드 전용 승인 파일 절대 경로·검증 키. 클라이언트 환경 변수로 바꾸지 않음 |
| ARCHIVE_NOTIFICATION_URL / SECRET / ALLOWED_HOSTS | 실제 HTTPS 전달 서비스·서명 키·명시적 host 제한 |
| ARCHIVE_PASSWORD_RESET_ENABLED | 알림 서비스가 실제 연결된 경우만 true |
| ARCHIVE_PRODUCTS_JSON | 실제 상품 id/title/정수 amountMinor/소문자 currency 배열. 기본 상품 없음 |
| STRIPE_SECRET_KEY / WEBHOOK_SECRET / API_VERSION | 공급자 키·서명 비밀값·계정과 맞는 고정 API 버전 |
| ARCHIVE_PAYMENT_LIVE_ENABLED | live 키 사용 승인 gate. 기본 false |
| OPENAI_API_KEY / ARCHIVE_AI_MODEL | 서버 전용 키·운영자가 확인한 모델 |
| ARCHIVE_AI_ENABLED / MAX_OUTPUT_TOKENS | 내부 보조 활성화·출력 상한(128~4096, 기본1200) |
| ARCHIVE_AI_EVALUATION_APPROVED | 실제 사실성·오답·인용·공격·비용 평가 뒤에만 공개 답변 활성 |
| ARCHIVE_AI_DAILY_REQUEST_LIMIT | UTC 기준 서비스 전체 일일 호출 상한(기본100). provider 호출 전 DB에 예약; 실패·미확정도 소모 |

## 마이그레이션과 데이터 유지

`api/migrations`의 순서별 SQL을 시작 시 트랜잭션으로 적용하고 checksum을 기록한다. 적용한 파일을 수정하면 시작을 거절한다. 기존 정적 원본과 브라우저 보관함은 API DB 생성과 독립적이다. 새 schema는 기존 공개 계약과 충돌하지 않으며 추가 변경은 새 마이그레이션으로 작성한다. 운영 컬럼 삭제·기록 초기화는 수행하지 않았다.

배포 전 온라인 백업을 만든다. `node --env-file-if-exists=.env.api --experimental-strip-types api/src/cli.ts backup <new-backup-path>`는 SQLite online backup과 quick_check를 수행하고 기존 파일을 덮어쓰지 않는다. 백업에 계정·메모·제보와 전달 작업이 포함되므로 비공개 저장소·접근 권한·보관 정책을 적용한다.

복구는 `node --env-file-if-exists=.env.api --experimental-strip-types api/src/cli.ts restore <backup-path> <new-db-path>`로 새 파일에 수행한다. 기존 DB를 덮어쓰지 않으며 무결성 확인과 필요한 forward migration을 적용한다. 검증한 뒤 서비스를 정지하고 DB 경로를 새 파일로 바꿔 재시작한다. 문제가 있으면 보존한 이전 DB/이전 호환 이미지로 되돌린다. 신규 schema에 구 버전 애플리케이션이 호환되는지 먼저 확인한다.

검수 첨부 파일까지 보관하려면 다음 bundle 명령을 사용한다. 단일 DB 백업에는 첨부 파일의 원본 바이트가 포함되지 않는다.

```bash
npm run db:backup-bundle --workspace @war-archive/api -- <new-backup-directory>
npm run db:restore-bundle --workspace @war-archive/api -- <backup-directory> <new-restore-directory>
```

bundle은 온라인 DB snapshot, snapshot에 연결된 PNG/JPEG/PDF, SHA-256 manifest를 함께 보관한다. 완료 manifest를 마지막에 쓰며, 복구 시 DB·첨부 관계·파일 hash·크기·일반 파일 여부를 검사한다. 손상·경로 조작·심볼릭 링크·기존 대상 덮어쓰기를 거절한다. 복구 결과의 새 DB와 private 경로를 모두 검증하고 서비스를 정지한 뒤 `ARCHIVE_API_DB_PATH`와 `ARCHIVE_API_PRIVATE_STORAGE_DIR`를 함께 전환한다. 원본 DB와 파일은 보존한다. 운영 백업은 별도 호스트에 접근 권한을 제한해 보관하고 실제 복구 훈련으로 확인한다.

## 컨테이너와 배포

`infrastructure/docker/Dockerfile.api`는 빌드/런타임을 분리하고 node 사용자로 실행한다. compose는 API/worker, 영구 `/data` volume, 읽기 전용 root FS, tmpfs, 권한 제거와 헬스 체크를 정의한다. `docker compose --env-file .env.api -f infrastructure/docker/compose.yml up -d --build` 전에 실제 값과 HTTPS 역방향 프록시를 준비한다. DB volume을 삭제하는 명령을 복구 절차에 사용하지 않는다.

compose는 production 모드, 컨테이너 API의 0.0.0.0:4200 바인딩과 DB/export/private의 `/data` 경로를 명시한다. 같은 환경 파일의 로컬 상대 경로나 빈 값이 영속 volume 경로를 바꾸지 않는다. 초기 snapshot은 컨테이너에서 기본 비활성이며 필요하면 운영자가 별도 읽기 전용 파일 mount와 경로 설정을 추가한다. root 이미지에는 src·마이그레이션·계약만 복사하며 중첩 환경 파일도 build context에서 제외한다.

CI의 Linux container job은 비루트 실행과 실제 컨테이너의 readiness를 검사하도록 정의했다. 이 세션의 로컬 자동 검증과 실제 CI 실행 결과는 별개다. 서버 호스팅 계정·TLS 도메인·배포 secrets가 제공되지 않아 운영 클라우드 배포는 수행하지 않았다. 공개 웹에 유료 서비스를 올리기 전에 해당 호스팅의 이용 조건과 적절한 운영 호스팅을 확인한다.

## 관측·장애 대응

requestId, operation, status, durationMs, errorCode를 구조화 로그로 기록한다. 비밀번호·세션 쿠키·질문·메모·개인정보 원문은 HTTP 로그에 남기지 않는다. 감사 로그는 사용자/작업/대상/결과/추적 ID를 유지한다. `/health/live`, `/health/ready`, 관리자 `/health/metrics`, CMS job 목록으로 상태를 확인한다.

worker는 DB에 작업·재시도·중복 키를 기록한다. 발행 시 최신 승인 hash를 재검증하고 stale 작업은 공개하지 않는다. 요청 종료는 HTTP를 정리하고 SQLite를 닫는다. 프로세스 내 속도 제한은 여러 API 인스턴스 사이에 공유되지 않으므로 수평 확장 전 gateway/공유 저장소 제한을 붙여야 한다. 실제 공급자 장애·DNS·역순 이벤트·결제 미확정 복구와 부하를 staging에서 확인한다.

AI는 UTC 일일 서비스 호출 한도를 DB 트랜잭션으로 예약한 후 공급자를 호출한다. 실패나 결과 미확정도 비용 예약을 사용하며 재시작해도 한도를 유지한다. 사용자별 호출 제한과 출력 토큰 한도를 함께 적용하고 질문 원문 없이 사용량을 집계한다. 실제 금액 예산은 선택한 공급자 가격과 사용량을 운영자가 대조해 설정한다.

## 현재 운영 gate

역사 전문가 승인·검수된 외국어·좌표·IIIF manifest·기관 협약은 임의로 생성하지 않았다. 외부 공급자 키가 없으면 실제 결제·알림·AI를 비활성으로 표시한다. source-checked 4건은 사람 검수 완료로 바뀌지 않았다. 실기기·보조 기술·Linux 호스팅·실 sandbox·실 API 답변 평가는 별도 출시 조건이다.

공급자 구현은 [Stripe 서버 확인](https://docs.stripe.com/checkout/fulfillment), [Webhook 관리](https://docs.stripe.com/events/manage-webhook-endpoints), [OpenAI 구조화 출력](https://developers.openai.com/api/docs/guides/structured-outputs), [Responses 저장 설정](https://developers.openai.com/api/docs/guides/migrate-to-responses)을 확인해 작성했다. 어댑터 주입 테스트는 실 공급자 증거를 대신하지 않는다.
