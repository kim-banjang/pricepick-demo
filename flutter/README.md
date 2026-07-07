# pricepick-demo · Flutter (Demo V1)

PricePick 서비스의 Flutter 참조 구현. 개발자 인계용 레퍼런스 소스이며, 데이터는 목업이 아니라
같은 저장소의 `../app` (웹 데모)와 **동일한 Firebase 프로젝트(`pricepick-demo`)**를 실시간으로 공유한다.
CMS에서 세팅한 회원·티켓·포인트가 이 앱에도 그대로 보이고, 이 앱에서 발생시킨 구매·교환도 CMS에 그대로 보인다.

⚠️ **이 데모의 배포 목표는 웹(`pricepick-demo.vercel.app/flutter`)이다.** 안드로이드 Play 등록용
서명 빌드·keystore, iOS 실기기 배포는 이 저장소 범위 밖(프로덕션 이관 시 개발자가 별도로 준비)이며,
카카오도 실 SDK 연동 없이 시뮬 로그인으로 대체돼 있다. 아래 "실행법"의 apk/ipa 빌드 항목은
소스가 표준 Flutter 프로젝트라 기술적으로 가능하다는 것만 보여주는 참고용이지, 이 세션에서 준비하거나
검증한 배포 경로가 아니다.

## 구조

```
flutter/
  lib/
    main.dart              # Firebase 초기화 + 앱 실행
    app.dart                # MaterialApp, 라우트 테이블
    theme/app_theme.dart    # 라이트 전용 테마 (화이트 + 소프트블루/파스텔, 다크모드 없음)
    models/
      pending_bundle.dart   # 확정 대기 중인 가지급 티켓 묶음(postback 단위) 뷰 모델
    services/
      pricepick_repository.dart  # Firestore/Auth 접근 계층 — 스키마·쿼리·쓰기 트랜잭션이 전부 이 파일에 모여 있다
      ticket_policy.dart    # Greedy 등급 전환 계산 + 만료 정책 상수 (순수 함수, 테스트하기 쉽게 분리)
    screens/
      splash_screen.dart    # 익명 로그인 → users/{uid} 존재 여부로 가입/홈 분기
      signup_screen.dart    # 카카오(시뮬 로그인)/게스트 가입
      home_screen.dart      # 티켓 현황 + 포인트 잔액 (허브 — 나머지 화면 진입점)
      purchase_screen.dart  # 경유구매 — 제휴몰 목록 + 구매 시뮬(금액 입력) → 실제 Firestore 기록
      ticket_screen.dart    # pending 묶음(postback 단위) 목록 → 확정 시 Greedy 트랜잭션
      gifticon_screen.dart  # 기프티콘 목록 + 재고 표시 + 교환 트랜잭션
      my_screen.dart        # 마이 — 프로필 + 공지/문의/이벤트/응모 진입 메뉴
      notice_screen.dart    # 공지사항 (notices 읽기)
      inquiry_screen.dart   # 문의 (inquiries 읽기 + 작성)
      event_screen.dart     # 이벤트 (events 읽기, 현재 시드 비어 있어 빈 상태)
      raffle_screen.dart    # 응모 (raffles 읽기, 참여는 스텁)
  android/, ios/, web/      # flutter create 표준 플랫폼 폴더
  firebase.json, lib/firebase_options.dart  # flutterfire configure 산출물 (커밋 대상)
```

화면 ↔ 서비스 계층을 분리했다: 화면(`screens/`)은 UI만 다루고, Firestore 쿼리·필드명·트랜잭션 로직은
전부 `services/pricepick_repository.dart`에 모아둔다. 스키마가 바뀌면 이 파일만 고치면 된다.

## 실행법

```bash
cd flutter
flutter pub get

# 웹 (배포 목표 플랫폼)
flutter run -d chrome                                # 로컬 확인
flutter build web --release --base-href /flutter/    # 정적 산출물 → build/web/ (배포 절차는 저장소 루트 README 참고)

# 참고용 — 이 세션에서 준비/검증하지 않은 경로 (시뮬레이터 확인 정도만 했음)
flutter run -d <ios-sim-udid>     # iOS 시뮬레이터
flutter build apk --release       # 안드로이드 APK — Play 등록용 서명은 별도 준비 필요, 이 저장소 범위 밖
flutter build ipa                 # iOS — 실기기 배포는 Xcode/Transporter 필요, 이 저장소 범위 밖
```

## Firebase (pricepick-demo) 연동

- **Firebase 프로젝트**: `pricepick-demo` (Firestore 리전 `asia-northeast3`). CMS 데모·웹 데모(`../app`)와 완전히 동일한 프로젝트/데이터를 그대로 읽고 쓴다. 별도 프로젝트를 새로 만들지 않는다.
- **패키지**: `firebase_core`, `cloud_firestore`, `firebase_auth`.
- **설정 파일** (모두 `flutterfire configure --project=pricepick-demo`로 생성, 커밋되어 있음):
  - `lib/firebase_options.dart` — android/ios/web 3개 플랫폼 옵션 포함.
  - `android/app/google-services.json`
  - `ios/Runner/GoogleService-Info.plist`
  - `firebase.json` (repo 루트의 firebase.json과는 별개 — FlutterFire CLI가 관리하는 앱-플랫폼 매핑 파일)
- **재설정이 필요할 때**(예: 앱을 새 Firebase 프로젝트로 옮기거나 플랫폼 앱을 재등록해야 할 때):
  ```bash
  dart pub global activate flutterfire_cli
  export PATH="$PATH":"$HOME/.pub-cache/bin"
  flutterfire configure --project=pricepick-demo --platforms=android,ios,web
  ```
  iOS는 Xcode 프로젝트를 조작하기 위해 `xcodeproj` Ruby gem이 필요하다 (`gem install xcodeproj`).
- **인증 방식**: Firebase Auth는 익명 로그인(`signInAnonymously`) 하나만 쓴다 — 이건 항상 실제로 붙어 있다
  (웹 데모 `../app`와 동일 패턴). 그 위에 앱 레벨로 "누구 데이터를 보여줄지"를 결정하는
  `PricePickRepository.activeUserId` 개념을 얹었다:
  - **게스트로 시작하기**: `activeUserId == 실제 Firebase Auth uid`. 기존과 동일.
  - **카카오로 시작하기(시뮬 로그인)**: 실제 Kakao SDK 인증은 전혀 타지 않는다. `users` 컬렉션에서
    `linked_kakao == true`인 CMS 세팅 회원 목록을 보여주고, 하나를 고르면
    `PricePickRepository.enterAsPersona(그 회원의 문서 ID)`로 `activeUserId`만 그 값으로 바꾼다
    (`signup_screen.dart`). 실제 Firebase Auth 세션은 그대로 익명 계정이다 — CMS에 이미 있는
    회원의 티켓·포인트·문의내역을 "바로 로그인해서 보는" 경험만 흉내낸 것.
  - 마이 화면에 "시뮬 로그인 종료" 메뉴가 있어 다시 시작 화면으로 돌아갈 수 있다. 이 상태는
    메모리에만 있어 새로고침하면 사라진다(다시 게스트 흐름으로 돌아감).
  - 카카오 실 SDK 연동(앱 키, 안드로이드 SHA-1, 번들ID)은 **의도적으로 하지 않았다** — 이 데모의
    배포 목표가 웹 시연이라 실기기·서명 종속적인 작업은 범위 밖이다.
- **Firestore 보안 규칙**: 저장소 루트의 `firestore.rules` 기준. 원래는 "본인 uid == 문서의 user_id"만
  읽고 쓸 수 있는 구조였는데, 위 시뮬 로그인 때문에 실제 Firebase Auth uid와 화면이 보여주는
  `activeUserId`가 다를 수 있어 아래 컬렉션들의 **uid 일치 검사를 데모 한정으로 뺐다**
  (모두 "로그인은 돼 있어야 함" `isSignedIn()`만 요구):
  - `users`, `user_points`, `user_tickets`, `postbacks`, `ticket_transactions`, `gifticon_exchanges`,
    `inquiries` — read 전체, 그리고 `user_tickets`/`postbacks`/`ticket_transactions`/`gifticon_exchanges`는
    create/update까지.
  - `gifticon_stock`은 `remaining`을 **정확히 1만** 감소시키는 조건부 `update`만 열어뒀다(재고 음수 방지,
    다른 필드/임의값 변경은 여전히 admin 전용) — 이 데모에 재고 차감을 대신 처리할 Cloud Functions가 없기 때문.
  - ⚠️ **이건 실서비스에 절대 그대로 가져가면 안 된다.** 지금은 어떤 로그인 세션이든 다른 사람 명의로
    구매·티켓·문의를 만들 수 있는 상태다. 실제 서비스로 이관할 때는 uid 일치 검사를 되돌리고,
    시뮬 로그인 대신 진짜 Kakao SDK + Firebase Custom Token/OIDC로 교체해야 한다.
- **컬렉션 스키마 정본**: `../docs/schema-mapping.md` — 필드명이 헷갈리면 이 문서와 `pricepick_repository.dart`를 대조할 것.
  (`affiliate_malls.active`는 boolean, `gifticons.price`/`required_grade`/`required_count`처럼 화면에 보이는
  라벨과 실제 필드명이 다른 경우가 있으니 주의. CMS에서 수기로 추가한 문서 중 일부는 `price`나
  `gifticon_stock` 없이 등록돼 있을 수 있다 — 화면은 이런 누락 필드를 `-`/품절로 안전하게 처리한다.)

## 핵심 정책 (실제 구현됨)

- **티켓 적립 흐름**: 경유구매(`purchase_screen.dart`) → `click_logs` + `postbacks`(status: `pending`) +
  `click_postback_matches` 실제 기록 → 랜덤(가지급) 티켓 1~3장을 `user_tickets`(status: `pending`)로 발급.
  → 티켓 화면(`ticket_screen.dart`)에서 "확정" → `PricePickRepository.confirmBundle`이 postback의
  실제 `purchase_amount`로 Greedy를 재계산해 pending 문서를 active로 전환(부족하면 신규 생성, 남으면
  `expired` 처리)하고 `ticket_transactions`(`earn`)를 기록, `postbacks.status`를 `confirmed`로 변경.
  - Greedy 공식(`services/ticket_policy.dart`): 골드 100,000원당·실버 50,000원당·브론즈 5,000원당 1장,
    큰 단위(골드)부터 채우고 남는 금액을 순차 배분한다. **수량이 아니라 단가(금액 기준)로 등급이 정해진다.**
- **만료**: 등급 티켓(bronze/silver/gold) 확정일로부터 1년(`gradeTicketValidity`). 이벤트 티켓(100일,
  `eventTicketValidity`)은 상수만 정의해뒀고, 이벤트 티켓을 발급하는 소스(응모/초대 등)는 아직 없다.
- **기프티콘 교환**(`gifticon_screen.dart` → `PricePickRepository.exchangeGifticon`): 포인트가 아니라
  **등급 티켓 수량**으로 교환한다(`gifticons.required_grade` + `required_count`). 트랜잭션 하나로
  active 티켓 N장을 `used` 처리 + `gifticon_stock.remaining` -1 + `gifticon_exchanges` 기록 +
  `ticket_transactions`(`use`)를 남긴다. 포인트(`user_points.balance`)는 별도 자산이며 화면에는 표시만 한다.
- **불변 원장**: `ticket_transactions`, `point_transactions`는 앱에서 update/delete 불가 (Firestore 규칙으로 강제).
  취소/환불은 반대 부호 신규 문서로 처리한다 — 절대 기존 문서를 고치지 않는다.

## 이 저장소 범위 밖 (의도적으로 안 함)

- **카카오 실 SDK 연동** — 앱 키 발급, 안드로이드 SHA-1 등록, 실기기 테스트가 필요해 웹 데모 목적과
  맞지 않는다. 위 시뮬 로그인으로 대체.
- **안드로이드 Play 등록용 서명 빌드(keystore/AAB)**, **iOS 실기기 배포** — 프로덕션 이관 시 개발자가
  준비할 몫.

## 아직 안 된 것 / 다음 세션에서 이어갈 것 (전부 웹 기준)

1. **응모 참여 실동작**: `raffle_screen.dart`의 "응모하기"는 스낵바만 띄운다. `raffle_entries` 기록
   로직이 필요하다 (규칙은 이미 `create: if isSignedIn()`로 열려 있음). 현재 `raffles` 시드가 비어 있어
   먼저 CMS/시드 쪽에 데이터가 필요하다.
2. **이벤트 상세/참여**: `event_screen.dart`는 목록만 있다. `events` 시드가 비어 있어 실제 화면 확인은
   데이터가 채워진 뒤에 가능하다.
3. **알림(notifications), 활동내역, 초대(invites), 출석체크(daily_visits), 응모용 룰렛** 등
   `docs/schema-mapping.md`의 나머지 화면은 아직 이식하지 않았다.
4. `user_points.balance`를 실제로 증감시키는 로직(예: 브론즈 티켓 포인트 환전)은 아직 없다 — 현재는
   가입 시 0으로 초기화만 되고 화면에는 표시만 한다.
5. 시뮬 로그인 대상(`linked_kakao == true`)이 CMS 시드에 아직 1명뿐이면 피커가 단조로울 수 있다 —
   여러 연동 회원 시드를 늘려두면 데모가 더 풍성해진다.

이 앱을 이어받는 개발자는 `pricepick_repository.dart`의 기존 트랜잭션 메서드(`simulatePurchase`,
`confirmBundle`, `exchangeGifticon`)를 참고 패턴 삼아 나머지 쓰기 로직을 추가하면 된다.
실서비스로 이관할 때는 "Firestore 보안 규칙" 절의 데모용 완화 사항을 반드시 원복하고 진짜 인증으로 교체할 것.
