# pump · 쇼츠플로우

상품 소개 쇼츠를 만드는 크리에이터를 위한 콘텐츠 기획·대본·게시 일정·성과 관리 웹앱입니다.

**사이트:** https://shorts-flow-studio.fjqmdudrud.workers.dev  
**제작 가이드:** https://shorts-flow-studio.fjqmdudrud.workers.dev/learn.html

## 기능

- Google 로그인과 계정별 작업 공간
- 저장 콘텐츠 10개까지 무료, 11번째부터 구독 권한 확인
- 월 9,900원 Toss Payments **테스트** 구독과 해지·결제 재확인
- 콘텐츠 제작 단계, 게시 일정, 직접 입력한 성과, CSV 내보내기
- 공개 제작 가이드와 AdSense 연동 준비

실결제와 자동 청구는 비활성입니다. 광고는 사이트 승인 대기 상태로 송출하지 않습니다. 유튜브 자동 게시와 클릭·수익 자동 수집은 제공하지 않습니다.

## 개발과 검증

Node.js 24 이상을 사용합니다. 테스트는 내장 SQLite를 사용합니다.

```sh
npm ci
npm test
npm run build
```

빌드는 `dist/worker.mjs`를 생성하며 HTML·CSS·브라우저 스크립트를 Worker에 포함합니다. `node_modules`, 빌드 결과, 생성된 assets 파일, 비밀값과 로컬 데이터베이스는 Git에 포함하지 않습니다.

## 배포

Cloudflare Worker `shorts-flow-studio`와 D1 `DB` 바인딩을 사용합니다. `wrangler.jsonc`에는 현재 배포 대상과 공개 Supabase 설정만 들어 있습니다. 다른 계정에 배포할 때는 자신의 D1 ID와 Supabase 프로젝트로 변경하세요.

필요한 런타임 값은 다음과 같습니다.

| 값 | 저장 위치 |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | 공개 런타임 설정 |
| `TOSS_CLIENT_KEY` | 테스트 클라이언트 키 런타임 설정 |
| `TOSS_SECRET_KEY` | Cloudflare Secret |
| `BILLING_ENCRYPTION_KEY` | Cloudflare Secret, 32바이트 난수의 64자리 hex |
| Google OAuth Client Secret | Supabase Google Provider 설정 |

Google Client Secret, Toss Secret, 암호화 키, Cloudflare API 토큰을 소스나 GitHub에 올리지 마세요. 로컬 비밀값은 무시되는 `.dev.vars` 파일에 저장할 수 있습니다.

기존 운영 D1에는 마이그레이션이 적용돼 있습니다. 새 환경에서만 `drizzle` SQL을 순서대로 적용하세요. 기존 테이블에 초기 마이그레이션을 다시 실행하지 마세요.

`BILLING_SCHEDULER_READY=false`, `ADSENSE_READY=false`를 기본으로 유지합니다. 자동 청구나 광고 활성화는 각 외부 연결과 승인을 확인한 뒤 별도로 진행합니다.

세부 운영 상태와 도메인 변경 절차는 [운영 안내](README.ko.md)를 참고하세요.
