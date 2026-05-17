/** 에어코리아 시도별 실시간 측정(getCtprvnRltmMesureDnsty) 응답 파싱 */

export type AirKoreaStationRow = {
  pm25Value?: string;
  pm25Grade?: string;
  stationName?: string;
  /** 에어코리아 측정 시각 문자열 — 최신 행 선택용 */
  dataTime?: string;
};

export type AirKoreaItemsBody = {
  items?: AirKoreaStationRow[] | { item?: AirKoreaStationRow | AirKoreaStationRow[] };
};

/** response.body.items — 배열 또는 { item: [...] } 모두 처리 */
export function extractAirKoreaItems(
  body: AirKoreaItemsBody | undefined,
): AirKoreaStationRow[] {
  const items = body?.items;
  if (!items) return [];
  if (Array.isArray(items)) return items;
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

/** 에어코리아 PM2.5 등급(1~4) → 한글 */
export function pm25GradeToLabel(grade: number): string {
  switch (grade) {
    case 1:
      return '좋음';
    case 2:
      return '보통';
    case 3:
      return '나쁨';
    case 4:
      return '매우나쁨';
    default:
      return '정보없음';
  }
}

/** 농도(㎍/㎥)만으로 등급 근사 (에어코리아 기준) */
export function pm25UgToLabel(pm25: number): string {
  if (pm25 <= 15) return '좋음';
  if (pm25 <= 35) return '보통';
  if (pm25 <= 75) return '나쁨';
  return '매우나쁨';
}

/**
 * 유효 측정값이 있는 첫 측정소 — pm25Value·pm25Grade(1~4)
 * 파싱 실패 시 null (호출 측에서 캐시 미저장 처리)
 */
export function pickBestPm25Reading(rows: AirKoreaStationRow[]): {
  pm25: number;
  pm25Grade: number;
  pm25Label: string;
  stationName: string | null;
} | null {
  for (const row of rows) {
    const raw = row.pm25Value?.trim();
    if (!raw || raw === '-' || raw === '점검중') continue;
    const pm25 = Number(raw);
    if (!Number.isFinite(pm25) || pm25 < 0) continue;

    const gradeRaw = row.pm25Grade?.trim();
    const gradeParsed = gradeRaw ? Number(gradeRaw) : NaN;
    const pm25Grade = Number.isFinite(gradeParsed) && gradeParsed >= 1 && gradeParsed <= 4
      ? gradeParsed
      : pm25 <= 15
        ? 1
        : pm25 <= 35
          ? 2
          : pm25 <= 75
            ? 3
            : 4;

    return {
      pm25,
      pm25Grade,
      pm25Label: pm25GradeToLabel(pm25Grade),
      stationName: row.stationName?.trim() ?? null,
    };
  }
  return null;
}

/** dataTime 역순(최근 우선)으로 정렬한 뒤 pickBestPm25Reading — 측정소별 시계열 응답용 */
export function pickLatestPm25Reading(rows: AirKoreaStationRow[]): {
  pm25: number;
  pm25Grade: number;
  pm25Label: string;
  stationName: string | null;
} | null {
  const sorted = [...rows].sort((a, b) => {
    const ta = a.dataTime?.trim() ?? '';
    const tb = b.dataTime?.trim() ?? '';
    return tb.localeCompare(ta);
  });
  return pickBestPm25Reading(sorted);
}
