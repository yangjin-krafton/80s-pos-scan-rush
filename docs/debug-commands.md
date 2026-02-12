# Debug Console Commands

브라우저 개발자 도구 콘솔(F12)에서 사용하는 디버그 명령어.

## 명령어 목록

| 명령어 | 설명 |
|--------|------|
| `POS.debug.help()` | 명령어 목록 출력 |
| `POS.debug.status()` | 현재 게임 상태 확인 |
| `POS.debug.god()` | God 모드 토글 (만족도 드레인 정지) |
| `POS.debug.setDifficulty(n)` | 난이도 강제 설정 후 다음 라운드 재생성 |
| `POS.debug.trigger(name)` | 실시간 메타 이벤트 즉시 발동 (0.5초 후) |

---

## POS.debug.god()

만족도(satisfaction) 감소를 멈추고 100으로 고정. 시간 제한 없이 테스트 가능.
다시 호출하면 OFF.

```
POS.debug.god()   // ON
POS.debug.god()   // OFF
```

---

## POS.debug.setDifficulty(n)

`State.diffRating`을 강제 설정하고 다음 라운드를 재생성한다.
현재 라운드는 유지되며, 다음 라운드부터 새 난이도가 적용된다.

```
POS.debug.setDifficulty(5)   // damagedBarcode 해금
POS.debug.setDifficulty(7)   // + mixedSale 해금
POS.debug.setDifficulty(9)   // + multiDiscount, midCancel 해금
```

### 메타 이벤트 해금 기준 (diffRating)

| diffRating | 메타 이벤트 | 타입 | 설명 |
|------------|------------|------|------|
| >= 4 | highQty | 생성시 | 대량 구매 (수량 최대 4~8) |
| >= 5 | damagedBarcode | 생성시 | 바코드 손상 (스캔 불가 카드) |
| >= 6 | midAdd | 실시간 | 플레이 중 상품 추가 요청 |
| >= 7 | mixedSale | 생성시 | 같은 상품이 세일/비세일 동시 등장 |
| >= 8 | posBlackout | 실시간 | POS 화면 일시 정전 |
| >= 9 | multiDiscount | 생성시 | 같은 상품에 다른 할인율 |
| >= 9 | midCancel | 실시간 | 플레이 중 상품 취소 요청 |

**생성시** 메타: 라운드 생성 단계에서 적용. `setDifficulty` 후 다음 라운드부터 반영.
**실시간** 메타: 플레이 중 타이머로 발동. `trigger`로 즉시 테스트 가능.

---

## POS.debug.trigger(name)

플레이 중(playing phase)에서만 사용 가능. 0.5초 후 해당 메타가 발동된다.

```
POS.debug.trigger('posBlackout')   // POS 정전
POS.debug.trigger('midAdd')        // 상품 추가
POS.debug.trigger('midCancel')     // 상품 취소
```

---

## POS.debug.status()

현재 게임 상태를 콘솔에 출력:
- phase, round, diffRating, satisfaction, score
- 현재 라운드의 메타 설정값
- 각 실시간 메타의 scheduled/fired 상태

---

## 테스트 시나리오 예시

### 1. 바코드 손상 + 세일 혼합 테스트
```
POS.debug.god()
POS.debug.setDifficulty(7)
// 현재 라운드 계산 완료 → 다음 라운드에서 damagedBarcode + mixedSale 확인
```

### 2. POS 정전 + 취소 동시 테스트
```
POS.debug.god()
POS.debug.trigger('posBlackout')
POS.debug.trigger('midCancel')
```

### 3. 최고 난이도 체험
```
POS.debug.god()
POS.debug.setDifficulty(15)
// 모든 메타 활성화 + 대량 상품
```
