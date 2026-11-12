# 이 폴더에서 연 코드세션 규칙

## ⚠️ 작업 기록은 지시를 받는 즉시 등록한다

지시를 받으면 **무엇을 하기 전에** dispatch-history 작업 기록에 먼저 등록한다.
지시서에 「작업 기록을 남겨라」가 **적혀 있지 않아도 등록한다.**

- 프로젝트 · 기기(맥미니) · 제목 · 상세설명을 넣고 **진행중**으로 시작한다
- 작업이 끝나면 **그 자리에서 완료로 바꾼다**
- **조사·확인도 작업이다.** 고치는 일만 기록하는 것이 아니다
- 지시 하나가 기록 하나다. 「아까 하던 일의 연장」이라고 묶지 않는다
- 상세설명은 **업무 용어**로 쓴다. 개발 변경 내역을 적지 않는다

등록이 막히면 **그 사실을 보고에 분명히 적는다.** 조용히 넘어가지 않는다.

### 등록 방법 (어느 폴더에서 연 세션이든 같다)

```bash
W=/Users/markkim/dispatch-history/scripts/works.py   # 맥미니 경로. PC·맥북은 그 기기의 dispatch-history/scripts/works.py
python3 $W start auto "제목" --project 프라이스픽 --device 맥미니 --detail "상세설명"   # 번호는 오늘 다음 번호로 자동
python3 $W done 작업번호12자리 --detail "끝난 뒤 상세설명"                              # 완료
python3 $W get  작업번호12자리                                                          # 확인
```

지시서에 번호가 있으면 `auto` 대신 그 번호를 쓴다. 수칙 전문은 `/Users/markkim/dispatch-history/WORKS.md`.
