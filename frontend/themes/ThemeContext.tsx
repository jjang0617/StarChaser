/**
 * StarChaser — ThemeContext
 *
 * - night / red: 실제 앱에서 사용자가 쓰는 모드
 * - normal: 개발 중 팔레트·레이아웃 확인용 (setMode('normal') 등)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { themes, type ThemeMode, type ThemeTokens } from './themes';

interface ThemeContextValue {
  mode:        ThemeMode;
  theme:       ThemeTokens;
  isNightMode: boolean;
  isRedMode:   boolean;
  setMode:     (mode: ThemeMode) => void;
  toggleNight: () => void;  // 개발용: normal ↔ night
  toggleRed:   () => void;  // 사용자: night ↔ red
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('night');

  const setMode     = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggleNight = useCallback(() => setModeState(p => p === 'normal' ? 'night' : 'normal'), []);
  const toggleRed   = useCallback(() => setModeState(p => p === 'red' ? 'night' : 'red'), []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    theme:       themes[mode],
    isNightMode: mode === 'night',
    isRedMode:   mode === 'red',
    setMode,
    toggleNight,
    toggleRed,
  }), [mode, setMode, toggleNight, toggleRed]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
