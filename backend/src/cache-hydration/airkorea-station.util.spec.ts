import { findSidoByLatLng } from './airkorea-sido-bbox.util';
import {
  findDustStationInCatalog,
  findNearestStation,
  parseStationCatalogFromCtprvn,
  pickRepresentativeStations,
  withStationCoords,
} from './airkorea-station.util';

describe('airkorea-station.util', () => {
  it('parseStationCatalogFromCtprvn keeps sido without coords', () => {
    const rows = parseStationCatalogFromCtprvn([{ stationName: '청송읍' }], '경북');
    expect(rows.length).toBe(1);
    expect(rows[0].stationName).toBe('청송읍');
    expect(rows[0].sidoName).toBe('경북');
    expect(Number.isNaN(rows[0].lat)).toBe(true);
  });

  it('findDustStationInCatalog matches findNearestStation in same sido', () => {
    const catalog = [
      withStationCoords(
        parseStationCatalogFromCtprvn([{ stationName: 'A' }], '경북')[0],
        36.0,
        128.0,
      ),
      withStationCoords(
        parseStationCatalogFromCtprvn([{ stationName: 'B' }], '경북')[0],
        37.0,
        129.0,
      ),
    ];
    expect(findDustStationInCatalog(catalog, 36.05, 128.05).stationName).toBe('A');
  });

  it('findNearestStation uses geocoded entries', () => {
    const catalog = [
      withStationCoords(
        parseStationCatalogFromCtprvn([{ stationName: 'A' }], '경북')[0],
        36.0,
        128.0,
      ),
      withStationCoords(
        parseStationCatalogFromCtprvn([{ stationName: 'B' }], '경북')[0],
        37.0,
        129.0,
      ),
    ];
    const near = findNearestStation(catalog, 36.05, 128.05);
    expect(near.stationName).toBe('A');
  });

  it('findSidoByLatLng resolves 구미 to 경북', () => {
    expect(findSidoByLatLng(36.152673, 128.3432401)).toBe('경북');
  });

  it('pickRepresentativeStations keeps at most 2 per sido', () => {
    const catalog = [
      withStationCoords(
        parseStationCatalogFromCtprvn([{ stationName: '북' }], '강원')[0],
        38.0,
        128.0,
      ),
      withStationCoords(
        parseStationCatalogFromCtprvn([{ stationName: '중' }], '강원')[0],
        37.5,
        128.5,
      ),
      withStationCoords(
        parseStationCatalogFromCtprvn([{ stationName: '남' }], '강원')[0],
        37.0,
        129.0,
      ),
      withStationCoords(
        parseStationCatalogFromCtprvn([{ stationName: '서울A' }], '서울')[0],
        37.56,
        126.98,
      ),
    ];
    const reps = pickRepresentativeStations(catalog, 2);
    const gangwon = reps.filter((s) => s.sidoName === '강원');
    expect(gangwon.length).toBe(2);
    expect(gangwon.map((s) => s.stationName).sort()).toEqual(['남', '북']);
    expect(reps.filter((s) => s.sidoName === '서울').length).toBe(1);
  });
});
