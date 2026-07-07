# pricepick-demo · Flutter (Demo V1)

PricePick 서비스의 Flutter 참조 구현. 개발자 인계용 레퍼런스 소스이며, 데이터는 목업이 아니라
같은 저장소의 `../app` (웹 데모)와 **동일한 Firebase 프로젝트(`pricepick-demo`)**를 실시간으로 공유한다.
CMS에서 세팅한 회원·티켓·포인트가 이 앱에도 그대로 보인다.

## 구조

```
flutter/
  lib/
    main.dart              # Firebase 초기화 + 앱 실행
    app.dart                # MaterialApp, 라우트 테이블
    theme/app_theme.dart    # 라이트 전용 테마 (화이트 + 소프트블루/파스텔, 다크모드 없음)
    services/
      pricepick_repository.dart  # Firestore/Auth 접근 계층 (스키마 매핑은 이 파일에만 있음)
    screens/
      splash_screen.dart    # 익명 로그인 → users/{uid} 존재 여부로 가입/홈 분기
      signup_screen.dart    # 카카오(스텁)/게스트 가입
      home_screen.dart      # 티켓 현황 + 포인트 잔액 (허브)
      purchase_screen.dart  # 경유구매 — 제휴몰 목록 + 구매 시뮬
      ticket_screen.dart    # 랜덤 가지급(pending) 티켓 → 등급 확정
      gifticon_screen.dart  # 기프티콘 목록 + 교환
  android/, ios/, web/      # flutter create 표준 플랫폼 폴더
  firebase.json, lib/firebase_options.dart  # flutterfire configure 산출물 (커밋 대상)
```

화면 ↔ 서비스 계층을 분리했다: 화면(`screens/`)은 UI만 다루고, Firestore 쿼리·필드명은
전부 `services/pricepick_repository.dart`에 모아둔다. 스키마가 바뀌면 이 파일만 고치면 된다.

## 실행법

```bash
cd flutter
flutter pub get

# 시뮬레이터/에뮬레이터
flutter run                      # 연결된 기기 자동 선택
flutter run -d chrome             # 웹(크롬)
flutter run -d <ios-sim-udid>     # iOS 시뮬레이터

# 빌드
flutter build web --release       # 웹 정적 산출물 → build/web/
flutter build apk --release       # 안드로이드 APK (Play 등록용은 appbundle)
flutter build ipa                 # iOS (배포는 Xcode/Transporter 필요)
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
- **인증 방식**: 익명 로그인(`signInAnonymously`)만 사용한다. 웹 데모(`../app`)와 동일한 패턴.
  - 카카오 로그인은 **UI 스텁**이다 (`signup_screen.dart`의 `_showKakaoStubNotice`). 실제 카카오 SDK 연동은
    카카오 개발자 앱 키 발급, 안드로이드 SHA-1 키 해시 등록, 실기기 테스트가 필요해 이 저장소 밖의
    작업(형님 개입 구간)이다. 개발자가 이어받을 때 이 부분을 실제 Kakao SDK + Firebase Custom Token 또는
    OIDC 연동으로 교체해야 한다.
- **Firestore 보안 규칙**: 저장소 루트의 `firestore.rules` 기준. 익명 사용자도 `isSignedIn()`을 통과하므로
  본인 소유 문서(`users/{uid}`, `user_tickets` 등 `user_id == uid`)는 읽고 쓸 수 있다.
  마스터 데이터(`affiliate_malls`, `gifticons` 등)는 로그인 사용자면 누구나 읽기 가능.
- **컬렉션 스키마 정본**: `../docs/schema-mapping.md` — 필드명이 헷갈리면 이 문서와 `pricepick_repository.dart`를 대조할 것.
  (`affiliate_malls.active`는 boolean, `gifticons.price`/`required_grade`/`required_count`처럼 화면에 보이는
  라벨과 실제 필드명이 다른 경우가 있으니 주의.)

## 핵심 정책 (반드시 준수)

- **티켓 적립**: 구매 1건 → 랜덤(가지급/`pending`) 티켓 1묶음 발급 → 포스트백 확정 시 Greedy 방식으로 등급 전환.
  - 골드: 100,000원당 1장, 실버: 50,000원당 1장, 브론즈: 5,000원당 1장.
  - 큰 단위(골드)부터 채우고 남는 금액을 순차로 실버·브론즈에 배분한다. **수량이 늘어나는 게 아니라 단가(금액 기준)로 등급이 정해진다.**
- **만료**: 이벤트 티켓(`grade: 'event'`) 100일, 등급 티켓(bronze/silver/gold) 1년.
- **기프티콘 교환**: 포인트가 아니라 **등급 티켓 수량**으로 교환한다 (`gifticons.required_grade` + `required_count`).
  예: 배민 10,000원권 = silver 11장. 포인트(`user_points.balance`)는 별도 자산이며 이번 단계 화면에서는 표시만 한다.
- **불변 원장**: `ticket_transactions`, `point_transactions`는 앱에서 update/delete 불가 (Firestore 규칙으로 강제).
  취소/환불은 반대 부호 신규 문서로 처리한다 — 절대 기존 문서를 고치지 않는다.

## 아직 안 된 것 / 다음 세션에서 이어갈 것

이번 단계(1단계)는 **프로젝트 생성 + Firebase 완전 세팅 + 코어 스파인 골격**까지만 진행했다.
아래는 의도적으로 비워둔 부분이다 (스텁 UI만 있고 실제 쓰기 로직 없음):

1. **경유구매 실동작**: `purchase_screen.dart`의 "구매 시뮬"은 다이얼로그만 띄운다.
   실제로는 `click_logs` 생성 → `postbacks` 매칭 → `click_postback_matches` → 구매 확정 시
   Greedy 로직으로 `user_tickets`(pending) 생성까지 이어져야 한다.
2. **티켓 등급 확정**: `ticket_screen.dart`의 "확정" 버튼은 스텁이다. pending 티켓 묶음을
   Greedy 규칙으로 실제 등급 티켓(`user_tickets` status: active)으로 전환하고
   `ticket_transactions`(불변 원장)에 `earn` 기록을 남기는 로직이 필요하다.
3. **기프티콘 교환 실동작**: `gifticon_screen.dart`의 교환은 스텁이다. 실제로는 보유 등급 티켓 차감
   (`user_tickets` 상태 변경 또는 소모 처리) + `gifticon_stock.remaining` 차감 +
   `gifticon_exchanges` 문서 생성이 하나의 트랜잭션으로 묶여야 한다 (동시성 주의).
4. **카카오 로그인 실연동**: 위 "Firebase 연동" 절 참고. 안드로이드 실기기 + SHA-1 + 카카오 앱 키 필요.
5. **웹/안드로이드 배포 파이프라인**: 웹은 `pricepick-demo.vercel.app/flutter`로 정적 배포(저장소 루트
   README 참고). 안드로이드는 Play 등록용 서명·appbundle 빌드가 아직 없다.
6. 나머지 전체 화면(응모/이벤트, 공지, 문의, 초대 등 `docs/schema-mapping.md`의 F·G 그룹)은
   코어 스파인에 포함하지 않았다 — 다음 세션에서 순차 이식 예정.

이 앱을 이어받는 개발자는 위 1~3번(핵심 코어 로직)부터 `pricepick_repository.dart`에
쓰기 메서드를 추가하는 방식으로 진행하면 된다. 화면 쪽은 이미 읽기 연동이 되어 있어
쓰기가 끝나면 `_load()`만 다시 타면 화면에 반영된다.
