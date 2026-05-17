import { findSidoByLatLng } from './airkorea-sido-bbox.util';
import {
  findNearestStation,
  parseStationCatalogFromCtprvn,
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
});
