import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearSession,
  loadUser,
  saveSession,
  type StoredUser,
} from '../lib/auth-storage';
import { ensureFreshAccessToken, postAuthJson } from '../lib/api-client';
import { getJwtPayload } from '../lib/jwt-utils';
import { registerDevicePushTokenWithServer } from '../lib/register-fcm-token';

interface AuthContextValue {
  /** AsyncStorage + 선택적 선제 갱신 완료 */
  isHydrated: boolean;
  /** refresh 토큰이 있고 세션 유효(또는 갱신 성공) */
  isAuthenticated: boolean;
  user: StoredUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** refresh 실패 등 — 저장소 비우고 로그인 화면으로 */
  onSessionInvalidated: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromAccessToken(accessToken: string): StoredUser | null {
  const p = getJwtPayload(accessToken);
  if (!p?.sub) return null;
  return {
    id: p.sub,
    email: typeof p.email === 'string' ? p.email : '',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await ensureFreshAccessToken();
        if (cancelled) return;
        if (!session) {
          setHasValidSession(false);
          setUser(null);
          return;
        }
        setHasValidSession(true);
        const u =
          session.user ??
          userFromAccessToken(session.accessToken) ??
          null;
        setUser(
          u
            ? { id: u.id, email: u.email || '(이메일 없음)' }
            : null,
        );
        void registerDevicePushTokenWithServer();
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await postAuthJson('/auth/login', { email, password });
    await saveSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
    setHasValidSession(true);
    setUser(data.user);
    void registerDevicePushTokenWithServer();
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const data = await postAuthJson('/auth/register', { email, password });
    await saveSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
    setHasValidSession(true);
    setUser(data.user);
    void registerDevicePushTokenWithServer();
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setHasValidSession(false);
    setUser(null);
  }, []);

  const onSessionInvalidated = useCallback(async () => {
    await clearSession();
    setHasValidSession(false);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isHydrated,
      isAuthenticated: hasValidSession,
      user,
      login,
      register,
      logout,
      onSessionInvalidated,
    }),
    [
      isHydrated,
      hasValidSession,
      user,
      login,
      register,
      logout,
      onSessionInvalidated,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용하세요.');
  return ctx;
}
