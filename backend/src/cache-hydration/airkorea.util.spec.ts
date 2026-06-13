import {
  extractAirKoreaItems,
  pickBestPm25Reading,
  pickPm25ForStationName,
  pickPm25SidoFallback,
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

  it('pickPm25ForStationName matches fuzzy station names', () => {
    const rows = [
      { stationName: '제주', pm25Value: '18', pm25Grade: '2', dataTime: '2026-01-01 12:00' },
      { stationName: '연동', pm25Value: '30', pm25Grade: '3', dataTime: '2026-01-01 11:00' },
    ];
    const r = pickPm25ForStationName(rows, '제주항');
    expect(r?.pm25).toBe(18);
    expect(r?.stationName).toBe('제주');
  });

  it('pickPm25SidoFallback uses any valid station in sido batch', () => {
    const r = pickPm25SidoFallback([
      { stationName: 'A', pm25Value: '-' },
      { stationName: 'B', pm25Value: '22', pm25Grade: '2' },
    ]);
    expect(r?.pm25).toBe(22);
  });
});
