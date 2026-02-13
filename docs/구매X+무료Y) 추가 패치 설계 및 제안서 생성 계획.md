# 프로모션(1+1/2+1/구매X+무료Y) 추가 패치 설계 및 제안서 생성 계획

**요약**
- 목표: 기존 할인(할인 스티커) 로직에 **프로모션 룰(1+1, 2+1, 구매X+무료Y)** 을 추가하고, **무료품은 스캔으로 처리**.
- 핵심 변경점: 라운드 데이터에 프로모션 규칙을 포함하고, 카드/스캔/체크아웃 검증/영수증을 프로모션에 맞게 확장.
- 산출물: 프로모션 설계 제안서 1건을 `docs/프로모션_패치_제안.md`로 생성.

---

## 1) 변경/추가할 데이터 구조(공개 인터페이스)

### 1-1. 신규 프로모션 데이터 파일
- 새 파일: `src/data/promos.json`
- 스키마(고정 결정)
```json
{
  "promos": [
    {
      "id": "bogo",
      "type": "same",
      "buyQty": 1,
      "freeQty": 1,
      "unlockDR": 6,
      "chance": 0.35
    },
    {
      "id": "b2g1",
      "type": "same",
      "buyQty": 2,
      "freeQty": 1,
      "unlockDR": 8,
      "chance": 0.25
    },
    {
      "id": "burger_cola",
      "type": "cross",
      "buyItem": "hamburger",
      "freeItem": "cola",
      "buyQty": 1,
      "freeQty": 1,
      "forceInclude": true,
      "unlockDR": 7,
      "chance": 0.25
    }
  ]
}
```
- 설계 포인트
  - `type: same`이면 **동일상품 N+M** (1+1, 2+1)
  - `type: cross`이면 **구매X+무료Y**
  - `unlockDR`와 `chance`로 라운드 난이도 기반 등장 확률 제어
  - `forceInclude`가 true면 해당 아이템이 라운드에 없을 경우 강제 포함

### 1-2. 아이템 구조 확장 (라운드 아이템)
- 기존 `round.items`의 각 entry에 **프로모션 무료 수량**을 추가:
```js
// 기존: { id, qty, ... }
{ id, qty, promoFreeQty, promoId }
```
- `promoFreeQty`는 무료품 요구 수량 (0이면 없음)
- `promoId`는 해당 무료품에 연결된 프로모션 ID

### 1-3. POS 항목 구조 확장
- `State.posItems[]`에 다음 필드를 추가:
```js
{ itemId, qty, barcodeType, discountRate, promoId }
```
- `barcodeType`에 `promo` 타입 추가
- `promoId`는 무료품 스캔 시 어떤 프로모션인지 추적

---

## 2) 로직 설계 및 변경 지점

### 2-1. 프로모션 로더 추가
- 파일: `src/js/loader.js`
- 변경:
  1. `load()`에서 `promos.json`을 추가 로드하여 `POS.PROMOS`로 저장.
  2. 라운드 생성 시점에 `_applyPromoToRound()`를 호출:
     - `diffRating` 기준으로 eligible 프로모션 리스트 구성 (`unlockDR` 이상)
     - `chance`로 1개만 선정 (v1은 **라운드당 1개 프로모션 고정**)
     - 프로모션이 필요한 제품이 라운드에 없으면 `forceInclude` 규칙으로 교체 삽입
  3. `round.items`에 `promoFreeQty/promoId`를 설정

**교체 규칙(결정)**
- `forceInclude` 제품이 없으면 `round.items`에서 **비할인(normal) 품목 1개를 동일 qty로 교체**
- 교체 대상이 없으면 **가장 qty가 작은 항목을 교체**

### 2-2. 카드/스캔용 바코드 확장
- 파일: `src/js/loader.js`의 `_buildItem`
- 변경:
  - `promoFreeQty > 0`인 아이템은 **promo 바코드 추가**
  - 바코드 타입: `promo`, 라벨: `FREE`
  - 바코드 영역은 할인 바코드와 겹치지 않는 위치에 고정

### 2-3. 스캔 처리 변경(무료품 스캔)
- 파일: `src/js/game.js`
- 변경:
  - `addToPOS(itemId, barcode)`로 시그니처 변경
  - `barcode.type`에 따라 분기:
    - `promo`: promoId 매핑 + `barcodeType='promo'`로 POS에 추가 (가격 0 처리)
    - `discount`: 기존 할인 검증 유지
    - `normal`: 기존 검증 유지
  - `State.scanDiscountRate`는 **discount 타입 검증에만 사용**

### 2-4. POS 렌더링/합계
- 파일: `src/js/ui.js`
- 변경:
  - POS 리스트 라벨에 `promo` 항목은 `FREE` 배지 표시
  - 합계 계산에서 `barcodeType === 'promo'`는 0원 처리
  - POS 항목 키 생성에 `barcodeType` + `promoId` 포함  
    예: `posKey = itemId + '_' + barcodeType + '_' + discountRate + '_' + (promoId||'')`

### 2-5. 체크아웃 검증 확장
- 파일: `src/js/game.js`
- 변경:
  - 기존 `required qty` 검증 외에 `promoFreeQty` 검증 추가
  - `promoFreeQty`는 **promo 스캔된 수량으로만 충족**
  - 부족/초과/잘못된 스캔 시 새로운 실패 사유 `promo`

### 2-6. 영수증/오류 메시지
- 파일: `src/js/game.js`, `src/js/ui.js`
- 변경:
  - `_buildCheckoutReport`에 `promoFreeQty` 라인 표시
  - `MISTAKE_KEY_MAP`에 `promo` 추가, NPC 대사 fallback 적용

---

## 3) 신규 상품 추가(햄버거)
- 파일: `src/data/products.csv`
- 신규 라인 추가 (결정)
```
hamburger,🍔,햄버거,ハンバーガー,惣菜,350
```

---

## 4) 문서 생성(제안서)
- 신규 문서: `docs/프로모션_패치_제안.md`
- 포함할 내용(결정):
  1. 목표/범위(1+1, 2+1, 구매X+무료Y)
  2. 데이터 구조(프로모션 JSON, round.items 확장)
  3. 스캔/바코드 설계(무료 바코드, 검증 흐름)
  4. 체크아웃 검증 규칙
  5. UX/UI 표시(카드 배지, POS 표시, 영수증)
  6. 신규 상품(햄버거) 추가 방식
  7. 확장 방법(새 프로모션 추가 절차)

---

## 5) 테스트 시나리오(수동 테스트)
1. 1+1 프로모션 라운드
   - 동일 상품 정상 1개 + 무료 1개 스캔 → 성공
   - 무료품을 normal로 스캔 → 실패(reason: promo)
2. 2+1 프로모션 라운드
   - 2개 정상 + 1개 무료 스캔 → 성공
   - 무료 수량 부족 → 실패
3. 구매X+무료Y (햄버거→콜라)
   - 햄버거 1개 + 콜라 무료 바코드 스캔 → 성공
   - 콜라를 normal 스캔 → 실패
4. POS 합계 검증
   - 무료품 포함 시 합계가 무료품 가격 제외되는지 확인
5. 영수증 검증
   - promo 실패 시 영수증 라인에 promo 관련 불일치가 표시되는지 확인

---

## 명시적 가정/기본값
- 프로모션은 **라운드당 1개만 활성화**한다.
- 프로모션은 **할인(sale) 아이템과 중복 적용하지 않는다**.
- 무료품은 **promo 바코드로만 인정**되며 normal/discount 스캔은 유료로 처리된다.
- 프로모션 선택은 `promos.json` + `diffRating` + `chance`로 제어한다.
