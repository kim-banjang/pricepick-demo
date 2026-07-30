# pricepick-demo

PricePick 운영 로직 데모/개발자 인계용 저장소. 실서비스(LIVE, `pricepick-baee8`)와는
**완전히 별개의 Firebase 프로젝트(`pricepick-demo`)**를 쓴다 — 이 저장소를 아무리 건드려도
실서비스에는 영향이 없다.

## 저장소 구조

```
pricepick-demo/
  cms/        # CMS 데모(운영자용) — 단일 index.html, Firestore 직접 read/write로 운영 동작 시연
  app/        # 웹 앱 데모(사용자용, 기존 v8.2 프로토타입 + Firebase 연동 주입) — 단일 index.html
  flutter-web/# /flutter 경로로 서비스되는 Flutter 웹 빌드 산출물 (정적 파일, 빌드 단계 없음)
  scenario/   # 시나리오 뷰어
  scripts/    # Firestore 시드 스크립트 (seed-demo.js 등)
  docs/       # schema-mapping.md — Firestore 컬렉션 스키마 정본
  firestore.rules / firestore.indexes.json / firebase.json  # Firestore 배포 설정
  vercel.json # 정적 라우팅 (cms/app/scenario/flutter 경로 매핑)
```

전부 순수 정적 파일이라 빌드 단계가 없다. `flutter-web/`은 이미 만들어진 웹 빌드
산출물을 그대로 올려둔 것이다.

> Flutter 네이티브 앱 시도(`flutter/` 소스 + Android/iOS 자동배포 워크플로)는 2026-07-07~08에
> 진행됐다가 중단됐고, 2026-07-30에 저장소에서 제거했다. 다시 필요하면 커밋 `228101a` 이전
> 이력(`git show <해당커밋>:flutter/...`)에서 복구할 수 있다. 릴리즈 서명 키스토어는 원래부터
> git에 커밋되지 않았으므로 이력에 없다.

## Firebase

- 프로젝트: `pricepick-demo` (Firestore `asia-northeast3`)
- 데모 전부(cms/app/flutter-web) **같은 프로젝트, 같은 컬렉션**을 공유한다. CMS에서 만든
  회원·티켓·포인트가 웹 앱에 그대로 보이는 게 이 저장소의 핵심 목적이다.
- 스키마 정본: `docs/schema-mapping.md`
- 배포: `firebase deploy --only firestore:rules,firestore:indexes`
- 시드 재실행: `node scripts/seed-demo.js` (Admin SDK 인증은 `.adc.json`, git에 커밋되지 않음)

## 배포 (Vercel)

`pricepick-demo.vercel.app`에 정적 배포되어 있으며 경로별 라우팅은 `vercel.json` 참고:

| 경로 | 내용 |
|---|---|
| `/` , `/cms` | CMS 데모 |
| `/app` | 웹 앱 데모 |
| `/scenario` | 시나리오 뷰어 |
| `/flutter` | Flutter 웹 빌드 산출물 — `flutter-web/`에서 서비스 (`vercel.json` 리라이트) |

## 핵심 정책

- 티켓: 구매 1건 → 랜덤(가지급) 1묶음 → 확정 시 Greedy로 등급 전환
  (골드 100,000원당·실버 50,000원당·브론즈 5,000원당 1장, 큰 단위부터, 수량이 아니라 단가 기준)
- 이벤트 티켓 만료 100일, 등급 티켓 만료 1년
- 기프티콘 교환은 포인트가 아니라 등급 티켓 수량(`required_grade`/`required_count`) 기반
- `ticket_transactions`/`point_transactions`는 불변 원장 — update/delete 금지, 취소는 반대 부호 신규 문서

## 참고

- 스키마 정본: [`docs/schema-mapping.md`](docs/schema-mapping.md)
