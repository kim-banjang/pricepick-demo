# PricePick Demo — Firestore Schema Mapping
## v8.2 엔티티 ↔ Firestore 컬렉션 대응표

이 문서는 CMS 개발자 및 후속 세션을 위한 스키마 매핑 정본이다.
원본 정의서: https://pricepick.vercel.app/datamodel.html

---

## 컬렉션 구조 개요

| v8.2 엔티티 | Firestore 경로 | 문서 ID | 비고 |
|---|---|---|---|
| **A. 회원·인증·기기** | | | |
| User | `users/{userId}` | user_id (UUID) | |
| AuthProvider | `users/{userId}/auth_providers/{id}` | UUID | 서브컬렉션 |
| UserConsent | `users/{userId}/consents/{id}` | UUID | 서브컬렉션, append-only |
| Device | `users/{userId}/devices/{id}` | UUID | 서브컬렉션 |
| **B. 마스터 데이터** | | | |
| AffiliateMall | `affiliate_malls/{mallCode}` | mall_code (enum) | e.g. "coupang" |
| TicketGrade | `ticket_grades/{gradeCode}` | grade_code (enum) | "bronze"/"silver"/"gold" |
| GradeExchangeRule | `grade_exchange_rules/{id}` | UUID | 4건 고정 |
| **C. 경유보상 코어4** | | | |
| click_logs | `click_logs/{clickId}` | click_id (UUID) | |
| postbacks | `postbacks/{postbackId}` | postback_id (UUID) | |
| click_postback_matches | `click_postback_matches/{matchId}` | match_id (UUID) | |
| ticket_transactions | `ticket_transactions/{id}` | UUID | 불변 원장, delete금지 |
| **D. 유저자산 코어3** | | | |
| user_tickets | `user_tickets/{id}` | UUID | 유저 기준 쿼리 위해 flat |
| user_points | `user_points/{userId}` | user_id (UUID) | 1:1, balance 필드 |
| point_transactions | `point_transactions/{id}` | UUID | 불변 원장, delete금지 |
| **E. 기프티콘** | | | |
| Gifticon | `gifticons/{id}` | UUID | |
| GifticonStock | `gifticon_stock/{gifticonId}` | gifticon_id (UUID) | 1:1, Gifticon과 동일 ID |
| GifticonExchange | `gifticon_exchanges/{id}` | UUID | |
| **F. 응모·이벤트** | | | |
| Raffle | `raffles/{id}` | UUID | |
| RaffleEntry | `raffle_entries/{id}` | UUID | |
| WeeklyDraw | `weekly_draws/{id}` | UUID | |
| Invite | `invites/{id}` | UUID | |
| DailyVisit | `daily_visits/{id}` | UUID | |
| Banner | `banners/{id}` | UUID | |
| Event | `events/{id}` | UUID | |
| **G. 운영·시스템** | | | |
| Notice | `notices/{id}` | UUID | |
| Notification | `notifications/{id}` | UUID | |
| Inquiry | `inquiries/{id}` | UUID | |
| Withdrawal | `withdrawals/{id}` | UUID | |
| AdminAccount | `admin_accounts/{id}` | UUID | |

---

## 설계 결정 사항

### 서브컬렉션 vs flat 컬렉션

- **서브컬렉션 선택**: AuthProvider, UserConsent, Device → 항상 userId로만 접근, 상위 문서와 생명주기 동일
- **flat 컬렉션 선택**: user_tickets, ticket_transactions, point_transactions → CMS에서 전체 유저 대상 쿼리 필요 (status별, expires_at별 등). Firestore는 컬렉션 그룹 쿼리가 가능하지만 인덱스 관리가 복잡해지므로 flat 선택

### 문서 ID 규칙

- `affiliate_malls`: mall_code 값 자체를 ID로 사용 (coupang, 11st 등) → 앱에서 `doc('coupang')` 직접 참조 가능
- `ticket_grades`: grade_code 값 자체를 ID로 사용 (bronze, silver, gold)
- `user_points`: user_id를 문서 ID로 사용 → 1:1 관계, `doc(userId)` 직접 참조
- `gifticon_stock`: gifticon_id를 문서 ID로 사용 → 1:1 관계
- 나머지: UUID

### 불변 원장

`ticket_transactions`, `point_transactions`는 Firestore 보안규칙에서 `update/delete: if false` 강제.
CMS에서도 직접 수정 불가 — 취소/환불은 반대 부호 qty로 신규 문서 추가.

### 포인트 환율

10P = 1 KRW (고정). `user_points.balance`는 포인트 단위로 저장.
- bronze 티켓 1장 = 1,000P
- silver 티켓 1장 = 10,000P
- gold 티켓 1장 = 20,000P

---

## postbacks — 제휴사별 수신 필드

쿠팡과 링크프라이스는 포스트백 API 규격이 다르다. 한 컬렉션(`postbacks`)에 적재하되
`provider` 필드로 구분하고, 제휴사 원본 필드명을 그대로 보존한다.
CMS 「포스트백 로그」 화면도 이 구분에 따라 블록·컬럼을 완전히 분리한다.

| 필드 | 값 | 비고 |
|---|---|---|
| `provider` | `'coupang'` \| `'linkprice'` | 제휴사 구분 정본. 없으면 제휴사 고유 필드로 추론 |

### 쿠팡 — Coupang Partners Postback (2026-09-07 실측)

| 필드 | 예시 | 비고 |
|---|---|---|
| `afcode` | `'AF7751406'` | 프라이스픽 쿠팡 파트너스 계정 코드 |
| `subid` | `'androidTEST'` | 링크에 실어 보낸 값 — 적립 대상 회원 식별 |
| `os` | `'IOS'` / `'MWEB'` | 구매가 일어난 환경 |
| `adid` | `''` | 광고 식별자 |
| `subparam` | | 링크 서브 파라미터 (클릭 식별자 — 주문 식별자 아님, 2026-09-04 검토 결과) |
| `purchase_time` | `'1787889273'` | 유닉스 초 |
| `orderId` | `'4000123456789'` | 주문번호 |
| `purchase_cancel` | `'purchase'` \| `'cancel'` | 구매 / 취소 |
| `order_detail[]` | 배열 | 주문 내 상품 목록 |

`order_detail[]` 원소:

| 필드 | 비고 |
|---|---|
| `productid` | **구매** 포스트백의 상품번호 — 소문자 i |
| `productId` | **취소** 포스트백의 상품번호 — 대문자 I |
| `productName` | 상품명 |
| `payment` | 해당 상품의 결제 금액 |
| `quantity` | 수량 |

> ⚠ 상품번호 키가 구매/취소에서 다르다(`productid` / `productId`). 실제 수신 로그에서 확인됐다.
> 읽는 쪽은 반드시 양쪽을 모두 본다.

**취소 대사 정책 (김반장 확정 2026-09-07)**

1. 취소 포스트백의 `payment`는 **쓰지 않는다**. 그 값은 본상품 가격이라 회원이 실제 낸 돈과 다르다
   (구매 26,910원 → 취소 29,900원으로 들어온 사례가 있다).
2. 취소가 오면 `orderId`로 원 구매 기록을 찾고, 상품번호로 어느 상품인지 지정한다.
3. 환수 금액·수수료는 **원 구매 기록의 값**을 쓴다.
4. 부분 취소(상품 셋 중 하나만 취소)는 상품번호로 그 상품만 환수한다. 주문 전체를 취소로 잡지 않는다.

### 링크프라이스 — LinkPrice Affiliate Postback

출처: 해리 전달 「Postback Data: LinkPrice, Coupang」(Notion, 2026-08-27) · 마스터 정책서 v8.3.

| 필드 | 예시 | 비고 |
|---|---|---|
| `day` | `'20260827'` | 주문 날짜 YYYYMMDD |
| `time` | `'180056'` | 주문 시각 HHMMSS |
| `merchant_id` | `'clickbuy'` | 어느 제휴몰인지 — 적립률 판단 기준 |
| `order_code` | `'_bjlg0wo83_p_num1'` | 제휴몰이 준 주문 코드 |
| `product_code` | | 상품 코드 |
| `product_name` | | 상품 이름 |
| `category_code` | `''` | 카테고리 코드 |
| `item_count` | `1` | 수량 |
| `price` | `30000` | 구매 금액(원) — 적립 계산 기준 |
| `commision` | `300` | 수수료 금액(원). **철자가 `commission`이 아니다** — 원문 그대로 |
| `affiliate_user_id` | `'e5f037d0-…'` | 링크에 실어 보낸 회원 식별자 |
| `base_commission` | `'1%'` | 기본 수수료율 |
| `incentive_commission` | `'0%'` | 추가 수수료율 |
| `trlog_id` | `18000661263481` | 링크프라이스 거래 기록 번호 — 포스트백 건마다 다름 |
| `uniq_id` | `'6a8ffcc8e7662'` | 주문 묶음 키 — 같은 주문에서 온 포스트백은 같은 값 |
| `affiliate_id` | `'A100706012'` | 프라이스픽의 링크프라이스 계정 번호 |

**쿠팡과 다른 점**

- 한 주문에 상품이 여럿이면 **상품 수만큼 포스트백이 따로 온다**. `uniq_id`가 같은 건을 한 주문으로
  묶어 적립액을 한 번만 계산한다(건별 계산 시 잔돈 버림이 반복돼 회원이 손해 — 김반장 확정 2026-08-27).
- **취소 포스트백이 오지 않는다.** 조회 API를 매일 돌려 대사한다:
  `https://api.linkprice.com/affiliate/translist.php?a_id=A100706012&auth_key=***&yyyymmdd=YYYYMMDD`
  (`auth_key`는 이 문서에 싣지 않는다.)
- 수수료 **금액**이 직접 온다(`commision`). 쿠팡은 수수료가 오지 않아 적립률로 계산한다.
- 주문번호·상품 정보가 온다. 쿠팡의 구/신 규격 차이와 무관하게 링크프라이스는 상품 단위 수신이다.

---

## 보안 규칙 요약

| 컬렉션 | 일반 유저 | CMS 어드민 |
|---|---|---|
| users, 서브컬렉션 | 본인만 read | read/write |
| affiliate_malls, ticket_grades, grade_exchange_rules | 누구나 read | write |
| click_logs | create만 (본인) | read/write |
| postbacks, matches | 없음 | read/write |
| ticket_transactions, point_transactions | 본인 read, create 불가 | create only (delete 금지) |
| user_tickets | 본인 read | read/write |
| user_points | 본인 read | read/write |
| gifticons, gifticon_stock | 로그인 유저 read | write |
| gifticon_exchanges | 본인 read | read/write |
| raffles, weekly_draws, events, banners, notices | read (일부 누구나) | write |
| admin_accounts, withdrawals, notifications, inquiries | 제한적 | read/write |

어드민 판별: `request.auth.token.email == 'sgkim.mixit@gmail.com' && email_verified == true`

---

## 시드 데이터 현황

### 마스터 (B그룹)
- AffiliateMall: 1건 (coupang, active)
- TicketGrade: 3건 (bronze/silver/gold)
- GradeExchangeRule: 4건 (v8.2 정의 4가지 규칙 전부)

### 기프티콘 (E그룹)
- Gifticon: 3건 (스타벅스 4500/CU 3000/배민 10000)
- GifticonStock: 3건 (각 재고 현황)

### 유저 (A그룹)
| ID | 닉네임 | 상태 | link_status |
|---|---|---|---|
| user-linked-alice | 앨리스 | active | linked |
| user-linked-bob | 밥 | active | linked |
| user-linked-carol | 캐롤 | suspended | linked |
| user-guest-dave | 데이브(게스트) | active | guest |
| user-guest-eve | 이브(게스트) | active | guest |

### 구매 시나리오 (C그룹)
| 유저 | 구매액 | 상태 | 발급 티켓 |
|---|---|---|---|
| 앨리스 | 67,000원 | confirmed (쿠팡 D+7) | silver 1 + bronze 3 (greedy) |
| 밥 | 120,000원 | confirmed (D+0) | gold 1 + bronze 4 (greedy) |
| 데이브(게스트) | 15,000원 | pending (D+30) | bronze 3 pending |
| unmatched | 34,000원 | pending | 미매칭 |

### 자산 현황 (D그룹)
| 유저 | 포인트 잔액 | 티켓 |
|---|---|---|
| 앨리스 | 3,500P | silver 1 + bronze 3 active, event 2 active |
| 밥 | 1,200P | gold 1 + bronze 4 active |
| 캐롤 | 0P | bronze 0 expired |
| 데이브 | 100P | bronze 3 pending |
| 이브 | 0P | bronze 1 pending |

---

*Last updated: 2026-09-07*
*Firestore project: pricepick-demo (asia-northeast3)*
