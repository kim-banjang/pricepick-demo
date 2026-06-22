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
| 앨리스 | 67,000원 | confirmed (D+7) | silver 1 + bronze 4 (greedy) |
| 밥 | 120,000원 | confirmed (D+0) | gold 1 + bronze 4 (greedy) |
| 데이브(게스트) | 15,000원 | pending (D+30) | bronze 3 pending |
| unmatched | 34,000원 | pending | 미매칭 |

### 자산 현황 (D그룹)
| 유저 | 포인트 잔액 | 티켓 |
|---|---|---|
| 앨리스 | 3,500P | silver 1 + bronze 4 active, event 2 active |
| 밥 | 1,200P | gold 1 + bronze 4 active |
| 캐롤 | 0P | bronze 0 expired |
| 데이브 | 100P | bronze 3 pending |
| 이브 | 0P | bronze 1 pending |

---

*Last updated: 2026-06-22*
*Firestore project: pricepick-demo (asia-northeast3)*
