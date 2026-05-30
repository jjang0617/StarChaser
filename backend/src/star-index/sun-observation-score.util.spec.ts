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

  it('multiplier가 태양 고도 상승에 따라 단조 감소한다 (박명 구간)', () => {
    // -18° → 0° 로 태양이 높아질수록 점수는 낮아져야 한다 (역방향 버그 회귀 방지)
    const samples = [-18, -15, -12, -9, -6, -3, 0].map((deg) =>
      applySunAltitudeToStarIndexScore(100, deg),
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
    }
    // 박명 시작과 끝은 뚜렷한 차이가 있어야 한다
    expect(samples[0] - samples[samples.length - 1]).toBeGreaterThan(70);
  });

  it('경계 앵커 값이 의도한 multiplier와 일치한다', () => {
    expect(applySunAltitudeToStarIndexScore(100, -18)).toBe(100); // 1.00
    expect(applySunAltitudeToStarIndexScore(100, -12)).toBe(75); // 0.75
    expect(applySunAltitudeToStarIndexScore(100, -6)).toBe(45); // 0.45
    // 0°는 낮 시간 cap(14)과 박명 끝(15)이 만나는 지점 — 14~15 허용
    expect(applySunAltitudeToStarIndexScore(100, 0)).toBeGreaterThanOrEqual(14);
    expect(applySunAltitudeToStarIndexScore(100, 0)).toBeLessThanOrEqual(15);
  });

  it('경계(-18, -12, -6, 0)에서 점프 없이 연속적이다', () => {
    const boundaries = [-18, -12, -6, 0];
    for (const b of boundaries) {
      const left = applySunAltitudeToStarIndexScore(100, b - 0.01);
      const right = applySunAltitudeToStarIndexScore(100, b + 0.01);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
    }
  });

  it('표시용 관측 점수도 태양 고도 상승에 따라 단조 감소한다', () => {
    const samples = [-18, -12, -6, 0].map((deg) =>
      sunAltitudeToObservationScore(deg),
    );
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
    }
    expect(sunAltitudeToObservationScore(-18)).toBe(100);
  });
});
