# 데모와 STG가 달라진 지점

데모에서 기획을 다듬으며 STG와 달라진 지점을 기록한다. 개발 요청 여부는 김반장이 정한다.

STG 상태는 실제 CMS 소스(`inetkr/pricepick-cms` staging 브랜치)에서 확인한 것만 적는다. 확인 시점의 커밋을 함께 적는다.

| # | 화면 | 데모 | STG | 데모 커밋 · 날짜 |
|---|---|---|---|---|
| 1 | 랜덤 선물 상자 열기 설정 | 데모에서 「기본값 복원」 버튼을 지웠다. 되돌리는 값이 승인된 구성이 아니라 개발 중 코드에 넣어 둔 값이어서다. 「저장」 버튼은 그대로다. | STG는 「기본값 복원」 버튼이 있는 상태다(`src/sections/jackpot-roulette/jackpot-roulette-section.tsx:127`, 매일 선물 상자 화면에도 있다 `daily-lucky-roulette-section.tsx:120`). dc03dd2 기준 | 5a9f03f · 2026-11-05 |
| 2 | 알림 관리 → 알림 작성 · 발송 | 데모에서 발송 시점이 「즉시 발송」이면 날짜·시각 입력란을 칸째 숨기고, 「예약 발송」일 때만 보이게 했다. 예약에서 즉시로 되돌리면 입력했던 날짜를 비운다. | STG는 입력란이 늘 보이고, 즉시 발송일 때는 흐리게 잠기는 상태다(`disabled`). 입력했던 날짜는 그대로 남는다(`src/components/notification/notification-form-card.tsx:182–190`). dc03dd2 기준 | 206b0a9 · 2026-11-06 |
| 3 | 알림 관리 → 발송 기록 | 예약 건 액션: 데모는 「취소」만 둔다. | STG는 「테스트 발송」 단추가 함께 있다(`src/components/notification/notification-table.tsx:172`). dc03dd2 기준 | 4a33904 · 2026-11-06 |
| 4 | 알림 관리 → 발송 기록 (표 칸) | 데모는 「대상 수 · 성공 · 실패 · 미처리 · 확인 불가 · 열람률」 여섯 칸이다. 상태별 네 칸(성공·실패·미처리·확인 불가)의 합이 대상 수와 일치하도록 했다 — 미처리는 10-27(17fbbdf), 확인 불가는 11-04 수정 요청 A-13(대상 수와 상태별 합계 불일치, ad29bcd)으로 넣었다. | STG는 「대상 수 · 성공 · 실패 · 열람율」 네 칸이다(`src/components/notification/notification-table.tsx:106–109`). A-13은 아직 반영 전이다. 참고: STG 발송 내역에 대상 0명·성공 0명·실패 0명인데 상태가 「발송완료」인 행이 여러 건 있다(11/06 09:48, 10/14 등 — 화면 확인, 소스로는 확인 불가). 결과가 남지 않은 과거 건이며 데모 기준으로는 「확인 불가」에 해당한다. dc03dd2 기준 | 17fbbdf · ad29bcd |
| 5 | 알림 관리 → 발송 기록 (칸 이름 표기) | 데모는 「열람률」이다(맞춤법). | STG는 「열람율」이다(`notification-table.tsx:109`). dc03dd2 기준 | ea7db8d · 2026-11-06 |
| 6 | 탈퇴 처리 (앱 탈퇴 · 회원 데이터) — 닉네임 | 데모를 STG와 같게 바꿨다. 탈퇴해도 닉네임을 남긴다. 그전에는 탈퇴 때 닉네임을 지웠다(2026-07-10 f9fda92부터). 이미 닉네임이 지워진 탈퇴 회원 32명은 앱 가입 화면과 같은 방식(형용사+동물)으로 새 닉네임을 넣었다 — 원래 닉네임은 남아 있지 않아 되살리지 못했다. 카카오 닉네임·카카오 로그인 아이디(이메일)·카카오 회원번호는 지운다. 티켓·포인트는 그대로 둔다. | STG 백엔드 탈퇴(`src/services/crud/userService.ts` `deleteUser`·`kakaoInfoClearedFields`)는 닉네임을 지우지 않는 상태다. kakao_id·kakao_info(닉네임·이메일·연동 일시)만 비우고 티켓·포인트는 그대로 둔다. 참고: STG 앱 탈퇴 화면(`account_deletion_intro_page.dart:191`)과 STG CMS 탈퇴 정책 카드(`withdrawal-policy-card.tsx:26`)는 「닉네임」을 삭제 항목으로 적고 있어 STG 백엔드 동작과 다르다. 백엔드 6ebdad9 · CMS 50aee58 · 앱 d77d2f8 기준 | da5e938 · 2026-11-10 |
| 7 | 탈퇴 처리 — 로그인 아이디 | 데모를 STG와 같게 카카오 연동 회원은 로그인 아이디(username)를 `deleted_<회원id>`로 둔다. 연동 표시(linked_kakao)는 남기고, CMS 회원 목록·상세에서는 탈퇴 회원을 「게스트」로 보인다. | STG는 `kakao_`로 시작하는 username만 `deleted_<회원id>`로 바꾸고 login_type은 남기는 상태다(`userService.ts:1810`). STG CMS 회원 화면은 kakao_info가 있어야 「카카오 연동」으로 보이므로 탈퇴 회원은 「게스트」로 보인다(`member-table.tsx:69`, `member-modal.tsx:209`). 백엔드 6ebdad9 · CMS 50aee58 기준 | da5e938 · 2026-11-10 |
| 8 | 개인정보 처리방침 4-1) 보관 기간 | 데모·STG 어디에도 탈퇴 회원 정보를 30일 뒤에 지우는 기능이 없다. 데모 처리방침(앱·CMS 기본값, Firestore `terms/privacy`)의 「탈퇴일로부터 30일간 보관 후 파기」를 실제대로 「카카오 연동 정보 즉시 파기, 관계 법령 정보는 3)의 기간 보관」으로 고쳤다. | STG 백엔드는 탈퇴 회원 행을 지운 표시만 해 둔 채 계속 남기는 상태다. 일정 기간 뒤 지우는 예약 작업은 없다(`src/services/scheduleService.ts:39–60`). 백엔드 6ebdad9 기준 | 0d847bb · 2026-11-10 |
