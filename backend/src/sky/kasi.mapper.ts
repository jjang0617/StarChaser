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

export function kasiToInternalMapper(moonData: KasiMoonRaw | null, phaseData: KasiPhaseRaw | null) {
  const moonAltitude = toNumber(
    moonData?.moonAltitude ?? moonData?.altitude ?? moonData?.alt,
    -10
  );

  const moonrise = moonData?.moonrise?.trim() ?? null;
  const moonset = moonData?.moonset?.trim() ?? null;

  const lunAge = toNumber(phaseData?.lunAge, 0);

  const rawPhase =
    phaseData?.lunPhase ?? phaseData?.illumination ?? (lunAge > 0 ? lunAge / 29.5 : 0);
  const lunPhase = Math.min(1, Math.max(0, toNumber(rawPhase, 0)));

  return {
    moonAltitude,
    lunPhase,
    moonrise,
    moonset,
    lunAge,
  };
}
