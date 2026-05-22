import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
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
  resetPassword,
  sendVerificationCode,
  verifyCode,
} from '../../lib/api-client';

type Mode = 'login' | 'register' | 'resetPassword';
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

function emailValidationError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return '이메일을 입력해 주세요.';
  if (!isValidEmail(trimmed)) return '올바른 이메일 형식이 아닙니다.';
  return null;
}

function passwordValidationError(password: string): string | null {
  if (!password) return '비밀번호를 입력해 주세요.';
  if (password.length < 6) return '비밀번호는 6자 이상이어야 합니다.';
  return null;
}

function codeValidationError(code: string): string | null {
  if (!code) return '인증번호를 입력해 주세요.';
  if (code.length !== 6) return '인증번호는 6자리여야 합니다.';
  return null;
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
  const [loginEmailError, setLoginEmailError] = useState<string | null>(null);
  const [loginPasswordError, setLoginPasswordError] = useState<string | null>(null);
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
  const [regPasswordError, setRegPasswordError] = useState<string | null>(null);
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [confirmStatus, setConfirmStatus] = useState<FieldStatus>('idle');
  const [confirmMsg, setConfirmMsg] = useState('');

  const [regNickname, setRegNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState<FieldStatus>('idle');
  const [nicknameMsg, setNicknameMsg] = useState('');

  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // --- reset password state ---
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailStatus, setResetEmailStatus] = useState<FieldStatus>('idle');
  const [resetEmailMsg, setResetEmailMsg] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetSendingCode, setResetSendingCode] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const resetCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resetVerificationCode, setResetVerificationCode] = useState('');
  const [resetCodeVerified, setResetCodeVerified] = useState(false);
  const [resetVerifyingCode, setResetVerifyingCode] = useState(false);
  const [resetCodeStatus, setResetCodeStatus] = useState<FieldStatus>('idle');
  const [resetCodeMsg, setResetCodeMsg] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetConfirmStatus, setResetConfirmStatus] = useState<FieldStatus>('idle');
  const [resetConfirmMsg, setResetConfirmMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (resetCooldownRef.current) clearInterval(resetCooldownRef.current);
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
    setRegPasswordError(null);
    setRegPasswordConfirm('');
    setConfirmStatus('idle');
    setConfirmMsg('');
    setRegNickname('');
    setNicknameStatus('idle');
    setNicknameMsg('');
    setRegLoading(false);
    setRegError(null);
  }, []);

  const resetResetForm = useCallback(() => {
    setResetEmail('');
    setResetEmailStatus('idle');
    setResetEmailMsg('');
    setResetCodeSent(false);
    setResetSendingCode(false);
    setResetCooldown(0);
    if (resetCooldownRef.current) {
      clearInterval(resetCooldownRef.current);
      resetCooldownRef.current = null;
    }
    setResetVerificationCode('');
    setResetCodeVerified(false);
    setResetVerifyingCode(false);
    setResetCodeStatus('idle');
    setResetCodeMsg('');
    setResetPasswordValue('');
    setResetPasswordError(null);
    setResetPasswordConfirm('');
    setResetConfirmStatus('idle');
    setResetConfirmMsg('');
    setResetLoading(false);
    setResetError(null);
    setResetDone(false);
  }, []);

  const goToLogin = useCallback(
    (email?: string) => {
      resetResetForm();
      setMode('login');
      setLoginError(null);
      if (email) setLoginEmail(email);
    },
    [resetResetForm],
  );

  const applyEmailFieldError = useCallback(
    (
      email: string,
      setStatus: (s: FieldStatus) => void,
      setMsg: (m: string) => void,
    ): boolean => {
      const err = emailValidationError(email);
      if (err) {
        setStatus('error');
        setMsg(err);
        return false;
      }
      setStatus('idle');
      setMsg('');
      return true;
    },
    [],
  );

  const handleEmailBlur = useCallback(() => {
    if (regEmailStatus === 'success') return;
    applyEmailFieldError(regEmail, setRegEmailStatus, setRegEmailMsg);
  }, [regEmail, regEmailStatus, applyEmailFieldError]);

  const handleResetEmailBlur = useCallback(() => {
    if (resetEmailStatus === 'success') return;
    applyEmailFieldError(resetEmail, setResetEmailStatus, setResetEmailMsg);
  }, [resetEmail, resetEmailStatus, applyEmailFieldError]);

  const handleRegEmailChange = useCallback((text: string) => {
    setRegEmail(text);
    setRegEmailStatus('idle');
    setRegEmailMsg('');
    setCodeSent(false);
    setCodeVerified(false);
    setCodeStatus('idle');
    setCodeMsg('');
    setVerificationCode('');
    setCodeStatus('idle');
    setCodeMsg('');
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
    if (!applyEmailFieldError(regEmail, setRegEmailStatus, setRegEmailMsg)) return;
    const trimmed = regEmail.trim().toLowerCase();
    setSendingCode(true);
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
  }, [regEmail, startCooldown, applyEmailFieldError]);

  // --- verify code ---
  const handleVerifyCode = useCallback(async () => {
    const codeErr = codeValidationError(verificationCode);
    if (codeErr) {
      setCodeStatus('error');
      setCodeMsg(codeErr);
      return;
    }
    const trimmed = regEmail.trim().toLowerCase();
    setVerifyingCode(true);
    setCodeStatus('checking');
    setCodeMsg('');
    try {
      const { verified } = await verifyCode(trimmed, verificationCode, 'register');
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

  const startResetCooldown = useCallback(() => {
    setResetCooldown(60);
    if (resetCooldownRef.current) clearInterval(resetCooldownRef.current);
    resetCooldownRef.current = setInterval(() => {
      setResetCooldown((prev) => {
        if (prev <= 1) {
          if (resetCooldownRef.current) clearInterval(resetCooldownRef.current);
          resetCooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleResetEmailChange = useCallback((text: string) => {
    setResetEmail(text);
    setResetEmailStatus('idle');
    setResetEmailMsg('');
    setResetCodeSent(false);
    setResetCodeVerified(false);
    setResetCodeStatus('idle');
    setResetCodeMsg('');
    setResetVerificationCode('');
    setResetDone(false);
  }, []);

  const handleResetSendCode = useCallback(async () => {
    if (!applyEmailFieldError(resetEmail, setResetEmailStatus, setResetEmailMsg)) return;
    const trimmed = resetEmail.trim().toLowerCase();
    setResetSendingCode(true);
    try {
      await sendVerificationCode(trimmed, 'reset-password');
      setResetCodeSent(true);
      setResetEmailStatus('success');
      setResetEmailMsg('인증번호가 발송되었습니다');
      startResetCooldown();
    } catch (e) {
      setResetEmailStatus('error');
      setResetEmailMsg(
        e instanceof ApiRequestError ? e.message : '인증번호 발송에 실패했습니다.',
      );
    } finally {
      setResetSendingCode(false);
    }
  }, [resetEmail, startResetCooldown, applyEmailFieldError]);

  const handleResetVerifyCode = useCallback(async () => {
    const codeErr = codeValidationError(resetVerificationCode);
    if (codeErr) {
      setResetCodeStatus('error');
      setResetCodeMsg(codeErr);
      return;
    }
    const trimmed = resetEmail.trim().toLowerCase();
    setResetVerifyingCode(true);
    setResetCodeStatus('checking');
    setResetCodeMsg('');
    try {
      const { verified } = await verifyCode(
        trimmed,
        resetVerificationCode,
        'reset-password',
      );
      if (verified) {
        setResetCodeVerified(true);
        setResetCodeStatus('success');
        setResetCodeMsg('인증 완료');
      } else {
        setResetCodeStatus('error');
        setResetCodeMsg('인증번호가 올바르지 않습니다');
      }
    } catch (e) {
      setResetCodeStatus('error');
      setResetCodeMsg(
        e instanceof ApiRequestError ? e.message : '인증번호 확인에 실패했습니다.',
      );
    } finally {
      setResetVerifyingCode(false);
    }
  }, [resetEmail, resetVerificationCode]);

  const handleResetConfirmBlur = useCallback(() => {
    const pwErr = passwordValidationError(resetPasswordValue);
    setResetPasswordError(pwErr);
    if (!resetPasswordConfirm) {
      setResetConfirmStatus('idle');
      setResetConfirmMsg('');
      return;
    }
    if (pwErr) {
      setResetConfirmStatus('idle');
      setResetConfirmMsg('');
      return;
    }
    if (resetPasswordValue === resetPasswordConfirm) {
      setResetConfirmStatus('success');
      setResetConfirmMsg('비밀번호가 일치합니다');
    } else {
      setResetConfirmStatus('error');
      setResetConfirmMsg('비밀번호가 일치하지 않습니다');
    }
  }, [resetPasswordValue, resetPasswordConfirm]);

  const validateResetForm = useCallback((): boolean => {
    let ok = true;
    if (!applyEmailFieldError(resetEmail, setResetEmailStatus, setResetEmailMsg)) ok = false;
    const codeErr = codeValidationError(resetVerificationCode);
    if (!resetCodeVerified) {
      setResetCodeStatus('error');
      setResetCodeMsg(codeErr ?? '이메일 인증을 완료해 주세요.');
      ok = false;
    } else if (codeErr) {
      setResetCodeStatus('error');
      setResetCodeMsg(codeErr);
      ok = false;
    }
    const pwErr = passwordValidationError(resetPasswordValue);
    setResetPasswordError(pwErr);
    if (pwErr) ok = false;
    if (!resetPasswordConfirm) {
      setResetConfirmStatus('error');
      setResetConfirmMsg('비밀번호 확인을 입력해 주세요.');
      ok = false;
    } else if (!pwErr && resetPasswordValue !== resetPasswordConfirm) {
      setResetConfirmStatus('error');
      setResetConfirmMsg('비밀번호가 일치하지 않습니다');
      ok = false;
    }
    return ok;
  }, [
    resetEmail,
    resetVerificationCode,
    resetCodeVerified,
    resetPasswordValue,
    resetPasswordConfirm,
    applyEmailFieldError,
  ]);

  const onResetSubmit = async () => {
    setResetError(null);
    if (!validateResetForm()) return;
    const trimmedEmail = resetEmail.trim().toLowerCase();
    setResetLoading(true);
    try {
      await resetPassword(trimmedEmail, resetVerificationCode, resetPasswordValue);
      setResetDone(true);
    } catch (e) {
      setResetError(
        e instanceof ApiRequestError ? e.message : '비밀번호 변경에 실패했습니다.',
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegPasswordBlur = useCallback(() => {
    const err = passwordValidationError(regPassword);
    setRegPasswordError(err);
  }, [regPassword]);

  const handleResetPasswordBlur = useCallback(() => {
    const err = passwordValidationError(resetPasswordValue);
    setResetPasswordError(err);
  }, [resetPasswordValue]);

  // --- password confirm blur ---
  const handleConfirmBlur = useCallback(() => {
    const pwErr = passwordValidationError(regPassword);
    setRegPasswordError(pwErr);
    if (!regPasswordConfirm) {
      setConfirmStatus('idle');
      setConfirmMsg('');
      return;
    }
    if (pwErr) {
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

  const validateRegisterForm = useCallback((): boolean => {
    let ok = true;
    if (!applyEmailFieldError(regEmail, setRegEmailStatus, setRegEmailMsg)) ok = false;
    const codeErr = codeValidationError(verificationCode);
    if (!codeVerified) {
      setCodeStatus('error');
      setCodeMsg(codeErr ?? '이메일 인증을 완료해 주세요.');
      ok = false;
    } else if (codeErr) {
      setCodeStatus('error');
      setCodeMsg(codeErr);
      ok = false;
    }
    const pwErr = passwordValidationError(regPassword);
    setRegPasswordError(pwErr);
    if (pwErr) ok = false;
    if (!regPasswordConfirm) {
      setConfirmStatus('error');
      setConfirmMsg('비밀번호 확인을 입력해 주세요.');
      ok = false;
    } else if (!pwErr && regPassword !== regPasswordConfirm) {
      setConfirmStatus('error');
      setConfirmMsg('비밀번호가 일치하지 않습니다');
      ok = false;
    }
    if (!regNickname.trim()) {
      setNicknameStatus('error');
      setNicknameMsg('닉네임을 입력해 주세요.');
      ok = false;
    } else if (nicknameStatus !== 'success') {
      setNicknameStatus('error');
      setNicknameMsg(
        nicknameStatus === 'checking'
          ? '닉네임 확인 중입니다. 잠시 후 다시 시도해 주세요.'
          : '사용 가능한 닉네임인지 확인해 주세요.',
      );
      ok = false;
    }
    return ok;
  }, [
    regEmail,
    verificationCode,
    codeVerified,
    regPassword,
    regPasswordConfirm,
    regNickname,
    nicknameStatus,
    applyEmailFieldError,
  ]);

  // --- login submit ---
  const onLoginSubmit = async () => {
    setLoginError(null);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:3333';
    const emailErr = emailValidationError(loginEmail);
    const pwErr = passwordValidationError(loginPassword);
    setLoginEmailError(emailErr);
    setLoginPasswordError(pwErr);
    if (emailErr || pwErr) return;
    const trimmed = loginEmail.trim().toLowerCase();
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

  const onRegisterSubmit = async () => {
    setRegError(null);
    if (!validateRegisterForm()) return;
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

  const resetSendCodeLabel =
    resetCooldown > 0
      ? `재발송 (${resetCooldown}초)`
      : resetCodeSent
        ? '재발송'
        : '인증번호 발송';

  const subTitle =
    mode === 'login'
      ? '로그인'
      : mode === 'register'
        ? '회원가입'
        : '비밀번호 찾기';

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
            {subTitle}
          </Text>

          {mode === 'resetPassword' ? (
            !resetDone && (
              <Pressable onPress={() => goToLogin()} hitSlop={8}>
                <Text style={[styles.backLink, { color: theme.mutedForeground }]}>
                  ← 로그인으로 돌아가기
                </Text>
              </Pressable>
            )
          ) : (
            <View style={styles.tabRow}>
              <Button
                label="로그인"
                variant={mode === 'login' ? 'primary' : 'outline'}
                size="sm"
                onPress={() => {
                  setMode('login');
                  setLoginError(null);
                  setLoginEmailError(null);
                  setLoginPasswordError(null);
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
          )}

          {mode === 'login' ? (
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
                  const err = emailValidationError(loginEmail);
                  setLoginEmailError(err);
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
                  const err = passwordValidationError(loginPassword);
                  setLoginPasswordError(err);
                }}
                secureTextEntry
                placeholder="6자 이상"
                errorMessage={loginPasswordError ?? undefined}
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
              <Pressable
                onPress={() => {
                  resetResetForm();
                  setMode('resetPassword');
                }}
                hitSlop={8}
                style={styles.forgotLinkWrap}
              >
                <Text style={[styles.forgotLink, { color: theme.mutedForeground }]}>
                  비밀번호 찾기
                </Text>
              </Pressable>
            </View>
          ) : mode === 'resetPassword' ? (
            <View style={styles.form}>
              {resetDone ? (
                <>
                  <Text style={[styles.doneText, { color: theme.foreground }]}>
                    비밀번호가 변경되었습니다.{'\n'}새 비밀번호로 로그인해 주세요.
                  </Text>
                  <Button
                    label="로그인하기"
                    fullWidth
                    onPress={() => goToLogin(resetEmail.trim().toLowerCase())}
                  />
                </>
              ) : (
                <>
                  <Input
                    label="이메일"
                    monoLabel
                    value={resetEmail}
                    onChangeText={handleResetEmailChange}
                    onBlur={handleResetEmailBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    editable={!resetCodeVerified}
                    errorMessage={
                      resetEmailStatus === 'error' ? resetEmailMsg : undefined
                    }
                  />
                  {resetEmailStatus === 'success' && (
                    <StatusText
                      status={resetEmailStatus}
                      message={resetEmailMsg}
                      successColor={theme.starGold}
                      errorColor={theme.dimRedFg}
                    />
                  )}

                  <Button
                    label={resetSendingCode ? '발송 중...' : resetSendCodeLabel}
                    variant="outline"
                    size="sm"
                    disabled={
                      resetCooldown > 0 || resetSendingCode || resetCodeVerified
                    }
                    loading={resetSendingCode}
                    onPress={() => void handleResetSendCode()}
                  />

                  {resetCodeSent && (
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
                          errorMessage={
                            resetCodeStatus === 'error' ? resetCodeMsg : undefined
                          }
                        />
                      </View>
                      <View style={styles.codeButtonWrap}>
                        <Button
                          label="확인"
                          variant="outline"
                          size="sm"
                          disabled={resetVerifyingCode || resetCodeVerified}
                          loading={resetVerifyingCode}
                          onPress={() => void handleResetVerifyCode()}
                        />
                      </View>
                    </View>
                  )}
                  {resetCodeStatus === 'success' && (
                    <StatusText
                      status={resetCodeStatus}
                      message={resetCodeMsg}
                      successColor={theme.starGold}
                      errorColor={theme.dimRedFg}
                    />
                  )}

                  <Input
                    label="새 비밀번호"
                    monoLabel
                    value={resetPasswordValue}
                    onChangeText={(text) => {
                      setResetPasswordValue(text);
                      setResetPasswordError(null);
                    }}
                    onBlur={handleResetPasswordBlur}
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
                    onBlur={handleResetConfirmBlur}
                    secureTextEntry
                    placeholder="비밀번호 재입력"
                    editable={resetCodeVerified}
                    errorMessage={
                      resetConfirmStatus === 'error' ? resetConfirmMsg : undefined
                    }
                  />
                  {resetConfirmStatus === 'success' && (
                    <StatusText
                      status={resetConfirmStatus}
                      message={resetConfirmMsg}
                      successColor={theme.starGold}
                      errorColor={theme.dimRedFg}
                    />
                  )}

                  {resetError && (
                    <Text style={[styles.err, { color: theme.dimRedFg }]}>
                      {resetError}
                    </Text>
                  )}

                  <Button
                    label="비밀번호 변경"
                    fullWidth
                    loading={resetLoading}
                    onPress={() => void onResetSubmit()}
                  />
                </>
              )}
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
                disabled={cooldown > 0 || sendingCode || codeVerified}
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
                onChangeText={(text) => {
                  setRegPassword(text);
                  setRegPasswordError(null);
                }}
                onBlur={handleRegPasswordBlur}
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                secureTextEntry
                placeholder="6자 이상"
                errorMessage={regPasswordError ?? undefined}
              />

              {/* 비밀번호 확인 */}
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
  forgotLinkWrap: {
    alignSelf: 'center',
    marginTop: 4,
  },
  forgotLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  backLink: {
    fontSize: 12,
    marginBottom: 4,
  },
  doneText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
});
