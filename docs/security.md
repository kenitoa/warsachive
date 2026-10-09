# 보안 경계와 의존성 점검

2026-10-07 고도화에서 직원 업무별 scope, 암호화된 실제 TOTP, 민감 변경 재인증, 접근 종료 및 복구 원장 검증을 추가했다. 파일의 MIME/SHA 검사와 악성 파일 검사 결과를 구분하고, 새 범위 사용권에는 서명된 정상 검사 증빙을 요구한다. 실제 설정·키 분리·추가 마이그레이션과 외부 확인 한계는 [고도화 운영](refinement-operations.md)과 [검증 결과](refinement-verification.md)를 따른다.

## 적용한 경계

- 공개 원문은 자격증명·사설 호스트·내부 스킴·임의 포트를 거절합니다.
- 운영 링크 검사는 명시적 기관 호스트의 HTTPS만 허용하고 DNS 결과를 공개 IP로 제한합니다. 요청에는 검증한 IP를 고정합니다.
- 리다이렉트도 동일 정책으로 다시 검사하며 최대 3번까지 따라갑니다. 요청 타임아웃은 8초입니다.
- HEAD 미지원 405/501이면 제한된 Range GET으로 상태·헤더만 확인하고 본문을 취소합니다. 원문의 내용을 자동 사실 검증한 것으로 표현하지 않습니다.
- 공개 기록은 스키마·공개 상태·출처·주장별 연결을 검증합니다. malformed v2를 legacy로 낮춰서 공개하지 않습니다.
- JSON-LD는 `<`를 이스케이프합니다. 공개 경로와 파일 이름을 검증하고 폴더 외 경로를 읽지 않습니다.
- 모바일은 응답 버전·크기·사이트·공개 레코드를 검사하고 위험한 프로토타입 키·객체를 거절합니다.
- 손상된 저장 기록을 새 저장으로 덮어쓰지 않습니다. 모바일은 사용자 확인 후 기존 원문을 백업하고 새 보관함을 시작합니다.
- 액세스 토큰·NAS 비밀키·관리자 권한은 브라우저·모바일 저장소에 제공하지 않습니다.
- Vercel은 정적 파일을 제공하며 인증·관리자·비공개 파일은 별도 API의 서버 경계에서 처리합니다. [서버 운영·보안](backend-operations.md)과 [API 계약](api-contracts.md)을 따릅니다.

## 의존성 검사 결과

2026-10-08 최종 재검사 기준입니다. 웹/API 운영 의존성은 각각 0개, 전체 도구 트리는 28개(moderate 5, high 23)를 확인했습니다. 감사 데이터는 이후 바뀔 수 있으므로 배포 때 다시 확인합니다.

| 검사 | 결과 |
| --- | --- |
| `npm audit --omit=dev --workspace @war-archive/web` | 취약점 0 |
| `npm audit --omit=dev --workspace @war-archive/api` | 취약점 0 |
| 전체 `npm audit` | 28개: moderate 5, high 23, critical 0 |

`npm audit fix --ignore-scripts`로 현재 버전 범위 안의 패치를 반영했습니다. Next.js 16.4.0, Expo 55.0.31을 사용하며 React Native의 주요 버전은 유지합니다. 지원되는 ESLint 10과 TS/hooks/Next 플러그인을 사용합니다.

호환성 근거를 확인한 범위에서 두 전이 의존성만 scoped override했습니다.

- Xcode 프로젝트의 UUID 생성은 `uuid.v4()`만 사용합니다. xcode 아래 uuid 11.1.1을 적용하고 실제 프로젝트 ID 생성 API로 50개 고유 ID를 검증했습니다. 이는 iOS 실기기·서명 전체 검증과 다릅니다.
- Metro의 image-size 호출은 동기 buffer와 default export입니다. 패치된 2.0.4에도 해당 API가 유지되므로 Metro 아래에만 적용하고 실제 Metro `getAssetSize`로 PNG·SVG 디코딩을 검증했습니다. 문자열 파일 API가 변경된 2.x를 저장소 전체에 무조건 치환하지 않습니다.

## 미해결 원인

| 직접 원인 | 설치/최신 확인 | 경로와 영향 | 처리 |
| --- | --- | --- | --- |
| braces | 최신 3.0.3까지 해당 취약 범위 | micromatch → glob/Jest/Metro/Next lint. 깊은 패턴 입력으로 빌드 도구 자원 소모 | 공개 입력을 glob으로 전달하지 않음. 공급자 수정판 추적 |
| node-forge | 최신 1.4.0까지 해당 취약 범위 | Expo CLI 코드 서명 인증서 도구. RSA 서명 검사 | 공개 사이트에 포함되지 않는 CLI 경로. 서명/OTA 도입 전 별도 재검토 |
| sprintf-js | 최신 1.1.3까지 해당 취약 범위 | Jest/Babel → nyc/js-yaml/argparse 도구. 과도한 precision 입력 | 사용자 입력을 해당 도구 형식으로 전달하지 않음. 공급자 수정판 추적 |

전체 경고 수에는 위 원인의 상위 패키지가 반복 포함됩니다. 웹 운영 의존성 0이라는 결과가 모든 네이티브·빌드 도구에 위험이 없다는 뜻은 아닙니다. 강제 audit fix는 Expo 44, React Native 0.87, Next lint 14 등의 호환성 파괴 변경을 제안하므로 실행하지 않았습니다.

출처: [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), [image-size advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## 실제 운영에서 별도 확인

Vercel의 HTTPS와 `web/vercel.json` 응답 헤더는 실제 운영 응답에서 확인합니다. 저장소 권한과 브랜치 보호는 GitHub 계정 설정을 확인해야 합니다. 별도 프록시/서버를 도입하면 CSP·보안 헤더·로그·권한·CSRF·속도 제한을 해당 배포 경계에서 검증합니다. 비공개 초안과 사용자 제보를 공개 Git 저장소에 보관하지 않습니다.
