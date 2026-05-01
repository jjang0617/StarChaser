/**
 * 관측자 지평선 기준 적경·적위 → 고도·방위각 (Phase 1 천구 MVP)
 * GMST: Meeus *Astronomical Algorithms* 근사식 (UT 기준 JD)
 * 방위각: 북=0°, 동=90° (지평선 위 시계방향)
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** UT 기준 줄리안일(JD) */
export function julianDateUT(date: Date): number {
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const h = date.getUTCHours();
  const mi = date.getUTCMinutes();
  const s = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();
  const day =
    d +
    (h + (mi + (s + ms / 1000) / 60) / 60) / 24;
  let year = y;
  let month = mo;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const jd =
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    B -
    1524.5;
  return jd;
}

/** Greenwich 평균 항성시 (도, 0~360) */
export function gmstDegrees(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const theta =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    T * T * (0.000387933 - T / 38710000);
  return ((theta % 360) + 360) % 360;
}

/** 지방 항성시 (도, 0~360) — 동경 + */
export function localSiderealDegrees(jd: number, lngEastDeg: number): number {
  return ((gmstDegrees(jd) + lngEastDeg) % 360 + 360) % 360;
}

/**
 * 고도·방위각(도). 고도 -90~90, 방위 0~360 (북0 동90)
 */
export function raDecToAltAz(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lstDeg: number,
): { altDeg: number; azDeg: number } {
  const raRad = raDeg * DEG;
  const decRad = decDeg * DEG;
  const latRad = latDeg * DEG;
  const lstRad = lstDeg * DEG;
  const H = lstRad - raRad;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const cosH = Math.cos(H);
  const sinH = Math.sin(H);
  const sinAlt = sinDec * sinLat + cosDec * cosLat * cosH;
  const altRad = Math.asin(clamp(sinAlt, -1, 1));
  const y = -sinH * cosDec;
  const x = cosDec * sinLat * cosH - sinDec * cosLat;
  const azRad = Math.atan2(y, x);
  const azDeg = ((azRad * RAD) % 360 + 360) % 360;
  return { altDeg: altRad * RAD, azDeg };
}

/** 지평선 위(고도 > -0.5°) — 대기 굴절 미포함 MVP */
export function isAboveHorizon(altDeg: number, marginDeg = -0.5): boolean {
  return altDeg > marginDeg;
}
