import * as Astronomy from 'astronomy-engine';

/** 관측지 기준 달 고도·위상 — KASI RiseSet에 고도가 없을 때 Star-Index·캐시용 */
export function moonStateAtObserver(
  latDeg: number,
  lngDeg: number,
  atUtc = new Date(),
): {
  altitude: number;
  phase: number;
  moonAltitudeKnown: true;
} {
  const observer = new Astronomy.Observer(latDeg, lngDeg, 0);
  const eq = Astronomy.Equator(Astronomy.Body.Moon, atUtc, observer, true, true);
  const hor = Astronomy.Horizon(atUtc, observer, eq.ra, eq.dec, 'normal');
  const ill = Astronomy.Illumination(Astronomy.Body.Moon, atUtc);
  const altitude = Math.round(hor.altitude * 10) / 10;
  const phase = Math.min(1, Math.max(0, ill.phase_fraction));
  return { altitude, phase, moonAltitudeKnown: true };
}
