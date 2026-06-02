import {
  localityTokensFromQuery,
  provinceTokenFromQuery,
  textMatchesLocalityCore,
  textMatchesProvince,
} from './places-search-query.util';

const LOW_PRIORITY_NAME = /(경찰서|파출소|우체국|주민센터|행정복지센터)/;

export type PlaceSearchRankItem = {
  lat: number;
  lng: number;
  name: string;
  address: string;
};

export function rankPlaceSearchResults(
  items: PlaceSearchRankItem[],
  originalQuery: string,
): PlaceSearchRankItem[] {
  const parts = originalQuery.trim().split(/\s+/).filter(Boolean);
  const tokens = parts.map((t) => t.toLowerCase());
  const province = provinceTokenFromQuery(originalQuery);
  const localityCores = localityTokensFromQuery(originalQuery);

  const score = (item: PlaceSearchRankItem): number => {
    const hay = `${item.name} ${item.address}`.toLowerCase();
    let s = 0;

    if (hay.includes(originalQuery.trim().toLowerCase())) s += 30;

    for (const t of tokens) {
      if (hay.includes(t)) s += 10;
    }

    for (const core of localityCores) {
      if (textMatchesLocalityCore(hay, core)) s += 14;
      if (item.name.toLowerCase().includes(core)) s += 10;
    }

    if (province) {
      if (textMatchesProvince(hay, province)) s += 22;
      else s -= 18;
    }

    if (LOW_PRIORITY_NAME.test(item.name) && localityCores.length > 0) {
      const main = localityCores[localityCores.length - 1];
      if (!item.name.toLowerCase().includes(main)) s -= 8;
    }

    const hasRegionInAddress =
      Boolean(item.address.trim()) &&
      (province ? textMatchesProvince(item.address, province) : item.address.length > 6);
    if (!hasRegionInAddress) s -= 4;

    return s;
  };

  return [...items].sort((a, b) => score(b) - score(a));
}

export function finalizePlaceSearchResults(
  items: PlaceSearchRankItem[],
  originalQuery: string,
  limit: number,
): PlaceSearchRankItem[] {
  if (!items.length) return [];

  const ranked = rankPlaceSearchResults(items, originalQuery);
  const province = provinceTokenFromQuery(originalQuery);
  const localityCores = localityTokensFromQuery(originalQuery);
  const minDesired = Math.min(3, limit);

  if (province && localityCores.length > 0) {
    const strong = ranked.filter((item) => {
      const hay = `${item.name} ${item.address}`;
      const provinceOk = textMatchesProvince(hay, province);
      const localityOk = localityCores.some((c) => textMatchesLocalityCore(hay, c));
      return provinceOk && localityOk;
    });
    if (strong.length >= minDesired) {
      return strong.slice(0, limit);
    }

    const provinceOnly = ranked.filter((item) =>
      textMatchesProvince(`${item.name} ${item.address}`, province),
    );
    if (provinceOnly.length >= minDesired) {
      return provinceOnly.slice(0, limit);
    }
  }

  if (localityCores.length > 0) {
    const localMatch = ranked.filter((item) => {
      const hay = `${item.name} ${item.address}`.toLowerCase();
      return localityCores.some((c) => textMatchesLocalityCore(hay, c));
    });
    if (localMatch.length >= minDesired) {
      return localMatch.slice(0, limit);
    }
  }

  return ranked.slice(0, limit);
}
