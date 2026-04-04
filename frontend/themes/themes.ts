/**
 * StarChaser — 테마 토큰
 *
 * 사용자-facing: night, red / 개발 확인용: normal
 *
 * Anti-AI 원칙: Shadow 없음 · Border 중심 · 절제된 Amber · 고밀도
 *
 * ⚠️ React Native는 OKLCH 미지원 → hex 값 사용
 * StyleSheet에서는 이 파일의 토큰만 참조
 */

export type ThemeMode = 'normal' | 'night' | 'red';

export interface ThemeTokens {
  // ── shadcn 시스템 토큰 ──
  background:          string;
  foreground:          string;
  card:                string;
  cardForeground:      string;
  muted:               string;
  mutedForeground:     string;
  border:              string;
  borderSubtle:        string;   // 0.5px 내부 구분선
  input:               string;
  ring:                string;
  primary:             string;
  primaryForeground:   string;
  secondary:           string;
  secondaryForeground: string;
  destructive:         string;
  destructiveFg:       string;

  // ── StarChaser 전용 ──
  starGold:            string;   // Amber — 수치 데이터만
  nebulaSteel:         string;   // Steel Gray — 구조
  moonlight:           string;   // 달빛 텍스트
  dimRed:              string;   // Red Mode 배경 계열
  dimRedFg:            string;   // Red Mode 텍스트

  // ── 레이아웃 ──
  radius:              number;   // 기본 border-radius (px)
  radiusSm:            number;
  radiusLg:            number;
}

// ============================================================
//  NORMAL MODE
// ============================================================
export const normalTheme: ThemeTokens = {
  background:          '#161618',
  foreground:          '#DEDDE8',
  card:                '#1A1A1D',
  cardForeground:      '#DEDDE8',
  muted:               '#1E1E22',
  mutedForeground:     '#6E6E82',
  border:              '#2C2C34',
  borderSubtle:        '#202028',
  input:               '#1A1A20',
  ring:                '#B8922A',
  primary:             '#B8922A',
  primaryForeground:   '#161618',
  secondary:           '#222228',
  secondaryForeground: '#A8A8BC',
  destructive:         '#7A2E1A',
  destructiveFg:       '#FFFFFF',

  starGold:            '#B8922A',
  nebulaSteel:         '#4A4A5E',
  moonlight:           '#C8C8D8',
  dimRed:              '#7A2E1A',
  dimRedFg:            '#C85030',

  radius:              6,
  radiusSm:            4,
  radiusLg:            8,
};

// ============================================================
//  NIGHT MODE — 더 어둡게 (현장 관측)
// ============================================================
export const nightTheme: ThemeTokens = {
  ...normalTheme,
  background:   '#0E0E10',
  card:         '#121214',
  muted:        '#161618',
  border:       '#242430',
  borderSubtle: '#1A1A22',
  input:        '#121218',
};

// ============================================================
//  RED MODE — 야간 시력 보호 (암적응)
//  Blue/Green 계열 완전 제거 → Dark Red/Grey만
// ============================================================
export const redTheme: ThemeTokens = {
  background:          '#0A0604',
  foreground:          '#C85030',
  card:                '#0E0806',
  cardForeground:      '#C85030',
  muted:               '#120A06',
  mutedForeground:     '#5A2818',
  border:              '#2A1008',
  borderSubtle:        '#1A0A06',
  input:               '#0E0806',
  ring:                '#C85030',
  primary:             '#C85030',
  primaryForeground:   '#0A0604',
  secondary:           '#140C08',
  secondaryForeground: '#7A3820',
  destructive:         '#C85030',
  destructiveFg:       '#FFFFFF',

  starGold:            '#C85030',
  nebulaSteel:         '#3A1E14',
  moonlight:           '#A84028',
  dimRed:              '#C85030',
  dimRedFg:            '#C85030',

  radius:              6,
  radiusSm:            4,
  radiusLg:            8,
};

export const themes: Record<ThemeMode, ThemeTokens> = {
  normal: normalTheme,
  night:  nightTheme,
  red:    redTheme,
};