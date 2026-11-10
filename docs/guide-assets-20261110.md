# 홈페이지 리뉴얼 — 가이드 일러스트 자산 정리 (2026-11-10)

**홈페이지에 바로 쓸 수 있는 것 16장 / 새로 만들어야 하는 것 4장** (히어로 1, 혜택 아이콘 3: 출석·친구초대·연속구매)

- 바로 쓸 수 있는 16장의 구성은 다음과 같다.
  - 투명 배경 오브젝트 6장
  - 티켓 아이콘 2장
  - 폰 화면 1장
  - 배경이 있는 장면 그림 7장
- 히어로처럼 크게 쓸 그림은 512px 오려 낸 본으로는 모자라다. 같은 그림의 2048px 원본이 남아 있으므로, 원본에서 다시 오리면 된다(4번 표).
- 그림 파일은 옮기거나 고치지 않았다. 아래 경로는 전부 지금 있는 자리다.

---

## 1. 어디에 어떤 형태로 들어가 있나

| 화면 | 파일 | 그림이 들어가는 방식 |
|---|---|---|
| 앱 데모 — 가이드 투어(홈 첫 진입 시 1회, 홈 상단 GUIDE 단추) | `pricepick-demo/app/index.html` | 별도 그림 파일을 경로로 불러온다(`/app/assets/guide/`). HTML 안에 그림 자료를 박아 넣은 것은 없다. 화살표·뱃지(「구매 확정」, 「10P = 티켓 1장」)·배경에 떠다니는 티켓·동전·반짝이는 코드로 그렸다. |
| 앱 데모 — 「쇼핑 가이드」 상세 화면(마이 → 쇼핑 가이드) | 같은 파일 | 투어와 같은 그림을 같은 경로로 쓴다. |
| 시안 원본 | `pricepick/design/guide-20261103.html` | `design/guide-art/` 폴더의 그림을 경로로 불러온다. |
| New Design 단독 페이지 | `pricepick/20261103_NewDesign_guide.html` | 위 시안과 같은 `design/guide-art/` 그림을 경로로 불러온다. |
| 통합 시안 뷰어 | `pricepick/NewDesign.html` | 그림이 직접 들어 있지 않다. 위 단독 페이지들을 띄워 보여 주는 화면이다. |

**지금 가이드에 실제로 보이는 그림 (7단계 흐름도)**

| 단계 | 화면 문구 | 쓰인 그림 |
|---|---|---|
| 1 | 프라이스픽을 먼저 열어요 | 앱 실행 화면(pricepick-splash.png). 폰 틀 없이 화면 그림만 쓴다. |
| 2 | 쓰던 쇼핑몰 그대로 들어가요 | 제휴몰 로고 5개. 그림이 아니라 코드로 만든 카드다. |
| 3 | 상품은 집으로, 티켓은 여기로 | o2.png 쇼핑백 |
| 4 | 아직은 랜덤 티켓이에요 | ticket-random.svg 빨간 티켓 |
| 5 | 확정되면 바로 쓸 수 있어요 | ticket-gold.svg 금색 티켓 3장 + 초록 체크 |
| 6 | 포인트도 티켓이 돼요 | o5.png 동전 더미 |
| 7 | 티켓으로 기프티콘을 바꿔요 | o6.png 바코드 상품권 + 커피컵 |

같은 폴더의 o1·o3·o4, 장면 그림 s1~s7, card-shell은 만들어 두었지만 지금 가이드에는 쓰지 않는다. 앞 단계 시안에서 쓰다가 교체한 것들이다(아래 3번 커밋 기록).

---

## 2. 그림 목록

원본 폴더는 `pricepick/design/guide-art/`다. 앱 데모의 `pricepick-demo/app/assets/guide/`에는 그중 쓰는 것만 같은 파일로 복사해 두었다(파일 지문 같음).

### 2-1. 투명 배경 오브젝트 (오려 낸 본)

| 파일 | 형식 · 크기 · 용량 | 무엇을 그린 것인가 | 가이드 어느 자리 | 배경 투명 | 떼어 쓰기 |
|---|---|---|---|---|---|
| o2.png | png 512×573, 260KB | 보라 쇼핑백에 베이지 택배 상자와 보라 병이 담긴 모습 | 3단계 「구매 완료」 | 투명 | 가능 |
| o5.png | png 512×337, 156KB | 노란 동전 더미(무늬 없는 동전 여러 개, 하나는 앞에 기대어 세움) | 6단계 「포인트」 | 투명 | 가능 |
| o6.png | png 512×286, 127KB | 흰 상품권 카드(보라 바코드)와 그 위에 놓인 노란 커피컵 | 7단계 「기프티콘」 | 투명 | 상품권과 커피컵이 붙어 있어 하나로만 쓸 수 있다 |
| o1.png | png 512×816, 353KB | 정면으로 선 보라 스마트폰. 화면은 비어 있다. | 지금 안 씀(1단계 폰 틀 후보였다) | 투명 | 가능. 빈 화면에 앱 화면을 얹어 쓰기 좋다 |
| o3.png | png 512×416, 174KB | 연보라 티켓 3장이 비스듬히 겹친 더미(천공선 있음, 흐린 색 = 아직 못 쓰는 티켓) | 지금 안 씀(4단계 대기 티켓 후보였다) | 투명 | 가능 |
| o4.png | png 512×417, 185KB | 진보라 티켓 2장 겹침, 오른쪽 위에 초록 체크 뱃지 | 지금 안 씀(5단계 확정 티켓 후보였다) | 투명 | 체크 뱃지가 붙어 있어 함께만 쓸 수 있다 |
| o1-old.png | png 512×697, 294KB | 비스듬히 선 보라 폰, 화면 가운데 보라 꽃 모양 뱃지 | 안 씀(o1 이전본) | 투명 | 가능 |
| o3-old.png | png 512×397, 197KB | 연보라 판 6장이 층층이 쌓인 더미. 티켓 모양이 잘 안 읽힌다. | 안 씀(o3 이전본) | 투명 | 가능 |
| o4-old.png | png 512×310, 145KB | 정면 진보라 티켓 한 장(양옆 홈 파임) | 안 씀(o4 이전본) | 투명 | 가능 |
| card-shell.png | png 640×300, 158KB | 빈 흰색 둥근 카드 판(입체) | 안 씀(제휴몰 카드 바탕 후보였다) | 투명 | 가능. 그림이라기보다 화면 부품이다 |
| card-shell-270.png | png 540×112, 33KB | 위 카드를 가로로 길게 늘인 본 | 안 씀 | 투명 | 가능 |

### 2-2. 티켓 아이콘 (코드로 그린 그림)

| 파일 | 형식 · 크기 · 용량 | 무엇을 그린 것인가 | 가이드 어느 자리 | 배경 투명 | 떼어 쓰기 |
|---|---|---|---|---|---|
| ticket-gold.svg | svg(벡터, 크기 제한 없음), 20KB | 대각선으로 놓인 금색 티켓. 「TICKET」 글자, 별 하나, 천공선. 두께와 하이라이트를 넣어 입체처럼 보이게 했다. | 5단계 「사용 가능 티켓」(3장 겹쳐 쓰고, 체크 뱃지는 코드로 따로 얹음) | 투명 | 가능 |
| ticket-random.svg | svg, 22KB | 같은 모양의 빨간 티켓에 흰 물음표가 크게 들어간 것 | 4단계 「랜덤 티켓」 | 투명 | 가능 |
| ticket-random_s01.svg | svg, 20KB | 위의 이전본. 물음표가 티켓 밖으로 삐져나온다. | 안 씀 | 투명 | 쓰지 말 것 |

이 둘은 김반장이 준 2D 티켓 아이콘을 SVG로 옮긴 것이다(2026-11-03 커밋 904b8db). 점토 질감의 다른 오브젝트와는 그림 결이 다르다.

### 2-3. 폰 화면 그림

| 파일 | 형식 · 크기 · 용량 | 무엇을 그린 것인가 | 가이드 어느 자리 | 배경 투명 | 떼어 쓰기 |
|---|---|---|---|---|---|
| pricepick-splash.png | png 390×844, 269KB | 앱 실행 화면. 파스텔 배경에 앱 아이콘, 「프라이스픽 PRICEPICK」, 단추 둘, 떠다니는 티켓·쇼핑백. 시안 화면을 렌더한 캡처다. | 1단계 「프라이스픽」 | 불투명(화면째) | 가능. 폰 틀(o1) 안에 넣어 쓰면 된다 |
| pricepick-home.png | png 288×626, 147KB | 앱 홈 화면 캡처(보유 티켓 16,761장, 혜택 카드 4개, 랜덤 선물 상자 배너, 쿠팡·CJ더마켓) | 안 씀(1단계 이전본) | 불투명 | 해상도가 낮고 예시 숫자가 박혀 있다 |
| pricepick-appicon.png | png 512×512, 259KB | 3D 앱 아이콘: 보라 그라디언트 바탕에 흰 「p」, 안에 종 모양 | 안 씀(1단계 이전본). 앱 데모 `app/assets/app-icon-3d.png` 와 같은 파일이다. | 불투명(보라 바탕) | 가능. 상표 자리에 쓰는 그림이다 |

### 2-4. 배경이 있는 장면 그림 (첫 시안용 7장)

전부 png 1024×1024이고 연보라 단색 배경이다. 2026-11-03 첫 시안(커밋 6ab1b5b)의 7단계에 한 장씩 썼다가, 같은 날 흐름도 방식으로 바꾸면서 빠졌다.

| 파일 | 용량 | 무엇을 그린 것인가 | 당시 단계 | 배경 투명 | 떼어 쓰기 |
|---|---|---|---|---|---|
| s1.png | 311KB | 보라 폰(화면에 「=」 모양 아이콘)과 위로 떠오르는 보라 티켓 4장 | 1 앱 열기 | 불투명(연보라) | 장면째만 쓸 수 있다 |
| s2.png | 354KB | 왼쪽 보라 폰에서 화살표가 나와 오른쪽 차양 달린 가게로 향함 | 2 쇼핑몰로 이동 | 불투명 | 장면째만 쓸 수 있다 |
| s3.png | 344KB | 보라 쇼핑백과 베이지 택배 상자, 위로 떠오르는 티켓 2장 | 3 구매 | 불투명 | 장면째만 쓸 수 있다 |
| s4.png | 342KB | 연보라 티켓 더미 위에 티켓 한 장이 떠 있음(대기) | 4 랜덤 티켓 대기 | 불투명 | 장면째만 쓸 수 있다 |
| s5.png | 376KB | 진보라 티켓 한 장과 초록 체크 뱃지 | 5 확정 | 불투명 | 장면째만 쓸 수 있다 |
| s6.png | 351KB | 노란 동전 더미 → 화살표 → 보라 티켓 | 6 포인트 → 티켓 | 불투명 | 장면째만 쓸 수 있다 |
| s7.png | 355KB | 바코드 상품권, 큰 커피컵, 작은 보라 티켓, 노란 공 | 7 기프티콘 | 불투명 | 장면째만 쓸 수 있다 |

### 2-5. 생성 원본 (배경 있는 큰 그림)

모두 png 2048×2048이고, 배경이 흰색이나 연회색이라 투명하지 않다. 위 512px 오브젝트는 이 원본에서 배경만 지워 줄인 것이다.

| 파일 | 용량 | 무엇을 그린 것인가 | 오려 낸 본 |
|---|---|---|---|
| raw-o1-front.png | 3.7MB | 정면 보라 폰, 빈 화면 | o1.png |
| raw-o1.png | 3.9MB | 비스듬한 보라 폰, 화면에 꽃 모양 뱃지 | o1-old.png |
| raw-o2.png | 4.1MB | 쇼핑백 + 택배 상자 + 병 | o2.png |
| raw-o3-new.png | 4.0MB | 연보라 티켓 3장 겹침 | o3.png |
| raw-o3.png | 4.0MB | 연보라 판 6장 더미 | o3-old.png |
| raw-o4-new.png | 3.9MB | 진보라 티켓 2장 + 체크 뱃지 | o4.png |
| raw-o4.png | 4.3MB | 정면 진보라 티켓(배경이 진회색 그라디언트) | o4-old.png |
| raw-o5.png | 3.9MB | 동전 더미 | o5.png |
| raw-o6.png | 3.7MB | 바코드 상품권 + 커피컵 | o6.png |
| raw-card-shell.png | 1.8MB (2048×1152) | 빈 흰 카드 판 | card-shell.png |

### 2-6. 제휴몰 로고 (그림이 아님)

| 파일 | 형식 · 크기 | 내용 | 홈페이지 사용 |
|---|---|---|---|
| mall/coupang.png | png 128×128 | 쿠팡 로고 | 각 쇼핑몰 상표다. 홈페이지에 올리려면 몰별 상표 사용 기준을 따로 확인해야 한다. |
| mall/gmarket.png | png 180×180 | G마켓 로고 | 같음 |
| mall/11st.png | png 128×128, 투명 | 11번가 로고 | 같음 |
| mall/ns.png | png 128×128, 투명 | NS몰 로고 | 같음 |
| mall/cj.png | png 128×128 | CJ더마켓 로고 | 같음 |

### 2-7. 가이드 밖이지만 같은 계열인 앱 그림 (참고)

| 파일 (`pricepick-demo/app/assets/`) | 형식 · 크기 · 용량 | 무엇을 그린 것인가 | 배경 투명 | 비고 |
|---|---|---|---|---|
| giftbox/box-purple.png | png 712×816, 680KB | 보라 상자에 금색 리본 | 투명 | 앱 「매일·랜덤 선물 상자」 그림. 광택이 강하고 채도가 높아 가이드의 무광 점토 질감과 결이 다르다. |
| giftbox/box-purple-open.png | png 567×846, 543KB | 위 상자의 뚜껑이 열린 모습 | 투명 | 같음 |
| giftbox/box-gold.png | png 714×816, 690KB | 금색 상자에 보라 리본 | 투명 | 같음 |
| giftbox/box-gold-open.png | png 566×841, 538KB | 위 상자의 뚜껑이 열린 모습 | 투명 | 같음 |
| onboard-bg.png | png 842×1264, 1.0MB | 파스텔 물결 배경에 흐린 티켓·쇼핑백·동전이 흩어진 모습 | 반투명 | 가입 첫 화면 배경. 히어로 배경 후보다. |
| hero-bg-invite-streak.png | png 1376×768, 1.3MB | 위와 같은 결의 가로형 배경 | 반투명 | 친구초대·연속구매 화면 배경. 히어로 배경 후보다. |
| jackpot-banner-bg.jpg | jpg 800×181 | 보라 커튼 무대, 망치·티켓·칩 | 불투명 | 잭팟 룰렛 배너 배경이다. 룰렛을 폐지해 쓰면 안 된다. |

---

## 3. 원본은 어디서 왔나

| 항목 | 확인한 사실 | 근거 |
|---|---|---|
| 만든 도구 | 생성형 이미지 서비스 **Higgsfield**로 뽑았다. 모델은 `z_image`. 같은 날 `gpt_image_2_5`, `recraft_v4_1`로도 시험했지만 최종본은 전부 `z_image`다. | 2026-11-03 Claude 데스크톱 에이전트 세션 기록(작업 폴더 `~/Library/Application Support/Claude/local-agent-mode-sessions/…/f5f57fcf….jsonl`) |
| 배경 지우기 | `rembg`(배경 제거 도구)로 지운 뒤 512px로 줄였다. | `pricepick` 커밋 1157db6, c119ebe, 082219d 메시지 |
| 만든 날 | 2026-11-03 하루. s1~s7 첫 시안 → 오브젝트 o1~o6 → 폰·티켓·카드 교체 순서다. | `pricepick` 커밋 6ab1b5b, 1157db6, 082219d, 36644ea, c119ebe, 904b8db, d168799 |
| 티켓 SVG 2장 | 생성 도구가 아니라 김반장 2D 티켓 아이콘을 코드로 다시 그린 것이다. | 커밋 904b8db |
| 앱 실행 화면 | 저장소 시안 `design-splash-login-20260729.html`의 1b안을 390×844로 렌더해 저장했다. | 커밋 d168799 |
| 앱 아이콘 | 김반장이 준 파일이다. 생성 기록은 없다. | 2026-11-03 세션 지시문 |
| 프롬프트 | **남아 있다.** 위 세션 기록에 최종본마다 원문 그대로 있다. 아래 표에 옮겼다. 저장소(커밋·문서)에는 없다. | 세션 기록 |
| 생성 결과 중 저장소에 없는 것 | 앱 아이콘풍 정사각 타일(그라디언트 바탕에 흰 오브젝트) 6종, 3D 티켓 4종, GUIDE 단추 아이콘 후보 3종(말풍선·책·나침반). 이것들은 Higgsfield 계정 안에만 있는 것으로 보인다. | 세션 기록(생성 호출은 있으나 저장소에 파일 없음) |

### 같은 톤으로 새로 뽑을 때 쓸 프롬프트 (최종본 원문)

**공통 틀 — 투명 오브젝트용** (o2·o3·o4·o5·o6과 같은 결로 나온다. 생성 후 배경을 지운다)

> Soft 3D clay render of a single object, isolated and centered on a pure flat white background. **[무엇을 그릴지 한두 문장]** Matte pastel surfaces, soft even studio lighting, no cast shadow on the floor, no surface, no table, no background scenery. Palette: purple #845EEE, lilac #C6AFFF, white. No text, no letters, no numbers, no logos. Clean icon-like object, generous white margin around it.

**공통 틀 — 배경 있는 장면용** (s1~s7과 같은 결)

> Soft 3D clay render illustration, matte pastel surfaces, rounded friendly shapes, soft studio lighting with a gentle drop shadow. **[장면 설명]** One centered object group, generous empty space, flat solid very light lavender background #E6DCFB. Color palette strictly purple #845EEE, lilac #C6AFFF, pale lilac #E2D9FF, white. No text, no letters, no numbers, no logos. Minimal, airy, premium mobile app onboarding illustration.

**그림별 [무엇을 그릴지] 원문**

| 그림 | 원문 |
|---|---|
| o2 쇼핑백 | A rounded paper shopping bag filled with simple abstract goods, with a small cardboard parcel box leaning against it. (팔레트: lilac #C6AFFF, purple #845EEE, warm kraft beige, white) |
| o5 동전 | A small pile of round glossy warm-yellow coins with completely smooth blank faces, no symbol, no engraving, no marking of any kind on them; a few stacked and one leaning in front. (팔레트: warm yellow #F5B84A, soft gold, white. 「no currency symbols」 추가) |
| o6 상품권 | A rounded white gift voucher card with a simple abstract dark barcode strip, with a small takeaway coffee cup with a lid standing next to it. (팔레트: white, purple #845EEE, lilac #C6AFFF, warm yellow #F5B84A) |
| o1 정면 폰 | Soft 3D clay render of a single smartphone … stands upright and faces the viewer straight on with no perspective tilt, perfectly symmetrical and level. It has a thick rounded purple clay body and a completely blank, flat, empty screen in a very pale lavender, with no icons, no widgets, no content at all on the screen. (그림자: gentle soft shadow beneath. 팔레트에 pale lavender #F1EEFF 추가) |
| o3 대기 티켓 | A small fanned stack of four admission tickets, each a wide rectangle with two deep semicircular notches cut into its left and right edges and a dashed perforation line near one end, clearly recognisable as tickets. They are pale translucent lavender and look faded and inactive, slightly fanned so the notched edges of each are visible. |
| o4 확정 티켓 | One vivid purple admission ticket, a wide rectangle with two deep semicircular notches … tilted slightly, with a small bright green circular badge holding a white checkmark attached at its top-right corner and a few tiny sparkles around it. (팔레트에 green #22C55E 추가) |
| card-shell 카드 판 | Soft 3D clay render of one single empty horizontal rounded rectangle card … wide and short like a list row, pure glossy white, with visible rounded thickness and softly bevelled edges, seen straight on … (비율 16:9) |
| s1~s7 | 장면 설명만 바꿨다. 예: s2 「A rounded modern smartphone on the left and a small rounded storefront shop card with a striped awning on the right, joined by one smooth curved purple arrow flowing from the phone to the shop.」 |

시행착오로 남은 주의점:
- 동전은 처음에 화폐 기호가 찍혀 나와, 「no currency symbols」를 넣어 다시 뽑았다.
- 티켓은 「coupon-ticket shape」라고만 쓰면 판때기처럼 나왔다(o3-old). 「admission ticket … two deep semicircular notches … dashed perforation line」으로 모양을 못 박아야 티켓으로 읽힌다.
- 폰은 「straight on, no perspective tilt」를 넣어야 정면으로 나온다.
- 비율은 1:1(카드 판만 16:9)이고, 원본은 2048×2048로 나온다.

---

## 4. 홈페이지에 쓸 만한 것 — 고른 결과

### 4-1. 히어로(머리 화면) 큰 그림

| 후보 | 판단 | 이유 |
|---|---|---|
| 새로 만들기 | **추천** | 지금 있는 그림 중 히어로 한 장으로 「앱 → 쇼핑 → 티켓 → 기프티콘」을 다 보여 주는 것이 없다. 가이드 흐름도는 그림 한 장이 아니라 코드로 이어 붙인 화면이라 그대로 떼어 올 수 없다. 정면 폰(o1)에 앱 실행 화면을 얹고, 주변에 쇼핑백·티켓·동전·상품권이 떠 있는 장면을 위 「장면용」 틀로 새로 뽑는 것을 권한다. 가로형 16:9로 뽑는다. |
| o1 + pricepick-splash 조합 | 차선 | 폰 틀과 앱 화면만으로 히어로를 만들 수 있다. 다만 o1이 512×816이라 크게 띄우면 흐려진다. raw-o1-front(2048px)에서 다시 오려야 한다. |
| s1.png | 작게는 가능 | 폰과 떠오르는 티켓으로 주제는 맞다. 1024px에 정사각, 연보라 배경째라 히어로 너비로는 모자라고 배경색을 맞춰야 한다. |
| onboard-bg.png / hero-bg-invite-streak.png | 배경으로 가능 | 파스텔 물결에 흐린 오브젝트가 흩어진 배경이다. 히어로 뒷면으로 깔 수 있다. |

### 4-2. 이용 방법 1·2·3단계 작은 그림

현재 홈페이지 단계는 「프라이스픽 열기 / 평소처럼 쇼핑 / 티켓 받고 교환」 셋이다.

| 단계 | 1안: 투명 오브젝트 | 2안: 배경 있는 장면 | 해상도 |
|---|---|---|---|
| 1 프라이스픽 열기 | o1 정면 폰 + pricepick-splash 화면 얹기 | s1 (폰 + 떠오르는 티켓) | 둘 다 화면에 250px 안팎으로 쓰면 충분하다 |
| 2 평소처럼 쇼핑 | o2 쇼핑백 | s2 (폰 → 가게) 또는 s3 (쇼핑백 + 택배 상자) | 충분 |
| 3 티켓 받고 교환 | o6 상품권 + 커피컵 (또는 ticket-gold.svg → o6 두 개를 이어 배치) | s7 (상품권 + 커피컵 + 티켓) | 충분 |

1안은 투명이라 홈페이지 배경색에 상관없이 얹힌다. 2안은 연보라 네모 카드째 들어가므로 카드형 배치일 때만 어울린다. 한 페이지 안에서 1안과 2안을 섞지 말 것.

단계를 넷 이상으로 늘려 적립 흐름(구매 → 랜덤 티켓 대기 → 확정 → 교환)까지 보여 줄 경우 쓸 수 있는 그림:
- 대기: o3, s4, ticket-random.svg
- 확정: o4, s5, ticket-gold.svg
- 포인트 전환: o5, s6

### 4-3. 혜택 항목 아이콘급 그림

| 혜택 | 쓸 그림 | 판단 |
|---|---|---|
| 구매 적립(티켓) | ticket-gold.svg 또는 o4 | 바로 사용 가능. 다만 SVG 티켓은 평면에 가까워, 점토 질감 그림과 한 줄에 놓으면 결이 다르다. 한 종류로 통일할 것. |
| 포인트 | o5 동전 | 바로 사용 가능 |
| 기프티콘 교환 | o6 | 바로 사용 가능 |
| 매일 선물 상자 · 랜덤 선물 상자 | 앱의 giftbox/box-purple · box-gold | 가이드 그림은 아니지만 앱 실제 화면의 그림이라 내용은 맞다. 광택이 강해 가이드 오브젝트 옆에 두면 튄다. 따로 줄을 잡거나 같은 틀로 새로 뽑는다. |
| 출석(쿠팡 구경 10P) | 없음 | **새로 만든다.** 예: 폰 + 눈(구경) 또는 달력 + 동전 |
| 친구초대(각 500P) | 없음 | **새로 만든다.** 예: 사람 두 명 모양 또는 하트로 이어진 폰 두 대 |
| 연속구매 미션 | 없음 | **새로 만든다.** 예: 계단식 티켓 또는 과녁 |

### 4-4. 홈페이지에 안 맞는 것

| 그림 | 이유 |
|---|---|
| 512px 오브젝트를 크게 키워 쓰는 것 | 화면에 300px 넘게 띄우면 레티나 화면에서 흐리다. 크게 쓸 자리는 2048 원본(raw-*)에서 다시 오려야 한다. 원본은 다 있다. |
| pricepick-home.png | 288px 저해상도이고 예시 숫자(16,761장)가 박혀 있다. 홈 화면이 바뀌면 틀린 그림이 된다. |
| o1-old · o3-old · o4-old · raw-o4 | 교체된 이전본이다. o3-old는 티켓으로 안 읽히고, raw-o4는 배경이 진회색이다. |
| card-shell · card-shell-270 | 그림이 아니라 화면 부품(빈 카드 판)이다. |
| ticket-random_s01.svg | 물음표가 티켓 밖으로 삐져나온 이전본이다. |
| jackpot-banner-bg.jpg | 폐지된 잭팟 룰렛 배너다. |
| 제휴몰 로고 5개 | 각 쇼핑몰 상표다. 홈페이지 사용 기준을 따로 확인해야 한다. |

---

## 5. 개수 정리

| 구분 | 장수 | 그림 |
|---|---|---|
| 바로 쓸 수 있는 것 | 16 | o1, o2, o3, o4, o5, o6 (투명 6) / ticket-gold.svg, ticket-random.svg (2) / pricepick-splash.png (1) / s1~s7 (장면 7) |
| 원본에서 다시 오리면 크게 쓸 수 있는 것 | 6 | raw-o1-front, raw-o2, raw-o3-new, raw-o4-new, raw-o5, raw-o6 (2048px) |
| 새로 만들어야 하는 것 | 4 | 히어로 1, 출석 아이콘 1, 친구초대 아이콘 1, 연속구매 아이콘 1 |
| 결이 달라 판단 필요 | 4 | 선물 상자 4장(box-purple·box-gold 닫힘·열림) |
| 쓰지 않을 것 | 11 | o1-old, o3-old, o4-old, raw-o1, raw-o3, raw-o4, card-shell 2장, pricepick-home, ticket-random_s01, jackpot-banner-bg |
