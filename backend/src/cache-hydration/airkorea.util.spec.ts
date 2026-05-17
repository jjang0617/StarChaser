import {
  extractAirKoreaItems,
  pickBestPm25Reading,
  pm25UgToLabel,
} from './airkorea.util';

describe('airkorea.util', () => {
  it('extractAirKoreaItems handles array and item wrapper', () => {
    expect(extractAirKoreaItems({ items: [{ pm25Value: '10' }] })).toHaveLength(1);
    expect(
      extractAirKoreaItems({ items: { item: [{ pm25Value: '20' }, { pm25Value: '30' }] } }),
    ).toHaveLength(2);
  });

  it('pickBestPm25Reading skips invalid values', () => {
    const r = pickBestPm25Reading([
      { pm25Value: '-', stationName: 'A' },
      { pm25Value: '42', pm25Grade: '3', stationName: 'B' },
    ]);
    expect(r?.pm25).toBe(42);
    expect(r?.pm25Label).toBe('나쁨');
    expect(r?.stationName).toBe('B');
  });

  it('pm25UgToLabel matches AirKorea bands', () => {
    expect(pm25UgToLabel(10)).toBe('좋음');
    expect(pm25UgToLabel(25)).toBe('보통');
    expect(pm25UgToLabel(50)).toBe('나쁨');
  });
});
