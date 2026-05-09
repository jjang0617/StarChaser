/** 천구 원형 투영 — SVG·OpenGL 공통 */

export function azAltToNorm(azDeg: number, altDeg: number): { nx: number; ny: number } {
  const r = Math.max(0, Math.min(48, ((90 - altDeg) / 90) * 46));
  const az = (azDeg * Math.PI) / 180;
  return {
    nx: 50 + r * Math.sin(az),
    ny: 50 - r * Math.cos(az),
  };
}

export function magToRadius(mag: number): number {
  const t = Math.max(-2, Math.min(6, mag));
  return Math.max(0.55, 2.4 - t * 0.28);
}

export function planetDiskRadius(mag: number): number {
  const t = Math.max(-5, Math.min(2, mag));
  return Math.max(2.2, 4.2 - t * 0.35);
}

/** 자북 기준 시계 방향 skyRotation(°)과 동일 — 중심 (50,50) 기준 회전 */
export function rotateSkyNorm(
  nx: number,
  ny: number,
  skyRotationDeg: number,
): { nx: number; ny: number } {
  const rad = (skyRotationDeg * Math.PI) / 180;
  const cx = 50;
  const cy = 50;
  const dx = nx - cx;
  const dy = ny - cy;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { nx: cx + dx * c - dy * s, ny: cy + dx * s + dy * c };
}

/** viewBox 0–100 좌표 → 레이아웃 px (Svg `preserveAspectRatio="xMidYMid slice"` 와 맞춤) */
export function normToLayoutSlice(
  nx: number,
  ny: number,
  layoutW: number,
  layoutH: number,
): { x: number; y: number } {
  const scale = Math.max(layoutW / 100, layoutH / 100);
  const ox = (layoutW - 100 * scale) / 2;
  const oy = (layoutH - 100 * scale) / 2;
  return { x: ox + nx * scale, y: oy + ny * scale };
}
