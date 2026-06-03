/** KMA 격자·dust 키와 비슷한 규모 — 이 안에서는 Star-Index 재요청 생략 */
export const COORD_RELOAD_EPS = 0.02;

export function hasFiniteCoords(
  lat?: number | null,
  lng?: number | null,
): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

export function bucketCoords(lat: number, lng: number): string {
  const r = (n: number) => Math.round(n / COORD_RELOAD_EPS) * COORD_RELOAD_EPS;
  return `${r(lat).toFixed(3)}:${r(lng).toFixed(3)}`;
}

export function coordsChangedEnough(
  prev: { lat: number; lng: number } | null,
  lat: number,
  lng: number,
): boolean {
  if (!prev) return true;
  return (
    Math.abs(prev.lat - lat) > COORD_RELOAD_EPS ||
    Math.abs(prev.lng - lng) > COORD_RELOAD_EPS
  );
}
