/**
 * 천구 화면에서 이름 라벨 박스끼리 겹침을 줄이기 — 밝은 별을 먼저 고정하고 나머지는 작은 오프셋을 시도.
 */
export type LabelAnchor = {
  id: string;
  /** 별의 화면 x (px) */
  anchorX: number;
  /** 기본 라벨 top (px) — 별 아래 */
  anchorY: number;
  label: string;
  /** 시각등급 — 낮을수록 밝고 배치 우선 */
  mag: number;
};

export type PlacedLabel = {
  id: string;
  left: number;
  top: number;
  label: string;
};

const OFFSET_TRY: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, 15],
  [0, -15],
  [20, 0],
  [-20, 0],
  [16, 14],
  [-16, 14],
  [16, -14],
  [-16, -14],
  [0, 30],
  [0, -30],
  [28, 0],
  [-28, 0],
  [22, 22],
  [-22, 22],
  [22, -22],
  [-22, -22],
];

function estimateLabelBox(label: string): { w: number; h: number } {
  const fs = 10;
  const w = Math.min(240, Math.max(52, label.length * fs * 0.52 + 14));
  const h = fs + 8;
  return { w, h };
}

function rectsOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
  pad: number,
): boolean {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

/** 밝은 별 라벨을 먼저 배치한 뒤, 겹치면 오프셋을 바꿔 재시도 */
export function layoutNamedStarLabels(anchors: LabelAnchor[]): PlacedLabel[] {
  if (anchors.length === 0) return [];
  const sorted = [...anchors].sort((a, b) => a.mag - b.mag);
  const placedRects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  const out: PlacedLabel[] = [];

  for (const a of sorted) {
    const { w, h } = estimateLabelBox(a.label);
    let placed: { left: number; top: number } | null = null;

    for (const [ox, oy] of OFFSET_TRY) {
      const left = a.anchorX - w / 2 + ox;
      const top = a.anchorY + oy;
      const rect = { left, top, right: left + w, bottom: top + h };
      const clash = placedRects.some((r) => rectsOverlap(rect, r, 3));
      if (!clash) {
        placed = { left, top };
        placedRects.push(rect);
        break;
      }
    }

    if (!placed) {
      const left = a.anchorX - w / 2;
      const top = a.anchorY;
      placed = { left, top };
      placedRects.push({ left, top, right: left + w, bottom: top + h });
    }

    out.push({ id: a.id, left: placed.left, top: placed.top, label: a.label });
  }

  return out;
}
