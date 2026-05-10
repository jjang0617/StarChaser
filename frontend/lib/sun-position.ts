/**
 * 태양 고도·방위 (관측 시각·위도·경도 기준) — suncalc 기반 근사.
 * 천구 배경 색·태양 디스크 배치용; 고정밀 천문은 서버와 별도.
 */
const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;
const tan = Math.tan;
const asin = Math.asin;
const atan2 = Math.atan2;
const rad = PI / 180;

const dayMs = 1000 * 60 * 60 * 24;
const J1970 = 2440588;
const J2000 = 2451545;

const e = rad * 23.4397;

function toJulian(date: Date): number {
  return date.valueOf() / dayMs - 0.5 + J1970;
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function rightAscension(l: number, b: number): number {
  return atan2(sin(l) * cos(e) - tan(b) * sin(e), cos(l));
}

function declination(l: number, b: number): number {
  return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l));
}

function siderealTime(d: number, lw: number): number {
  return rad * (280.16 + 360.9856235 * d) - lw;
}

function solarMeanAnomaly(d: number): number {
  return rad * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(M: number): number {
  const C =
    rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M));
  const P = rad * 102.9372;
  return M + C + P + PI;
}

function sunCoords(d: number): { dec: number; ra: number } {
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  return {
    dec: declination(L, 0),
    ra: rightAscension(L, 0),
  };
}

/** 고도·방위(rad). 방위: 북에서 동쪽으로 시계방향 */
export function getSunPosition(
  date: Date,
  latDeg: number,
  lngDeg: number,
): { altitudeRad: number; azimuthRad: number } {
  const lw = rad * -lngDeg;
  const phi = rad * latDeg;
  const d = toDays(date);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  const alt = asin(sin(phi) * sin(c.dec) + cos(phi) * cos(c.dec) * cos(H));
  const az = atan2(sin(H), cos(H) * sin(phi) - tan(c.dec) * cos(phi));
  return { altitudeRad: alt, azimuthRad: az };
}

export function sunAltAzDeg(
  date: Date,
  latDeg: number,
  lngDeg: number,
): { altDeg: number; azDeg: number } {
  const { altitudeRad, azimuthRad } = getSunPosition(date, latDeg, lngDeg);
  let azDeg = (azimuthRad * 180) / PI;
  if (azDeg < 0) azDeg += 360;
  return {
    altDeg: (altitudeRad * 180) / PI,
    azDeg,
  };
}
