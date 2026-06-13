/**
 * StarChaser — 테마 토큰
 *
 * 사용자-facing: night, red / 개발 확인용: normal
 *
 * Figma Redesign: 딥 네이비 · 아이스 블루 글로우 · 글래스 카드 · iOS형 라운드
 *
 * ⚠️ React Native는 OKLCH 미지원 → hex / rgba 사용
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
  borderSubtle:        string;
  input:               string;
  ring:                string;
  primary:             string;
  primaryForeground:   string;
  secondary:           string;
  secondaryForeground: string;
  destructive:         string;
  destructiveFg:       string;

  // ── Figma Ice & Space ──
  deepNavy:              string;
  cardBorder:            string;
  inputBackground:       string;
  primaryGlow:           string;
  primaryGlowMuted:      string;
  primaryGlowBorder:     string;
  accent:                string;
  overlay:               string;

  // ── StarChaser 전용 (데이터·강조 — 골드 대신 아이스 블루) ──
  starGold:            string;
  nebulaSteel:         string;
  moonlight:           string;
  dimRed:              string;
  dimRedFg:            string;

  // ── 레이아웃 ──
  radius:              number;
  radiusSm:            number;
  radiusLg:            number;
  radiusXl:            number;
}

/** Figma theme.css 기준 — Ice & Space (항상 다크) */
const iceBase: Omit<ThemeTokens, 'dimRed' | 'dimRedFg'> = {
  background:          '#030712',
  foreground:          '#F8FAFC',
  card:                'rgba(8, 15, 30, 0.72)',
  cardForeground:      '#F8FAFC',
  muted:               'rgba(71, 85, 105, 0.3)',
  mutedForeground:     '#94A3B8',
  border:              'rgba(255, 255, 255, 0.1)',
  borderSubtle:        'rgba(255, 255, 255, 0.06)',
  input:               'rgba(255, 255, 255, 0.05)',
  ring:                'rgba(138, 220, 255, 0.5)',
  primary:             '#EAF6FF',
  primaryForeground:   '#030712',
  secondary:           '#5DADEB',
  secondaryForeground: '#F8FAFC',
  destructive:         '#EF4444',
  destructiveFg:       '#F8FAFC',

  deepNavy:            '#07111F',
  cardBorder:          'rgba(255, 255, 255, 0.1)',
  inputBackground:     'rgba(15, 23, 42, 0.5)',
  primaryGlow:         '#8DDCFF',
  primaryGlowMuted:    'rgba(141, 220, 255, 0.1)',
  primaryGlowBorder:   'rgba(141, 220, 255, 0.3)',
  accent:              '#8DDCFF',
  overlay:             'rgba(0, 0, 0, 0.5)',

  starGold:            '#8DDCFF',
  nebulaSteel:         '#64748B',
  moonlight:           '#EAF6FF',

  radius:              12,
  radiusSm:            8,
  radiusLg:            16,
  radiusXl:            24,
};

// ============================================================
//  NORMAL MODE — 개발·프리뷰 (Figma와 동일 팔레트)
// ============================================================
export const normalTheme: ThemeTokens = {
  ...iceBase,
  dimRed:              '#EF4444',
  dimRedFg:            '#FCA5A5',
};

// ============================================================
//  NIGHT MODE — 현장 관측 (Figma 기본 톤, 배경만 약간 더 깊게)
// ============================================================
export const nightTheme: ThemeTokens = {
  ...iceBase,
  background:   '#020617',
  deepNavy:     '#050C18',
  card:         'rgba(6, 12, 24, 0.82)',
  dimRed:       '#EF4444',
  dimRedFg:     '#FCA5A5',
};

// ============================================================
//  RED MODE — 야간 시력 보호 (암적응)
//  Blue/Green 계열 완전 제거 → Dark Red/Grey만
// ============================================================
export const redTheme: ThemeTokens = {
  background:          '#0A0604',
  foreground:          '#C85030',
  card:                'rgba(14, 8, 6, 0.85)',
  cardForeground:      '#C85030',
  muted:               'rgba(90, 40, 24, 0.35)',
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

  deepNavy:            '#0A0604',
  cardBorder:          '#2A1008',
  inputBackground:     '#0E0806',
  primaryGlow:         '#C85030',
  primaryGlowMuted:    'rgba(200, 80, 48, 0.12)',
  primaryGlowBorder:   'rgba(200, 80, 48, 0.35)',
  accent:              '#C85030',
  overlay:             'rgba(0, 0, 0, 0.55)',

  starGold:            '#C85030',
  nebulaSteel:         '#3A1E14',
  moonlight:           '#A84028',
  dimRed:              '#C85030',
  dimRedFg:            '#C85030',

  radius:              12,
  radiusSm:            8,
  radiusLg:            16,
  radiusXl:            24,
};

export const themes: Record<ThemeMode, ThemeTokens> = {
  normal: normalTheme,
  night:  nightTheme,
  red:    redTheme,
};

/** 회원 탈퇴 등 위험 액션 — Night Vision(red)에서도 대비되게 */
export function dangerAccent(theme: ThemeTokens, isRedMode: boolean) {
  if (isRedMode) {
    return {
      title: '#FF8585',
      subtitle: '#FFAE9E',
      icon: '#FF7070',
      iconBg: 'rgba(255, 110, 100, 0.16)',
      iconBorder: 'rgba(255, 130, 115, 0.42)',
    };
  }
  return {
    title: theme.destructive,
    subtitle: theme.dimRedFg,
    icon: theme.destructive,
    iconBg: 'rgba(239, 68, 68, 0.12)',
    iconBorder: 'rgba(239, 68, 68, 0.32)',
  };
}
