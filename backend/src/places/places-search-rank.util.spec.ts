import {
  finalizePlaceSearchResults,
  rankPlaceSearchResults,
  type PlaceSearchRankItem,
} from './places-search-rank.util';

const item = (
  name: string,
  address: string,
  lat = 37.5,
  lng = 127.0,
): PlaceSearchRankItem => ({ name, address, lat, lng });

describe('places-search-rank.util', () => {
  it('prefers 강원 평창 over unrelated 평창', () => {
    const rows = [
      item('평창경찰서', '서울특별시 강남구'),
      item('대관령면', '강원특별자치도 평창군'),
      item('평창터미널', '강원특별자치도 평창군'),
      item('평창역', '강원특별자치도 평창읍'),
    ];
    const out = finalizePlaceSearchResults(rows, '강원 평창', 10);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].address).toMatch(/강원/);
    expect(out.some((r) => r.name.includes('평창'))).toBe(true);
  });

  it('ranks full query match highest', () => {
    const rows = [
      item('성산일출봉', '제주특별자치도 서귀포시 성산읍'),
      item('일출', '제주특별자치도'),
    ];
    const ranked = rankPlaceSearchResults(rows, '제주 성산일출봉');
    expect(ranked[0].name).toContain('성산');
  });
});
