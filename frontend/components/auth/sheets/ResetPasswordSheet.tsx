import React from 'react';
import { Text, View } from 'react-native';
import { Button, Input } from '../../ui';
import { AuthSubmitButton } from '../AuthSubmitButton';
import { StatusText } from '../AuthFieldStatus';
import type { FieldStatus } from '../auth-validation';
import { authFormStyles as styles } from './auth-form-styles';

export type ResetPasswordSheetProps = {
  theme: { dimRedFg: string; foreground: string; primaryGlow: string };
  resetDone: boolean;
  resetEmail: string;
  onResetEmailChange: (text: string) => void;
  onResetEmailBlur: () => void;
  resetEmailStatus: FieldStatus;
  resetEmailMsg: string;
  resetSendingCode: boolean;
  resetSendCodeLabel: string;
  resetCooldown: number;
  resetCodeVerified: boolean;
  onResetSendCode: () => void | Promise<void>;
  resetCodeSent: boolean;
  resetVerificationCode: string;
  setResetVerificationCode: (v: string) => void;
  resetCodeStatus: FieldStatus;
  resetCodeMsg: string;
  setResetCodeStatus: (s: FieldStatus) => void;
  setResetCodeMsg: (m: string) => void;
  resetVerifyingCode: boolean;
  onResetVerifyCode: () => void | Promise<void>;
  resetPasswordValue: string;
  setResetPasswordValue: (v: string) => void;
  setResetPasswordError: (v: string | null) => void;
  onResetPasswordBlur: () => void;
  resetPasswordError: string | null;
  resetPasswordConfirm: string;
  setResetPasswordConfirm: (v: string) => void;
  onResetConfirmBlur: () => void;
  resetConfirmStatus: FieldStatus;
  resetConfirmMsg: string;
  setResetConfirmStatus: (s: FieldStatus) => void;
  setResetConfirmMsg: (m: string) => void;
  resetError: string | null;
  resetLoading: boolean;
  onResetSubmit: () => void | Promise<void>;
  onGoToLogin: (email?: string) => void;
};

export function ResetPasswordSheet({
  theme,
  resetDone,
  resetEmail,
  onResetEmailChange,
  onResetEmailBlur,
  resetEmailStatus,
  resetEmailMsg,
  resetSendingCode,
  resetSendCodeLabel,
  resetCooldown,
  resetCodeVerified,
  onResetSendCode,
  resetCodeSent,
  resetVerificationCode,
  setResetVerificationCode,
  resetCodeStatus,
  resetCodeMsg,
  setResetCodeStatus,
  setResetCodeMsg,
  resetVerifyingCode,
  onResetVerifyCode,
  resetPasswordValue,
  setResetPasswordValue,
  setResetPasswordError,
  onResetPasswordBlur,
  resetPasswordError,
  resetPasswordConfirm,
  setResetPasswordConfirm,
  onResetConfirmBlur,
  resetConfirmStatus,
  resetConfirmMsg,
  setResetConfirmStatus,
  setResetConfirmMsg,
  resetError,
  resetLoading,
  onResetSubmit,
  onGoToLogin,
}: ResetPasswordSheetProps) {
  if (resetDone) {
    return (
      <View style={styles.form}>
        <Text style={[styles.doneText, { color: theme.foreground }]}>
          비밀번호가 변경되었습니다.{'\n'}새 비밀번호로 로그인해 주세요.
        </Text>
        <AuthSubmitButton
          label="로그인하기"
          onPress={() => onGoToLogin(resetEmail.trim().toLowerCase())}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Input
        label="이메일"
        monoLabel
        value={resetEmail}
        onChangeText={onResetEmailChange}
        onBlur={onResetEmailBlur}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@example.com"
        editable={!resetCodeVerified}
        errorMessage={resetEmailStatus === 'error' ? resetEmailMsg : undefined}
      />
      {resetEmailStatus === 'success' ? (
        <StatusText
          status={resetEmailStatus}
          message={resetEmailMsg}
          successColor={theme.primaryGlow}
          errorColor={theme.dimRedFg}
        />
      ) : null}
      <Button
        label={resetSendingCode ? '발송 중...' : resetSendCodeLabel}
        variant="outline"
        size="sm"
        disabled={resetCooldown > 0 || resetSendingCode || resetCodeVerified}
        loading={resetSendingCode}
        onPress={() => void onResetSendCode()}
      />
      {resetCodeSent ? (
        <View style={styles.codeRow}>
          <View style={styles.codeInputWrap}>
            <Input
              label="인증번호"
              monoLabel
              value={resetVerificationCode}
              onChangeText={(text) => {
                setResetVerificationCode(text);
                if (resetCodeStatus === 'error') {
                  setResetCodeStatus('idle');
                  setResetCodeMsg('');
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6자리 숫자"
              editable={!resetCodeVerified}
              errorMessage={resetCodeStatus === 'error' ? resetCodeMsg : undefined}
            />
          </View>
          <View style={styles.codeButtonWrap}>
            <Button
              label="확인"
              variant="outline"
              size="sm"
              disabled={resetVerifyingCode || resetCodeVerified}
              loading={resetVerifyingCode}
              onPress={() => void onResetVerifyCode()}
            />
          </View>
        </View>
      ) : null}
      {resetCodeStatus === 'success' ? (
        <StatusText
          status={resetCodeStatus}
          message={resetCodeMsg}
          successColor={theme.primaryGlow}
          errorColor={theme.dimRedFg}
        />
      ) : null}
      <Input
        label="새 비밀번호"
        monoLabel
        value={resetPasswordValue}
        onChangeText={(text) => {
          setResetPasswordValue(text);
          setResetPasswordError(null);
        }}
        onBlur={onResetPasswordBlur}
        secureTextEntry
        placeholder="6자 이상"
        editable={resetCodeVerified}
        errorMessage={resetPasswordError ?? undefined}
      />
      <Input
        label="새 비밀번호 확인"
        monoLabel
        value={resetPasswordConfirm}
        onChangeText={(text) => {
          setResetPasswordConfirm(text);
          if (resetConfirmStatus === 'error') {
            setResetConfirmStatus('idle');
            setResetConfirmMsg('');
          }
        }}
        onBlur={onResetConfirmBlur}
        secureTextEntry
        placeholder="비밀번호 재입력"
        editable={resetCodeVerified}
        errorMessage={resetConfirmStatus === 'error' ? resetConfirmMsg : undefined}
      />
      {resetConfirmStatus === 'success' ? (
        <StatusText
          status={resetConfirmStatus}
          message={resetConfirmMsg}
          successColor={theme.primaryGlow}
          errorColor={theme.dimRedFg}
        />
      ) : null}
      {resetError ? (
        <Text style={[styles.err, { color: theme.dimRedFg }]}>{resetError}</Text>
      ) : null}
      <AuthSubmitButton
        label="비밀번호 변경"
        loading={resetLoading}
        onPress={() => void onResetSubmit()}
      />
    </View>
  );
}
