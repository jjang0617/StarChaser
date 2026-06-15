import React from 'react';
import type { ScrollView } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { Button, Input } from '../../ui';
import { AuthSubmitButton } from '../AuthSubmitButton';
import { KakaoSubmitButton } from '../KakaoSubmitButton';
import { StatusText } from '../AuthFieldStatus';
import type { FieldStatus } from '../auth-validation';
import { authFormStyles as styles } from './auth-form-styles';

export type RegisterSheetProps = {
  scrollRef: React.RefObject<ScrollView | null>;
  theme: { dimRedFg: string; primaryGlow: string; mutedForeground: string };
  regEmail: string;
  onRegEmailChange: (text: string) => void;
  onEmailBlur: () => void;
  regEmailStatus: FieldStatus;
  regEmailMsg: string;
  sendingCode: boolean;
  sendCodeLabel: string;
  cooldown: number;
  codeVerified: boolean;
  onSendCode: () => void | Promise<void>;
  codeSent: boolean;
  verificationCode: string;
  setVerificationCode: (v: string) => void;
  codeStatus: FieldStatus;
  codeMsg: string;
  setCodeStatus: (s: FieldStatus) => void;
  setCodeMsg: (m: string) => void;
  verifyingCode: boolean;
  onVerifyCode: () => void | Promise<void>;
  regPassword: string;
  setRegPassword: (v: string) => void;
  onRegPasswordBlur: () => void;
  regPasswordError: string | null;
  setRegPasswordError: (v: string | null) => void;
  regPasswordConfirm: string;
  setRegPasswordConfirm: (v: string) => void;
  onConfirmBlur: () => void;
  confirmStatus: FieldStatus;
  confirmMsg: string;
  setConfirmStatus: (s: FieldStatus) => void;
  setConfirmMsg: (m: string) => void;
  regNickname: string;
  onNicknameChange: (text: string) => void;
  nicknameStatus: FieldStatus;
  nicknameMsg: string;
  regError: string | null;
  regLoading: boolean;
  termsAgreed: boolean;
  onTermsAgreedChange: (v: boolean) => void;
  termsError: string | null;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onRegisterSubmit: () => void | Promise<void>;
  kakaoLoading: boolean;
  onKakaoPress: () => void;
};

export function RegisterSheet({
  scrollRef,
  theme,
  regEmail,
  onRegEmailChange,
  onEmailBlur,
  regEmailStatus,
  regEmailMsg,
  sendingCode,
  sendCodeLabel,
  cooldown,
  codeVerified,
  onSendCode,
  codeSent,
  verificationCode,
  setVerificationCode,
  codeStatus,
  codeMsg,
  setCodeStatus,
  setCodeMsg,
  verifyingCode,
  onVerifyCode,
  regPassword,
  setRegPassword,
  onRegPasswordBlur,
  regPasswordError,
  setRegPasswordError,
  regPasswordConfirm,
  setRegPasswordConfirm,
  onConfirmBlur,
  confirmStatus,
  confirmMsg,
  setConfirmStatus,
  setConfirmMsg,
  regNickname,
  onNicknameChange,
  nicknameStatus,
  nicknameMsg,
  regError,
  regLoading,
  termsAgreed,
  onTermsAgreedChange,
  termsError,
  onOpenTerms,
  onOpenPrivacy,
  onRegisterSubmit,
  kakaoLoading,
  onKakaoPress,
}: RegisterSheetProps) {
  const scrollToEnd = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);

  return (
    <View style={styles.form}>
      <Input
        label="이메일"
        monoLabel
        value={regEmail}
        onChangeText={onRegEmailChange}
        onBlur={onEmailBlur}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@example.com"
        editable={!codeVerified}
        errorMessage={regEmailStatus === 'error' ? regEmailMsg : undefined}
      />
      {regEmailStatus === 'success' ? (
        <StatusText
          status={regEmailStatus}
          message={regEmailMsg}
          successColor={theme.primaryGlow}
          errorColor={theme.dimRedFg}
        />
      ) : null}
      <Button
        label={sendingCode ? '발송 중...' : sendCodeLabel}
        variant="outline"
        size="sm"
        disabled={cooldown > 0 || sendingCode || codeVerified}
        loading={sendingCode}
        onPress={() => void onSendCode()}
      />
      {codeSent ? (
        <View style={styles.codeRow}>
          <View style={styles.codeInputWrap}>
            <Input
              label="인증번호"
              monoLabel
              value={verificationCode}
              onChangeText={(text) => {
                setVerificationCode(text);
                if (codeStatus === 'error') {
                  setCodeStatus('idle');
                  setCodeMsg('');
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6자리 숫자"
              editable={!codeVerified}
              errorMessage={codeStatus === 'error' ? codeMsg : undefined}
            />
          </View>
          <View style={styles.codeButtonWrap}>
            <Button
              label="확인"
              variant="outline"
              size="sm"
              disabled={verifyingCode || codeVerified}
              loading={verifyingCode}
              onPress={() => void onVerifyCode()}
            />
          </View>
        </View>
      ) : null}
      {codeStatus === 'success' ? (
        <StatusText
          status={codeStatus}
          message={codeMsg}
          successColor={theme.primaryGlow}
          errorColor={theme.dimRedFg}
        />
      ) : null}
      <Input
        label="비밀번호"
        monoLabel
        value={regPassword}
        onChangeText={(text) => {
          setRegPassword(text);
          setRegPasswordError(null);
        }}
        onBlur={onRegPasswordBlur}
        onFocus={scrollToEnd}
        secureTextEntry
        placeholder="6자 이상"
        errorMessage={regPasswordError ?? undefined}
      />
      <Input
        label="비밀번호 확인"
        monoLabel
        value={regPasswordConfirm}
        onChangeText={(text) => {
          setRegPasswordConfirm(text);
          if (confirmStatus === 'error') {
            setConfirmStatus('idle');
            setConfirmMsg('');
          }
        }}
        onFocus={scrollToEnd}
        onBlur={onConfirmBlur}
        secureTextEntry
        placeholder="비밀번호 재입력"
        errorMessage={confirmStatus === 'error' ? confirmMsg : undefined}
      />
      {confirmStatus === 'success' ? (
        <StatusText
          status={confirmStatus}
          message={confirmMsg}
          successColor={theme.primaryGlow}
          errorColor={theme.dimRedFg}
        />
      ) : null}
      <Input
        label="닉네임"
        monoLabel
        value={regNickname}
        onChangeText={onNicknameChange}
        onFocus={scrollToEnd}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="2~30자"
        maxLength={30}
        errorMessage={nicknameStatus === 'error' ? nicknameMsg : undefined}
      />
      {nicknameStatus === 'success' ? (
        <StatusText
          status={nicknameStatus}
          message={nicknameMsg}
          successColor={theme.primaryGlow}
          errorColor={theme.dimRedFg}
        />
      ) : null}
      {regError ? (
        <Text style={[styles.err, { color: theme.dimRedFg }]}>{regError}</Text>
      ) : null}
      <View style={styles.termsRow}>
        <Pressable
          onPress={() => onTermsAgreedChange(!termsAgreed)}
          hitSlop={8}
          style={[
            styles.termsCheck,
            {
              borderColor: termsError
                ? theme.dimRedFg
                : termsAgreed
                  ? theme.primaryGlow
                  : theme.mutedForeground,
              backgroundColor: termsAgreed
                ? theme.primaryGlow
                : 'transparent',
            },
          ]}
        >
          {termsAgreed ? (
            <Text style={styles.termsCheckMark}>✓</Text>
          ) : null}
        </Pressable>
        <Text style={[styles.termsText, { color: theme.mutedForeground }]}>
          <Text onPress={onOpenTerms} style={{ color: theme.primaryGlow }}>
            이용약관
          </Text>
          {' 및 '}
          <Text onPress={onOpenPrivacy} style={{ color: theme.primaryGlow }}>
            개인정보 처리방침
          </Text>
          에 동의합니다 (필수)
        </Text>
      </View>
      {termsError ? (
        <Text style={[styles.err, { color: theme.dimRedFg }]}>{termsError}</Text>
      ) : null}
      <AuthSubmitButton
        label="가입하기"
        loading={regLoading}
        onPress={() => void onRegisterSubmit()}
      />
      <KakaoSubmitButton
        loading={kakaoLoading}
        onPress={onKakaoPress}
        label="카카오로 회원가입"
      />
    </View>
  );
}
