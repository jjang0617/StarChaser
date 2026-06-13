import {
  julianDateUT,
  localSiderealDegrees,
  raDecToAltAz,
} from './sky-astronomy.util';

describe('sky-astronomy.util', () => {
  it('julianDateUT — J2000.0 근처', () => {
    const jd = julianDateUT(new Date('2000-01-01T12:00:00.000Z'));
    expect(jd).toBeGreaterThan(2451544);
    expect(jd).toBeLessThan(2451546);
  });

  it('raDecToAltAz — 북극 근처 별은 고위도에서 높게', () => {
    const jd = julianDateUT(new Date('2026-05-01T12:00:00.000Z'));
    const lst = localSiderealDegrees(jd, 127); // 서울 경도 근처
    const { altDeg } = raDecToAltAz(37.75, 89.26, 37.57, lst); // Polaris 근처
    expect(altDeg).toBeGreaterThan(30);
  });
});
