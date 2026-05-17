/** 기상청 단기예보(getVilageFcst) item 파싱 — KST 기준 */

export type VilageFcstItem = {
  category?: string;
  fcstDate?: string;
  fcstTime?: string;
  fcstValue?: string;
};

const SKY_TO_CLOUD_PCT: Record<number, number> = {
  1: 15, // 맑음
  2: 35,
  3: 65, // 구름많음
  4: 90, // 흐림
};

/** 기상청 단기예보 하늘상태(SKY) 4단계 — UI 표시용 */
export const SKY_LABEL_KO: Record<number, string> = {
  1: '맑음',
  2: '구름조금',
  3: '구름많음',
  4: '흐림',
};

export function skyCodeToLabel(skyCode: number): string {
  const code = Math.round(skyCode);
  return SKY_LABEL_KO[code] ?? (code <= 1 ? '맑음' : code >= 4 ? '흐림' : '구름많음');
}

/** 운량 근사(%) → SKY 코드 — 구형 weather 캐시 호환 */
export function cloudPercentToSkyCode(pct: number): number {
  if (pct <= 20) return 1;
  if (pct <= 45) return 2;
  if (pct <= 75) return 3;
  return 4;
}

/** 하늘상태(SKY) 코드 → 운량 근사(%) — Star-Index 점수용 */
export function skyCodeToCloudPercent(skyCode: number): number {
  const mapped = SKY_TO_CLOUD_PCT[Math.round(skyCode)];
  if (mapped !== undefined) return mapped;
  if (skyCode <= 1) return 15;
  if (skyCode >= 4) return 90;
  return 50;
}

/** KST 시각 문자열 (YYYYMMDDHHmm) */
export function kstYmdHm(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}`;
}

const VILAGE_BASE_TIMES = [
  '2300',
  '2000',
  '1700',
  '1400',
  '1100',
  '0800',
  '0500',
  '0200',
] as const;

/**
 * 단기예보 발표 시각 중 현재 KST 이전 최신 base (발표 후 ~10분 지연은 호출 측 재시도로 보완)
 */
export function resolveVilageFcstBaseKst(now = new Date()): {
  baseDate: string;
  baseTime: string;
} {
  const ymdhm = kstYmdHm(now);
  const today = ymdhm.slice(0, 8);
  const hour = Number(ymdhm.slice(8, 10));
  const minute = Number(ymdhm.slice(10, 12));
  const nowHm = hour * 100 + minute;

  for (const bt of VILAGE_BASE_TIMES) {
    const baseHm = Number(bt);
    if (nowHm >= baseHm + 15) {
      return { baseDate: today, baseTime: bt };
    }
  }

  const yesterday = new Date(now.getTime() - 86400000);
  const yParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(yesterday);
  const yGet = (type: string) =>
    yParts.find((p) => p.type === type)?.value ?? '01';
  const ymd = `${yGet('year')}${yGet('month')}${yGet('day')}`;
  return { baseDate: ymd, baseTime: '2300' };
}

function slotKey(item: VilageFcstItem): string | null {
  if (!item.fcstDate || !item.fcstTime) return null;
  return `${item.fcstDate}${item.fcstTime.padStart(4, '0')}`;
}

export function fcstSlotToNum(fcstDate: string, fcstTime: string): number {
  return Number(`${fcstDate}${fcstTime.padStart(4, '0')}`);
}

export function currentKstFcstSlotNum(now = new Date()): number {
  const hm = kstYmdHm(now);
  return Number(`${hm.slice(0, 10)}00`);
}

/** 현재 KST 이후 가장 가까운(동일 포함) 예보 슬롯의 category 값 */
export function pickNearestForecastValue(
  items: VilageFcstItem[],
  category: string,
  now = new Date(),
): string | undefined {
  const targetNum = currentKstFcstSlotNum(now);

  const bySlot = new Map<number, Map<string, string>>();
  for (const item of items) {
    if (!item.fcstDate || !item.fcstTime || !item.category || item.fcstValue === undefined) {
      continue;
    }
    const slotNum = fcstSlotToNum(item.fcstDate, item.fcstTime);
    let slot = bySlot.get(slotNum);
    if (!slot) {
      slot = new Map();
      bySlot.set(slotNum, slot);
    }
    slot.set(item.category, item.fcstValue);
  }

  let bestNum: number | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const slotNum of bySlot.keys()) {
    const diff = slotNum - targetNum;
    if (diff < 0) continue;
    if (diff < bestDiff) {
      bestDiff = diff;
      bestNum = slotNum;
    }
  }

  if (bestNum === null) {
    for (const slotNum of bySlot.keys()) {
      if (bestNum === null || slotNum > bestNum) bestNum = slotNum;
    }
  }

  if (bestNum === null) return undefined;
  return bySlot.get(bestNum)?.get(category);
}

export function parseForecastNumbers(
  items: VilageFcstItem[],
  now = new Date(),
): {
  skyCode: number;
  cloud: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  visibilityKnown: boolean;
  temperature: number;
  pop: number;
  pty: number;
} {
  const readRaw = (category: string): string | undefined =>
    pickNearestForecastValue(items, category, now);

  const read = (category: string, fallback: number): number => {
    const raw = readRaw(category);
    const parsed = raw !== undefined && raw !== '' ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const vvvRaw = readRaw('VVV');
  const visibilityKnown =
    vvvRaw !== undefined && vvvRaw !== '' && Number.isFinite(Number(vvvRaw));
  const visibility = visibilityKnown ? Number(vvvRaw) : 10;

  const sky = read('SKY', 1);
  return {
    skyCode: sky,
    cloud: skyCodeToCloudPercent(sky),
    humidity: read('REH', 70),
    windSpeed: read('WSD', 2),
    visibility,
    visibilityKnown,
    temperature: read('TMP', 12),
    pop: read('POP', 0),
    pty: read('PTY', 0),
  };
}
