/**
 * StarChaser — ThemeContext
 * normal / night / red 3모드 전역 관리
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
  toggleNight: () => void;  // normal ↔ night
  toggleRed:   () => void;  // red 진입/해제
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('normal');

  const setMode     = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggleNight = useCallback(() => setModeState(p => p === 'normal' ? 'night' : 'normal'), []);
  const toggleRed   = useCallback(() => setModeState(p => p === 'red' ? 'normal' : 'red'), []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    theme:       themes[mode],
    isNightMode: mode !== 'normal',
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
