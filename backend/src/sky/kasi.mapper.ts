/**
 * KASI RiseSetInfoService/getAreaRiseSetInfo item에는 보통 moonrise/moonset 중심이고
 * moonAltitude/altitude/alt 키가 없는 경우가 많습니다. 이 때는 파싱 실패가 아니라
 * “필드 부재”이며 내부에서는 아래 센티넬로 통일합니다.
 * (A/C 합의: 실제 고도 원천 API 확정 후 mapper 우선순위만 추가하면 됨)
 */
export const MOON_ALTITUDE_MISSING_SENTINEL = -10;

type KasiMoonRaw = {
  moonAltitude?: string | number | null;
  altitude?: string | number | null;
  alt?: string | number | null;
  moonrise?: string | null;
  moonset?: string | null;
};

type KasiPhaseRaw = {
  lunPhase?: string | number | null;
  lunAge?: string | number | null;
  illumination?: string | number | null;
};

function toNumber(value: string | number | null | undefined, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

/** 원시 필드에서 유한한 숫자를 뽑거나 null (부재/비파싱) */
function tryMoonAltitudeDegrees(raw: KasiMoonRaw | null): number | null {
  if (!raw) return null;
  const v = raw.moonAltitude ?? raw.altitude ?? raw.alt;
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = toNumber(v, NaN);
  return Number.isFinite(n) ? n : null;
}

export type KasiMoonInternal = {
  moonAltitude: number;
  /** true면 KASI item에서 고도 숫자를 실제로 읽음. false면 RiseSet에 고도 키 없음 등 */
  moonAltitudeKnown: boolean;
  lunPhase: number;
  moonrise: string | null;
  moonset: string | null;
  lunAge: number;
};

export function kasiToInternalMapper(
  moonData: KasiMoonRaw | null,
  phaseData: KasiPhaseRaw | null,
): KasiMoonInternal {
  const parsedAlt = tryMoonAltitudeDegrees(moonData);
  const moonAltitudeKnown = parsedAlt !== null;
  const moonAltitude = moonAltitudeKnown ? parsedAlt : MOON_ALTITUDE_MISSING_SENTINEL;

  const moonrise = moonData?.moonrise?.trim() ?? null;
  const moonset = moonData?.moonset?.trim() ?? null;

  const lunAge = toNumber(phaseData?.lunAge, 0);

  const rawPhase =
    phaseData?.lunPhase ?? phaseData?.illumination ?? (lunAge > 0 ? lunAge / 29.5 : 0);
  const lunPhase = Math.min(1, Math.max(0, toNumber(rawPhase, 0)));

  return {
    moonAltitude,
    moonAltitudeKnown,
    lunPhase,
    moonrise,
    moonset,
    lunAge,
  };
}
