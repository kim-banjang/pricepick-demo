# pricepick-demo · Flutter (Demo V1)

PricePick 서비스의 **네이티브 앱(안드로이드/iOS) 참조 구현**. 개발자가 그대로 이어받아 개발할
레퍼런스 소스가 목적이다 — 기존 웹 PWA(`../app`)의 재탕이 아니다. 데이터는 목업이 아니라
같은 저장소의 `../app`(웹 데모)와 **동일한 Firebase 프로젝트(`pricepick-demo`)**를 실시간으로 공유한다.
CMS에서 세팅한 회원·티켓·포인트가 이 앱에도 그대로 보인다.

`flutter build web`으로 웹(`pricepick-demo.vercel.app/flutter`)에도 배포해 두었지만, 이건 형님이
브라우저로 빠르게 확인·공유하기 위한 **부수 효과**일 뿐 목표가 아니다. 코드는 항상
**네이티브 앱에서 정석대로 도는 것**을 기준으로 작성한다 — 웹에서만 되는 트릭이나 웹 전용 분기는
쓰지 않는다.

## 앱 아키텍처 원칙 — 노출(표시) 중심

이 앱은 **화면·라우팅·Firestore 읽기 위주의 단순한 표시 계층**이다. 티켓 적립 계산(랜덤→등급
Greedy 전환), 재고·보유수량 차감 같은 **비즈니스 계산 로직은 앱에 넣지 않는다** — 원래 백엔드
(Cloud Functions 등)가 처리해야 할 영역이고, 클라이언트가 그 계산을 떠맡으면 조작·정합성 문제가
생기기 때문이다.

- **앱이 하는 것**: Firestore에서 회원의 티켓·포인트·등급 등 결과 값을 읽어 화면에 노출 +
  구매/교환 같은 사용자 액션을 "일어났다"는 이벤트로 최소한만 기록.
- **앱이 하지 않는 것**: 등급 티켓 Greedy 계산, 재고 차감, 티켓 소진 처리, 포인트 환산 — 전부
  코드 안에 `TODO(백엔드)` 주석으로 명시해 뒀다 (`services/pricepick_repository.dart` 참고).
- **데모의 한계**: `pricepick-demo`엔 아직 Cloud Functions 같은 백엔드가 없어서, 지금까지 CMS/웹
  데모 쪽에서 이 계산을 임시로 클라이언트 코드로 흉내내 왔다. 이 Flutter 앱에서는 그 계산을
  재현하려 하지 않고, **CMS가 세팅해 둔 데이터를 그대로 읽어 보여주는 데** 집중했다.

## 구조

```
flutter/
  lib/
    main.dart              # Firebase 초기화 + 앱 실행
    app.dart                # MaterialApp, 라우트 테이블
    theme/app_theme.dart    # 라이트 전용 테마 (화이트 + 소프트블루/파스텔, 다크모드 없음)
    models/
      pending_bundle.dart   # 확정 대기 중인 가지급 티켓 묶음(postback 단위) 노출용 뷰 모델
    services/
      pricepick_repository.dart  # Firestore/Auth 접근 계층 — 스키마·쿼리가 전부 이 파일에 모여 있다.
                                  # 계산 없이 읽기 + 최소 액션 기록만 함. TODO(백엔드) 주석 참고.
    screens/
      splash_screen.dart    # 익명 로그인 → users/{uid} 존재 여부로 가입/홈 분기
      signup_screen.dart    # 카카오(시뮬 로그인)/게스트 가입
      home_screen.dart      # 티켓 현황 + 포인트 잔액 노출 (허브 — 나머지 화면 진입점)
      purchase_screen.dart  # 경유구매 — 제휴몰 목록 + 구매 이벤트 기록(금액 입력)
      ticket_screen.dart    # 확정 대기(pending) 묶음 노출 — 순수 읽기, 액션 버튼 없음
      gifticon_screen.dart  # 기프티콘 목록 + 재고 노출 + 교환 "요청" 기록
      my_screen.dart        # 마이 — 프로필 + 공지/문의/이벤트/응모 진입 메뉴
      notice_screen.dart    # 공지사항 (notices 읽기)
      inquiry_screen.dart   # 문의 (inquiries 읽기 + 작성)
      event_screen.dart     # 이벤트 (events 읽기, 현재 시드 비어 있어 빈 상태)
      raffle_screen.dart    # 응모 (raffles 읽기, 참여는 스텁)
  android/, ios/, web/      # flutter create 표준 플랫폼 폴더
  firebase.json, lib/firebase_options.dart  # flutterfire configure 산출물 (커밋 대상)
```

화면 ↔ 서비스 계층을 분리했다: 화면(`screens/`)은 UI만 다루고, Firestore 쿼리·필드명은
전부 `services/pricepick_repository.dart`에 모아둔다. 스키마가 바뀌면 이 파일만 고치면 된다.

## 실행법 (네이티브 우선)

```bash
cd flutter
flutter pub get

# 안드로이드 — 에뮬레이터/실기기
flutter run                          # 연결된 안드로이드 기기·에뮬레이터에 실행
flutter build apk --debug            # 스토어 서명 없이 폰에 바로 설치할 수 있는 디버그 APK
                                      # → build/app/outputs/flutter-apk/app-debug.apk

# iOS — 시뮬레이터
flutter run -d <ios-simulator-udid>   # xcrun simctl list devices 로 UDID 확인

# 웹 — 부수 효과(형님 확인용), 목표 아님
flutter run -d chrome
flutter build web --release --base-href /flutter/
```

디버그 APK(`app-debug.apk`)는 Android 표준 debug keystore로 자동 서명되므로 별도 키 생성 없이
`adb install app-debug.apk`로 실제 폰에 설치해 확인할 수 있다. **Play 스토어 등록용 릴리스
서명(keystore, AAB)과 iOS 실기기 배포(Apple 개발자 계정, 프로비저닝)는 이 저장소 범위 밖**이다 —
프로덕션 이관 시 개발자가 준비할 몫이고, 이 세션에서는 건드리지 않았다.

## Firebase (pricepick-demo) 연동

- **Firebase 프로젝트**: `pricepick-demo` (Firestore 리전 `asia-northeast3`). CMS 데모·웹 데모(`../app`)와 완전히 동일한 프로젝트/데이터를 그대로 읽는다. 별도 프로젝트를 새로 만들지 않는다.
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
- **인증 방식**: Firebase Auth는 익명 로그인(`signInAnonymously`) 하나만 쓴다. 그 위에 앱 레벨로
  "누구 데이터를 보여줄지"를 결정하는 `PricePickRepository.activeUserId` 개념을 얹었다:
  - **게스트로 시작하기**: `activeUserId == 실제 Firebase Auth uid`.
  - **카카오로 시작하기(시뮬 로그인)**: 실제 Kakao SDK 인증은 타지 않는다. `users` 컬렉션에서
    `linked_kakao == true`인 CMS 세팅 회원 목록을 보여주고, 하나를 고르면
    `PricePickRepository.enterAsPersona(그 회원의 문서 ID)`로 `activeUserId`만 그 값으로 바꾼다
    (`signup_screen.dart`). 실제 Firebase Auth 세션은 그대로 익명 계정이다 — CMS에 이미 있는
    회원의 티켓·포인트·문의내역을 "바로 로그인해서 보는" 경험만 흉내낸 것.
  - 마이 화면에 "시뮬 로그인 종료" 메뉴가 있어 다시 시작 화면으로 돌아갈 수 있다.
  - 카카오 실 SDK 연동(앱 키, 안드로이드 SHA-1, 번들ID)은 **의도적으로 하지 않았다** — 프로덕션·
    개발자 몫이라 이 저장소 범위 밖이다.
- **Firestore 보안 규칙**: 저장소 루트의 `firestore.rules` 기준. 앱은 계산·차감을 하지 않으므로
  대부분의 컬렉션은 "본인 uid == 문서의 user_id"만 쓸 수 있는 원래 구조를 그대로 유지한다.
  시뮬 로그인 때문에 실제 Firebase Auth uid와 화면이 보여주는 `activeUserId`가 달라질 수 있는
  지점만 최소한으로 완화했다:
  - **read 완화** (`isSignedIn()`만 요구, 다른 회원 데이터를 시뮬 로그인으로 조회하기 위함):
    `users`, `user_points`, `user_tickets`, `postbacks`, `gifticon_exchanges`, `inquiries`.
  - **create 완화** (persona 명의로 이벤트를 기록하기 위함): `postbacks`(구매 기록),
    `gifticon_exchanges`(교환 요청), `click_logs`/`click_postback_matches`/`inquiries`는
    원래부터 uid 검사가 없었다.
  - **그 외에는 전부 원래 규칙 그대로다**: `user_tickets`/`postbacks`의 update, `ticket_transactions`
    read/create, `gifticon_stock` write는 여전히 owner-uid 검증 또는 admin 전용이다 — 앱이 이
    컬렉션들에 계산 결과를 쓰지 않기 때문에 완화할 이유가 없다.
  - ⚠️ 그래도 read 완화·`postbacks`/`gifticon_exchanges` create 완화는 데모 한정 조치다. 실서비스
    이관 시 시뮬 로그인을 진짜 Kakao SDK + Firebase Custom Token/OIDC로 교체하고 이 완화도 되돌릴 것.
- **컬렉션 스키마 정본**: `../docs/schema-mapping.md` — 필드명이 헷갈리면 이 문서와 `pricepick_repository.dart`를 대조할 것.
  (`affiliate_malls.active`는 boolean, `gifticons.price`/`required_grade`/`required_count`처럼 화면에 보이는
  라벨과 실제 필드명이 다른 경우가 있으니 주의. CMS에서 수기로 추가한 문서 중 일부는 `price`나
  `gifticon_stock` 없이 등록돼 있을 수 있다 — 화면은 이런 누락 필드를 `-`/품절로 안전하게 처리한다.)

## 핵심 정책 (앱은 노출만, 계산은 백엔드 사양)

아래는 실제 서비스 정책이며, **이 앱은 계산하지 않고 결과만 표시한다.** 계산 자체는 백엔드가
구현해야 할 사양으로 남겨둔다 (해당 지점마다 `pricepick_repository.dart`에 `TODO(백엔드)` 주석 있음).

- **티켓 적립**: 구매 1건 → 랜덤(가지급) 1묶음 → 확정 시 Greedy로 등급 전환.
  - Greedy 공식: 골드 100,000원당·실버 50,000원당·브론즈 5,000원당 1장, 큰 단위(골드)부터 채우고
    남는 금액을 순차 배분한다. **수량이 아니라 단가(금액 기준)로 등급이 정해진다.**
  - 앱은 `PricePickRepository.recordPurchase`로 `postbacks`(status: `pending`)만 남긴다.
    이 postback을 트리거로 실제 등급 티켓을 계산해 `user_tickets`를 만드는 건 백엔드 몫 — TODO.
- **만료**: 이벤트 티켓 100일, 등급 티켓(bronze/silver/gold) 1년. 앱 코드에는 이 상수가 없다 —
  만료 처리 자체가 백엔드/배치 작업의 몫이기 때문.
- **기프티콘 교환**: 포인트가 아니라 **등급 티켓 수량**으로 교환한다(`gifticons.required_grade` +
  `required_count`). 앱은 `PricePickRepository.requestGifticonExchange`로 `gifticon_exchanges`
  (status: `requested`)만 남긴다. 실제 보유 티켓을 `used` 처리하고 `gifticon_stock.remaining`을
  차감하는 건 백엔드가 이 요청을 트리거로 처리해야 한다 — TODO.
- **불변 원장**: `ticket_transactions`, `point_transactions`는 update/delete 불가(Firestore 규칙으로
  강제). 앱은 이 컬렉션에 아예 쓰지 않는다 — earn/use 기록은 백엔드가 계산과 함께 남겨야 한다.

## 이 저장소 범위 밖 (의도적으로 안 함)

- **카카오 실 SDK 연동** — 앱 키 발급, 안드로이드 SHA-1 등록, 번들ID 설정. 위 시뮬 로그인으로 대체.
- **안드로이드 Play 등록용 서명 빌드(keystore/AAB)**, **iOS 실기기 배포(Apple 개발자 계정)** —
  프로덕션 이관 시 개발자가 준비할 몫.

## 아직 안 된 것 / 다음 세션에서 이어갈 것

1. **백엔드(Cloud Functions) 자체가 없다** — 이게 가장 큰 항목이다. `postbacks`/`gifticon_exchanges`
   생성을 트리거로 Greedy 등급 계산·티켓 생성·재고 차감을 수행하는 서버 로직이 필요하다. 이 앱은
   그 결과가 Firestore에 반영되면 자동으로 화면에 나타나도록 이미 읽기 연동이 되어 있다.
2. **응모 참여**: `raffle_screen.dart`의 "응모하기"는 스낵바만 띄운다. 참여 자체는 단순 기록(요청)이라
   앱에서 처리해도 되지만, 현재 `raffles` 시드가 비어 있어 먼저 CMS/시드 쪽에 데이터가 필요하다.
3. **이벤트 상세**: `event_screen.dart`는 목록만 있다. `events` 시드가 비어 있어 실제 화면 확인은
   데이터가 채워진 뒤에 가능하다.
4. **알림(notifications), 활동내역, 초대(invites), 출석체크(daily_visits), 응모용 룰렛** 등
   `docs/schema-mapping.md`의 나머지 화면은 아직 이식하지 않았다.
5. 시뮬 로그인 대상(`linked_kakao == true`)이 CMS 시드에 아직 1명뿐이면 피커가 단조로울 수 있다 —
   여러 연동 회원 시드를 늘려두면 데모가 더 풍성해진다.

이 앱을 이어받는 개발자는 `pricepick_repository.dart`의 `TODO(백엔드)` 주석이 달린 지점부터
Cloud Functions(또는 다른 백엔드)를 붙이면 된다. 화면 쪽은 이미 읽기 연동이 되어 있어 백엔드가
데이터를 만들어 넣으면 그대로 화면에 반영된다.
