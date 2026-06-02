import { formatObserverPlaceLabel } from './observer-place-label';

function hasAdminRegion(address: string): boolean {
  return /(특별시|광역시|특별자치|도|시|군|구)/.test(address);
}

/** 장소 검색·일기 저장용 표시 라벨 (시·도·군·구 포함) */
export function formatPlaceSearchItemLabel(item: {
  name: string;
  address: string;
}): string {
  const name = item.name.trim();
  const addr = item.address.trim();

  if (!name && !addr) return '';
  if (!addr) return formatObserverPlaceLabel(name);
  if (!name || name === addr) return formatObserverPlaceLabel(addr);

  if (addr.includes(name)) {
    return formatObserverPlaceLabel(addr);
  }

  if (hasAdminRegion(addr)) {
    return formatObserverPlaceLabel(addr);
  }

  return formatObserverPlaceLabel(`${addr} ${name}`);
}

/** 목록 부제 — 전체 주소(지역 우선) */
export function formatPlaceSearchItemSubtitle(item: {
  name: string;
  address: string;
}): string | null {
  const addr = item.address.trim();
  const name = item.name.trim();
  if (!addr) return null;
  if (addr === name) return null;
  const label = formatPlaceSearchItemLabel(item);
  if (addr === label || addr.replace(/\s+/g, '') === label.replace(/\s+/g, '')) {
    return null;
  }
  return addr;
}
