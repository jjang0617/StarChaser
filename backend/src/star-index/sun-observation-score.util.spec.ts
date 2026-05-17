import {
  applySunAltitudeToStarIndexScore,
  sunAltitudeToObservationScore,
} from './sun-observation-score.util';

describe('sun-observation-score.util', () => {
  it('keeps daytime scores low but not identical', () => {
    const high = applySunAltitudeToStarIndexScore(88, 35);
    const low = applySunAltitudeToStarIndexScore(62, 35);
    expect(high).toBeLessThanOrEqual(8);
    expect(low).toBeLessThanOrEqual(8);
    expect(high).toBeGreaterThan(low);
    expect(high - low).toBeGreaterThanOrEqual(2);
  });

  it('allows high scores when sun is well below horizon', () => {
    expect(applySunAltitudeToStarIndexScore(82, -25)).toBe(82);
    expect(sunAltitudeToObservationScore(-25)).toBe(100);
  });

  it('twilight is partial penalty', () => {
    const score = applySunAltitudeToStarIndexScore(80, -6);
    expect(score).toBeGreaterThan(30);
    expect(score).toBeLessThan(80);
  });
});
