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

/* ────────────────────────────────────────────────────────────────────────
 * 1인칭 카메라 투영 (천정 고정 회전 대신 "바라보는 방향" 기준 둘러보기)
 *
 * 화면 중앙 = 시선 방향(viewAz, viewAlt). 별까지의 천구각거리(ρ)와 화면상
 * 방위(카메라 right/up 성분)로 방위등거리(azimuthal-equidistant) 투영한다.
 * 천정을 정면(viewAlt=90)으로 두면 기존 천정중심 표시와 동일한 축척이 된다.
 * ──────────────────────────────────────────────────────────────────────── */

/** 천정→지평선(90°)=46 units 라는 기존 축척 유지 */
export const SKY_UNITS_PER_RAD = 46 / (Math.PI / 2);

/** GL 몰입(원근) 뷰 수직 시야각(°). GL 캔버스와 라벨 오버레이가 공유한다. */
export const GL_FOV_V_DEG = 105;
export const GL_TAN_HALF_FOV = Math.tan((GL_FOV_V_DEG * Math.PI) / 360);

export type Vec3 = [number, number, number];

export type ViewBasis = {
  fwd: Vec3;
  right: Vec3;
  up: Vec3;
};

/** 방위·고도 → 지평좌표 단위벡터 (x=동, y=북, z=상) */
export function dirFromAzAlt(azDeg: number, altDeg: number): Vec3 {
  const a = (azDeg * Math.PI) / 180;
  const e = (altDeg * Math.PI) / 180;
  const ce = Math.cos(e);
  return [ce * Math.sin(a), ce * Math.cos(a), Math.sin(e)];
}

/**
 * 1인칭 "제자리에서 몸 돌리고 고개 드는" 시점 기저.
 *
 * 카메라 right(화면 오른쪽) = 방위각+90°의 지평선 방향 → 항상 수평이고, 천정에서도
 * 방위각에 의존한다. 그래서:
 *  - 고도 0°(정면): right=수평, up=천정 → 좌우 회전은 순수 수평 패닝
 *  - 고도 90°(천정): forward=천정 고정(화면 중심), 방위각이 바뀌면 right/up이 돌아
 *    별이 화면 중심을 축으로 roll
 *  - 중간 고도: 패닝과 roll이 고도에 비례해 자연스럽게 섞임
 *
 * 기존 cross(forward, 월드업) 방식은 천정에서 0벡터가 돼 방위각이 무시되던(회전 안 됨)
 * 특이점이 있었는데, right를 방위각에서 직접 잡아 해소했다(고도<90°에선 결과 동일).
 */
export function computeViewBasis(viewAzDeg: number, viewAltDeg: number): ViewBasis {
  const fwd = dirFromAzAlt(viewAzDeg, viewAltDeg);
  const right = dirFromAzAlt(viewAzDeg + 90, 0);
  // up = cross(right, fwd) (right·fwd=0 이라 이미 정규직교)
  const up: Vec3 = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ];
  return { fwd, right, up };
}

/**
 * 원근(perspective) 투영 — GL 몰입 뷰 전용. 클립좌표(-1..1)를 직접 반환한다.
 * 어안(projectToView)과 달리 사람 눈/카메라처럼 직선 투영이라 화면을 사각형으로
 * 가득 채우고 둥근 테두리가 생기지 않는다. tanHalfFov=tan(수직시야각/2), aspect=가로/세로.
 */
export function projectPerspectiveClip(
  azDeg: number,
  altDeg: number,
  basis: ViewBasis,
  tanHalfFov: number,
  aspect: number,
): { cx: number; cy: number; visible: boolean } {
  const s = dirFromAzAlt(azDeg, altDeg);
  const f = s[0] * basis.fwd[0] + s[1] * basis.fwd[1] + s[2] * basis.fwd[2];
  if (f <= 0.05) return { cx: 0, cy: 0, visible: false };
  const rc = s[0] * basis.right[0] + s[1] * basis.right[1] + s[2] * basis.right[2];
  const uc = s[0] * basis.up[0] + s[1] * basis.up[1] + s[2] * basis.up[2];
  const cx = rc / f / (tanHalfFov * aspect);
  const cy = uc / f / tanHalfFov;
  const visible = cx > -1.18 && cx < 1.18 && cy > -1.18 && cy < 1.18;
  return { cx, cy, visible };
}

/** 별(az,alt)을 시선 기준 viewBox(0–100) 좌표로. visible=false면 시야 뒤/가장자리 */
export function projectToView(
  azDeg: number,
  altDeg: number,
  basis: ViewBasis,
): { nx: number; ny: number; rho: number; visible: boolean } {
  const s = dirFromAzAlt(azDeg, altDeg);
  const fwd = s[0] * basis.fwd[0] + s[1] * basis.fwd[1] + s[2] * basis.fwd[2];
  const rc = s[0] * basis.right[0] + s[1] * basis.right[1] + s[2] * basis.right[2];
  const uc = s[0] * basis.up[0] + s[1] * basis.up[1] + s[2] * basis.up[2];
  const rho = Math.acos(Math.max(-1, Math.min(1, fwd)));
  const dl = Math.hypot(rc, uc) || 1e-6;
  const radius = rho * SKY_UNITS_PER_RAD;
  return {
    nx: 50 + radius * (rc / dl),
    ny: 50 - radius * (uc / dl),
    rho,
    visible: rho < (Math.PI * 110) / 180,
  };
}
