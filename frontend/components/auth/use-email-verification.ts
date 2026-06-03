import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiRequestError,
  sendVerificationCode,
  verifyCode,
} from '../../lib/api-client';
import {
  codeValidationError,
  emailValidationError,
  type FieldStatus,
} from './auth-validation';

export type VerificationPurpose = 'register' | 'reset-password';

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

export function useEmailVerification(purpose: VerificationPurpose) {
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [verificationCode, setVerificationCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeStatus, setCodeStatus] = useState<FieldStatus>('idle');
  const [codeMsg, setCodeMsg] = useState('');

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

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

  const clearVerificationState = useCallback(() => {
    setCodeSent(false);
    setCodeVerified(false);
    setVerifyingCode(false);
    setCodeStatus('idle');
    setCodeMsg('');
    setVerificationCode('');
  }, []);

  const reset = useCallback(() => {
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
  }, []);

  const handleSendCode = useCallback(
    async (
      email: string,
      setEmailStatus: (s: FieldStatus) => void,
      setEmailMsg: (m: string) => void,
    ) => {
      if (!applyEmailFieldError(email, setEmailStatus, setEmailMsg)) return;
      const trimmed = email.trim().toLowerCase();
      setSendingCode(true);
      try {
        await sendVerificationCode(trimmed, purpose);
        setCodeSent(true);
        setEmailStatus('success');
        setEmailMsg('인증번호가 발송되었습니다');
        startCooldown();
      } catch (e) {
        setEmailStatus('error');
        setEmailMsg(
          e instanceof ApiRequestError
            ? e.message
            : '인증번호 발송에 실패했습니다.',
        );
      } finally {
        setSendingCode(false);
      }
    },
    [purpose, startCooldown],
  );

  const handleVerifyCode = useCallback(
    async (email: string) => {
      const codeErr = codeValidationError(verificationCode);
      if (codeErr) {
        setCodeStatus('error');
        setCodeMsg(codeErr);
        return;
      }
      const trimmed = email.trim().toLowerCase();
      setVerifyingCode(true);
      setCodeStatus('checking');
      setCodeMsg('');
      try {
        const { verified } = await verifyCode(trimmed, verificationCode, purpose);
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
        setCodeMsg(
          e instanceof ApiRequestError
            ? e.message
            : '인증번호 확인에 실패했습니다.',
        );
      } finally {
        setVerifyingCode(false);
      }
    },
    [purpose, verificationCode],
  );

  const sendCodeLabel =
    cooldown > 0
      ? `재발송 (${cooldown}초)`
      : codeSent
        ? '재발송'
        : '인증번호 발송';

  return {
    codeSent,
    sendingCode,
    cooldown,
    verificationCode,
    setVerificationCode,
    codeVerified,
    verifyingCode,
    codeStatus,
    codeMsg,
    setCodeStatus,
    setCodeMsg,
    clearVerificationState,
    reset,
    handleSendCode,
    handleVerifyCode,
    sendCodeLabel,
  };
}
