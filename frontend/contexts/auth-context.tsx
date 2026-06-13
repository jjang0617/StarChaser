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
  patchStoredUser,
  saveSession,
  type StoredUser,
} from '../lib/auth-storage';
import { ensureFreshAccessToken, postAuthJson } from '../lib/api-client';
import type { UserProfileDto } from '../lib/types/api';
import { getJwtPayload } from '../lib/jwt-utils';
import { registerDevicePushTokenWithServer } from '../lib/register-fcm-token';

interface AuthContextValue {
  /** AsyncStorage + 선택적 선제 갱신 완료 */
  isHydrated: boolean;
  /** refresh 토큰이 있고 세션 유효(또는 갱신 성공) */
  isAuthenticated: boolean;
  user: StoredUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string, verificationCode: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 로그아웃 직후 Auth 화면에서 완료 알림 */
  justLoggedOut: boolean;
  clearJustLoggedOut: () => void;
  /** 회원 탈퇴 완료 직후 Auth 화면 안내 */
  justAccountDeleted: boolean;
  clearJustAccountDeleted: () => void;
  /** 탈퇴 API 성공 후 세션은 이미 정리된 상태 — 화면 전환만 수행 */
  completeAccountDeletion: () => void;
  /** refresh 실패 등 — 저장소 비우고 로그인 화면으로 */
  onSessionInvalidated: () => Promise<void>;
  /** 프로필 수정 후 context·AsyncStorage 동기화 */
  applyProfile: (profile: UserProfileDto) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromAccessToken(accessToken: string): StoredUser | null {
  const p = getJwtPayload(accessToken);
  if (!p?.sub) return null;
  return {
    id: p.sub,
    email: typeof p.email === 'string' ? p.email : '',
    nickname: '',
    avatarUrl: null,
  };
}

function storedUserFromProfile(profile: UserProfileDto): StoredUser {
  return {
    id: profile.id,
    email: profile.email,
    nickname: profile.nickname ?? '',
    avatarUrl: profile.avatarUrl ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const [justAccountDeleted, setJustAccountDeleted] = useState(false);

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
            ? {
                id: u.id,
                email: u.email || '(이메일 없음)',
                nickname: u.nickname || '',
                avatarUrl: u.avatarUrl ?? null,
              }
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
    const u = storedUserFromProfile(data.user);
    await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: u });
    setHasValidSession(true);
    setUser(u);
    void registerDevicePushTokenWithServer();
  }, []);

  const register = useCallback(async (email: string, password: string, nickname: string, verificationCode: string) => {
    const data = await postAuthJson('/auth/register', { email, password, nickname, verificationCode });
    const u = storedUserFromProfile(data.user);
    await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: u });
    setHasValidSession(true);
    setUser(u);
    void registerDevicePushTokenWithServer();
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setHasValidSession(false);
    setUser(null);
    setJustAccountDeleted(false);
    setJustLoggedOut(true);
  }, []);

  const clearJustLoggedOut = useCallback(() => {
    setJustLoggedOut(false);
  }, []);

  const clearJustAccountDeleted = useCallback(() => {
    setJustAccountDeleted(false);
  }, []);

  const completeAccountDeletion = useCallback(() => {
    setHasValidSession(false);
    setUser(null);
    setJustLoggedOut(false);
    setJustAccountDeleted(true);
  }, []);

  const onSessionInvalidated = useCallback(async () => {
    await clearSession();
    setHasValidSession(false);
    setUser(null);
  }, []);

  const applyProfile = useCallback(async (profile: UserProfileDto) => {
    const u = storedUserFromProfile(profile);
    await patchStoredUser(u);
    setUser(u);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isHydrated,
      isAuthenticated: hasValidSession,
      user,
      login,
      register,
      logout,
      justLoggedOut,
      clearJustLoggedOut,
      justAccountDeleted,
      clearJustAccountDeleted,
      completeAccountDeletion,
      onSessionInvalidated,
      applyProfile,
    }),
    [
      isHydrated,
      hasValidSession,
      user,
      login,
      register,
      logout,
      justLoggedOut,
      clearJustLoggedOut,
      justAccountDeleted,
      clearJustAccountDeleted,
      completeAccountDeletion,
      onSessionInvalidated,
      applyProfile,
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
