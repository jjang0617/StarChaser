import {
  buildPlaceSearchQueries,
  localityTokensFromQuery,
  normalizeProvinceToken,
  provinceTokenFromQuery,
  textMatchesLocalityCore,
  textMatchesProvince,
} from './places-search-query.util';

describe('places-search-query.util', () => {
  it('normalizes 강원특별자치도 in query', () => {
    expect(provinceTokenFromQuery('강원특별자치도 평창군')).toBe('강원');
    expect(normalizeProvinceToken('강원특별자치도')).toBe('강원');
  });

  it('builds multiple queries for region + place', () => {
    const queries = buildPlaceSearchQueries('강원 평창');
    expect(queries[0]).toBe('강원 평창');
    expect(queries).toContain('평창');
  });

  it('extracts locality cores', () => {
    expect(localityTokensFromQuery('제주 서귀포시 성산읍')).toEqual(
      expect.arrayContaining(['성산', '서귀포']),
    );
  });

  it('matches province and locality in address', () => {
    expect(textMatchesProvince('강원특별자치도 평창군', '강원')).toBe(true);
    expect(textMatchesLocalityCore('평창군 대관령면', '평창')).toBe(true);
  });
});
