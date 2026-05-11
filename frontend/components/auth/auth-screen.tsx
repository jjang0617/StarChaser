import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';
import { useAuth } from '../../contexts/auth-context';
import { Button, Input, Screen } from '../ui';
import {
  ApiRequestError,
  checkNickname,
  sendVerificationCode,
  verifyCode,
} from '../../lib/api-client';

type Mode = 'login' | 'register';
type FieldStatus = 'idle' | 'checking' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const [local, domain, ...rest] = email.split('@');
  if (!local || !domain || rest.length > 0) return false;
  if (local.length > 64) return false;
  if (domain.includes('..')) return false;
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) return false;
  return domainParts.every((p) => p.length > 0 && /^[a-zA-Z0-9-]+$/.test(p));
}

function StatusText({
  status,
  message,
  successColor,
  errorColor,
}: {
  status: FieldStatus;
  message: string;
  successColor: string;
  errorColor: string;
}) {
  if (status === 'idle' || status === 'checking' || !message) return null;
  return (
    <Text
      style={[
        styles.statusText,
        { color: status === 'success' ? successColor : errorColor },
      ]}
    >
      {message}
    </Text>
  );
}

export function AuthScreen() {
  const { theme } = useTheme();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const scrollRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // --- login state ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- register state ---
  const [regEmail, setRegEmail] = useState('');
  const [regEmailStatus, setRegEmailStatus] = useState<FieldStatus>('idle');
  const [regEmailMsg, setRegEmailMsg] = useState('');

  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [verificationCode, setVerificationCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeStatus, setCodeStatus] = useState<FieldStatus>('idle');
  const [codeMsg, setCodeMsg] = useState('');

  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [confirmStatus, setConfirmStatus] = useState<FieldStatus>('idle');
  const [confirmMsg, setConfirmMsg] = useState('');

  const [regNickname, setRegNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState<FieldStatus>('idle');
  const [nicknameMsg, setNicknameMsg] = useState('');

  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const resetRegisterForm = useCallback(() => {
    setRegEmail('');
    setRegEmailStatus('idle');
    setRegEmailMsg('');
    setCodeSent(false);
    setSendingCode(false);
    setCooldown(0);
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
      cooldownRef.current = null;
    }
    setVerificationCode('');
    setCodeVerified(false);
    setVerifyingCode(false);
    setCodeStatus('idle');
    setCodeMsg('');
    setRegPassword('');
    setRegPasswordConfirm('');
    setConfirmStatus('idle');
    setConfirmMsg('');
    setRegNickname('');
    setNicknameStatus('idle');
    setNicknameMsg('');
    setRegLoading(false);
    setRegError(null);
  }, []);

  const isEmailValid = isValidEmail(regEmail.trim());

  const handleEmailBlur = useCallback(() => {
    const trimmed = regEmail.trim();
    if (!trimmed) {
      setRegEmailStatus('idle');
      setRegEmailMsg('');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setRegEmailStatus('error');
      setRegEmailMsg('올바른 이메일 형식이 아닙니다.');
      return;
    }
    setRegEmailStatus('idle');
    setRegEmailMsg('');
  }, [regEmail]);

  const handleRegEmailChange = useCallback((text: string) => {
    setRegEmail(text);
    setRegEmailStatus('idle');
    setRegEmailMsg('');
    setCodeSent(false);
    setCodeVerified(false);
    setCodeStatus('idle');
    setCodeMsg('');
    setVerificationCode('');
  }, []);

  // --- send verification code ---
  const startCooldown = useCallback(() => {
    setCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = useCallback(async () => {
    const trimmed = regEmail.trim().toLowerCase();
    if (!isValidEmail(trimmed)) return;
    setSendingCode(true);
    setRegEmailStatus('idle');
    setRegEmailMsg('');
    try {
      await sendVerificationCode(trimmed, 'register');
      setCodeSent(true);
      setRegEmailStatus('success');
      setRegEmailMsg('인증번호가 발송되었습니다');
      startCooldown();
    } catch (e) {
      setRegEmailStatus('error');
      setRegEmailMsg(e instanceof ApiRequestError ? e.message : '인증번호 발송에 실패했습니다.');
    } finally {
      setSendingCode(false);
    }
  }, [regEmail, startCooldown]);

  // --- verify code ---
  const handleVerifyCode = useCallback(async () => {
    const trimmed = regEmail.trim().toLowerCase();
    setVerifyingCode(true);
    setCodeStatus('checking');
    setCodeMsg('');
    try {
      const { verified } = await verifyCode(trimmed, verificationCode);
      if (verified) {
        setCodeVerified(true);
        setCodeStatus('success');
        setCodeMsg('인증 완료');
      } else {
        setCodeStatus('error');
        setCodeMsg('인증번호가 올바르지 않습니다');
      }
    } catch (e) {
      setCodeStatus('error');
      setCodeMsg(e instanceof ApiRequestError ? e.message : '인증번호 확인에 실패했습니다.');
    } finally {
      setVerifyingCode(false);
    }
  }, [regEmail, verificationCode]);

  // --- password confirm blur ---
  const handleConfirmBlur = useCallback(() => {
    if (!regPasswordConfirm) {
      setConfirmStatus('idle');
      setConfirmMsg('');
      return;
    }
    if (regPassword === regPasswordConfirm) {
      setConfirmStatus('success');
      setConfirmMsg('비밀번호가 일치합니다');
    } else {
      setConfirmStatus('error');
      setConfirmMsg('비밀번호가 일치하지 않습니다');
    }
  }, [regPassword, regPasswordConfirm]);

  const nicknameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (nicknameCheckRef.current) clearTimeout(nicknameCheckRef.current); };
  }, []);

  const handleNicknameChange = useCallback((text: string) => {
    setRegNickname(text);
    if (nicknameCheckRef.current) clearTimeout(nicknameCheckRef.current);

    const trimmed = text.trim();
    if (!trimmed) {
      setNicknameStatus('idle');
      setNicknameMsg('');
      return;
    }
    if (trimmed.length < 2) {
      setNicknameStatus('error');
      setNicknameMsg('닉네임은 2자 이상이어야 합니다');
      return;
    }

    setNicknameStatus('checking');
    setNicknameMsg('');
    nicknameCheckRef.current = setTimeout(async () => {
      try {
        const { available } = await checkNickname(trimmed);
        if (available) {
          setNicknameStatus('success');
          setNicknameMsg('사용 가능한 닉네임입니다');
        } else {
          setNicknameStatus('error');
          setNicknameMsg('이미 사용 중인 닉네임입니다');
        }
      } catch (e) {
        setNicknameStatus('error');
        setNicknameMsg(e instanceof ApiRequestError ? e.message : '닉네임 확인 중 오류가 발생했습니다.');
      }
    }, 500);
  }, []);

  // --- login submit ---
  const onLoginSubmit = async () => {
    setLoginError(null);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:3333';
    const trimmed = loginEmail.trim().toLowerCase();
    if (!trimmed || !loginPassword) {
      setLoginError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    if (loginPassword.length < 6) {
      setLoginError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setLoginLoading(true);
    try {
      await login(trimmed, loginPassword);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setLoginError(e.message);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed')) {
          setLoginError(
            `네트워크 오류로 서버에 연결할 수 없습니다.\nAPI URL을 확인해 주세요: ${apiUrl}`,
          );
        } else {
          setLoginError('알 수 없는 오류가 발생했습니다.');
        }
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // --- register submit ---
  const canRegister =
    codeVerified &&
    regPassword.length >= 6 &&
    regPassword === regPasswordConfirm &&
    nicknameStatus === 'success';

  const onRegisterSubmit = async () => {
    if (!canRegister) return;
    setRegError(null);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:3333';
    const trimmedEmail = regEmail.trim().toLowerCase();
    const trimmedNickname = regNickname.trim();
    setRegLoading(true);
    try {
      await register(trimmedEmail, regPassword, trimmedNickname, verificationCode);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setRegError(e.message);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed')) {
          setRegError(
            `네트워크 오류로 서버에 연결할 수 없습니다.\nAPI URL을 확인해 주세요: ${apiUrl}`,
          );
        } else {
          setRegError('알 수 없는 오류가 발생했습니다.');
        }
      }
    } finally {
      setRegLoading(false);
    }
  };

  const sendCodeLabel =
    cooldown > 0
      ? `재발송 (${cooldown}초)`
      : codeSent
        ? '재발송'
        : '인증번호 발송';

  return (
    <Screen>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: 48 + kbHeight }]}
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
                setLoginError(null);
              }}
            />
            <Button
              label="회원가입"
              variant={mode === 'register' ? 'primary' : 'outline'}
              size="sm"
              onPress={() => {
                setMode('register');
                resetRegisterForm();
              }}
            />
          </View>

          {mode === 'login' ? (
            <View style={styles.form}>
              <Input
                label="이메일"
                monoLabel
                value={loginEmail}
                onChangeText={setLoginEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
              />
              <Input
                label="비밀번호"
                monoLabel
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry
                placeholder="6자 이상"
              />
              {loginError && (
                <Text style={[styles.err, { color: theme.dimRedFg }]}>
                  {loginError}
                </Text>
              )}
              <Button
                label="로그인"
                fullWidth
                loading={loginLoading}
                onPress={() => void onLoginSubmit()}
              />
            </View>
          ) : (
            <View style={styles.form}>
              {/* 이메일 */}
              <Input
                label="이메일"
                monoLabel
                value={regEmail}
                onChangeText={handleRegEmailChange}
                onBlur={handleEmailBlur}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                editable={!codeVerified}
                errorMessage={regEmailStatus === 'error' ? regEmailMsg : undefined}
              />
              {regEmailStatus === 'success' && (
                <StatusText
                  status={regEmailStatus}
                  message={regEmailMsg}
                  successColor={theme.starGold}
                  errorColor={theme.dimRedFg}
                />
              )}

              <Button
                label={sendingCode ? '발송 중...' : sendCodeLabel}
                variant="outline"
                size="sm"
                disabled={!isEmailValid || cooldown > 0 || sendingCode || codeVerified}
                loading={sendingCode}
                onPress={() => void handleSendCode()}
              />

              {/* 인증번호 */}
              {codeSent && (
                <View style={styles.codeRow}>
                  <View style={styles.codeInputWrap}>
                    <Input
                      label="인증번호"
                      monoLabel
                      value={verificationCode}
                      onChangeText={setVerificationCode}
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
                      disabled={verificationCode.length < 6 || verifyingCode || codeVerified}
                      loading={verifyingCode}
                      onPress={() => void handleVerifyCode()}
                    />
                  </View>
                </View>
              )}
              {codeStatus === 'success' && (
                <StatusText
                  status={codeStatus}
                  message={codeMsg}
                  successColor={theme.starGold}
                  errorColor={theme.dimRedFg}
                />
              )}

              {/* 비밀번호 */}
              <Input
                label="비밀번호"
                monoLabel
                value={regPassword}
                onChangeText={setRegPassword}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                secureTextEntry
                placeholder="6자 이상"
              />

              {/* 비밀번호 확인 */}
              <Input
                label="비밀번호 확인"
                monoLabel
                value={regPasswordConfirm}
                onChangeText={setRegPasswordConfirm}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                onBlur={handleConfirmBlur}
                secureTextEntry
                placeholder="비밀번호 재입력"
                errorMessage={confirmStatus === 'error' ? confirmMsg : undefined}
              />
              {confirmStatus === 'success' && (
                <StatusText
                  status={confirmStatus}
                  message={confirmMsg}
                  successColor={theme.starGold}
                  errorColor={theme.dimRedFg}
                />
              )}

              {/* 닉네임 */}
              <Input
                label="닉네임"
                monoLabel
                value={regNickname}
                onChangeText={handleNicknameChange}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="2~30자"
                maxLength={30}
                errorMessage={nicknameStatus === 'error' ? nicknameMsg : undefined}
              />
              {nicknameStatus === 'success' && (
                <StatusText
                  status={nicknameStatus}
                  message={nicknameMsg}
                  successColor={theme.starGold}
                  errorColor={theme.dimRedFg}
                />
              )}

              {regError && (
                <Text style={[styles.err, { color: theme.dimRedFg }]}>
                  {regError}
                </Text>
              )}

              <Button
                label="가입하기"
                fullWidth
                loading={regLoading}
                disabled={!canRegister}
                onPress={() => void onRegisterSubmit()}
              />
            </View>
          )}

          <Text style={[styles.hint, { color: theme.mutedForeground }]}>
            API: {process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:3333 (기본)'}
          </Text>
        </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
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
  statusText: {
    fontSize: 11,
    marginTop: -6,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  codeInputWrap: {
    flex: 1,
  },
  codeButtonWrap: {
    paddingBottom: 2,
  },
  hint: {
    fontSize: 10,
    marginTop: 16,
    fontFamily: 'SpaceMono-Regular',
  },
});
