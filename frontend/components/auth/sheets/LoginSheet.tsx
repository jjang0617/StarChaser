import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Input } from '../../ui';
import { AuthSubmitButton } from '../AuthSubmitButton';
import { KakaoSubmitButton } from '../KakaoSubmitButton';
import {
  emailValidationError,
  passwordValidationError,
} from '../auth-validation';
import { authFormStyles as styles } from './auth-form-styles';

export type LoginSheetProps = {
  theme: { dimRedFg: string; primaryGlow: string };
  loginEmail: string;
  setLoginEmail: (v: string) => void;
  loginPassword: string;
  setLoginPassword: (v: string) => void;
  loginEmailError: string | null;
  setLoginEmailError: (v: string | null) => void;
  loginPasswordError: string | null;
  setLoginPasswordError: (v: string | null) => void;
  loginError: string | null;
  setLoginError: (v: string | null) => void;
  loginLoading: boolean;
  onLoginSubmit: () => void | Promise<void>;
  onResetPassword: () => void;
  kakaoLoading: boolean;
  onKakaoPress: () => void;
};

export function LoginSheet({
  theme,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginEmailError,
  setLoginEmailError,
  loginPasswordError,
  setLoginPasswordError,
  loginError,
  setLoginError,
  loginLoading,
  onLoginSubmit,
  onResetPassword,
  kakaoLoading,
  onKakaoPress,
}: LoginSheetProps) {
  return (
    <View style={styles.form}>
      <Input
        label="이메일"
        monoLabel
        value={loginEmail}
        onChangeText={(text) => {
          setLoginEmail(text);
          setLoginEmailError(null);
          setLoginError(null);
        }}
        onBlur={() => {
          setLoginEmailError(emailValidationError(loginEmail));
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@example.com"
        errorMessage={loginEmailError ?? undefined}
      />
      <Input
        label="비밀번호"
        monoLabel
        value={loginPassword}
        onChangeText={(text) => {
          setLoginPassword(text);
          setLoginPasswordError(null);
          setLoginError(null);
        }}
        onBlur={() => {
          setLoginPasswordError(passwordValidationError(loginPassword));
        }}
        secureTextEntry
        placeholder="6자 이상"
        errorMessage={loginPasswordError ?? undefined}
      />
      {loginError ? (
        <Text style={[styles.err, { color: theme.dimRedFg }]}>{loginError}</Text>
      ) : null}
      <AuthSubmitButton
        label="로그인"
        loading={loginLoading}
        onPress={() => void onLoginSubmit()}
      />
      <KakaoSubmitButton
        loading={kakaoLoading}
        onPress={onKakaoPress}
        label="카카오 로그인"
      />
      <View style={styles.forgotLinksRow}>
        <Pressable onPress={onResetPassword} hitSlop={8}>
          <Text style={[styles.forgotLink, { color: theme.primaryGlow }]}>
            비밀번호 찾기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
