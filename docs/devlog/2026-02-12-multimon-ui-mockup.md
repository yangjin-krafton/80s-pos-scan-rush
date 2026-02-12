# Dev Log — 2026-02-12

## POS SCAN RUSH: Multi-Window UI Mockup (concept-multimon)

`sandbox/concept-multimon/index.html`

---

### 1. 뷰포트 스케일링 (360x640 세로 고정)

**문제**: 게임 UI 우측이 짤려 보임 — `.game` 컨테이너가 `width:100%; max-width:480px`로 되어 있어 내부 Win95 윈도우들이 오른쪽으로 넘침

**해결**:
- `.game` 컨테이너 → 고정 `360x640` 디자인 사이즈로 변경
- `grid-template-columns: minmax(0,1fr)` 추가로 자식 요소가 360px를 넘지 못하도록 강제
- `.mid-split` → `minmax(0,1fr) minmax(0,1fr)` 로 POS/SCAN 패널 균등 분할 + 오버플로우 방지
- JS 기반 비율 유지 스케일링 추가:
  ```js
  var s = Math.min(innerWidth / 360, innerHeight / 640);
  g.style.transform = 'scale(' + s + ')';
  ```
- `body`에 `display:flex; align-items:center; justify-content:center` 적용
- 미디어 쿼리 제거 (JS 스케일링이 모든 화면 크기 처리)

---

### 2. 내부 요소 360px 최적화

| 요소 | 변경 전 | 변경 후 |
|------|---------|---------|
| POS 행 이모지 | 18px | 14px |
| POS 행 min-height | 48px | 40px |
| 수량 버튼 (.qb) | 32px | 24px |
| 수량 숫자 폭 (.qn) | 22px | 16px |
| 스크롤바 | 16px | 12px |
| 드래그 아이템 | 76px | 64px |
| 스캐너 드롭존 | 140x64 | 120x52 |
| 카트 카드 | 68px | 58px |
| 액션 버튼 min-height | 48px | 42px |

---

### 3. 고객 섹션 → 8비트 픽셀 게임 씬으로 완전 재설계

기존의 Win95/MSN Messenger 스타일 고객 바를 완전히 제거하고, 독립적인 8-bit 픽셀 아트 게임 뷰포트(`.customer-scene`)로 교체.

#### 배경 레이어 (순수 CSS)
- **상점 벽면**: CSS gradient 벽돌 패턴
- **선반 상품**: linear-gradient로 만든 컬러 상품 박스 픽셀아트 (빨/초/파/노/주/보/시안 반복)
- **바닥 타일**: `repeating-conic-gradient`로 체크무늬

#### HUD 오버레이
- **플레이어 이름**: 4방향 `text-shadow`로 픽셀 외곽선 텍스트
- **하트 게이지**: `clip-path` polygon으로 픽셀 하트 모양 구현
  - 상태 클래스: 기본(빨강), `.empty`(어두운), `.warn`(주황)
- **라운드 카운터**: 노란 픽셀 폰트 (`#ffe040`)

#### 캐릭터 스프라이트
- **현재 손님**: 큰 이모지 머리(😊) + CSS 픽셀 바디(파란 셔츠) + 팔(`::before`/`::after`) + 다리
  - `animation: steps(1)` idle — 진정한 8비트 느낌
- **대기 큐 5명**: 😐 😴 🤔 😊 😤
  - 각각 다른 색 옷 (빨/초/노/보/시안)
  - 홀짝 교대 sway 애니메이션 (`steps(1)`)
  - 뒤쪽 갈수록 투명도 감소 (거리감)
- **말풍선**: 흰색 박스 + 픽셀 꼬리 (`::before` skew)
- **POS 계산대**: 회색 박스 + 녹색 화면 + 키보드 슬롯

#### 기술 특징
- 모든 요소 `image-rendering: pixelated` 적용
- `steps(1)` 애니메이션으로 프레임 단위 움직임
- `drop-shadow` 필터로 이모지에 1px 검정 외곽선

---

### 현재 화면 구성 (5단 그리드)

```
┌─────────────────────────────────┐
│ [1] Info Bar                     │  Win95 Taskbar / Tahoma
│     로고 + RD/SC 통계            │
├─────────────────────────────────┤
│ [2] Customer Scene               │  8-bit Pixel Game (독립)
│     ♥♥♥♥♥♥♥♡♡♡                  │  HUD: Courier New
│     😊 스프라이트 + 😐😴🤔😊😤 큐 │
├────────────────┬────────────────┤
│ [3-L] POS List │ [3-R] SCAN     │
│ DOS Terminal   │ Help Window    │
│ Courier New    │ Times New Roman│
│ 녹색 on 검정   │ 세리프체        │
├────────────────┴────────────────┤
│ [4] Cart Carousel                │  Media Player / MS Gothic
│     가로 스크롤 카드              │
├─────────────────────────────────┤
│ [5] Action Bar                   │  Win95 버튼 / Segoe UI
│     봉투 / 반품 / 회계           │
└─────────────────────────────────┘
```

### 주요 기술 스택
- **레이아웃**: CSS Grid (5행) + JS transform scale
- **레트로 효과**: CRT 스캔라인, 비네팅, Win95 크롬
- **폰트 믹스**: Tahoma, Courier New, Times New Roman, Comic Sans MS, MS Gothic, Segoe UI
- **픽셀 아트**: 순수 CSS (gradient, clip-path, box-shadow)
- **반응형**: JS 기반 scale-to-fit (미디어 쿼리 없음)
