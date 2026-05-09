# Hipparcos 확장 파이프라인 (Issue D 스텁)

`src/sky/data/hip-bright-subset.json`은 수동 큐레이션 MVP(~40행)입니다. VizieR 등으로 확장할 때 아래를 참고합니다.

## VizieR 예시 (콘솔 / 저장 후 CSV)

- 카탈로그: **I/239/hip_main** (Hipparcos Catalogue)
- 필터 예: `Vmag < 4.5` (팀 합의 후 mag 한도 확정)
- 출력 컬럼: `HIP`, `_RA.icrs`, `_DE.icrs`, `Vmag`, (별자리 코드는 CDS와 매핑 또는 별도 cross-match)

## 레포 작업 흐름 (제안)

1. `npm run` 또는 `node scripts/extract-hip-subset.mjs`로 JSON 생성 → `src/sky/data/`.
2. 앱 번들 크기·초기 로드 시간 측정 후 mag·HIP 개수 상한 결정.
3. `SkyService.loadBrightCatalog()` 실패 시 내장 최소 3성 폴백 유지.

## 참고

- Stellarium 스틱피겨 HIP 소스 병행 시 `constellation-lines-*.json` 세그먼트 HIP이 카탈로그에 존재해야 선이 그려짐.
