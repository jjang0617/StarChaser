# hip-bright-subset.json 검증 노트

**목적:** `GET /sky/view`·`GET /sky/stars`에 쓰이는 **HIP·J2000 적경·적위·시각등급·IAU 별자리 약어** 부분집합.

## 2026-05-01 정정 사항 (SIMBAD / 일반 표준값 대조)

- **큰곰(UMa) 7주성:** HIP·이름·좌표를 WGSN/일반 표(J2000)에 맞게 재배치 (이전 버전에서 Merak~Alkaid 좌표 혼선 수정).
- **아드하라 Adhara:** ε CMa **HIP 33579**, `con` **CMa**, RA≈104.66°, Dec≈−28.97° (이전에 Car/다른 HIP과 혼동 수정).
- **아비어 Avior:** ε Car **HIP 41037** 별도 행 추가.
- **미아플라시두스 Miaplacidus:** β Car **HIP 45238** (기존 39953 오기 교체).
- **나오스 Naos:** ζ Pup **HIP 39757** (Pup 대표 밝은 별로 추가, 잘못된 Pup 행 제거).

## C팀·Stellarium 권장 체크리스트

1. Stellarium 동일 시각·위치에서 **UMa·Ori·CMa** 몇 개 HIP을 픽하여 고도/방위 오차 허용 범위 합의.
2. 필요 시 VizieR `I/239/hip_main`에서 동일 HIP의 **ICRS** 좌표로 일괄 교체 스크립트 작성.
3. `mag`는 시각등급 V 근사; 이원성은 Phase 2에서 분리 검토.

---

*파일 경로:* `backend/src/sky/data/hip-bright-subset.json`
