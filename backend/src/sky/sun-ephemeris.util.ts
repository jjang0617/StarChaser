import * as Astronomy from 'astronomy-engine';

/** 관측지·시각 기준 태양 고도(°) — astronomy-engine */
export function sunAltitudeAtObserver(
  latDeg: number,
  lngDeg: number,
  atUtc = new Date(),
): number {
  const observer = new Astronomy.Observer(latDeg, lngDeg, 0);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, atUtc, observer, true, true);
  const hor = Astronomy.Horizon(atUtc, observer, eq.ra, eq.dec, 'normal');
  return Math.round(hor.altitude * 10) / 10;
}
