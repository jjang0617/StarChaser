import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { useAuth } from '../../contexts/auth-context';
import { AuthSegmentTabs } from './AuthSegmentTabs';
import { AuthBrandHeader } from './AuthBrandHeader';
import { AuthWelcomeBackdrop } from './AuthWelcomeBackdrop';
import { AuthWelcomeActions } from './AuthWelcomeActions';
import { AUTH_SHEET_BG, authSheetStyles } from './auth-sheet-styles';
import { AppAlertModal, GlassCard, Screen } from '../ui';
import { getKakaoRestApiKey } from '../../lib/config';
import {
  ApiRequestError,
  checkNickname,
  resetPassword,
} from '../../lib/api-client';
import {
  codeValidationError,
  emailValidationError,
  passwordValidationError,
  type FieldStatus,
} from './auth-validation';
import { useEmailVerification } from './use-email-verification';
import { LegalDocumentModal } from '../profile/LegalDocumentModal';
import {
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
} from '../../content/legal-documents';
import { apiErrorMessage } from '../../lib/api-error';
import { LoginSheet } from './sheets/LoginSheet';
import { RegisterSheet } from './sheets/RegisterSheet';
import { ResetPasswordSheet } from './sheets/ResetPasswordSheet';
import { KakaoLoginWebViewModal } from './sheets/KakaoLoginWebViewModal';

type Mode = 'login' | 'register' | 'resetPassword';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SHEET_CLOSED_Y = WINDOW_HEIGHT;

function applyEmailFieldError(
  email: string,
  setStatus: (s: FieldStatus) => void,
  setMsg: (m: string) => void,
): boolean {
  const err = emailValidationError(email);
  if (err) {
    setStatus('error');
    setMsg(err);
    return false;
  }
  setStatus('idle');
  setMsg('');
  return true;
}

export function AuthScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    login,
    register,
    loginWithKakao,
    justLoggedOut,
    clearJustLoggedOut,
    justAccountDeleted,
    clearJustAccountDeleted,
  } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [formOpen, setFormOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);
  const [logoutSuccessOpen, setLogoutSuccessOpen] = useState(false);
  const [accountDeletedSuccessOpen, setAccountDeletedSuccessOpen] = useState(false);
  const sheetY = useRef(new Animated.Value(SHEET_CLOSED_Y)).current;
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const brandReveal = useRef(new Animated.Value(0)).current;

  const regVerification = useEmailVerification('register');
  const resetVerification = useEmailVerification('reset-password');

  useEffect(() => {
    if (!justLoggedOut) return;
    setLogoutSuccessOpen(true);
    clearJustLoggedOut();
  }, [justLoggedOut, clearJustLoggedOut]);

  useEffect(() => {
    if (!justAccountDeleted) return;
    setAccountDeletedSuccessOpen(true);
    clearJustAccountDeleted();
  }, [justAccountDeleted, clearJustAccountDeleted]);

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
  const [regTermsAgreed, setRegTermsAgreed] = useState(false);
  const [regTermsError, setRegTermsError] = useState<string | null>(null);
  const [registerLegalOpen, setRegisterLegalOpen] = useState<
    'terms' | 'privacy' | null
  >(null);

  // --- reset password state ---
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailStatus, setResetEmailStatus] = useState<FieldStatus>('idle');
  const [resetEmailMsg, setResetEmailMsg] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetConfirmStatus, setResetConfirmStatus] = useState<FieldStatus>('idle');
  const [resetConfirmMsg, setResetConfirmMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const resetRegisterForm = useCallback(() => {
    setRegEmail('');
    setRegEmailStatus('idle');
    setRegEmailMsg('');
    regVerification.reset();
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
    setRegTermsAgreed(false);
    setRegTermsError(null);
  }, [regVerification]);

  const resetResetForm = useCallback(() => {
    setResetEmail('');
    setResetEmailStatus('idle');
    setResetEmailMsg('');
    resetVerification.reset();
    setResetPasswordValue('');
    setResetPasswordError(null);
    setResetPasswordConfirm('');
    setResetConfirmStatus('idle');
    setResetConfirmMsg('');
    setResetLoading(false);
    setResetError(null);
    setResetDone(false);
  }, [resetVerification]);

  const [kakaoModalOpen, setKakaoModalOpen] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  const handleKakaoSuccess = useCallback(
    async (code: string, redirectUri: string) => {
      setKakaoLoading(true);
      setLoginError(null);
      setRegError(null);
      try {
        await loginWithKakao(code, redirectUri);
      } catch (e) {
        const msg = apiErrorMessage(e, '카카오 로그인에 실패했습니다.');
        if (mode === 'register') {
          setRegError(msg);
        } else {
          setLoginError(msg);
        }
      } finally {
        setKakaoLoading(false);
      }
    },
    [loginWithKakao, mode],
  );

  const handleKakaoFailure = useCallback(
    (err: Error) => {
      const msg = err.message || '카카오 로그인 중 오류가 발생했습니다.';
      if (mode === 'register') {
        setRegError(msg);
      } else {
        setLoginError(msg);
      }
    },
    [mode],
  );

  const handleKakaoPress = useCallback(() => {
    const clientId = getKakaoRestApiKey();
    if (!clientId) {
      Alert.alert(
        '설정 필요',
        '프론트엔드 .env 파일에 EXPO_PUBLIC_KAKAO_REST_API_KEY 환경변수 설정이 필요합니다. 설정법은 walkthrough.md 또는 대화를 참조해 주세요.',
      );
      return;
    }
    setKakaoModalOpen(true);
  }, []);

  const openForm = useCallback(
    (next: Mode) => {
      setMode(next);
      setFormOpen(true);
      sheetY.setValue(SHEET_CLOSED_Y);
      brandReveal.setValue(0);
      Animated.parallel([
        Animated.spring(sheetY, {
          toValue: 0,
          friction: 8,
          tension: 68,
          useNativeDriver: true,
        }),
        Animated.timing(welcomeOpacity, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(brandReveal, {
          toValue: 1,
          friction: 7,
          tension: 90,
          delay: 140,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [brandReveal, sheetY, welcomeOpacity],
  );

  const closeForm = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: SHEET_CLOSED_Y,
        duration: 340,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 300,
        delay: 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(brandReveal, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setFormOpen(false);
        setMode('login');
      }
    });
  }, [brandReveal, sheetY, welcomeOpacity]);

  const goToLogin = useCallback(
    (email?: string) => {
      resetResetForm();
      setLoginError(null);
      setLoginEmailError(null);
      setLoginPasswordError(null);
      if (email) setLoginEmail(email);
      setMode('login');
      if (!formOpen) {
        openForm('login');
      }
    },
    [formOpen, openForm, resetResetForm],
  );

  const handleEmailBlur = useCallback(() => {
    if (regEmailStatus === 'success') return;
    applyEmailFieldError(regEmail, setRegEmailStatus, setRegEmailMsg);
  }, [regEmail, regEmailStatus]);

  const handleResetEmailBlur = useCallback(() => {
    if (resetEmailStatus === 'success') return;
    applyEmailFieldError(resetEmail, setResetEmailStatus, setResetEmailMsg);
  }, [resetEmail, resetEmailStatus]);

  const handleRegEmailChange = useCallback(
    (text: string) => {
      setRegEmail(text);
      setRegEmailStatus('idle');
      setRegEmailMsg('');
      regVerification.clearVerificationState();
    },
    [regVerification],
  );

  const handleSendCode = useCallback(() => {
    return regVerification.handleSendCode(
      regEmail,
      setRegEmailStatus,
      setRegEmailMsg,
    );
  }, [regEmail, regVerification]);

  const handleVerifyCode = useCallback(() => {
    return regVerification.handleVerifyCode(regEmail);
  }, [regEmail, regVerification]);

  const handleResetEmailChange = useCallback(
    (text: string) => {
      setResetEmail(text);
      setResetEmailStatus('idle');
      setResetEmailMsg('');
      resetVerification.clearVerificationState();
      setResetDone(false);
    },
    [resetVerification],
  );

  const handleResetSendCode = useCallback(() => {
    return resetVerification.handleSendCode(
      resetEmail,
      setResetEmailStatus,
      setResetEmailMsg,
    );
  }, [resetEmail, resetVerification]);

  const handleResetVerifyCode = useCallback(() => {
    return resetVerification.handleVerifyCode(resetEmail);
  }, [resetEmail, resetVerification]);

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
    const codeErr = codeValidationError(resetVerification.verificationCode);
    if (!resetVerification.codeVerified) {
      resetVerification.setCodeStatus('error');
      resetVerification.setCodeMsg(codeErr ?? '이메일 인증을 완료해 주세요.');
      ok = false;
    } else if (codeErr) {
      resetVerification.setCodeStatus('error');
      resetVerification.setCodeMsg(codeErr);
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
    resetVerification,
    resetPasswordValue,
    resetPasswordConfirm,
  ]);

  const onResetSubmit = async () => {
    setResetError(null);
    if (!validateResetForm()) return;
    const trimmedEmail = resetEmail.trim().toLowerCase();
    setResetLoading(true);
    try {
      await resetPassword(
        trimmedEmail,
        resetVerification.verificationCode,
        resetPasswordValue,
      );
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
    setRegPasswordError(passwordValidationError(regPassword));
  }, [regPassword]);

  const handleResetPasswordBlur = useCallback(() => {
    setResetPasswordError(passwordValidationError(resetPasswordValue));
  }, [resetPasswordValue]);

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
    const codeErr = codeValidationError(regVerification.verificationCode);
    if (!regVerification.codeVerified) {
      regVerification.setCodeStatus('error');
      regVerification.setCodeMsg(codeErr ?? '이메일 인증을 완료해 주세요.');
      ok = false;
    } else if (codeErr) {
      regVerification.setCodeStatus('error');
      regVerification.setCodeMsg(codeErr);
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
    if (!regTermsAgreed) {
      setRegTermsError('이용약관 및 개인정보 처리방침에 동의해 주세요.');
      ok = false;
    } else {
      setRegTermsError(null);
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
    regVerification,
    regPassword,
    regPasswordConfirm,
    regNickname,
    nicknameStatus,
    regTermsAgreed,
  ]);

  const onLoginSubmit = async () => {
    setLoginError(null);
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
      setLoginError(
        apiErrorMessage(e, '로그인에 실패했습니다.') ??
          '로그인에 실패했습니다.',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const onRegisterSubmit = async () => {
    setRegError(null);
    if (!validateRegisterForm()) return;
    const trimmedEmail = regEmail.trim().toLowerCase();
    const trimmedNickname = regNickname.trim();
    setRegLoading(true);
    try {
      await register(
        trimmedEmail,
        regPassword,
        trimmedNickname,
        regVerification.verificationCode,
      );
    } catch (e) {
      const msg = apiErrorMessage(e, '회원가입에 실패했습니다.');
      if (msg) {
        setRegError(msg);
      } else {
        setRegError('세션이 만료되었습니다. 다시 시도해 주세요.');
      }
    } finally {
      setRegLoading(false);
    }
  };

  const formTitle =
    mode === 'login'
      ? '로그인'
      : mode === 'register'
        ? '회원가입'
        : '비밀번호 찾기';

  const renderFormBody = () => {
    if (mode === 'login') {
      return (
        <LoginSheet
          theme={theme}
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          loginEmailError={loginEmailError}
          setLoginEmailError={setLoginEmailError}
          loginPasswordError={loginPasswordError}
          setLoginPasswordError={setLoginPasswordError}
          loginError={loginError}
          setLoginError={setLoginError}
          loginLoading={loginLoading}
          onLoginSubmit={onLoginSubmit}
          onResetPassword={() => {
            resetResetForm();
            setMode('resetPassword');
          }}
          kakaoLoading={kakaoLoading}
          onKakaoPress={handleKakaoPress}
        />
      );
    }
    if (mode === 'resetPassword') {
      return (
        <ResetPasswordSheet
          theme={theme}
          resetDone={resetDone}
          resetEmail={resetEmail}
          onResetEmailChange={handleResetEmailChange}
          onResetEmailBlur={handleResetEmailBlur}
          resetEmailStatus={resetEmailStatus}
          resetEmailMsg={resetEmailMsg}
          resetSendingCode={resetVerification.sendingCode}
          resetSendCodeLabel={resetVerification.sendCodeLabel}
          resetCooldown={resetVerification.cooldown}
          resetCodeVerified={resetVerification.codeVerified}
          onResetSendCode={handleResetSendCode}
          resetCodeSent={resetVerification.codeSent}
          resetVerificationCode={resetVerification.verificationCode}
          setResetVerificationCode={resetVerification.setVerificationCode}
          resetCodeStatus={resetVerification.codeStatus}
          resetCodeMsg={resetVerification.codeMsg}
          setResetCodeStatus={resetVerification.setCodeStatus}
          setResetCodeMsg={resetVerification.setCodeMsg}
          resetVerifyingCode={resetVerification.verifyingCode}
          onResetVerifyCode={handleResetVerifyCode}
          resetPasswordValue={resetPasswordValue}
          setResetPasswordValue={setResetPasswordValue}
          setResetPasswordError={setResetPasswordError}
          onResetPasswordBlur={handleResetPasswordBlur}
          resetPasswordError={resetPasswordError}
          resetPasswordConfirm={resetPasswordConfirm}
          setResetPasswordConfirm={setResetPasswordConfirm}
          onResetConfirmBlur={handleResetConfirmBlur}
          resetConfirmStatus={resetConfirmStatus}
          resetConfirmMsg={resetConfirmMsg}
          setResetConfirmStatus={setResetConfirmStatus}
          setResetConfirmMsg={setResetConfirmMsg}
          resetError={resetError}
          resetLoading={resetLoading}
          onResetSubmit={onResetSubmit}
          onGoToLogin={goToLogin}
        />
      );
    }
    return (
      <RegisterSheet
        scrollRef={scrollRef}
        theme={theme}
        regEmail={regEmail}
        onRegEmailChange={handleRegEmailChange}
        onEmailBlur={handleEmailBlur}
        regEmailStatus={regEmailStatus}
        regEmailMsg={regEmailMsg}
        sendingCode={regVerification.sendingCode}
        sendCodeLabel={regVerification.sendCodeLabel}
        cooldown={regVerification.cooldown}
        codeVerified={regVerification.codeVerified}
        onSendCode={handleSendCode}
        codeSent={regVerification.codeSent}
        verificationCode={regVerification.verificationCode}
        setVerificationCode={regVerification.setVerificationCode}
        codeStatus={regVerification.codeStatus}
        codeMsg={regVerification.codeMsg}
        setCodeStatus={regVerification.setCodeStatus}
        setCodeMsg={regVerification.setCodeMsg}
        verifyingCode={regVerification.verifyingCode}
        onVerifyCode={handleVerifyCode}
        regPassword={regPassword}
        setRegPassword={setRegPassword}
        onRegPasswordBlur={handleRegPasswordBlur}
        regPasswordError={regPasswordError}
        setRegPasswordError={setRegPasswordError}
        regPasswordConfirm={regPasswordConfirm}
        setRegPasswordConfirm={setRegPasswordConfirm}
        onConfirmBlur={handleConfirmBlur}
        confirmStatus={confirmStatus}
        confirmMsg={confirmMsg}
        setConfirmStatus={setConfirmStatus}
        setConfirmMsg={setConfirmMsg}
        regNickname={regNickname}
        onNicknameChange={handleNicknameChange}
        nicknameStatus={nicknameStatus}
        nicknameMsg={nicknameMsg}
        regError={regError}
        regLoading={regLoading}
        termsAgreed={regTermsAgreed}
        onTermsAgreedChange={(v) => {
          setRegTermsAgreed(v);
          if (v) setRegTermsError(null);
        }}
        termsError={regTermsError}
        onOpenTerms={() => setRegisterLegalOpen('terms')}
        onOpenPrivacy={() => setRegisterLegalOpen('privacy')}
        onRegisterSubmit={onRegisterSubmit}
        kakaoLoading={kakaoLoading}
        onKakaoPress={handleKakaoPress}
      />
    );
  };

  const brandScale = brandReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });

  return (
    <Screen transparent noPadding edges={[]}>
      <StatusBar style="light" />
      <AuthWelcomeBackdrop />

      <Animated.View
        pointerEvents={formOpen ? 'none' : 'box-none'}
        style={[StyleSheet.absoluteFill, { opacity: welcomeOpacity }]}
      >
        <AuthWelcomeActions
          onLogin={() => openForm('login')}
          onRegister={() => {
            resetRegisterForm();
            openForm('register');
          }}
          style={{
            ...styles.welcomeCta,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        />
      </Animated.View>

      {formOpen ? (
        <Animated.View
          style={[
            styles.sheetHost,
            { transform: [{ translateY: sheetY }] },
          ]}
        >
          <GlassCard
            glow
            padding={0}
            style={{
              ...styles.sheetCard,
              backgroundColor: AUTH_SHEET_BG,
            }}
          >
            <Pressable onPress={closeForm} style={styles.sheetHandleHit}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.mutedForeground }]} />
            </Pressable>

            <View style={styles.sheetHeader}>
              {mode === 'resetPassword' && !resetDone ? (
                <Pressable onPress={() => goToLogin()} hitSlop={8} style={styles.sheetBack}>
                  <Text style={[styles.backLink, { color: theme.mutedForeground }]}>
                    ← 로그인으로
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={closeForm} hitSlop={8} style={styles.sheetBack}>
                  <Text style={[styles.backLink, { color: theme.mutedForeground }]}>
                    ← 돌아가기
                  </Text>
                </Pressable>
              )}

              <Animated.View
                style={{
                  opacity: brandReveal,
                  transform: [{ scale: brandScale }],
                }}
              >
                <View style={styles.sheetBrand}>
                  <AuthBrandHeader subtitle={formTitle} compact />
                </View>
              </Animated.View>

              {(mode === 'login' || mode === 'register') && (
                <View style={styles.tabRow}>
                  <AuthSegmentTabs
                    active={mode === 'register' ? 'register' : 'login'}
                    onLogin={() => {
                      setMode('login');
                      setLoginError(null);
                      setLoginEmailError(null);
                      setLoginPasswordError(null);
                    }}
                    onRegister={() => {
                      resetRegisterForm();
                      setMode('register');
                    }}
                  />
                </View>
              )}
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.sheetScroll}
              contentContainerStyle={[
                styles.sheetScrollContent,
                { paddingBottom: Math.max(insets.bottom, 12) + kbHeight + spacing.lg },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.formPanel,
                  {
                    borderColor: theme.cardBorder,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  },
                ]}
              >
                {renderFormBody()}
              </View>
            </ScrollView>
          </GlassCard>
        </Animated.View>
      ) : null}

      <LegalDocumentModal
        visible={registerLegalOpen === 'terms'}
        title="이용약관"
        content={TERMS_OF_SERVICE}
        onClose={() => setRegisterLegalOpen(null)}
      />
      <LegalDocumentModal
        visible={registerLegalOpen === 'privacy'}
        title="개인정보 처리방침"
        content={PRIVACY_POLICY}
        onClose={() => setRegisterLegalOpen(null)}
      />

      <AppAlertModal
        visible={logoutSuccessOpen}
        tone="success"
        title="로그아웃 되었습니다"
        message="다시 만나요. 밤하늘이 기다리고 있어요."
        primaryLabel="확인"
        autoDismissMs={2400}
        onPrimary={() => setLogoutSuccessOpen(false)}
        onRequestClose={() => setLogoutSuccessOpen(false)}
      />

      <AppAlertModal
        visible={accountDeletedSuccessOpen}
        tone="success"
        title="회원 탈퇴가 완료되었습니다"
        message="계정과 데이터가 삭제되었습니다. 이용해 주셔서 감사합니다."
        primaryLabel="확인"
        autoDismissMs={3200}
        onPrimary={() => setAccountDeletedSuccessOpen(false)}
        onRequestClose={() => setAccountDeletedSuccessOpen(false)}
      />

      <KakaoLoginWebViewModal
        visible={kakaoModalOpen}
        onClose={() => setKakaoModalOpen(false)}
        onSuccess={handleKakaoSuccess}
        onFailure={handleKakaoFailure}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcomeCta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    justifyContent: 'flex-end',
  },
  sheetHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WINDOW_HEIGHT * 0.94,
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  sheetCard: {
    flex: 1,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHeader: {
    paddingHorizontal: spacing.lg,
  },
  sheetHandleHit: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.45,
  },
  sheetBrand: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sheetBack: {
    marginBottom: spacing.xs,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  formPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
  },
  tabRow: {
    marginTop: spacing.sm,
  },
  backLink: {
    fontSize: 12,
    marginBottom: 4,
  },
});
