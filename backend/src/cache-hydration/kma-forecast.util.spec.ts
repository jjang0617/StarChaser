import {
  parseForecastNumbers,
  resolveVilageFcstBaseKst,
  skyCodeToCloudPercent,
} from './kma-forecast.util';

describe('kma-forecast.util', () => {
  it('skyCodeToCloudPercent maps KMA SKY codes', () => {
    expect(skyCodeToCloudPercent(1)).toBe(15);
    expect(skyCodeToCloudPercent(3)).toBe(65);
    expect(skyCodeToCloudPercent(4)).toBe(90);
  });

  it('parseForecastNumbers uses nearest future slot, not first row', () => {
    const items = [
      { fcstDate: '20260517', fcstTime: '0600', category: 'SKY', fcstValue: '1' },
      { fcstDate: '20260517', fcstTime: '1200', category: 'SKY', fcstValue: '4' },
      { fcstDate: '20260517', fcstTime: '0600', category: 'REH', fcstValue: '80' },
      { fcstDate: '20260517', fcstTime: '1200', category: 'REH', fcstValue: '55' },
    ];
    const now = new Date('2026-05-17T03:00:00Z'); // KST 12:00
    const parsed = parseForecastNumbers(items, now);
    expect(parsed.skyCode).toBe(4);
    expect(parsed.cloud).toBe(90);
    expect(parsed.humidity).toBe(55);
  });

  it('resolveVilageFcstBaseKst picks latest issued base before now', () => {
    const now = new Date('2026-05-17T01:00:00Z'); // KST 10:00
    const { baseDate, baseTime } = resolveVilageFcstBaseKst(now);
    expect(baseDate).toBe('20260517');
    expect(baseTime).toBe('0800');
  });
});
