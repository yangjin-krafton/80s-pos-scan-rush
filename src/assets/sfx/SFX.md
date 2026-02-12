# SFX 목록 (m4a)

이 폴더의 `.m4a` 파일은 모바일 웹용 SFX 배포본입니다.
재생성 파이프라인: `python3 src/sfx_gen.py` → `python3 src/sfx_encode.py`

## 파일 설명
- `ui_click.m4a`: UI 버튼 클릭 (짧고 또렷한 클릭, 상단 고음 + 하단 보강)
- `item_pickup.m4a`: 장바구니에서 아이템 선택/집기 (상승 톤, 경쾌함)
- `item_bag.m4a`: 봉투 담기 완료 (저역 “툭” + 종이 질감)
- `scan_beep.m4a`: 스캔 성공 “삑” (2연속 비프 + 하이 스파클)
- `scan_fail.m4a`: 스캔 실패 (저역 하강 + 거친 버즈)
- `checkout_success.m4a`: 결제 성공 (3단 상승 음계, 축하 느낌)
- `checkout_fail.m4a`: 결제 실패 (저역 하강 + 묵직한 불협 느낌)
- `combo_up.m4a`: 콤보 증가 (짧은 이중 상승 톤)
- `warning.m4a`: 만족도 낮음 경고 (짧은 2펄스 경고음)
