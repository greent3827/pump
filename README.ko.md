# 쇼츠플로우 고객용 Google 로그인

고객용 사이트: https://shorts-flow-studio.fjqmdudrud.workers.dev

## 반영된 구성
- Cloudflare Worker: shorts-flow-studio
- D1: shorts-flow-customer (DB 바인딩)
- Supabase: shorts-flow-auth / 서울 리전
- Google OAuth: My Project 92512 / 쇼츠플로우 고객용 웹
- 요청 범위: openid, email, profile
- Google → Supabase 콜백: https://nrcxvmxuriqudksracdh.supabase.co/auth/v1/callback
- Supabase → 사이트 콜백: https://shorts-flow-studio.fjqmdudrud.workers.dev/auth/callback

## 검증
Google 로그인, 콘텐츠 보관함으로 복귀, 로그아웃 후 로그인 전 화면으로 초기화를 실제 브라우저에서 확인했습니다.
서버 인증, 계정별 데이터 격리, 출처 검사, 결제 및 화면 테스트 총 44개가 통과했습니다.
Worker 배포는 Cloudflare 대시보드의 shorts-flow-studio 활성 버전에서 확인할 수 있습니다.

## 현재 공개 범위
Google OAuth 앱을 외부 사용자 / 프로덕션 단계로 전환했습니다. 등록된 테스트 사용자 제한을 해제했습니다.
공개 개인정보처리방침: https://shorts-flow-studio.fjqmdudrud.workers.dev/privacy.html
운영자: 그린티38 / 공개 문의: lyk0307@naver.com

## 무료 한도와 구독
계정별 현재 저장 콘텐츠 10개까지 무료입니다. 11번째부터 구독 이용 기간이 필요합니다.
샘플 미리보기는 저장하지 않으므로 한도에 포함하지 않습니다. 샘플을 내 기획으로 저장하면 한도에 포함합니다.
삭제하면 무료 저장 공간이 다시 생깁니다. 월별 초기화나 누적 생성 횟수 기준이 아닙니다.
서버 SQL의 조건부 쓰기로 한도를 검사하며, 계정별 결제 기간을 서버에서 확인합니다.
구독 만료 후에도 기존 데이터의 조회·수정·삭제·CSV 내보내기를 유지하며, 10개를 초과하는 새 콘텐츠 추가를 차단합니다.
이미 해지했더라도 결제한 기간이 남아 있으면 그 기간까지 구독 권한을 유지합니다.
실제 브라우저에서 Google 프로덕션 상태, 무료 이용량, 구독 관리 진입과 개인정보처리방침 공개를 확인했습니다.
44개 자동화 테스트에서 10/11 경계, 동시 저장, 플래그·계정 우회, 결제 기간, 해지·만료, 샘플과 편집 흐름을 검증했습니다.

## 결제
사용자가 제공한 Toss 테스트 키를 Cloudflare 런타임에 설정했습니다. 비밀 키와 빌링 암호화 키는 소스에 포함하지 않았습니다.
월 9,900원 테스트 구독 UI와 API를 유지합니다. 실제 카드 등록과 결제는 실행하지 않았습니다.
BILLING_SCHEDULER_READY=false이며 자동 청구는 비활성입니다. 기존 shorts-flow-billing-test Worker도 비활성 상태를 유지했습니다.

## 소스 사용
Node.js 환경에서 npm ci, npm test, npm run build 순서로 실행합니다.
dist/worker.mjs를 Cloudflare Worker에 배포하며, wrangler.jsonc의 공개 구성과 D1 바인딩을 함께 적용합니다.
필요한 서버 비밀값: TOSS_SECRET_KEY, BILLING_ENCRYPTION_KEY. TOSS_CLIENT_KEY는 런타임 설정입니다.
Google OAuth Client Secret은 Supabase Google Provider에만 저장합니다.
스케줄러는 별도 명시적 활성화 전까지 연결하지 않습니다.

## 도메인 변경 시
도메인 구매 후 Cloudflare 사용자 지정 도메인을 연결하고, Supabase Site URL/Redirect URL 및 Google OAuth JavaScript Origin/홈페이지를 새 주소로 갱신합니다.
Supabase Google 콜백 주소는 Supabase 프로젝트가 동일한 한 유지됩니다.

기존 Sites 사이트는 그대로 보존했습니다. 확인 당시 콘텐츠와 구독/결제 기록은 모두 0건이었습니다.


## 광고 수익 연동 준비 (2026-11-17)
- AdSense 기존 계정의 쇼츠플로우 전용 광고 단위 생성: ShortsFlow_Free_Learn_Responsive
- 게시자 ID: ca-pub-3778484976179591 / 광고 단위 ID: 4865999546
- 공개 제작 가이드: /learn.html, 소유 확인용 /ads.txt 및 AdSense 계정 메타 태그 적용
- 작업 공간·편집기·로그인 화면에는 광고 스크립트를 넣지 않았습니다.
- 제작 가이드에서만, 한국 접속·비구독자·광고 표시 허용 조건을 모두 만족할 때 수동 반응형 광고를 요청합니다.
- 서버가 실제 구독 이용 기간을 확인하며, 계정 확인 실패나 광고 설정 조회 실패 시 광고를 표시하지 않습니다.
- 구독 기간 중 해지한 계정도 남은 이용 기간에는 광고를 표시하지 않습니다.
- 구독자 응답에는 광고 게시자/단위 정보도 반환하지 않습니다.
- AdSense 심사 전에는 ADSENSE_READY=false(미설정도 false)로 유지합니다. 현재 실제 광고 및 수익 발생은 시작되지 않았습니다.
- 유럽경제지역·영국·스위스 등 한국 이외 지역은 필요한 동의 관리 구성이 끝날 때까지 송출하지 않습니다.

## 남은 외부 단계
현재 workers.dev 주소는 AdSense 사이트 등록에서 독립 도메인 형식을 요구해 등록되지 않았습니다.
greent38.com은 기존 AdSense에 과거 기록이 있으나 Cloudflare가 현재 미등록으로 표시했고, 사용자는 현재 그 도메인을 사용하지 않는다고 밝혔습니다. 도메인 구매·이전·DNS 변경은 하지 않았습니다.
새 독립 도메인 확정·연결 후 AdSense 사이트 등록/소유 확인/심사를 진행합니다. 승인 준비됨 상태를 확인한 뒤 ADSENSE_READY를 true로 설정합니다.
Google OAuth와 Supabase의 홈페이지/허용 Origin/Redirect URL도 새 도메인에 맞춰 함께 갱신해야 합니다.
광고 계정 생성 및 송출 승인과 실제 수익은 별개입니다. 광고 단위를 만들었다고 새 사이트가 승인된 것은 아닙니다.
