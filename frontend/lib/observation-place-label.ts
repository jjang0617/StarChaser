export type ObservationLocationMode = 'current' | 'spot' | 'custom';

/** 일기 저장 시 DB에 넣을 장소 문자열 (시·도 포함 우선) */
export function observationPlaceLabelForSave(params: {
  mode: ObservationLocationMode;
  label: string;
  starIndexName: string;
}): string {
  if (params.mode === 'spot') {
    const full = params.starIndexName.trim();
    if (full) return full;
  }
  const label = params.label.trim();
  if (label) return label;
  return params.starIndexName.trim() || '관측 위치';
}

export function formatObservationPlaceLabel(
  placeLabel: string | null | undefined,
): string | null {
  const t = placeLabel?.trim();
  return t || null;
}
