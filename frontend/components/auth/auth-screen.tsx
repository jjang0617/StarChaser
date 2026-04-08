import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import { useAuth } from '../../contexts/auth-context';
import { Button, Input, Screen } from '../ui';
import { ApiRequestError } from '../../lib/api-client';

type Mode = 'login' | 'register';

/**
 * 로그인 / 회원가입 — POST /auth/login · /auth/register
 */
export function AuthScreen() {
  const { theme } = useTheme();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:3333';
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(trimmed, password);
      } else {
        await register(trimmed, password);
      }
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setError(e.message);
      } else {
        // fetch 네트워크 에러는 대부분 TypeError로 떨어짐 (Expo Go에서 127.0.0.1 등)
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed')) {
          setError(
            `네트워크 오류로 서버에 연결할 수 없습니다.\nAPI URL을 확인해 주세요: ${apiUrl}`,
          );
        } else {
          setError('알 수 없는 오류가 발생했습니다.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: theme.foreground }]}>
            StarChaser
          </Text>
          <Text style={[styles.sub, { color: theme.mutedForeground }]}>
            {mode === 'login' ? '로그인' : '회원가입'}
          </Text>

          <View style={styles.tabRow}>
            <Button
              label="로그인"
              variant={mode === 'login' ? 'primary' : 'outline'}
              size="sm"
              onPress={() => {
                setMode('login');
                setError(null);
              }}
            />
            <Button
              label="회원가입"
              variant={mode === 'register' ? 'primary' : 'outline'}
              size="sm"
              onPress={() => {
                setMode('register');
                setError(null);
              }}
            />
          </View>

          <View style={styles.form}>
            <Input
              label="이메일"
              monoLabel
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Input
              label="비밀번호"
              monoLabel
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="6자 이상"
            />
            {error && (
              <Text style={[styles.err, { color: theme.dimRedFg }]}>
                {error}
              </Text>
            )}
            <Button
              label={mode === 'login' ? '로그인' : '가입하기'}
              fullWidth
              loading={loading}
              onPress={() => void onSubmit()}
            />
          </View>

          <Text style={[styles.hint, { color: theme.mutedForeground }]}>
            API: {process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:3333 (기본)'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: 32,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  sub: {
    fontSize: 13,
    marginBottom: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  form: {
    gap: 12,
    marginTop: 8,
  },
  err: {
    fontSize: 12,
  },
  hint: {
    fontSize: 10,
    marginTop: 16,
    fontFamily: 'SpaceMono-Regular',
  },
});
