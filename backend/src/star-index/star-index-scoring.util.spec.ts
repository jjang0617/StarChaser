import {
  aggregateStarIndexScore,
  calcCloudScore,
  calcLightPollutionScore,
  calcMoonEffectScore,
  calcPm25Score,
  calcPrecipitationScore,
  cloudTransmittanceGate,
  precipitationGate,
} from './star-index-scoring.util';

function nightComponents(overrides: Partial<Record<string, number>> = {}) {
  return {
    cloud_score: 95,
    pm25_score: 90,
    light_pollution_score: 96,
    moon_effect_score: 95,
    humidity_score: 100,
    elevation_score: 85,
    wind_score: 100,
    visibility_score: 100,
    temperature_score: 100,
    correction_score: 100,
    precipitation_score: 100,
    ...overrides,
  };
}

describe('star-index-scoring.util', () => {
  it('ranks dark sky above urban under clear night', () => {
    const dark = aggregateStarIndexScore({
      components: nightComponents({ light_pollution_score: 96 }),
      cloudPercent: 15,
      sunAltitudeDeg: -25,
      pop: 0,
      pty: 0,
      visibilityKnown: false,
    });
    const urban = aggregateStarIndexScore({
      components: nightComponents({ light_pollution_score: 18 }),
      cloudPercent: 15,
      sunAltitudeDeg: -25,
      pop: 0,
      pty: 0,
      visibilityKnown: false,
    });
    expect(dark).toBeGreaterThan(urban);
    expect(dark - urban).toBeGreaterThan(15);
  });

  it('heavy cloud caps score even with dark bortle', () => {
    const score = aggregateStarIndexScore({
      components: nightComponents({ cloud_score: 5 }),
      cloudPercent: 92,
      sunAltitudeDeg: -30,
      pop: 5,
      pty: 0,
      visibilityKnown: false,
    });
    expect(score).toBeLessThan(25);
  });

  it('rain PTY crushes score', () => {
    const score = aggregateStarIndexScore({
      components: nightComponents(),
      cloudPercent: 20,
      sunAltitudeDeg: -28,
      pop: 10,
      pty: 1,
      visibilityKnown: false,
    });
    expect(score).toBeLessThan(15);
  });

  it('full moon low altitude hurts less than high', () => {
    const low = calcMoonEffectScore(1, 12);
    const high = calcMoonEffectScore(1, 55);
    expect(low).toBeGreaterThan(high);
    expect(high).toBeLessThan(50);
  });

  it('daytime sun drives score below measurable UI threshold', () => {
    const score = aggregateStarIndexScore({
      components: nightComponents(),
      cloudPercent: 10,
      sunAltitudeDeg: 40,
      pop: 0,
      pty: 0,
      visibilityKnown: false,
    });
    expect(score).toBeLessThan(50);
  });

  it('bortle curve is steep in city', () => {
    expect(calcLightPollutionScore(1)).toBe(100);
    expect(calcLightPollutionScore(5)).toBe(65);
    expect(calcLightPollutionScore(9)).toBe(8);
  });

  it('cloud score is nonlinear', () => {
    expect(calcCloudScore(10)).toBeGreaterThan(calcCloudScore(70));
    expect(calcCloudScore(90)).toBeLessThan(10);
  });

  it('precipitation gates', () => {
    expect(precipitationGate(0, 10)).toBe(1);
    expect(precipitationGate(1, 0)).toBe(0.05);
    expect(precipitationGate(0, 70)).toBeLessThan(0.3);
  });

  it('cloud gate', () => {
    expect(cloudTransmittanceGate(10)).toBe(1);
    expect(cloudTransmittanceGate(85)).toBeLessThan(0.25);
  });

  it('calcPrecipitationScore matches gate', () => {
    expect(calcPrecipitationScore(3, 0)).toBe(5);
    expect(calcPrecipitationScore(0, 0)).toBe(100);
  });
});
