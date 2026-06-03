import * as Location from 'expo-location';
import type { SkyViewStarDto } from '../../lib/api-client';

/** IAU 별자리 3글자 약어 → 한글(주요 별군만) */
export const CON_LABEL_KO: Record<string, string> = {
  Ori: '오리온',
  Aur: '마차부',
  Tau: '황소',
  Gem: '쌍둥이',
  CMi: '작은개',
  CMa: '큰개',
  Car: '용골',
  Cen: '센타우루스',
  Cru: '남십자',
  Vir: '처녀',
  Lyr: '거문고',
  Cyg: '백조',
  Aql: '독수리',
  UMi: '작은곰',
  Boo: '목동',
  Sco: '전갈',
  UMa: '큰곰',
  PsA: '남쪽물고기',
  Pup: '고물',
  Tri: '여름삼각',
};

/** 별 탭 히트 영역 (px) — 최소 터치 타깃 근사 */
export const STAR_HIT_PX = 44;

export type SkyOverlaySheet =
  | { kind: 'constellation'; con: string; labelKo: string }
  | { kind: 'star'; star: SkyViewStarDto };

export interface SkyTabScreenProps {
  observerLat: number | null;
  observerLng: number | null;
  /** GPS가 없을 때 GET /spots/:id 로 보조 좌표 */
  observerSpotId: string | null;
  observeAtIso: string;
  onShiftHours: (deltaHours: number) => void;
  onObserveNow: () => void;
  onSessionInvalidated: () => Promise<void>;
  /** 기기 GPS로 천구 중심을 잡는 중인지 */
  skyUsesGps: boolean;
  /** 마이페이지에서 위치 기능을 켠 경우에만 OS 권한 UI 표시 */
  locationFeaturesEnabled?: boolean;
  /** expo-location 전경 위치 권한(null이면 아직 조회 전) */
  locationPermissionStatus?: Location.PermissionResponse['status'] | null;
  /** 위치 권한 시스템 다이얼로그 재요청 */
  onRequestLocationPermission?: () => void | Promise<void>;
}

export const SKY_RENDER_STORAGE_KEY = 'starChaser:skyRenderMode';
export const SKY_CONTROLS_EXPANDED_KEY = 'starChaser:skyControlsExpanded';

/** 방위 UI 스무딩 — 클수록 천천히 따라감(초) */
export const HEADING_SMOOTH_TAU_SEC = 0.42;
export const HEADING_MAX_SAMPLE_DT_SEC = 0.14;
/** 자이로 보조 시 나침반 보정 강도(한 스텝당) */
export const COMPASS_BLEND_MOTION = 0.035;
/** 자이로만 쓸 때 각속도 감도 */
export const GYRO_YAW_GAIN = 0.68;
/** 초당 최대 회전(급격한 나침반 튐 완화) */
export const HEADING_MAX_RATE_DEG_PER_SEC = 88;

/** 1인칭 자유 시점 카메라 — 드래그 감도(°/px)와 시선 고도 범위 */
export const VIEW_YAW_GAIN = 0.2;
export const VIEW_PITCH_GAIN = 0.2;
/** 시선 고도: 지평선(0°, 정면)부터 천정(90°, 수직으로 올려다봄)까지만 */
export const VIEW_ALT_MIN = 0;
export const VIEW_ALT_MAX = 90;
/** 처음 시선: 남쪽 지평선을 정면으로(서서 앞을 보는 느낌) */
export const VIEW_DEFAULT_YAW = 180;
export const VIEW_DEFAULT_PITCH = 0;

export function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function normYaw(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** 0~360° 최단 호 보간 */
export function lerpAngleDeg(from: number, to: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const delta = ((to - from + 540) % 360) - 180;
  return normYaw(from + delta * clamped);
}

export function headingSmoothAlpha(dtSec: number, tauSec = HEADING_SMOOTH_TAU_SEC): number {
  const dt = Math.max(0, Math.min(HEADING_MAX_SAMPLE_DT_SEC, dtSec));
  return 1 - Math.exp(-dt / Math.max(0.05, tauSec));
}

export function smoothHeadingToward(
  prev: number | null,
  target: number,
  dtSec: number,
  tauSec = HEADING_SMOOTH_TAU_SEC,
): number {
  if (prev == null) return normYaw(target);
  const dt = Math.max(0, Math.min(HEADING_MAX_SAMPLE_DT_SEC, dtSec));
  const alpha = headingSmoothAlpha(dt, tauSec);
  let next = lerpAngleDeg(prev, normYaw(target), alpha);
  const step = ((next - prev + 540) % 360) - 180;
  const maxStep = HEADING_MAX_RATE_DEG_PER_SEC * dt;
  if (Math.abs(step) > maxStep) {
    next = normYaw(prev + Math.sign(step) * maxStep);
  }
  return next;
}

/** 한 타일 폭(viewBox 단위). 360°↔2타일이라 좌우로 끝없이 돌려도 이음새가 없음 */
export const CAMP_TILE = 90;
/** 지평선 화면 높이: 정면(0°)에서 하단에 낮게, 올려다볼수록 아래로 내려가 사라짐 */
export const CAMP_HORIZON_BASE = 82;
export const CAMP_HORIZON_SLOPE = 0.5;

export type CampColors = {
  pine: string;
  trunk: string;
  tent: string;
  accent: string;
};
